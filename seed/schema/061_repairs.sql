-- THE LAST HANDS (ring 2026-11-03): the origin's one-time Firestore backfills grown on this soil as the
-- keeper's own audits and repairs — the same names, the same report shapes, the node's own law. The
-- soil's rules refuse a new record without its lid, its visibility or its chain; what these hands mend
-- is what ARRIVED otherwise: the crossing's legacy records, the records of a soil older than its rules.
-- Every repair is the keeper's alone (seed.is_superadmin), idempotent, and never touches a SEALED block
-- (a block carrying hashVersion: its type, its visibility, its lid and its matchId are canonical content,
-- BLOCK_CONTENT_FIELDS — rewriting them would break the seal the chain was minted with; the origin's
-- hands skipped those too, or predate the seals). The FACTS a repair needs a law for (a vision's genesis
-- sealed from its own birth moment, a lid minted from a record's birth, the alignment a sync block
-- names) are read here and applied here; the law runs in the API (seed/api/repairs.mjs) between.

create function seed.repair_gate() returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if seed.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not seed.is_superadmin() then raise exception 'Only the node''s keeper repairs the soil' using errcode='42501'; end if;
end;
$$;
revoke all on function seed.repair_gate() from public;

-- A block without a visibility is public, as the origin stamped it; sealed blocks are counted, not touched.
create function seed.repair_pulse_visibility() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare updated integer; sealed integer;
begin
  perform seed.repair_gate();
  select count(*) into sealed from public.pulses where doc->>'visibility' is null and doc ? 'hashVersion';
  update public.pulses set doc=doc||'{"visibility":"public"}'::jsonb where doc->>'visibility' is null and not (doc ? 'hashVersion');
  get diagnostics updated=row_count;
  return jsonb_build_object('updated',updated,'skippedSealed',sealed);
end;
$$;
revoke all on function seed.repair_pulse_visibility() from public;

-- The legacy casing of a block's type (GROWTH, growth, STANDARD) becomes the canonical token; sealed blocks counted.
create function seed.repair_pulse_type_casing() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare updated integer; sealed integer;
begin
  perform seed.repair_gate();
  select count(*) into sealed from public.pulses where doc->>'type' in ('GROWTH','growth','STANDARD') and doc ? 'hashVersion';
  update public.pulses set doc=doc||jsonb_build_object('type',case doc->>'type' when 'GROWTH' then 'tree_growth' when 'growth' then 'vision_growth' else 'standard' end)
    where doc->>'type' in ('GROWTH','growth','STANDARD') and not (doc ? 'hashVersion');
  get diagnostics updated=row_count;
  return jsonb_build_object('updated',updated,'skippedSealed',sealed);
end;
$$;
revoke all on function seed.repair_pulse_type_casing() from public;

-- A tree without a visibility is public, as the origin stamped it.
create function seed.repair_tree_visibility() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare updated integer;
begin
  perform seed.repair_gate();
  update public.lifetrees set doc=doc||'{"visibility":"public"}'::jsonb where coalesce(doc->>'visibility','')='';
  get diagnostics updated=row_count;
  return jsonb_build_object('updated',updated);
end;
$$;
revoke all on function seed.repair_tree_visibility() from public;

-- The visions without a chain, each with its birth moment (the law seals the genesis from it), and how many are chained.
create function seed.repair_vision_chains_due() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare due jsonb; chained integer;
begin
  perform seed.repair_gate();
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'createdAt',doc->>'createdAt') order by id),'[]'::jsonb) into due from public.visions where doc->>'genesisHash' is null;
  select count(*) into chained from public.visions where doc->>'genesisHash' is not null;
  return jsonb_build_object('due',due,'chained',chained);
end;
$$;
revoke all on function seed.repair_vision_chains_due() from public;

-- The twin awakens: a vision still without a chain gains its genesis, additive only, under its own row lock.
create function seed.repair_vision_chain(vision_id text, genesis_hash text) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
begin
  perform seed.repair_gate();
  if vision_id is null or length(vision_id) not between 1 and 512 or genesis_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid repair' using errcode='22023'; end if;
  perform 1 from public.visions where id=vision_id for update;
  update public.visions set doc=doc||jsonb_build_object('genesisHash',genesis_hash,'latestHash',genesis_hash,'blockHeight',0)
    where id=vision_id and doc->>'genesisHash' is null;
  return found;
end;
$$;
revoke all on function seed.repair_vision_chain(text,text) from public;

-- Every record of the six named kinds without a lid, with its birth moment (the law mints the lid from it);
-- a sealed block without a lid is counted and left (its lid would be canonical content it was sealed without).
create function seed.repair_lids_due() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare due jsonb; sealed integer;
begin
  perform seed.repair_gate();
  select coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.collection, r.id),'[]'::jsonb) into due from (
    select 'communities' as collection, id, doc->>'createdAt' as "createdAt" from public.communities where doc->>'lid' is null
    union all select 'lifetrees', id, doc->>'createdAt' from public.lifetrees where doc->>'lid' is null
    union all select 'visions', id, doc->>'createdAt' from public.visions where doc->>'lid' is null
    union all select 'pulses', id, doc->>'createdAt' from public.pulses where doc->>'lid' is null and not (doc ? 'hashVersion')
    union all select 'lightHouses', id, doc->>'createdAt' from public.light_houses where doc->>'lid' is null
    union all select 'persons', id, doc->>'createdAt' from public.persons where doc->>'lid' is null) r;
  select count(*) into sealed from public.pulses where doc->>'lid' is null and doc ? 'hashVersion';
  return jsonb_build_object('due',due,'skippedSealed',sealed);
