-- THE ORGANS (ring 2026-11-02): the server hands functions/src/index.ts kept for the origin node,
-- grown on the independent node as context/apply pairs the trusted API drives — the API reads
-- facts under locks (context), asks the pure law from the shared domain bundle, and the apply
-- function stores what the law allowed. Nothing here trusts a claim: identity is seed.uid(),
-- standing is read from the records, amounts are the law's, moments are the server's.

-- ── LIGHT: the witnessed care kindles ───────────────────────────────────────────────────────
-- Facts for judgeWitness (domain/light): the watering, the witness's standing (the earliest circle
-- seat they hold on the tree, or the tree's birth for its anchor), the tree, the day's rays.
create function seed.witness_context(pulse_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); pulse jsonb; tree jsonb; tree_id text; since timestamptz; moment timestamptz; day_key text;
  carer_exists boolean:=false; witness_exists boolean:=false; place text;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if pulse_id is null or length(pulse_id) not between 1 and 512 or pulse_id ~ '[[:cntrl:]]' then raise exception 'Invalid pulse' using errcode='22023'; end if;
  select doc into pulse from public.pulses where id=pulse_id for update;
  if pulse is null then return jsonb_build_object('exists',false); end if;
  tree_id:=pulse->>'lifetreeId';
  if tree_id is not null and tree_id<>'' then
    select doc into tree from public.lifetrees where id=tree_id for update;
    select min(created_at) into since from public.links where from_id=actor and to_id=tree_id and rel in ('guardian','keeper','steward');
    if exists(select 1 from public.secret_links where from_id=actor and to_id=tree_id and rel='keeper') then
      since:=least(since,(select min(created_at) from public.secret_links where from_id=actor and to_id=tree_id and rel='keeper')); end if;
    if tree is not null and jsonb_typeof(tree->'anchorUid')='string' and tree->>'anchorUid'=actor then since:=least(since,seed.vision_moment(tree)); end if;
    if tree is not null then
      place:=case when jsonb_typeof(tree->'communityId')='string' and tree->>'communityId'<>'' then tree->>'communityId'
        else (select id from public.communities where doc->>'domain'=lower(regexp_replace(coalesce(tree->>'domain',''),'^www\.','')) order by seed.vision_moment(doc),id limit 1) end;
    end if;
  end if;
  moment:=seed.vision_moment(pulse);
  if moment>'1970-01-01T00:00:00Z'::timestamptz then
    day_key:=to_char(moment at time zone 'UTC','YYYY-MM-DD');
    perform 1 from public.rays where id in (tree_id || '__' || day_key || '__carer', tree_id || '__' || day_key || '__witness') order by id for update;
    carer_exists:=exists(select 1 from public.rays where id=tree_id || '__' || day_key || '__carer');
    witness_exists:=exists(select 1 from public.rays where id=tree_id || '__' || day_key || '__witness');
  end if;
  return jsonb_build_object('exists',true,'pulse',pulse,'tree',tree,'treeId',tree_id,'witnessSince',case when since is null then null else seed.doc_stamp(since) end,
    'createdAt',case when moment>'1970-01-01T00:00:00Z'::timestamptz then seed.doc_stamp(moment) else null end,
    'communityId',place,'carerRayExists',carer_exists,'witnessRayExists',witness_exists);
end;
$$;
revoke all on function seed.witness_context(text) from public;

-- The kindle, atomic: the confirmation on the watering and the rays born with their deterministic ids.
create function seed.apply_witness(pulse_id text, rays jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); pulse jsonb; ray jsonb; moment timestamptz:=now(); kindled integer:=0;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select doc into pulse from public.pulses where id=pulse_id for update;
  if pulse is null or pulse->>'care' is distinct from 'watering' then raise exception 'Not a watering' using errcode='LS050'; end if;
  if pulse->>'wateringConfirmedBy'='guardian' then raise exception 'Already witnessed' using errcode='LS051'; end if;
  if jsonb_typeof(rays) is distinct from 'array' or jsonb_array_length(rays)>2 then raise exception 'Invalid rays' using errcode='22023'; end if;
  pulse:=pulse || jsonb_build_object('wateringConfirmedBy','guardian',
    'wateringConfirmation',coalesce(pulse->'wateringConfirmation','{}'::jsonb) || jsonb_build_object('confirmedByUid',actor,'confirmedAt',seed.doc_stamp(moment)));
  update public.pulses set doc=pulse where id=pulse_id;
  for ray in select value from jsonb_array_elements(rays) loop
    if jsonb_typeof(ray->'id') is distinct from 'string' or length(ray->>'id')>600 or ray->>'id' !~ '^[A-Za-z0-9_-]+__[0-9]{4}-[0-9]{2}-[0-9]{2}__(carer|witness)$'
      or jsonb_typeof(ray->'units') is distinct from 'number' or (ray->>'units')::numeric<=0
      or jsonb_typeof(ray->'holderUid') is distinct from 'string' or ray->>'pulseId' is distinct from pulse_id then raise exception 'Invalid ray' using errcode='22023'; end if;
    insert into public.rays(id,doc) values(ray->>'id',(ray-'id') || jsonb_build_object('kindledAt',seed.doc_stamp(moment),'createdAt',seed.doc_stamp(moment)))
      on conflict(id) do nothing;
    if found then kindled:=kindled+1; end if;
  end loop;
  return jsonb_build_object('kindled',kindled);
