-- A freeze is account-authorized emergency revocation, not a replacement key.
create function seed.signing_freeze(command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); person jsonb; private_person jsonb; epoch jsonb; frozen jsonb;
  epoch_id text:=command->>'epochId'; fingerprint text:=command->>'fingerprint'; event_id text;
  moment timestamptz; anchored timestamptz; claimed timestamptz; event jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or command->>'action' is distinct from 'freeze'
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','epochId','fingerprint','suspectedSinceMs'))
    or jsonb_typeof(command->'epochId') is distinct from 'string' or epoch_id !~ '^[A-Za-z0-9_-]{1,128}$'
    or jsonb_typeof(command->'fingerprint') is distinct from 'string' or fingerprint !~ '^[a-f0-9]{64}$'
    then raise exception 'Invalid freeze' using errcode='22023'; end if;
  if command ? 'suspectedSinceMs' then
    if jsonb_typeof(command->'suspectedSinceMs') is distinct from 'number' then raise exception 'Invalid freeze' using errcode='22023'; end if;
    if (command->>'suspectedSinceMs')::numeric not between 0 and 253402300799999
      or trunc((command->>'suspectedSinceMs')::numeric)<>(command->>'suspectedSinceMs')::numeric then
      raise exception 'Invalid freeze' using errcode='22023'; end if;
    claimed:=to_timestamp((command->>'suspectedSinceMs')::numeric/1000);
  end if;
  select doc into private_person from public.users where id=actor for update;
  select doc into person from public.persons where id=actor for update;
  if person is null or private_person is null then raise exception 'Profile required' using errcode='LS001'; end if;
  if jsonb_typeof(person->'uid') is distinct from 'string' or jsonb_typeof(private_person->'uid') is distinct from 'string'
    or person->>'uid' is distinct from actor or private_person->>'uid' is distinct from actor
    or private_person->>'lid' is distinct from person->>'lid'
    or coalesce(person->>'lid','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or person->>'signingEpochId' is distinct from epoch_id or person->>'signingKeyFingerprint' is distinct from fingerprint
    or fingerprint is distinct from encode(public.digest(convert_to(person->>'publicKeyPem','UTF8'),'sha256'),'hex') then
    raise exception 'Signing identity needs review' using errcode='LS026'; end if;
  select doc into epoch from public.person_key_events where person_id=actor and id=epoch_id;
  if epoch is null or epoch->>'epochId' is distinct from epoch_id or epoch->>'keyFingerprint' is distinct from fingerprint
    or epoch->>'uid' is distinct from actor or epoch->>'lid' is distinct from person->>'lid'
    or coalesce(epoch->>'type','') not in ('anchor','rotate','recover') then
    raise exception 'Signing identity needs review' using errcode='LS026'; end if;
  -- Native timestamps are ISO strings. Imported timestamp encodings need normalization first.
  if jsonb_typeof(epoch->'recordedAt') is distinct from 'string' then raise exception 'Signing identity needs review' using errcode='LS026'; end if;
  begin anchored:=(epoch->>'recordedAt')::timestamptz;
  exception when others then raise exception 'Signing identity needs review' using errcode='LS026'; end;
  if not isfinite(anchored) then raise exception 'Signing identity needs review' using errcode='LS026'; end if;
  event_id:='freeze_' || epoch_id;
  select doc into frozen from public.person_key_events where person_id=actor and id=event_id;
  if person->>'signingState'='frozen' then
    if frozen is null or frozen->>'type' is distinct from 'freeze' or frozen->>'epochId' is distinct from epoch_id
      or frozen->>'keyFingerprint' is distinct from fingerprint or frozen->>'uid' is distinct from actor
      or frozen->>'lid' is distinct from person->>'lid' or person->>'signingFreezeEventId' is distinct from event_id
      or jsonb_typeof(frozen->'recordedAt') is distinct from 'string'
      or frozen->'recordedAt' is distinct from person->'signingFrozenAt' then
      raise exception 'Signing identity needs review' using errcode='LS026'; end if;
    return seed.signing_identity(actor);
  end if;
  if person->>'signingState' is distinct from 'active' or frozen is not null then
    raise exception 'Signing identity needs review' using errcode='LS026'; end if;
  moment:=clock_timestamp();
  if anchored>moment or (claimed is not null and (claimed<anchored or claimed>moment)) then
    raise exception 'Invalid compromise time' using errcode='22023'; end if;
  event:=jsonb_build_object('version',1,'type','freeze','uid',actor,'lid',person->>'lid',
    'epochId',epoch_id,'keyFingerprint',fingerprint,'recordedAt',moment);
  if claimed is not null then event:=event || jsonb_build_object('claimedSuspectedSince',claimed); end if;
  insert into public.person_key_events(person_id,id,doc) values(actor,event_id,event);
  update public.persons set doc=person || jsonb_build_object('signingState','frozen','signingFrozenAt',moment,'signingFreezeEventId',event_id) where id=actor;
  return seed.signing_identity(actor);
end;
$$;
revoke all on function seed.signing_freeze(jsonb) from public;

create function seed.signing_history(subject text, kind text, after_id text, page_limit integer) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare rows jsonb; next_id text;
begin
  if subject is null or length(subject) not between 1 and 128 or subject ~ '[[:cntrl:]]'
    or kind is null or kind not in ('keys','events') or page_limit is null or page_limit not between 1 and 100
    or (after_id is not null and (length(after_id) not between 1 and 512 or after_id ~ '[[:cntrl:]]')) then
    raise exception 'Invalid history query' using errcode='22023'; end if;
  with history as (
    select id,doc from public.person_keys where kind='keys' and person_id=subject
    union all select id,doc from public.person_key_events where kind='events' and person_id=subject
  ), page as (
    select id,doc from history where after_id is null or id collate "C">after_id collate "C" order by id collate "C" limit page_limit+1
  ), numbered as (select id,doc,row_number() over(order by id collate "C") as n from page)
  select coalesce(jsonb_agg(doc || jsonb_build_object('id',id) order by id collate "C") filter(where n<=page_limit),'[]'::jsonb),
    case when count(*)>page_limit then max(id) filter(where n=page_limit) else null end into rows,next_id from numbered;
  return jsonb_build_object('items',rows,'next',next_id);
end;
$$;
revoke all on function seed.signing_history(text,text,text,integer) from public;
