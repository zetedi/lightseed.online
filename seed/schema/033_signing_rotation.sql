-- Called only after the API verifies both Ed25519 signatures over the fixed-field
-- key-rotation preimage. Database credentials, like seed.uid, are a trusted boundary.
create function seed.apply_key_rotation(command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); person jsonb; private_person jsonb; old_key jsonb; epoch jsonb;
  event_id text:=command->>'eventId'; from_fp text:=command->>'fromFingerprint'; to_fp text:=command->>'toFingerprint'; moment timestamptz;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or command->>'action' is distinct from 'rotate'
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','eventId','lid','fromPubkey','toPubkey','fromFingerprint','toFingerprint','oldSig','newSig'))
    or exists(select 1 from unnest(array['eventId','lid','fromPubkey','toPubkey','fromFingerprint','toFingerprint','oldSig','newSig']) k where jsonb_typeof(command->k) is distinct from 'string')
    or event_id !~ '^[A-Za-z0-9_-]{1,128}$' or from_fp !~ '^[a-f0-9]{64}$' or to_fp !~ '^[a-f0-9]{64}$' or from_fp=to_fp
    or command->>'fromPubkey' !~ '^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$' or command->>'toPubkey' !~ '^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$'
    or command->>'oldSig' !~ '^[A-Za-z0-9+/]{86}==$' or command->>'newSig' !~ '^[A-Za-z0-9+/]{86}==$'
    or from_fp<>encode(public.digest(convert_to(command->>'fromPubkey','UTF8'),'sha256'),'hex')
    or to_fp<>encode(public.digest(convert_to(command->>'toPubkey','UTF8'),'sha256'),'hex') then
    raise exception 'Invalid rotation' using errcode='22023'; end if;
  select doc into private_person from public.users where id=actor for update;
  select doc into person from public.persons where id=actor for update;
  if person is null or private_person is null then raise exception 'Profile required' using errcode='LS001'; end if;
  if jsonb_typeof(person->'uid') is distinct from 'string' or jsonb_typeof(private_person->'uid') is distinct from 'string'
    or person->>'uid' is distinct from actor or private_person->>'uid' is distinct from actor
    or private_person->>'lid' is distinct from person->>'lid' or person->>'lid' is distinct from command->>'lid'
    or person->>'signingState' is distinct from 'active' or person->>'publicKeyPem' is distinct from command->>'fromPubkey'
    or person->>'signingKeyFingerprint' is distinct from from_fp then
    raise exception 'Signing identity needs review' using errcode='LS026'; end if;
  select doc into old_key from public.person_keys where person_id=actor and id=from_fp;
  select doc into epoch from public.person_key_events where person_id=actor and id=person->>'signingEpochId';
  if old_key is null or old_key->>'pubkey' is distinct from command->>'fromPubkey' or epoch is null
    or epoch->>'epochId' is distinct from person->>'signingEpochId' or epoch->>'keyFingerprint' is distinct from from_fp
    or epoch->>'uid' is distinct from actor or epoch->>'lid' is distinct from person->>'lid'
    or coalesce(epoch->>'type','') not in ('anchor','rotate','recover') then
    raise exception 'Signing identity needs review' using errcode='LS026'; end if;
  if exists(select 1 from public.person_keys where person_id=actor and id=to_fp)
    or exists(select 1 from public.person_key_events where person_id=actor and id=event_id) then
    raise exception 'Rotation already exists' using errcode='LS027'; end if;
  moment:=clock_timestamp();
  insert into public.person_keys(person_id,id,doc) values(actor,to_fp,jsonb_build_object('pubkey',command->>'toPubkey','publishedAt',moment));
  insert into public.person_key_events(person_id,id,doc) values(actor,event_id,jsonb_build_object('version',1,'type','rotate',
    'uid',actor,'lid',person->>'lid','epochId',event_id,'keyFingerprint',to_fp,'previousFingerprint',from_fp,
    'recordedAt',moment,'oldSig',command->>'oldSig','newSig',command->>'newSig'));
  update public.persons set doc=(person-'signingFrozenAt'-'signingFreezeEventId') || jsonb_build_object(
    'publicKeyPem',command->>'toPubkey','signingKeyFingerprint',to_fp,'signingEpochId',event_id,'signingState','active','signingAnchoredAt',moment) where id=actor;
  return seed.signing_identity(actor);
end;
$$;
revoke all on function seed.apply_key_rotation(jsonb) from public;
