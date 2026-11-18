-- ONLY A GROUNDED VISION'S CIRCLE MOVES LIGHT (ring 2026-11-18; src/domain/grounding.ts
-- visionReceivesLight, src/domain/spend.ts `light_vision_ungrounded`; the origin's
-- functions/src/lightCalls.ts of the same day). Light moves around a vision — the appreciation of
-- an offering made to it, a community's spend on one — only while the vision stands in a tree that
-- is alive, not secret and not a bed, cared for within a year, and validated (a guarded tree
-- needs no validation). The pattern is 054's: the two CONTEXTS now also hand the API the records
-- of the trees the offering's vision stands in (`groundTrees`; null when the offering was not
-- made to a vision), the shared law judges, and the two APPLIES re-prove the gate on the soil
-- (LS071), so nothing the API believed can move light around an ungrounded vision.
-- The four functions below are 054's, each with that one addition.

-- The trees a vision-offering's vision stands in, locked for the movement; null for any other offering.
create function seed.vision_ground_trees(offering jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare vision_id text:=offering->>'offeredToId';
begin
  if offering is null or offering->>'offeredToKind' is distinct from 'vision' then return null; end if;
  perform 1 from public.lifetrees t where t.id in (select to_id from public.links where from_id=vision_id and rel='grounded_in') order by t.id collate "C" for share;
  return coalesce((select jsonb_agg(jsonb_build_object('treeType',t.doc->'treeType','isNature',t.doc->'isNature','validated',t.doc->'validated',
      'validatorId',t.doc->'validatorId','diedAt',t.doc->'diedAt','lastCaredAt',t.doc->'lastCaredAt') order by t.id collate "C")
    from public.links l join public.lifetrees t on t.id=l.to_id where l.from_id=vision_id and l.rel='grounded_in'),'[]'::jsonb);
end;
$$;
revoke all on function seed.vision_ground_trees(jsonb) from public;

-- The soil's own copy of domain/grounding visionReceivesLight (groundCarriesLight over every ground).
create function seed.vision_carries_light(vision_id text, moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.links l join public.lifetrees t on t.id=l.to_id
    where l.from_id=vision_id and l.rel='grounded_in'
      and coalesce(t.doc->>'treeType','LIFETREE') not in ('SECRET','BED')
      and (not (t.doc ? 'diedAt') or t.doc->'diedAt'='null'::jsonb)
      and seed.vision_moment(jsonb_build_object('createdAt',t.doc->'lastCaredAt'))>moment-interval '365 days'
      and (t.doc->>'treeType'='GUARDED' or t.doc->'isNature'='true'::jsonb
        or (t.doc->'validated'='true'::jsonb and jsonb_typeof(t.doc->'validatorId')='string' and t.doc->>'validatorId' not in ('','SYSTEM','GENESIS'))));
$$;
revoke all on function seed.vision_carries_light(text,timestamptz) from public;

-- Is this offering made to a vision around which no light may move now?
create function seed.offering_is_groundless(offering_id text, moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.pulses p where p.id=offering_id and p.doc->>'offeredToKind'='vision'
    and not seed.vision_carries_light(coalesce(p.doc->>'offeredToId',''),moment));
$$;
revoke all on function seed.offering_is_groundless(text,timestamptz) from public;

create or replace function seed.appreciation_context(offering_id text) returns jsonb
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
  return jsonb_build_object('exists',offering is not null,'offering',offering,'place',place,'acceptsPlaces',accepts,'rays',held,'alreadyGiven',given,
    'groundTrees',seed.vision_ground_trees(offering));
end;
$$;

create or replace function seed.apply_appreciation(offering_id text, gift jsonb, takes jsonb) returns jsonb
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
  -- THE GROUND GATE, re-proved on the soil whatever the API believed.
  if seed.offering_is_groundless(offering_id,moment) then raise exception 'Vision without ground' using errcode='LS071'; end if;
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

create or replace function seed.spend_context(decision_id text) returns jsonb
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
    'place',place,'acceptsPlaces',accepts,'signatures',signatures,'signers',signers,'glowUnits',glow_units,'alreadySpent',spent,'callerStands',stands,
    'groundTrees',seed.vision_ground_trees(offering));
end;
$$;

create or replace function seed.apply_spend(decision_id text, spend jsonb) returns jsonb
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
  -- THE GROUND GATE, re-proved on the soil whatever the API believed.
  if seed.offering_is_groundless(offering_id,moment) then raise exception 'Vision without ground' using errcode='LS071'; end if;
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
