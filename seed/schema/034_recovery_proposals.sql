-- The API verifies the candidate signature while holding these identity locks.
-- Neither a proposal nor account access alone can activate the replacement key.
create function seed.recovery_context() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); person jsonb; private_person jsonb; frozen jsonb; epoch jsonb;
  anchored timestamptz; stopped timestamptz; suspected timestamptz;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select doc into private_person from public.users where id=actor for update;
  select doc into person from public.persons where id=actor for update;
  if person is null or private_person is null then raise exception 'Profile required' using errcode='LS001'; end if;
  if jsonb_typeof(person->'uid') is distinct from 'string' or jsonb_typeof(private_person->'uid') is distinct from 'string'
    or person->>'uid' is distinct from actor or private_person->>'uid' is distinct from actor
    or private_person->>'lid' is distinct from person->>'lid'
    or coalesce(person->>'lid','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or person->>'signingState' is distinct from 'frozen'
    or coalesce(person->>'signingKeyFingerprint','') !~ '^[a-f0-9]{64}$'
    or person->>'signingKeyFingerprint' is distinct from encode(public.digest(convert_to(person->>'publicKeyPem','UTF8'),'sha256'),'hex')
    or person->>'signingFreezeEventId' is distinct from 'freeze_' || (person->>'signingEpochId') then
    raise exception 'Signing identity needs review' using errcode='LS026'; end if;
  select doc into frozen from public.person_key_events where person_id=actor and id=person->>'signingFreezeEventId';
  select doc into epoch from public.person_key_events where person_id=actor and id=person->>'signingEpochId';
  if frozen is null or epoch is null or frozen->>'type' is distinct from 'freeze'
    or coalesce(epoch->>'type','') not in ('anchor','rotate','recover')
    or exists(select 1 from jsonb_array_elements(jsonb_build_array(epoch,frozen)) e where
      e->>'uid' is distinct from actor or e->>'lid' is distinct from person->>'lid'
      or e->>'keyFingerprint' is distinct from person->>'signingKeyFingerprint'
      or e->>'epochId' is distinct from person->>'signingEpochId' or jsonb_typeof(e->'recordedAt') is distinct from 'string')
    or frozen->'recordedAt' is distinct from person->'signingFrozenAt' then
    raise exception 'Signing identity needs review' using errcode='LS026'; end if;
  begin
    anchored:=(epoch->>'recordedAt')::timestamptz; stopped:=(frozen->>'recordedAt')::timestamptz;
    if frozen ? 'claimedSuspectedSince' and jsonb_typeof(frozen->'claimedSuspectedSince') is distinct from 'string' then
      raise exception 'Invalid claim'; end if;
    suspected:=coalesce((frozen->>'claimedSuspectedSince')::timestamptz,stopped);
  exception when others then raise exception 'Signing identity needs review' using errcode='LS026'; end;
  if not isfinite(anchored) or not isfinite(stopped) or not isfinite(suspected)
    or anchored>suspected or suspected>stopped or stopped>clock_timestamp()
    or extract(epoch from suspected)*1000 not between 0 and 253402300799999 then
    raise exception 'Signing identity needs review' using errcode='LS026'; end if;
  -- Match Firestore Timestamp.toMillis: signed recovery preimages use milliseconds.
  return jsonb_build_object('uid',actor,'lid',person->>'lid','fromFingerprint',person->>'signingKeyFingerprint',
    'suspectedSinceMs',floor(extract(epoch from suspected)*1000));
end;
$$;
revoke all on function seed.recovery_context() from public;

create function seed.apply_recovery_proposal(command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare context jsonb; actor text:=seed.uid(); event_id text:=command->>'eventId'; candidate text:=command->>'toFingerprint'; proposal jsonb;
begin
  if jsonb_typeof(command) is distinct from 'object' or command->>'action' is distinct from 'begin_recovery'
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','eventId','toPubkey','toFingerprint','newSig'))
    or exists(select 1 from unnest(array['eventId','toPubkey','toFingerprint','newSig']) k where jsonb_typeof(command->k) is distinct from 'string')
    or event_id !~ '^[A-Za-z0-9_-]{1,128}$' or candidate !~ '^[a-f0-9]{64}$'
    or command->>'toPubkey' !~ '^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$' or command->>'newSig' !~ '^[A-Za-z0-9+/]{86}==$'
    or candidate<>encode(public.digest(convert_to(command->>'toPubkey','UTF8'),'sha256'),'hex') then
    raise exception 'Invalid recovery candidate' using errcode='22023'; end if;
  context:=seed.recovery_context();
  if candidate=context->>'fromFingerprint' then raise exception 'Fresh key required' using errcode='22023'; end if;
  if exists(select 1 from public.person_keys where person_id=actor and id=candidate)
    or exists(select 1 from public.person_key_recoveries where person_id=actor and id=event_id)
    or exists(select 1 from public.person_key_events where person_id=actor and id=event_id) then
    raise exception 'Recovery already exists' using errcode='LS028'; end if;
  proposal:=context || jsonb_build_object('version',1,'status','open','toFingerprint',candidate,
    'toPubkey',command->>'toPubkey','newSig',command->>'newSig','createdAt',clock_timestamp());
  insert into public.person_key_recoveries(person_id,id,doc) values(actor,event_id,proposal);
  return jsonb_build_object('eventId',event_id,'recoveryCode',actor || ':' || event_id,'suspectedSinceMs',context->'suspectedSinceMs');
end;
$$;
revoke all on function seed.apply_recovery_proposal(jsonb) from public;

create function seed.recovery_proposal(subject text,event_id text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if seed.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if subject is null or length(subject) not between 1 and 128 or subject ~ '[[:cntrl:]]'
    or event_id is null or event_id !~ '^[A-Za-z0-9_-]{1,128}$' then raise exception 'Invalid recovery query' using errcode='22023'; end if;
  return jsonb_build_object('proposal',(select doc || jsonb_build_object('id',id) from public.person_key_recoveries where person_id=subject and id=event_id));
end;
$$;
revoke all on function seed.recovery_proposal(text,text) from public;