end;
$$;
revoke all on function seed.apply_witness(text,jsonb) from public;

-- ── LIGHT: appreciation and the spend (domain/spend) ────────────────────────────────────────
-- The place a being stands in: the community it names, else the one rooted at its domain.
create function seed.place_of(being jsonb) returns text language sql stable security definer set search_path=pg_catalog as $$
  select case when jsonb_typeof(being->'communityId')='string' and being->>'communityId'<>'' then being->>'communityId'
    when coalesce(being->>'domain','')='' then null
    else (select c.id from public.communities c where c.doc->>'domain'=lower(regexp_replace(being->>'domain','^www\.',''))
      or (jsonb_typeof(c.doc->'domainAliases')='array' and c.doc->'domainAliases' @> to_jsonb(lower(regexp_replace(being->>'domain','^www\.',''))))
      order by seed.vision_moment(c.doc),c.id limit 1) end;
$$;
revoke all on function seed.place_of(jsonb) from public;

create function seed.appreciation_context(offering_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); offering jsonb; place text; accepts jsonb; held jsonb; given boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if offering_id is null or length(offering_id) not between 1 and 512 or offering_id ~ '[[:cntrl:]]' then raise exception 'Invalid offering' using errcode='22023'; end if;
  select doc into offering from public.pulses where id=offering_id for update;
  place:=case when offering is null then null else seed.place_of(offering) end;
  accepts:=coalesce((select jsonb_agg(to_id) from public.links where from_id=place and rel='accepts_coin_of'),'[]'::jsonb);
  perform 1 from public.rays where doc->>'holderUid'=actor order by id for update;
  held:=coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'units',r.doc->'units','dayKey',r.doc->>'dayKey',
    'place',case when jsonb_typeof(r.doc->'communityId')='string' and r.doc->>'communityId'<>'' then r.doc->>'communityId'
      else (select seed.place_of(t.doc) from public.lifetrees t where t.id=r.doc->>'treeId') end) order by r.id) from public.rays r where r.doc->>'holderUid'=actor),'[]'::jsonb);
  perform 1 from public.gifts where id=offering_id || '__' || actor for update;
  given:=found;
  return jsonb_build_object('exists',offering is not null,'offering',offering,'place',place,'acceptsPlaces',accepts,'rays',held,'alreadyGiven',given);
end;
$$;
revoke all on function seed.appreciation_context(text) from public;

create function seed.apply_appreciation(offering_id text, gift jsonb, takes jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); take jsonb; moment timestamptz:=now(); glow_home text; glow_units numeric; suspended numeric; units numeric;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(gift) is distinct from 'object' or jsonb_typeof(takes) is distinct from 'array' or gift->>'giverUid' is distinct from actor
    or gift->>'offeringId' is distinct from offering_id or jsonb_typeof(gift->'units') is distinct from 'number'
    or jsonb_typeof(gift->'glow') is distinct from 'number' or jsonb_typeof(gift->'suspended') is distinct from 'number'
    or jsonb_typeof(gift->'glowHome') is distinct from 'string' then raise exception 'Invalid gift' using errcode='22023'; end if;
  units:=(gift->>'units')::numeric; glow_units:=(gift->>'glow')::numeric; suspended:=(gift->>'suspended')::numeric; glow_home:=gift->>'glowHome';
  if glow_units+suspended<>units or units<=0 then raise exception 'Light not conserved' using errcode='22023'; end if;
  if exists(select 1 from public.gifts where id=offering_id || '__' || actor) then raise exception 'Already appreciated' using errcode='LS052'; end if;
  if (select coalesce(sum((t->>'units')::numeric),0) from jsonb_array_elements(takes) t)<>units then raise exception 'Light not conserved' using errcode='22023'; end if;
  for take in select value from jsonb_array_elements(takes) loop
    update public.rays set doc=doc || jsonb_build_object('units',seed.doc_num(doc->'units',0)-(take->>'units')::numeric,'givenAt',seed.doc_stamp(moment))
      where id=take->>'id' and doc->>'holderUid'=actor and seed.doc_num(doc->'units',0)>=(take->>'units')::numeric;
    if not found then raise exception 'Ray moved' using errcode='LS053'; end if;
  end loop;
  insert into public.gifts(id,doc) values(offering_id || '__' || actor,gift || jsonb_build_object('rays',takes,'createdAt',seed.doc_stamp(moment)));
  if glow_units>0 then
    insert into public.glow(id,doc) values(glow_home,jsonb_build_object('units',glow_units,'updatedAt',seed.doc_stamp(moment)))
      on conflict(id) do update set doc=public.glow.doc || jsonb_build_object('units',seed.doc_num(public.glow.doc->'units',0)+glow_units,'updatedAt',seed.doc_stamp(moment));
  end if;
  update public.pulses set doc=doc || jsonb_build_object('offeringSuspendedLight',seed.doc_num(doc->'offeringSuspendedLight',0)+suspended,
    'offeringAppreciations',seed.doc_num(doc->'offeringAppreciations',0)+1,'updatedAt',seed.doc_stamp(moment)) where id=offering_id;
  return jsonb_build_object('units',units,'glow',glow_units,'suspended',suspended);
