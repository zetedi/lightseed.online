-- Alignment acceptance is a trusted API capability. Both named people must
-- still carry their trees; staff status alone does not stand in for consent.
create function seed.alignment_context(alignment_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); proposal jsonb; source jsonb; target jsonb;
  source_id text; target_id text; author text; source_carer boolean; target_carer boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select doc into proposal from public.alignments where id=alignment_id for update;
  if proposal is null then raise exception 'Alignment unavailable' using errcode='LS036'; end if;
  if jsonb_typeof(proposal->'targetUid') is distinct from 'string' or proposal->>'targetUid'<>actor then
    raise exception 'Not the alignment recipient' using errcode='42501'; end if;
  if proposal->>'status' is distinct from 'PENDING' then raise exception 'Alignment already answered' using errcode='LS037'; end if;
  if jsonb_typeof(proposal->'initiatorUid') is distinct from 'string' or coalesce(proposal->>'initiatorUid','')=''
    or jsonb_typeof(proposal->'initiatorTreeId') is distinct from 'string' or coalesce(proposal->>'initiatorTreeId','')=''
    or jsonb_typeof(proposal->'targetTreeId') is distinct from 'string' or coalesce(proposal->>'targetTreeId','')='' then
    raise exception 'Invalid alignment' using errcode='22023'; end if;
  source_id:=proposal->>'initiatorTreeId';target_id:=proposal->>'targetTreeId';author:=proposal->>'initiatorUid';
  if source_id=target_id then raise exception 'Alignment needs two trees' using errcode='LS037'; end if;
  perform 1 from public.lifetrees where id in (source_id,target_id) order by id collate "C" for update;
  select doc into source from public.lifetrees where id=source_id;
  select doc into target from public.lifetrees where id=target_id;
  perform 1 from public.links where from_id in (actor,author) and to_id in (source_id,target_id)
    and rel in ('keeper','steward') order by id collate "C" for share;
  perform 1 from public.secret_links where from_id in (actor,author) and to_id in (source_id,target_id)
    and rel='keeper' order by id collate "C" for share;
  source_carer:=coalesce(jsonb_typeof(source->'anchorUid')='string' and source->>'anchorUid'=author,false)
    or exists(select 1 from public.links where from_id=author and to_id=source_id and rel in ('keeper','steward'))
    or (coalesce(source->>'treeType'='SECRET',false) and exists(select 1 from public.secret_links where from_id=author and to_id=source_id and rel='keeper'));
  target_carer:=coalesce(jsonb_typeof(target->'anchorUid')='string' and target->>'anchorUid'=actor,false)
    or exists(select 1 from public.links where from_id=actor and to_id=target_id and rel in ('keeper','steward'))
    or (coalesce(target->>'treeType'='SECRET',false) and exists(select 1 from public.secret_links where from_id=actor and to_id=target_id and rel='keeper'));
  if source is null or target is null then raise exception 'Alignment tree unavailable' using errcode='LS036'; end if;
  if not source_carer or not target_carer then raise exception 'Alignment authority changed' using errcode='42501'; end if;
  return jsonb_build_object('proposal',proposal,'source',source,'target',target,'sourceCarer',source_carer,'targetCarer',target_carer);
end;
$$;
revoke all on function seed.alignment_context(text) from public;

