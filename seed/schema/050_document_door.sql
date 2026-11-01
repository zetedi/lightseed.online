-- THE DOCUMENT DOOR (ring 2026-11-02): the helpers the document law stands on. firestore.rules
-- is translated collection by collection into rule functions (051); this file holds what every
-- rule shares — the stamps, the patch, the diff, and the authority questions the rules ask
-- (keepsCommunity, isTreeCarer, staffHand, …) as SQL mirrors with the same names and meanings.
-- Nothing here is callable by the runtime role directly: every helper is reached through the
-- door's own entry points (052), which run as the schema owner and never widen a read.

-- Two node-local ledgers the travel plan EXCLUDES (devices bind to this node; a hold has no
-- meaning elsewhere) live in the seed schema, never in public: the plan's "no table" law holds.
create table seed.push_subscriptions(uid text not null, id text not null, doc jsonb not null, primary key(uid,id));
alter table seed.push_subscriptions enable row level security;
revoke all on seed.push_subscriptions from public;
create table seed.bed_holds(bed_id text not null, id text not null, doc jsonb not null, primary key(bed_id,id));
alter table seed.bed_holds enable row level security;
revoke all on seed.bed_holds from public;

-- A moment as every document carries it: ISO-8601, UTC, microseconds (the cursor format).
create function seed.doc_stamp(moment timestamptz) returns jsonb language sql immutable set search_path=pg_catalog as $$
  select to_jsonb(to_char(moment at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
$$;
create function seed.doc_num(value jsonb, fallback numeric) returns numeric language sql immutable set search_path=pg_catalog as $$
  select case when jsonb_typeof(value)='number' then (value#>>'{}')::numeric else fallback end;
$$;
create function seed.doc_text(value jsonb, fallback text) returns text language sql immutable set search_path=pg_catalog as $$
  select case when jsonb_typeof(value)='string' then value#>>'{}' else fallback end;
$$;
create function seed.doc_bool(value jsonb, fallback boolean) returns boolean language sql immutable set search_path=pg_catalog as $$
  select case when jsonb_typeof(value)='boolean' then (value#>>'{}')::boolean else fallback end;
$$;
create function seed.doc_is_lid(value text) returns boolean language sql immutable set search_path=pg_catalog as $$
  select value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
$$;

-- {"$op":"serverTime"} anywhere inside an object becomes the moment; arrays are left as said.
create function seed.doc_resolve(value jsonb, moment timestamptz) returns jsonb language plpgsql immutable set search_path=pg_catalog as $$
declare result jsonb:='{}'::jsonb; item record;
begin
  if jsonb_typeof(value) is distinct from 'object' then return value; end if;
  if value->>'$op'='serverTime' then return seed.doc_stamp(moment); end if;
  if value ? '$op' then raise exception 'Invalid document value' using errcode='22023'; end if;
  for item in select key,val from jsonb_each(value) as e(key,val) loop
    result:=result || jsonb_build_object(item.key,seed.doc_resolve(item.val,moment));
  end loop;
  return result;
end;
$$;
-- Set a value at a path, growing the objects on the way (a dotted update may name a nested key).
create function seed.doc_set_path(doc jsonb, path text[], value jsonb) returns jsonb language plpgsql immutable set search_path=pg_catalog as $$
declare result jsonb:=coalesce(doc,'{}'::jsonb); i integer;
begin
  for i in 1..coalesce(array_length(path,1),0)-1 loop
    if jsonb_typeof(result #> path[1:i]) is distinct from 'object' then result:=jsonb_set(result,path[1:i],'{}'::jsonb,true); end if;
  end loop;
  return jsonb_set(result,path,value,true);
end;
$$;
create function seed.doc_array_union(current jsonb, additions jsonb) returns jsonb language plpgsql immutable set search_path=pg_catalog as $$
declare result jsonb:=case when jsonb_typeof(current)='array' then current else '[]'::jsonb end; item jsonb;
begin
  if jsonb_typeof(additions) is distinct from 'array' then raise exception 'Invalid array union' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(additions) loop
    if not result @> jsonb_build_array(item) then result:=result || jsonb_build_array(item); end if;
  end loop;
  return result;
end;
$$;
create function seed.doc_array_remove(current jsonb, removals jsonb) returns jsonb language sql immutable set search_path=pg_catalog as $$
  select coalesce((select jsonb_agg(e) from jsonb_array_elements(case when jsonb_typeof(current)='array' then current else '[]'::jsonb end) e
    where not (removals @> jsonb_build_array(e))),'[]'::jsonb);
$$;
-- THE PATCH: Firestore's update (dotted keys name nested fields, a map replaces) and its
-- set-with-merge (plain keys, maps merge deeply), with the sentinels as instructions.
create function seed.doc_patch(doc jsonb, patch jsonb, moment timestamptz, dotted boolean) returns jsonb language plpgsql immutable set search_path=pg_catalog as $$
declare result jsonb:=coalesce(doc,'{}'::jsonb); item record; path text[]; current jsonb; op text;
begin
  if jsonb_typeof(patch) is distinct from 'object' then raise exception 'Invalid patch' using errcode='22023'; end if;
  for item in select key,val from jsonb_each(patch) as e(key,val) loop
    path:=case when dotted then string_to_array(item.key,'.') else array[item.key] end;
    if exists(select 1 from unnest(path) p where p='' or p ~ '[[:cntrl:]]') then raise exception 'Invalid patch key' using errcode='22023'; end if;
    current:=result #> path;
    op:=case when jsonb_typeof(item.val)='object' then item.val->>'$op' end;
    if op='delete' then result:=result #- path;
    elsif op='serverTime' then result:=seed.doc_set_path(result,path,seed.doc_stamp(moment));
    elsif op='arrayUnion' then result:=seed.doc_set_path(result,path,seed.doc_array_union(current,item.val->'values'));
    elsif op='arrayRemove' then result:=seed.doc_set_path(result,path,seed.doc_array_remove(current,coalesce(item.val->'values','[]'::jsonb)));
    elsif op='increment' then result:=seed.doc_set_path(result,path,to_jsonb(seed.doc_num(current,0)+seed.doc_num(item.val->'by',0)));
    elsif op is not null then raise exception 'Unknown patch instruction' using errcode='22023';
    elsif not dotted and jsonb_typeof(item.val)='object' and jsonb_typeof(current)='object' then
      result:=seed.doc_set_path(result,path,seed.doc_patch(current,item.val,moment,false));
    else result:=seed.doc_set_path(result,path,seed.doc_resolve(item.val,moment));
    end if;
  end loop;
  return result;
end;
$$;
-- The top-level keys whose value changed — the rules' diff().affectedKeys().
create function seed.doc_changed(old_doc jsonb, new_doc jsonb) returns text[] language sql immutable set search_path=pg_catalog as $$
  select coalesce(array_agg(k order by k),'{}'::text[]) from (
    select key as k from jsonb_object_keys(coalesce(old_doc,'{}'::jsonb)) key
    union select key from jsonb_object_keys(coalesce(new_doc,'{}'::jsonb)) key) keys
  where (old_doc->k) is distinct from (new_doc->k);
$$;
-- hasOnly / hasAny over the changed keys.
create function seed.changed_only(changed text[], allowed text[]) returns boolean language sql immutable set search_path=pg_catalog as $$
  select coalesce(changed,'{}'::text[]) <@ allowed;
$$;
create function seed.changed_any(changed text[], keys text[]) returns boolean language sql immutable set search_path=pg_catalog as $$
  select coalesce(changed,'{}'::text[]) && keys;
$$;
-- A list a hand may only append ITSELF to (seenBy, vetoes, votes): new ⊇ old, new ⊆ old ∪ {me}, me ∈ new.
create function seed.uid_list_append(old_list jsonb, new_list jsonb, actor text) returns boolean language sql immutable set search_path=pg_catalog as $$
  select jsonb_typeof(new_list)='array' and coalesce(jsonb_typeof(old_list)='array',true)
    and new_list @> coalesce(old_list,'[]'::jsonb)
    and (coalesce(old_list,'[]'::jsonb) || jsonb_build_array(actor)) @> new_list
    and new_list @> jsonb_build_array(actor);
$$;
create function seed.doc_keys_only(doc jsonb, allowed text[]) returns boolean language sql immutable set search_path=pg_catalog as $$
  select jsonb_typeof(doc)='object' and not exists(select 1 from jsonb_object_keys(doc) k where not (k=any(allowed)));
$$;

-- ── The authority questions the rules ask, as SQL mirrors ────────────────────────────────
create function seed.is_superadmin() returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and exists(select 1 from public.config where id='superadmin' and jsonb_typeof(doc->'uid')='string' and doc->>'uid'=seed.uid());
$$;
revoke all on function seed.is_superadmin() from public;
-- A staff hand lent by name (domain/staffHands): staff, and the switch not turned off (absent = lent).
create function seed.staff_hand(hand text) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select seed.is_staff() and not exists(select 1 from public.config where id='staffHands' and doc->hand='false'::jsonb);
$$;
revoke all on function seed.staff_hand(text) from public;
create function seed.keeps_community(community_id text) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and community_id is not null and community_id<>'' and (
    exists(select 1 from public.communities where id=community_id and jsonb_typeof(doc->'anchorUid')='string' and doc->>'anchorUid'=seed.uid())
    or exists(select 1 from public.links where from_id=seed.uid() and rel='keeper' and to_id=community_id));
$$;
revoke all on function seed.keeps_community(text) from public;
-- The community's door keepers: its keepers and its linked stewards.
create function seed.is_community_keeper(community_id text) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select seed.keeps_community(community_id) or (seed.uid() is not null and community_id is not null and community_id<>''
    and exists(select 1 from public.links where from_id=seed.uid() and rel='steward' and to_id=community_id));
$$;
revoke all on function seed.is_community_keeper(text) from public;
create function seed.community_door(community_id text) returns text language sql stable security definer set search_path=pg_catalog as $$
  select coalesce((select coalesce(doc->>'door','invite') from public.communities where id=community_id),'closed');
$$;
revoke all on function seed.community_door(text) from public;
create function seed.invite_opens_door(invite_id text, community_id text, moment timestamptz) returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare invite jsonb;
begin
  if invite_id is null or invite_id='' or community_id is null then return false; end if;
  select doc into invite from public.community_invites where id=invite_id;
  if invite is null or invite->>'communityId' is distinct from community_id then return false; end if;
  if invite ? 'revokedAt' and invite->'revokedAt'<>'null'::jsonb then return false; end if;
  if invite ? 'expiresAt' and invite->'expiresAt'<>'null'::jsonb then
    begin if (invite->>'expiresAt')::timestamptz<=moment then return false; end if;
    exception when others then return false; end;
  end if;
  return seed.community_door(community_id)<>'closed';
end;
$$;
revoke all on function seed.invite_opens_door(text,text,timestamptz) from public;
-- CARERS of a tree: its keepers (anchor, keeper link, secret seat) and its stewards.
create function seed.is_tree_carer(tree_id text) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and tree_id is not null and tree_id<>'' and (
    exists(select 1 from public.lifetrees t where t.id=tree_id and seed.is_tree_keeper(t.id,t.doc))
    or exists(select 1 from public.links where from_id=seed.uid() and rel='steward' and to_id=tree_id));
$$;
revoke all on function seed.is_tree_carer(text) from public;
create function seed.is_tree_circle(tree_id text) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select seed.is_tree_carer(tree_id) or (seed.uid() is not null and tree_id is not null and tree_id<>''
    and exists(select 1 from public.links where from_id=seed.uid() and rel='observer' and to_id=tree_id));
$$;
revoke all on function seed.is_tree_circle(text) from public;
create function seed.is_kept_validated_tree(tree_id text) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select tree_id is not null and tree_id<>'' and exists(select 1 from public.lifetrees t where t.id=tree_id
    and seed.is_tree_keeper(t.id,t.doc) and t.doc->'validated'='true'::jsonb);
$$;
revoke all on function seed.is_kept_validated_tree(text) from public;
create function seed.open_to_guarding(tree_id text) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.lifetrees where id=tree_id and coalesce(doc->>'visibility','public')<>'private' and coalesce(doc->>'treeType','')<>'SECRET');
$$;
revoke all on function seed.open_to_guarding(text) from public;
create function seed.is_secret_tree(tree_id text) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.lifetrees where id=tree_id and doc->>'treeType'='SECRET');
$$;
revoke all on function seed.is_secret_tree(text) from public;
-- A record rooted in a sentinel is its own beginning, never a link on a chain (domain/bundle NON_CHAIN_ROOTS).
create function seed.is_chain_root(previous text) returns boolean language sql immutable set search_path=pg_catalog as $$
  select previous in ('0','PERSON_REACH','DECISION','EVENT','OFFERING','COMMUNITY_EVENT','WATER_ALERT','WATER_NOTICE','OFFER_NOTICE','LIGHT_HOUSE');
$$;
create function seed.is_chain_block(doc jsonb) returns boolean language sql immutable set search_path=pg_catalog as $$
  select coalesce(doc->>'hash','')<>'' and (coalesce(doc->>'lifetreeId','')<>'' or coalesce(doc->>'visionId','')<>''
    or (coalesce(doc->>'previousHash','')<>'' and not seed.is_chain_root(doc->>'previousHash')));
$$;
create function seed.is_covenant_party(covenant_id text) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and covenant_id is not null and covenant_id<>''
    and exists(select 1 from public.links where from_id=seed.uid() and rel='party' and to_id=covenant_id);
$$;
revoke all on function seed.is_covenant_party(text) from public;
create function seed.can_read_light_house(house jsonb) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select coalesce(house->>'visibility','community')='public' or (seed.uid() is not null and (
    coalesce(house->>'visibility','community')='node' or (jsonb_typeof(house->'anchorUid')='string' and house->>'anchorUid'=seed.uid())
    or seed.is_staff() or seed.pulse_community_member(house->>'communityId')));
$$;
revoke all on function seed.can_read_light_house(jsonb) from public;
-- BORN WITH AN ANCHOR: the signing hand's own uid (staff alone may plant for another); ownerId is refused.
create function seed.born_with_anchor(doc jsonb) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select jsonb_typeof(doc->'anchorUid')='string' and doc->>'anchorUid'<>'' and not (doc ? 'ownerId')
    and (seed.is_staff() or doc->>'anchorUid'=seed.uid());
$$;
revoke all on function seed.born_with_anchor(jsonb) from public;
create function seed.web_links_in_shape(doc jsonb) returns boolean language sql immutable set search_path=pg_catalog as $$
  select not (doc ? 'webLinks') or (jsonb_typeof(doc->'webLinks')='array' and jsonb_array_length(doc->'webLinks')<=12);
$$;
create function seed.papers_sound(doc jsonb) returns boolean language sql immutable set search_path=pg_catalog as $$
  select not (doc ? 'papers') or (jsonb_typeof(doc->'papers')='array' and jsonb_array_length(doc->'papers')<=24);
$$;
create function seed.real_place(doc jsonb) returns boolean language sql immutable set search_path=pg_catalog as $$
  select jsonb_typeof(doc->'latitude')='number' and (doc->>'latitude')::numeric between -90 and 90
    and jsonb_typeof(doc->'longitude')='number' and (doc->>'longitude')::numeric between -180 and 180;
$$;
-- THE SIGNING EPOCH: a signature counts only while the person's server-anchored CURRENT epoch is
-- active, the record names that very key and epoch, and its receipt moment is the server's.
create function seed.is_current_epoch_signature(person_id text, sig jsonb, moment timestamptz) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.persons p where p.id=person_id
    and seed.doc_num(sig->'version',0)=3 and sig->'recordedAt'=seed.doc_stamp(moment)
    and p.doc->>'signingState'='active'
    and jsonb_typeof(sig->'pubkey')='string' and p.doc->>'publicKeyPem'=sig->>'pubkey'
    and jsonb_typeof(sig->'keyFingerprint')='string' and p.doc->>'signingKeyFingerprint'=sig->>'keyFingerprint'
    and jsonb_typeof(sig->'epochId')='string' and p.doc->>'signingEpochId'=sig->>'epochId'
    and exists(select 1 from public.person_keys k where k.person_id=p.id and k.id=sig->>'keyFingerprint' and k.doc->>'pubkey'=sig->>'pubkey')
    and exists(select 1 from public.person_key_events e where e.person_id=p.id and e.id=sig->>'epochId'
      and e.doc->>'epochId'=sig->>'epochId' and e.doc->>'lid'=p.doc->>'lid' and e.doc->>'keyFingerprint'=sig->>'keyFingerprint'));
$$;
revoke all on function seed.is_current_epoch_signature(text,jsonb,timestamptz) from public;
-- The node's community cap (config/limits maxNodeCommunities, 144 by default; tree circles do not count).
create function seed.community_cap() returns numeric language sql stable security definer set search_path=pg_catalog as $$
  select coalesce((select floor((doc->>'maxNodeCommunities')::numeric) from public.config where id='limits'
    and doc->>'maxNodeCommunities' ~ '^[0-9]+(\.[0-9]+)?$' and (doc->>'maxNodeCommunities')::numeric>=1),144);
$$;
revoke all on function seed.community_cap() from public;

-- WHERE EACH COLLECTION LIVES: the one mapping from a collection's name to its soil. The five
-- loves subcollections share one table (the own-slot law is its key); subcollections carry
-- their parent in a column; two node-local ledgers live in the seed schema.
create function seed.doc_table(collection text) returns table(relation text, id_column text, parent_column text, fixed_kind text)
language sql immutable set search_path=pg_catalog as $$
  select relation,id_column,parent_column,fixed_kind from (values
    ('users','public.users','id',null,null),
    ('persons','public.persons','id',null,null),
    ('admins','public.admins','id',null,null),
    ('config','public.config','id',null,null),
    ('initiates','public.initiates','id',null,null),
    ('lifetrees','public.lifetrees','id',null,null),
    ('visions','public.visions','id',null,null),
    ('pulses','public.pulses','id',null,null),
    ('light_houses','public.light_houses','id',null,null),
    ('communities','public.communities','id',null,null),
    ('alignments','public.alignments','id',null,null),
    ('covenants','public.covenants','id',null,null),
    ('covenant_signatures','public.covenant_signatures','id','covenant_id',null),
    ('pulse_signatures','public.pulse_signatures','id','pulse_id',null),
    ('pulse_witnesses','public.pulse_witnesses','id','pulse_id',null),
    ('lifetree_loves','public.loves','uid','parent_id','lifetrees'),
    ('vision_loves','public.loves','uid','parent_id','visions'),
    ('pulse_loves','public.loves','uid','parent_id','pulses'),
    ('community_loves','public.loves','uid','parent_id','communities'),
    ('light_house_loves','public.loves','uid','parent_id','lightHouses'),
    ('lifetree_occupancy','public.lifetree_occupancy','id','lifetree_id',null),
    ('bed_holds','seed.bed_holds','id','bed_id',null),
    ('stays','public.stays','id',null,null),
    ('supports','public.supports','id',null,null),
    ('rays','public.rays','id',null,null),
    ('glow','public.glow','id',null,null),
    ('gifts','public.gifts','id',null,null),
    ('spends','public.spends','id',null,null),
    ('network_invites','public.network_invites','id',null,null),
    ('community_tree_invites','public.community_tree_invites','id',null,null),
    ('community_keeper_invites','public.community_keeper_invites','id',null,null),
    ('invite_requests','public.invite_requests','id',null,null),
    ('collabs','public.collabs','id',null,null),
    ('intelligences','public.intelligences','id',null,null),
    ('personas','public.personas','id',null,null),
    ('memories','public.memories','id',null,null),
    ('subscriptions','public.subscriptions','id',null,null),
    ('person_keys','public.person_keys','id','person_id',null),
    ('person_key_events','public.person_key_events','id','person_id',null),
    ('push_subscriptions','seed.push_subscriptions','id','uid',null)
  ) as t(name,relation,id_column,parent_column,fixed_kind) where name=collection;
$$;

-- The indexes the door's filters walk.
create index pulses_thread on public.pulses((doc->>'threadId'),id);
create index pulses_reach_tree on public.pulses((doc->>'reachTreeId'),id);
create index pulses_type_community on public.pulses((doc->>'type'),(doc->>'communityId'),id);
create index pulses_hash on public.pulses((doc->>'hash'));
create index light_houses_domain on public.light_houses((doc->>'domain'),id);
create index light_houses_community on public.light_houses((doc->>'communityId'),id);
create index light_houses_anchor on public.light_houses((doc->>'anchorUid'),id);
create index stays_host on public.stays((doc->>'hostUid'),id);
create index stays_guest on public.stays((doc->>'uid'),id);
create index stays_bed on public.stays((doc->>'bedId'),id);
create index rays_holder on public.rays((doc->>'holderUid'),id);
create index network_invites_email on public.network_invites((doc->>'email'),id);
create index network_invites_inviter on public.network_invites((doc->>'invitedByUserId'),id);
create index community_tree_invites_tree on public.community_tree_invites((doc->>'lifetreeId'),id);
create index community_tree_invites_invitee on public.community_tree_invites((doc->>'invitedUserId'),id);
create index intelligences_author on public.intelligences((doc->>'authorId'),id);
create index subscriptions_place on public.subscriptions((doc->>'domain'),id);