end;
$$;
revoke all on function seed.apply_appreciation(text,jsonb,jsonb) from public;

-- The seal re-verified on server ground: every signer's facts (persons, lineage, epochs, standing).
create function seed.spend_context(decision_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); decision jsonb; community_id text; offering jsonb; offering_id text; place text; accepts jsonb;
  signatures jsonb; signers jsonb; glow_units numeric:=0; spent boolean; stands boolean:=false;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if decision_id is null or length(decision_id) not between 1 and 512 or decision_id ~ '[[:cntrl:]]' then raise exception 'Invalid decision' using errcode='22023'; end if;
  select doc into decision from public.pulses where id=decision_id for update;
  community_id:=coalesce(decision->>'communityId','');
  offering_id:=coalesce(decision->'spend'->>'offeringId','');
  if offering_id<>'' then select doc into offering from public.pulses where id=offering_id for update; end if;
  place:=case when offering is null then null else seed.place_of(offering) end;
  accepts:=coalesce((select jsonb_agg(to_id) from public.links where from_id=place and rel='accepts_coin_of'),'[]'::jsonb);
  signatures:=coalesce((select jsonb_agg(doc || jsonb_build_object('uid',id) order by id) from public.pulse_signatures where pulse_id=decision_id),'[]'::jsonb);
  signers:=coalesce((select jsonb_object_agg(s.id,jsonb_build_object(
      'publicKeyPem',coalesce(p.doc->>'publicKeyPem',''),'currentFingerprint',coalesce(p.doc->>'signingKeyFingerprint',''),'lid',coalesce(p.doc->>'lid',''),
      'keys',coalesce((select jsonb_object_agg(k.id,k.doc->>'pubkey') from public.person_keys k where k.person_id=s.id),'{}'::jsonb),
      'events',coalesce((select jsonb_agg(e.doc || jsonb_build_object('eventId',e.id)) from public.person_key_events e where e.person_id=s.id),'[]'::jsonb),
      'member',exists(select 1 from public.links where from_id=s.id and rel='member' and to_id=community_id)
        or exists(select 1 from public.communities c where c.id=community_id and c.doc->>'anchorUid'=s.id)))
    from public.pulse_signatures s left join public.persons p on p.id=s.id where s.pulse_id=decision_id),'{}'::jsonb);
  if community_id<>'' then
    perform 1 from public.glow where id=community_id for update;
    glow_units:=coalesce((select seed.doc_num(doc->'units',0) from public.glow where id=community_id),0);
    stands:=decision->>'proposedBy'=actor or seed.keeps_community(community_id);
  end if;
  perform 1 from public.spends where id=decision_id for update;
  spent:=found;
  return jsonb_build_object('exists',decision is not null,'decision',decision,'communityId',community_id,'offering',offering,'offeringId',offering_id,
    'place',place,'acceptsPlaces',accepts,'signatures',signatures,'signers',signers,'glowUnits',glow_units,'alreadySpent',spent,'callerStands',stands);
end;
$$;
revoke all on function seed.spend_context(text) from public;

