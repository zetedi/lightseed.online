-- Public signing identity is separate from the private login/session identity.
create function seed.signing_identity(person_id text) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select jsonb_build_object('identity',(select jsonb_build_object('uid',id,'lid',doc->'lid',
    'publicKeyB64',doc->'publicKeyPem','fingerprint',doc->'signingKeyFingerprint',
    'epochId',doc->'signingEpochId','state',doc->'signingState') from public.persons
    where id=person_id and jsonb_typeof(doc->'publicKeyPem')='string' and doc->>'publicKeyPem'<>''));
$$;
revoke all on function seed.signing_identity(text) from public;

create function seed.signing_anchor(command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); pubkey text:=command->>'publicKeyB64'; person jsonb; private_person jsonb;
  fingerprint text; epoch text; old_key jsonb; old_event jsonb; moment timestamptz:=clock_timestamp();
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or command->>'action' is distinct from 'anchor'
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','publicKeyB64'))
    or jsonb_typeof(command->'publicKeyB64') is distinct from 'string'
    or pubkey !~ '^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$' then raise exception 'Invalid signing key' using errcode='22023'; end if;
  if encode(decode(pubkey,'base64'),'base64')<>pubkey then raise exception 'Invalid signing key' using errcode='22023'; end if;
  -- Same lock order as profile updates; a UID cannot race its identity binding.
  select doc into private_person from public.users where id=actor for update;
  select doc into person from public.persons where id=actor for update;
  if person is null or private_person is null then raise exception 'Profile required' using errcode='LS001'; end if;
  if jsonb_typeof(person->'uid') is distinct from 'string' or jsonb_typeof(private_person->'uid') is distinct from 'string'
    or person->>'uid' is distinct from actor or private_person->>'uid' is distinct from actor
    or private_person->>'lid' is distinct from person->>'lid'
    or coalesce(person->>'lid','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Signing identity needs review' using errcode='LS026'; end if;
  moment:=clock_timestamp();
  fingerprint:=encode(public.digest(convert_to(pubkey,'UTF8'),'sha256'),'hex');
  epoch:='anchor_' || fingerprint;
  select doc into old_key from public.person_keys where person_id=actor and id=fingerprint;
  if old_key is not null and old_key->>'pubkey' is distinct from pubkey then
    raise exception 'Signing identity needs review' using errcode='LS026'; end if;
  if person ? 'signingEpochId' then
    epoch:=person->>'signingEpochId';
    select doc into old_event from public.person_key_events where person_id=actor and id=epoch;
    if person->>'publicKeyPem' is distinct from pubkey or person->>'signingKeyFingerprint' is distinct from fingerprint
      or coalesce(person->>'signingState','') not in ('active','frozen') or old_event is null
      or old_event->>'epochId' is distinct from epoch or old_event->>'lid' is distinct from person->>'lid'
      or old_event->>'uid' is distinct from actor or old_event->>'keyFingerprint' is distinct from fingerprint
      or coalesce(old_event->>'type','') not in ('anchor','rotate','recover') then
      raise exception 'Signing identity needs review' using errcode='LS026'; end if;
    -- Repair only a missing lineage record. Never change the current epoch or thaw it.
    if old_key is null then insert into public.person_keys(person_id,id,doc)
      values(actor,fingerprint,jsonb_build_object('pubkey',pubkey,'publishedAt',moment)); end if;
    return seed.signing_identity(actor);
  end if;
  if (person->>'publicKeyPem' is not null and person->>'publicKeyPem' not in ('',pubkey))
    or person ?| array['signingKeyFingerprint','signingState','signingAnchoredAt','signingFrozenAt','signingFreezeEventId']
    or exists(select 1 from public.person_key_events where person_id=actor)
    then raise exception 'Signing identity needs review' using errcode='LS026'; end if;
  if old_key is null then insert into public.person_keys(person_id,id,doc)
    values(actor,fingerprint,jsonb_build_object('pubkey',pubkey,'publishedAt',moment)); end if;
  insert into public.person_key_events(person_id,id,doc) values(actor,epoch,jsonb_build_object(
    'version',1,'type','anchor','uid',actor,'lid',person->>'lid','epochId',epoch,'keyFingerprint',fingerprint,'recordedAt',moment));
  update public.persons set doc=person || jsonb_build_object('publicKeyPem',pubkey,'signingKeyFingerprint',fingerprint,
    'signingEpochId',epoch,'signingState','active','signingAnchoredAt',moment) where id=actor;
  return seed.signing_identity(actor);
end;
$$;
revoke all on function seed.signing_anchor(jsonb) from public;