end;
$$;
revoke all on function seed.repair_lids_due() from public;

-- A record still without a lid receives the one the law minted; the collection is one of the six, by name.
create function seed.repair_lid(collection_name text, record_id text, lid_value text) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
begin
  perform seed.repair_gate();
  if record_id is null or length(record_id) not between 1 and 512
    or lid_value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'Invalid repair' using errcode='22023'; end if;
  case collection_name
    when 'communities' then update public.communities set doc=doc||jsonb_build_object('lid',lid_value) where id=record_id and doc->>'lid' is null;
    when 'lifetrees' then update public.lifetrees set doc=doc||jsonb_build_object('lid',lid_value) where id=record_id and doc->>'lid' is null;
    when 'visions' then update public.visions set doc=doc||jsonb_build_object('lid',lid_value) where id=record_id and doc->>'lid' is null;
    when 'pulses' then update public.pulses set doc=doc||jsonb_build_object('lid',lid_value) where id=record_id and doc->>'lid' is null and not (doc ? 'hashVersion');
    when 'lightHouses' then update public.light_houses set doc=doc||jsonb_build_object('lid',lid_value) where id=record_id and doc->>'lid' is null;
    when 'persons' then update public.persons set doc=doc||jsonb_build_object('lid',lid_value) where id=record_id and doc->>'lid' is null;
    else raise exception 'Invalid repair' using errcode='22023';
  end case;
  return found;
end;
$$;
revoke all on function seed.repair_lid(text,text,text) from public;

-- The legacy sync blocks (isMatch) without a matchId, unsealed, with the tree and moment the law resolves by.
create function seed.repair_match_ids_due() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare due jsonb; sealed integer;
begin
  perform seed.repair_gate();
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'lifetreeId',doc->>'lifetreeId','createdAt',doc->>'createdAt') order by id),'[]'::jsonb) into due
    from public.pulses where doc->>'isMatch'='true' and doc->>'matchId' is null and not (doc ? 'hashVersion');
  select count(*) into sealed from public.pulses where doc->>'isMatch'='true' and doc->>'matchId' is null and doc ? 'hashVersion';
  return jsonb_build_object('due',due,'skippedSealed',sealed);
end;
$$;
revoke all on function seed.repair_match_ids_due() from public;

-- A tree's alignments on either side, as the match law reads them.
create function seed.repair_alignments_of_tree(tree_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare found_rows jsonb;
begin
  perform seed.repair_gate();
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',doc->>'status','createdAt',doc->>'createdAt') order by id),'[]'::jsonb) into found_rows
    from public.alignments where doc->>'initiatorTreeId'=tree_id or doc->>'targetTreeId'=tree_id;
  return found_rows;
end;
$$;
revoke all on function seed.repair_alignments_of_tree(text) from public;

-- A sync block still without a matchId is stamped with the alignment the law named, if that alignment stands.
create function seed.repair_match_id(pulse_id text, alignment_id text) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
begin
  perform seed.repair_gate();
  if pulse_id is null or alignment_id is null or length(pulse_id) not between 1 and 512 or length(alignment_id) not between 1 and 512 then raise exception 'Invalid repair' using errcode='22023'; end if;
  if not exists(select 1 from public.alignments where id=alignment_id) then return false; end if;
  update public.pulses set doc=doc||jsonb_build_object('matchId',alignment_id)
    where id=pulse_id and doc->>'isMatch'='true' and doc->>'matchId' is null and not (doc ? 'hashVersion');
  return found;
end;
$$;
revoke all on function seed.repair_match_id(text,text) from public;

-- The audit of true names: on this soil the index IS the records, so nothing is written and nothing can
-- disagree; what can be wrong is a record without a name, and ONE TRUE NAME ON TWO BEINGS.
create function seed.repair_lid_index() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare nameless integer; twins jsonb;
begin
  perform seed.repair_gate();
  with named as (
    select 'users' as collection, id, doc->>'lid' as lid from public.users
    union all select 'lifetrees', id, doc->>'lid' from public.lifetrees
    union all select 'visions', id, doc->>'lid' from public.visions
    union all select 'lightHouses', id, doc->>'lid' from public.light_houses
    union all select 'communities', id, doc->>'lid' from public.communities
    union all select 'pulses', id, doc->>'lid' from public.pulses)
  select count(*) filter (where lid is null) into nameless from named;
  with named as (
    select 'users' as collection, id, doc->>'lid' as lid from public.users
    union all select 'lifetrees', id, doc->>'lid' from public.lifetrees
    union all select 'visions', id, doc->>'lid' from public.visions
    union all select 'lightHouses', id, doc->>'lid' from public.light_houses
    union all select 'communities', id, doc->>'lid' from public.communities
    union all select 'pulses', id, doc->>'lid' from public.pulses)
  select coalesce(jsonb_agg(jsonb_build_object('lid',lid,'addresses',addresses) order by lid),'[]'::jsonb) into twins
    from (select lid, jsonb_agg(collection||'/'||id order by collection, id) as addresses from named where lid is not null group by lid having count(*)>1) t;
  return jsonb_build_object('nameless',nameless,'twins',twins);
end;
$$;
revoke all on function seed.repair_lid_index() from public;