create function seed.apply_spend(decision_id text, spend jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); moment timestamptz:=now(); community_id text; glow_home text; units numeric; glow_units numeric; suspended numeric; offering_id text;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(spend) is distinct from 'object' or spend->>'decisionId' is distinct from decision_id or spend->>'spentBy' is distinct from actor
    or jsonb_typeof(spend->'units') is distinct from 'number' or jsonb_typeof(spend->'glow') is distinct from 'number' or jsonb_typeof(spend->'suspended') is distinct from 'number'
    or jsonb_typeof(spend->'communityId') is distinct from 'string' or jsonb_typeof(spend->'offeringId') is distinct from 'string' or jsonb_typeof(spend->'glowHome') is distinct from 'string'
    then raise exception 'Invalid spend' using errcode='22023'; end if;
  community_id:=spend->>'communityId'; offering_id:=spend->>'offeringId'; glow_home:=spend->>'glowHome';
  units:=(spend->>'units')::numeric; glow_units:=(spend->>'glow')::numeric; suspended:=(spend->>'suspended')::numeric;
  if glow_units+suspended<>units or units<=0 then raise exception 'Light not conserved' using errcode='22023'; end if;
  if exists(select 1 from public.spends where id=decision_id) then raise exception 'Already spent' using errcode='LS054'; end if;
  update public.glow set doc=doc || jsonb_build_object('units',seed.doc_num(doc->'units',0)-units,'updatedAt',seed.doc_stamp(moment))
    where id=community_id and seed.doc_num(doc->'units',0)>=units;
  if not found then raise exception 'Glow short' using errcode='LS055'; end if;
  if glow_units>0 then
    insert into public.glow(id,doc) values(glow_home,jsonb_build_object('units',glow_units,'updatedAt',seed.doc_stamp(moment)))
      on conflict(id) do update set doc=public.glow.doc || jsonb_build_object('units',seed.doc_num(public.glow.doc->'units',0)+glow_units,'updatedAt',seed.doc_stamp(moment));
  end if;
  insert into public.spends(id,doc) values(decision_id,spend || jsonb_build_object('createdAt',seed.doc_stamp(moment)));
  update public.pulses set doc=doc || jsonb_build_object('offeringSuspendedLight',seed.doc_num(doc->'offeringSuspendedLight',0)+suspended,
    'offeringAppreciations',seed.doc_num(doc->'offeringAppreciations',0)+1,'updatedAt',seed.doc_stamp(moment)) where id=offering_id;
  update public.pulses set doc=doc || jsonb_build_object('spentAt',seed.doc_stamp(moment),'spentBy',actor,'spendId',decision_id) where id=decision_id;
  return jsonb_build_object('units',units,'glow',glow_units,'suspended',suspended);
end;
$$;
revoke all on function seed.apply_spend(text,jsonb) from public;

-- RESET LIGHT — the testing-phase restart, the node's keeper alone: every ray and every glow.
create function seed.reset_light() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare rays_count bigint; rays_units numeric; glow_count bigint; glow_units numeric;
begin
  if not seed.is_superadmin() then raise exception 'Only the node''s keeper may reset the light' using errcode='42501'; end if;
  select count(*),coalesce(sum(seed.doc_num(doc->'units',0)),0) into rays_count,rays_units from public.rays;
  select count(*),coalesce(sum(seed.doc_num(doc->'units',0)),0) into glow_count,glow_units from public.glow;
  delete from public.rays; delete from public.glow;
  return jsonb_build_object('rays',rays_count,'rayUnits',rays_units,'glowHomes',glow_count,'glowUnits',glow_units);
end;
$$;
revoke all on function seed.reset_light() from public;

-- ── THE UNMINT: the newest link taken back, its touch lifted ────────────────────────────────
create function seed.unmint_context(pulse_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); pulse jsonb; tree jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if pulse_id is null or length(pulse_id) not between 1 and 512 or pulse_id ~ '[[:cntrl:]]' then raise exception 'Invalid pulse' using errcode='22023'; end if;
  select doc into pulse from public.pulses where id=pulse_id for update;
  if pulse is not null and jsonb_typeof(pulse->'lifetreeId')='string' then select doc into tree from public.lifetrees where id=pulse->>'lifetreeId' for update; end if;
  return jsonb_build_object('exists',pulse is not null,'pulse',pulse,'tree',tree,'isStaff',seed.is_staff());
end;
$$;
revoke all on function seed.unmint_context(text) from public;

