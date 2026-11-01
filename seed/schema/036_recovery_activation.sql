-- Locks remain held across API verification and the final activation statement.
create function seed.prepare_recovery_activation(event_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); context jsonb; proposal jsonb; witnesses jsonb:='[]'; witness record; epoch jsonb; at_time timestamptz; epoch_time timestamptz;
begin
  if event_id is null or event_id !~ '^[A-Za-z0-9_-]{1,128}$' then raise exception 'Invalid recovery' using errcode='22023'; end if;
  context:=seed.recovery_context();
  select doc into proposal from public.person_key_recoveries where person_id=actor and id=event_id for update;
  if proposal is null or proposal->>'status' is distinct from 'open' then raise exception 'Recovery not open' using errcode='LS029'; end if;
  if exists(select 1 from unnest(array['uid','lid','fromFingerprint','suspectedSinceMs']) k where proposal->k is distinct from context->k)
    then raise exception 'Signing identity needs review' using errcode='LS026'; end if;
  -- Only the current active epoch of each distinct UID can contribute a slot.
  for witness in select w.id,w.doc,p.doc as person from public.person_key_recovery_witnesses w
    join public.persons p on p.id=w.doc->>'witnessUid'
    where w.person_id=actor and w.recovery_id=event_id
      and jsonb_typeof(w.doc->'witnessUid')='string' and w.doc->>'witnessUid'<>actor
      and w.id=(w.doc->>'witnessUid') || '__' || (w.doc->>'epochId') and w.doc->'version'='3'::jsonb
      and p.doc->'uid'=w.doc->'witnessUid' and p.doc->>'signingState'='active'
      and p.doc->'publicKeyPem'=w.doc->'pubkey' and p.doc->'signingKeyFingerprint'=w.doc->'keyFingerprint'
      and p.doc->'signingEpochId'=w.doc->'epochId'
    order by p.id collate "C",w.id collate "C" for update of p,w loop
    select doc into epoch from public.person_key_events where person_id=witness.doc->>'witnessUid' and id=witness.doc->>'epochId';
    if epoch is null or epoch->'uid' is distinct from witness.doc->'witnessUid'
      or epoch->'lid' is distinct from witness.person->'lid' or epoch->'epochId' is distinct from witness.doc->'epochId'
      or epoch->'keyFingerprint' is distinct from witness.doc->'keyFingerprint'
      or coalesce(epoch->>'type','') not in ('anchor','rotate','recover')
      or jsonb_typeof(epoch->'recordedAt') is distinct from 'string' or jsonb_typeof(witness.doc->'recordedAt') is distinct from 'string'
      or not exists(select 1 from public.person_keys where person_id=witness.doc->>'witnessUid' and id=witness.doc->>'keyFingerprint' and doc->'pubkey'=witness.doc->'pubkey') then continue; end if;
    begin at_time:=(witness.doc->>'recordedAt')::timestamptz; epoch_time:=(epoch->>'recordedAt')::timestamptz;
    exception when others then continue; end;
    if not isfinite(at_time) or not isfinite(epoch_time) or at_time<epoch_time or at_time>clock_timestamp() then continue; end if;
    if not seed.recovery_witness_eligible(witness.doc->>'witnessUid') then continue; end if;
    witnesses:=witnesses || jsonb_build_array(witness.doc || jsonb_build_object('id',witness.id));
  end loop;
  return jsonb_build_object('context',context,'proposal',proposal || jsonb_build_object('id',event_id),'witnesses',witnesses);
end;
$$;
revoke all on function seed.prepare_recovery_activation(text) from public;

-- The selected witness IDs have been cryptographically verified by the trusted API.
create function seed.apply_recovery_activation(event_id text,witness_ids text[]) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); prepared jsonb; proposal jsonb; context jsonb; moment timestamptz;
begin
  if witness_ids is null or cardinality(witness_ids)<>3 or (select count(distinct id) from unnest(witness_ids) id)<>3 then
    raise exception 'Recovery quorum required' using errcode='LS030'; end if;
  prepared:=seed.prepare_recovery_activation(event_id); proposal:=prepared->'proposal'; context:=prepared->'context';
  if (select count(distinct w->>'witnessUid') from jsonb_array_elements(prepared->'witnesses') w where w->>'id'=any(witness_ids))<>3 then
    raise exception 'Recovery quorum required' using errcode='LS030'; end if;
  if exists(select 1 from public.person_keys where person_id=actor and id=proposal->>'toFingerprint')
    or exists(select 1 from public.person_key_events where person_id=actor and id=event_id) then
    raise exception 'Recovery already exists' using errcode='LS028'; end if;
  moment:=clock_timestamp();
  insert into public.person_keys(person_id,id,doc) values(actor,proposal->>'toFingerprint',jsonb_build_object('pubkey',proposal->>'toPubkey','publishedAt',moment));
  insert into public.person_key_events(person_id,id,doc) values(actor,event_id,jsonb_build_object('version',1,'type','recover',
    'uid',actor,'lid',context->>'lid','epochId',event_id,'keyFingerprint',proposal->>'toFingerprint','previousFingerprint',context->>'fromFingerprint',
    'suspectedSince',to_timestamp((context->>'suspectedSinceMs')::numeric/1000),'recoveryId',event_id,'recordedAt',moment));
  update public.persons set doc=(doc-'signingFrozenAt'-'signingFreezeEventId') || jsonb_build_object('publicKeyPem',proposal->>'toPubkey',
    'signingKeyFingerprint',proposal->>'toFingerprint','signingEpochId',event_id,'signingState','active','signingAnchoredAt',moment) where id=actor;
  update public.person_key_recoveries set doc=doc || jsonb_build_object('status','activated','activatedAt',moment) where person_id=actor and id=event_id;
  return seed.signing_identity(actor);
end;
$$;
revoke all on function seed.apply_recovery_activation(text,text[]) from public;
