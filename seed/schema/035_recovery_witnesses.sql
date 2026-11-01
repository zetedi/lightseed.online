-- Eligibility is a governed initiation or a validated rooted tree actually kept.
-- BED/SECRET trees grant no outside authority, including through their anchor.
create function seed.recovery_witness_eligible(actor text) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare tree record;
begin
  perform id from public.initiates where id=actor for share;
  if found then return true; end if;
  for tree in select id,doc from public.lifetrees where doc->'validated'='true'::jsonb
    and coalesce(doc->>'treeType','') not in ('BED','SECRET')
    and ((jsonb_typeof(doc->'anchorUid')='string' and doc->>'anchorUid'=actor)
      or exists(select 1 from public.links where from_id=actor and rel='keeper' and to_id=lifetrees.id))
    order by id collate "C" for update loop
    if jsonb_typeof(tree.doc->'anchorUid')='string' and tree.doc->>'anchorUid'=actor then return true; end if;
    perform id from public.links where from_id=actor and rel='keeper' and to_id=tree.id for share;
    if found then return true; end if;
  end loop;
  return false;
end;
$$;
revoke all on function seed.recovery_witness_eligible(text) from public;

create function seed.prepare_recovery_witness(command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); target text:=command->>'targetUid'; person jsonb; private_person jsonb; target_person jsonb; proposal jsonb; epoch jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or command->>'action' is distinct from 'witness_recovery'
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','targetUid','eventId','sig','pubkey','keyFingerprint','epochId'))
    or exists(select 1 from unnest(array['targetUid','eventId','sig','pubkey','keyFingerprint','epochId']) k where jsonb_typeof(command->k) is distinct from 'string')
    or length(target) not between 1 and 128 or target ~ '[[:cntrl:]]' or target=actor
    or command->>'eventId' !~ '^[A-Za-z0-9_-]{1,128}$' or command->>'epochId' !~ '^[A-Za-z0-9_-]{1,128}$'
    or command->>'pubkey' !~ '^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$' or command->>'sig' !~ '^[A-Za-z0-9+/]{86}==$'
    or command->>'keyFingerprint' !~ '^[a-f0-9]{64}$'
    or command->>'keyFingerprint'<>encode(public.digest(convert_to(command->>'pubkey','UTF8'),'sha256'),'hex') then
    raise exception 'Invalid witness' using errcode='22023'; end if;
  select doc into private_person from public.users where id=actor for update;
  perform id from public.persons where id in(actor,target) order by id collate "C" for update;
  select doc into person from public.persons where id=actor;
  select doc into target_person from public.persons where id=target;
  if person is null or private_person is null or jsonb_typeof(person->'uid') is distinct from 'string'
    or jsonb_typeof(private_person->'uid') is distinct from 'string' or person->>'uid' is distinct from actor
    or private_person->>'uid' is distinct from actor or private_person->>'lid' is distinct from person->>'lid'
    or coalesce(person->>'lid','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or person->>'signingState' is distinct from 'active' or person->>'publicKeyPem' is distinct from command->>'pubkey'
    or person->>'signingKeyFingerprint' is distinct from command->>'keyFingerprint'
    or person->>'signingEpochId' is distinct from command->>'epochId' then
    raise exception 'Signing identity needs review' using errcode='LS026'; end if;
  select doc into epoch from public.person_key_events where person_id=actor and id=command->>'epochId';
  if epoch is null or epoch->>'uid' is distinct from actor or epoch->>'lid' is distinct from person->>'lid'
    or epoch->>'epochId' is distinct from command->>'epochId' or epoch->>'keyFingerprint' is distinct from command->>'keyFingerprint'
    or coalesce(epoch->>'type','') not in ('anchor','rotate','recover')
    or not exists(select 1 from public.person_keys where person_id=actor and id=command->>'keyFingerprint' and doc->>'pubkey'=command->>'pubkey') then
    raise exception 'Signing identity needs review' using errcode='LS026'; end if;
  select doc into proposal from public.person_key_recoveries where person_id=target and id=command->>'eventId' for update;
  if proposal is null or proposal->>'status' is distinct from 'open' then raise exception 'Recovery not open' using errcode='LS029'; end if;
  if target_person is null or jsonb_typeof(target_person->'uid') is distinct from 'string' or target_person->>'uid' is distinct from target or target_person->>'signingState' is distinct from 'frozen'
    or target_person->>'lid' is distinct from proposal->>'lid' or target_person->>'signingKeyFingerprint' is distinct from proposal->>'fromFingerprint'
    or proposal->>'uid' is distinct from target then raise exception 'Signing identity needs review' using errcode='LS026'; end if;
  if not seed.recovery_witness_eligible(actor) then raise exception 'Witness not eligible' using errcode='42501'; end if;
  return proposal || jsonb_build_object('id',command->>'eventId');
end;
$$;
revoke all on function seed.prepare_recovery_witness(jsonb) from public;

create function seed.apply_recovery_witness(command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); witness_id text; existing jsonb;
begin
  perform seed.prepare_recovery_witness(command);
  witness_id:=actor || '__' || (command->>'epochId');
  select doc into existing from public.person_key_recovery_witnesses where person_id=command->>'targetUid' and recovery_id=command->>'eventId' and id=witness_id;
  if existing is not null then
    if existing->>'witnessUid' is distinct from actor or existing->>'epochId' is distinct from command->>'epochId'
      or existing->>'pubkey' is distinct from command->>'pubkey' or existing->>'sig' is distinct from command->>'sig'
      or existing->>'keyFingerprint' is distinct from command->>'keyFingerprint' then
      raise exception 'Signing identity needs review' using errcode='LS026'; end if;
    return jsonb_build_object('witnessed',true);
  end if;
  insert into public.person_key_recovery_witnesses(person_id,recovery_id,id,doc) values(command->>'targetUid',command->>'eventId',witness_id,
    jsonb_build_object('witnessUid',actor,'version',3,'sig',command->>'sig','pubkey',command->>'pubkey',
      'keyFingerprint',command->>'keyFingerprint','epochId',command->>'epochId','recordedAt',clock_timestamp()));
  return jsonb_build_object('witnessed',true);
end;
$$;
revoke all on function seed.apply_recovery_witness(jsonb) from public;