create function seed.apply_unmint(pulse_id text, lifted jsonb, cleared text[]) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare pulse jsonb; tree jsonb; tree_id text; latest text; height numeric; item record; path text; moment timestamptz:=now();
begin
  if seed.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select doc into pulse from public.pulses where id=pulse_id for update;
  if pulse is null or jsonb_typeof(pulse->'lifetreeId') is distinct from 'string' then raise exception 'Not a mint' using errcode='LS056'; end if;
  tree_id:=pulse->>'lifetreeId';
  select doc into tree from public.lifetrees where id=tree_id for update;
  if tree is null or tree->>'latestHash' is distinct from pulse->>'hash' then raise exception 'Not the head' using errcode='LS057'; end if;
  latest:=coalesce(pulse->>'previousHash',''); height:=greatest(0,coalesce(seed.doc_num(tree->'blockHeight',1),1)-1);
  tree:=tree || jsonb_build_object('latestHash',latest,'blockHeight',height,'updatedAt',seed.doc_stamp(moment));
  if jsonb_typeof(lifted)='object' then
    for item in select key,val from jsonb_each(lifted) as e(key,val) loop
      tree:=seed.doc_set_path(tree,string_to_array(item.key,'.'),item.val);
    end loop;
  end if;
  foreach path in array coalesce(cleared,'{}'::text[]) loop tree:=tree #- string_to_array(path,'.'); end loop;
  delete from public.pulses where id=pulse_id;
  update public.lifetrees set doc=tree where id=tree_id;
  return jsonb_build_object('latestHash',latest,'blockHeight',height);
end;
$$;
revoke all on function seed.apply_unmint(text,jsonb,text[]) from public;