create function seed.apply_alignment_acceptance(alignment_id text,from_record jsonb,to_record jsonb,from_height bigint,to_height bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare context jsonb; proposal jsonb; side jsonb; record jsonb; expected_height bigint; stored_height numeric;
  source_id text; target_id text; idx integer;
begin
  context:=seed.alignment_context(alignment_id);proposal:=context->'proposal';
  source_id:=proposal->>'initiatorTreeId';target_id:=proposal->>'targetTreeId';
  if from_record->>'id' is not distinct from to_record->>'id' or from_record->>'lid' is not distinct from to_record->>'lid' then
    raise exception 'Twin identities must differ' using errcode='22023'; end if;
  for idx in 1..2 loop
    if idx=1 then side:=context->'source';record:=from_record;expected_height:=from_height;
    else side:=context->'target';record:=to_record;expected_height:=to_height; end if;
    begin stored_height:=coalesce((side->>'blockHeight')::numeric,0);
    exception when others then raise exception 'Invalid chain height' using errcode='22023'; end;
    if expected_height is null or expected_height<>stored_height+1 or expected_height not between 1 and 9007199254740991
      or record->>'previousHash' is distinct from coalesce(nullif(side->>'latestHash',''),nullif(side->>'genesisHash',''),'0') then
      raise exception 'Chain head moved' using errcode='LS032'; end if;
    if jsonb_typeof(record) is distinct from 'object' or record->>'type' is distinct from 'standard'
      or record->>'authorId' is distinct from (case when idx=1 then proposal->>'initiatorUid' else proposal->>'targetUid' end)
      or record->>'lifetreeId' is distinct from (case when idx=1 then source_id else target_id end)
      or record->>'matchedLifetreeId' is distinct from (case when idx=1 then target_id else source_id end)
      or record->>'matchId' is distinct from alignment_id or record->'isMatch' is distinct from 'true'::jsonb
      or record ? 'visionId' or record ? 'authorSignature'
      or coalesce(record->>'id','') !~ '^[A-Za-z0-9_-]{1,128}$'
      or coalesce(record->>'lid','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(record->>'hash','') !~ '^[a-f0-9]{64}$' or record->>'hashVersion' is distinct from 'lifeseed.block.v1' then
      raise exception 'Invalid alignment record' using errcode='22023'; end if;
  end loop;
  insert into public.pulses(id,doc) values(from_record->>'id',from_record),(to_record->>'id',to_record);
  update public.lifetrees set doc=doc || jsonb_build_object('latestHash',from_record->>'hash','blockHeight',from_height) where id=source_id;
  update public.lifetrees set doc=doc || jsonb_build_object('latestHash',to_record->>'hash','blockHeight',to_height) where id=target_id;
  update public.alignments set doc=doc || jsonb_build_object('status','ACCEPTED','acceptedAt',clock_timestamp(),
    'acceptedPulseIds',jsonb_build_object('from',from_record->>'id','to',to_record->>'id')) where id=alignment_id;
  return jsonb_build_object('fromPulseId',from_record->>'id','toPulseId',to_record->>'id');
end;
$$;
revoke all on function seed.apply_alignment_acceptance(text,jsonb,jsonb,bigint,bigint) from public;

-- Match records name both trees even when their original content says public.
-- Stored participants retain their exact records; copied document IDs grant nothing.
create function seed.alignment_twin_party(pulse_id text,pulse jsonb) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and exists(select 1 from public.alignments a
    where a.id=pulse->>'matchId' and a.doc->>'status'='ACCEPTED' and pulse->'isMatch'='true'::jsonb
    and pulse_id in (a.doc->'acceptedPulseIds'->>'from',a.doc->'acceptedPulseIds'->>'to')
    and ((jsonb_typeof(a.doc->'initiatorUid')='string' and a.doc->>'initiatorUid'=seed.uid())
      or (jsonb_typeof(a.doc->'targetUid')='string' and a.doc->>'targetUid'=seed.uid())));
$$;
revoke all on function seed.alignment_twin_party(text,jsonb) from public;
create function seed.alignment_twin_access(pulse_id text,pulse jsonb) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select not(pulse ? 'matchId' or pulse ? 'matchedLifetreeId' or coalesce(pulse->'isMatch'='true'::jsonb,false))
    or seed.is_staff() or seed.alignment_twin_party(pulse_id,pulse)
    or coalesce(pulse->'isMatch'='true'::jsonb and seed.offering_bearer_visible('tree',pulse->>'lifetreeId')
      and seed.offering_bearer_visible('tree',pulse->>'matchedLifetreeId'),false);
$$;
revoke all on function seed.alignment_twin_access(text,jsonb) from public;
create policy alignment_twin_parties on public.pulses for select using(seed.alignment_twin_party(id,doc));
create policy alignment_twin_privacy on public.pulses as restrictive for select using(seed.alignment_twin_access(id,doc));