-- ── STAFF: the keeper's roster, and the keeper's own appointment (the installation's hand) ──
create function seed.staff_command(command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); action text:=command->>'action'; target text:=command->>'uid';
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or coalesce(action,'') not in ('grant_admin','revoke_admin')
    or target is null or length(target) not between 1 and 128 or target ~ '[[:space:][:cntrl:]]' then raise exception 'Invalid command' using errcode='22023'; end if;
  if not seed.is_superadmin() then raise exception 'Only the node''s keeper lends staff hands' using errcode='42501'; end if;
  if action='grant_admin' then
    if not exists(select 1 from public.persons where id=target) then raise exception 'Person missing' using errcode='LS058'; end if;
    insert into public.admins(id,doc) values(target,jsonb_build_object('grantedAt',seed.doc_stamp(now()),'grantedBy',actor)) on conflict(id) do nothing;
  else delete from public.admins where id=target; end if;
  return jsonb_build_object('uid',target,'admin',action='grant_admin');
end;
$$;
revoke all on function seed.staff_command(jsonb) from public;
-- The first keeper is appointed by the installation (seed:keeper, the owner's hand), never claimed:
-- config/superadmin is written once; a second appointment must be a deliberate replacement.
create function seed.appoint_keeper(keeper_uid text, replace_existing boolean) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare standing jsonb;
begin
  if keeper_uid is null or length(keeper_uid) not between 1 and 128 or keeper_uid ~ '[[:space:][:cntrl:]]' then raise exception 'Invalid keeper' using errcode='22023'; end if;
  select doc into standing from public.config where id='superadmin' for update;
  if standing is not null and not replace_existing then raise exception 'A keeper already stands' using errcode='LS059'; end if;
  insert into public.config(id,doc) values('superadmin',jsonb_build_object('uid',keeper_uid,'claimedAt',seed.doc_stamp(now())))
    on conflict(id) do update set doc=excluded.doc;
  update public.users set doc=doc || jsonb_build_object('invitesRemaining',greatest(144,seed.doc_num(doc->'invitesRemaining',0))) where id=keeper_uid;
  return jsonb_build_object('uid',keeper_uid);
end;
$$;
revoke all on function seed.appoint_keeper(text,boolean) from public;

-- ── THE ACCOUNT'S DEPARTURE: the last spend, then the record, in order ──────────────────────
create function seed.delete_account(target text, heir text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); super boolean; ray record; release_glow numeric; to_heir numeric; rays_count bigint:=0; units_heir numeric:=0; units_glow numeric:=0;
  glow_home text; moment timestamptz:=now(); counts jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if target is null or length(target) not between 1 and 128 or target ~ '[[:space:][:cntrl:]]' then raise exception 'Invalid account' using errcode='22023'; end if;
  super:=seed.is_superadmin();
  if target<>actor then
    if not seed.is_staff() then raise exception 'Staff only' using errcode='42501'; end if;
    if exists(select 1 from public.config where id='superadmin' and doc->>'uid'=target) and not super then raise exception 'The node''s keeper cannot be deleted' using errcode='42501'; end if;
    if exists(select 1 from public.admins where id=target) and not super then raise exception 'Only the node''s keeper can delete an admin' using errcode='42501'; end if;
    heir:=null;
  elsif heir is not null then
    if heir=target or not exists(select 1 from public.persons where id=heir) then raise exception 'Heir missing' using errcode='LS058'; end if;
  end if;
  -- The light first (releaseRay, domain/light): to the heir through the prism, else dissolved into its place.
  for ray in select id,doc from public.rays where doc->>'holderUid'=target order by id for update loop
    rays_count:=rays_count+1;
    glow_home:=coalesce(nullif(ray.doc->>'communityId',''),'NODE');
    if heir is null then release_glow:=greatest(0,floor(seed.doc_num(ray.doc->'units',0))); to_heir:=0;
    else release_glow:=floor(greatest(0,floor(seed.doc_num(ray.doc->'units',0)))/7); to_heir:=greatest(0,floor(seed.doc_num(ray.doc->'units',0)))-release_glow; end if;
    if release_glow>0 then
      units_glow:=units_glow+release_glow;
      insert into public.glow(id,doc) values(glow_home,jsonb_build_object('units',release_glow,'updatedAt',seed.doc_stamp(moment)))
        on conflict(id) do update set doc=public.glow.doc || jsonb_build_object('units',seed.doc_num(public.glow.doc->'units',0)+release_glow,'updatedAt',seed.doc_stamp(moment));
    end if;
    if heir is not null and to_heir>0 then
      units_heir:=units_heir+to_heir;
      update public.rays set doc=doc || jsonb_build_object('holderUid',heir,'units',to_heir,'inheritedAt',seed.doc_stamp(moment))
        || case when ray.doc->>'sourceUid'=target then jsonb_build_object('sourceUid','departed') else '{}'::jsonb end where id=ray.id;
    else delete from public.rays where id=ray.id; end if;
  end loop;
  update public.rays set doc=doc || jsonb_build_object('sourceUid','departed') where doc->>'sourceUid'=target;
  with trees as (delete from public.lifetrees where doc->>'anchorUid'=target returning 1),
    pulses as (delete from public.pulses where doc->>'authorId'=target returning 1),
    visions as (delete from public.visions where doc->>'authorId'=target returning 1),
    links as (delete from public.links where from_id=target returning 1),
    seats as (delete from public.secret_links where from_id=target returning 1)
  select jsonb_build_object('lifetrees',(select count(*) from trees),'pulses',(select count(*) from pulses),'visions',(select count(*) from visions),
    'links',(select count(*) from links)+(select count(*) from seats)) into counts;
  delete from public.persons where id=target;
  delete from public.users where id=target;
  delete from public.admins where id=target;
  delete from seed.push_subscriptions where uid=target;
  -- The login is unbound too: the issuer's subject no longer names this account (the sign-in is revoked here).
  delete from seed.identity_bindings where uid=target;
  return counts || jsonb_build_object('rays',rays_count,'unitsToHeir',units_heir,'unitsToGlow',units_glow,'deleted',true);
end;
$$;
revoke all on function seed.delete_account(text,text) from public;

-- ── DOMAIN PROOFS AND DOORS: challenges live locally (excluded from the travel plan) ───────
create table seed.domain_challenges(community_id text primary key, doc jsonb not null);
alter table seed.domain_challenges enable row level security;
revoke all on seed.domain_challenges from public;
create table seed.door_challenges(id text primary key, community_id text not null, door text not null, doc jsonb not null);
alter table seed.door_challenges enable row level security;
revoke all on seed.door_challenges from public;
create index door_challenges_community on seed.door_challenges(community_id);

-- The anchor's challenge. token null = a keeper's READ (the stored record as it stands, with the
-- community's present domain); a token = resume the live challenge or mint this one (the API judges
-- liveness with the domain law and brings its own 128-bit token — the record never trusts a client's).
create function seed.domain_challenge(cid text, token text, ttl_ms numeric) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); community jsonb; domain text; standing jsonb; moment timestamptz:=now();
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select doc into community from public.communities where id=cid for update;
  if community is null then raise exception 'Community missing' using errcode='LS003'; end if;
  if not seed.keeps_community(cid) then raise exception 'Only a keeper verifies the anchor' using errcode='42501'; end if;
  domain:=lower(regexp_replace(regexp_replace(coalesce(community->>'domain',''),'^https?://',''),'^www\.',''));
  select doc into standing from seed.domain_challenges where seed.domain_challenges.community_id=cid for update;
  if token is null then return jsonb_build_object('challenge',standing,'domain',domain); end if;
  if domain='' then raise exception 'No domain' using errcode='LS060'; end if;
  if standing is not null and (standing->>'domain' is distinct from domain or extract(epoch from moment-(standing->>'createdAt')::timestamptz)*1000>=ttl_ms) then standing:=null; end if;
  if standing is null then
    if token !~ '^[a-f0-9]{32}$' then raise exception 'Invalid token' using errcode='22023'; end if;
    standing:=jsonb_build_object('communityId',cid,'lid',community->'lid','domain',domain,'token',token,'createdBy',actor,'createdAt',seed.doc_stamp(moment));
    insert into seed.domain_challenges(community_id,doc) values(cid,standing) on conflict(community_id) do update set doc=excluded.doc;
  end if;
  return jsonb_build_object('challenge',standing,'domain',domain);
end;
$$;
revoke all on function seed.domain_challenge(text,text,numeric) from public;
-- The proof observed by the API: re-checked under the lock (the same token, the same domain, still
-- live), then the server-only mark is written and the spent challenge retired.
create function seed.domain_verified(cid text, token text, ttl_ms numeric) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); moment timestamptz:=now(); standing jsonb; community jsonb; domain text;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select doc into community from public.communities where id=cid for update;
  if community is null then raise exception 'Community missing' using errcode='LS003'; end if;
  if not seed.keeps_community(cid) then raise exception 'Only a keeper verifies the anchor' using errcode='42501'; end if;
  select doc into standing from seed.domain_challenges where seed.domain_challenges.community_id=cid for update;
  if standing is null or standing->>'token' is distinct from token then raise exception 'No challenge' using errcode='LS064'; end if;
  if extract(epoch from moment-(standing->>'createdAt')::timestamptz)*1000>=ttl_ms then raise exception 'Challenge expired' using errcode='LS065'; end if;
  domain:=lower(regexp_replace(regexp_replace(coalesce(community->>'domain',''),'^https?://',''),'^www\.',''));
  if domain is distinct from standing->>'domain' then raise exception 'Domain changed' using errcode='LS066'; end if;
  update public.communities set doc=doc || jsonb_build_object('domainVerification',jsonb_build_object('domain',domain,'method','dns_txt','verifiedAt',seed.doc_stamp(moment)),'updatedAt',seed.doc_stamp(moment)) where id=cid;
  delete from seed.domain_challenges where seed.domain_challenges.community_id=cid;
  return jsonb_build_object('verified',true,'domain',domain);
end;
$$;
revoke all on function seed.domain_verified(text,text,numeric) from public;
-- Who else claims a door (as its domain or an alias)?
create function seed.door_claimant(host text, cid text) returns text
language sql stable security definer set search_path=pg_catalog as $$
  select id from public.communities where id<>cid and (doc->>'domain'=host or (jsonb_typeof(doc->'domainAliases')='array' and doc->'domainAliases' @> to_jsonb(host))) order by id limit 1;
$$;
revoke all on function seed.door_claimant(text,text) from public;
-- A door claim. kind null = a keeper's READ (the claim in flight, the community's own names and any
-- other claimant — the facts the door law judges); 'face' = a standing request for the steward's
-- grant (no token); 'custom' = resume the fresh challenge or mint this one.
create function seed.door_claim(cid text, host text, kind text, token text, ttl_ms numeric) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); community jsonb; standing jsonb; moment timestamptz:=now(); challenge_id text:=cid || '__' || host;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if host is null or host='' or length(host)>253 or host ~ '[[:space:][:cntrl:]]' then raise exception 'Invalid door' using errcode='22023'; end if;
  select doc into community from public.communities where id=cid for update;
  if community is null then raise exception 'Community missing' using errcode='LS003'; end if;
  if not seed.keeps_community(cid) then raise exception 'Only a keeper claims a door' using errcode='42501'; end if;
  select doc into standing from seed.door_challenges where id=challenge_id for update;
  if kind is null then
    return jsonb_build_object('challenge',standing,'community',jsonb_build_object('domain',community->'domain','domainAliases',community->'domainAliases'),'claimant',seed.door_claimant(host,cid));
  end if;
  if kind not in ('face','custom') then raise exception 'Invalid door' using errcode='22023'; end if;
  if kind='face' then
    if standing is null then
      standing:=jsonb_build_object('communityId',cid,'door',host,'kind',kind,'createdBy',actor,'createdAt',seed.doc_stamp(moment));
      insert into seed.door_challenges(id,community_id,door,doc) values(challenge_id,cid,host,standing);
    end if;
    return jsonb_build_object('challenge',standing);
  end if;
  if standing is not null and (standing->>'token' is null or extract(epoch from moment-(standing->>'createdAt')::timestamptz)*1000>=ttl_ms) then standing:=null; end if;
  if standing is null then
    if token is null or token !~ '^[a-f0-9]{32}$' then raise exception 'Invalid token' using errcode='22023'; end if;
    standing:=jsonb_build_object('communityId',cid,'door',host,'kind',kind,'token',token,'createdBy',actor,'createdAt',seed.doc_stamp(moment));
    insert into seed.door_challenges(id,community_id,door,doc) values(challenge_id,cid,host,standing) on conflict(id) do update set doc=excluded.doc;
  end if;
  return jsonb_build_object('challenge',standing);
end;
$$;
revoke all on function seed.door_claim(text,text,text,text,numeric) from public;
-- The claims in flight, to the keeper alone (null to any other hand).
create function seed.door_claims(cid text) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select case when seed.keeps_community(cid) then coalesce((select jsonb_agg(doc order by id) from seed.door_challenges d where d.community_id=cid),'[]'::jsonb) else null end;
$$;
revoke all on function seed.door_claims(text) from public;
-- The door opens: by the keeper's observed proof (token re-checked under the lock) or by the
-- steward's grant (staff hand door_grant). The alias is written, every being stamped with the door
-- comes home to the community's canonical domain, and the claim retires. The structural refusals
-- stand here too, whoever asks: a door that is the community's own domain, already its alias, or
-- another place's name.
create function seed.door_open(cid text, host text, by_grant boolean, token text, ttl_ms numeric) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); community jsonb; standing jsonb; home text; moved bigint:=0; n bigint; moment timestamptz:=now(); challenge_id text:=cid || '__' || host;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if host is null or host='' or length(host)>253 or host ~ '[[:space:][:cntrl:]]' then raise exception 'Invalid door' using errcode='22023'; end if;
  select doc into community from public.communities where id=cid for update;
  if community is null then raise exception 'Community missing' using errcode='LS003'; end if;
  if by_grant then
    if not seed.staff_hand('door_grant') then raise exception 'Staff only' using errcode='42501'; end if;
  else
    if not seed.keeps_community(cid) then raise exception 'Only a keeper claims a door' using errcode='42501'; end if;
    select doc into standing from seed.door_challenges where id=challenge_id for update;
    if standing is null or standing->>'token' is null or standing->>'token' is distinct from token then raise exception 'No challenge' using errcode='LS064'; end if;
    if extract(epoch from moment-(standing->>'createdAt')::timestamptz)*1000>=ttl_ms then raise exception 'Challenge expired' using errcode='LS065'; end if;
  end if;
  home:=coalesce(community->>'domain','');
  if host=home then raise exception 'Door is the domain' using errcode='LS062'; end if;
  if jsonb_typeof(community->'domainAliases')='array' and community->'domainAliases' @> to_jsonb(host) then raise exception 'Door already open' using errcode='LS063'; end if;
  if seed.door_claimant(host,cid) is not null then raise exception 'Door taken' using errcode='LS061'; end if;
  update public.communities set doc=doc || jsonb_build_object('domainAliases',seed.doc_array_union(doc->'domainAliases',jsonb_build_array(host)),'updatedAt',seed.doc_stamp(moment)) where id=cid;
  update public.pulses set doc=doc || jsonb_build_object('domain',home,'updatedAt',seed.doc_stamp(moment)) where doc->>'domain'=host; get diagnostics n=row_count; moved:=moved+n;
  update public.lifetrees set doc=doc || jsonb_build_object('domain',home,'updatedAt',seed.doc_stamp(moment)) where doc->>'domain'=host; get diagnostics n=row_count; moved:=moved+n;
  update public.visions set doc=doc || jsonb_build_object('domain',home,'communityId',cid,'updatedAt',seed.doc_stamp(moment)) where doc->>'domain'=host; get diagnostics n=row_count; moved:=moved+n;
  delete from seed.door_challenges where id=challenge_id;
  return jsonb_build_object('claimed',true,'door',host,'moved',moved);
end;
$$;
revoke all on function seed.door_open(text,text,boolean,text,numeric) from public;
-- The keeper withdraws a door; beings stamped with the canonical domain stay where they are.
create function seed.door_withdraw(cid text, host text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); moment timestamptz:=now();
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if host is null or host='' or length(host)>253 or host ~ '[[:space:][:cntrl:]]' then raise exception 'Invalid door' using errcode='22023'; end if;
  if not exists(select 1 from public.communities where id=cid) then raise exception 'Community missing' using errcode='LS003'; end if;
  if not seed.keeps_community(cid) then raise exception 'Only a keeper withdraws a door' using errcode='42501'; end if;
  update public.communities set doc=doc || jsonb_build_object('domainAliases',seed.doc_array_remove(doc->'domainAliases',jsonb_build_array(host)),'updatedAt',seed.doc_stamp(moment)) where id=cid;
  delete from seed.door_challenges where id=cid || '__' || host;
  return jsonb_build_object('withdrawn',true,'door',host);
end;
$$;
revoke all on function seed.door_withdraw(text,text) from public;
