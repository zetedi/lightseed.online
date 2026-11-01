-- Editable events retain their original birth proof separately from later words.
create table seed.event_birth_proofs(event_id text primary key,author_id text not null,visibility text not null,
  preimage text not null,minted_at bigint not null,hash text not null);
alter table seed.event_birth_proofs enable row level security;

create function seed.event_copy_context(event_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); parent jsonb; profile jsonb; community jsonb; community_id text; allowed boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select doc into profile from public.users where id=actor for share;
  perform 1 from public.admins where id=actor for share;
  perform 1 from public.config where id='superadmin' for share;
  select doc into parent from public.pulses where id=event_id for share;
  if parent is null or parent->>'type' is distinct from 'event' then raise exception 'Event unavailable' using errcode='LS038'; end if;
  community_id:=case when jsonb_typeof(parent->'communityId')='string' then parent->>'communityId' else null end;
  select doc into community from public.communities where id=community_id for share;
  perform 1 from public.links where from_id=actor and to_id=community_id and rel='keeper' for share;
  allowed:=seed.is_staff() or (jsonb_typeof(parent->'authorId')='string' and parent->>'authorId'=actor)
    or (community is not null and ((jsonb_typeof(community->'anchorUid')='string' and community->>'anchorUid'=actor)
      or exists(select 1 from public.links where from_id=actor and to_id=community_id and rel='keeper')));
  if not coalesce(allowed,false) then raise exception 'Not an event host' using errcode='42501'; end if;
  return jsonb_build_object('parent',parent,'profile',coalesce(profile,'{}'::jsonb),'isHand',true);
end;
$$;
revoke all on function seed.event_copy_context(text) from public;

create function seed.apply_event_copy(parent_id text,record jsonb,proof jsonb,link_lid text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare context jsonb; parent jsonb; root text; expected_generation numeric; event_id text:=record->>'id';
begin
  context:=seed.event_copy_context(parent_id);parent:=context->'parent';
  root:=case when jsonb_typeof(parent->'communityId')='string' and parent->>'communityId'<>'' then 'COMMUNITY_EVENT' else 'EVENT' end;
  begin expected_generation:=coalesce((parent->>'generation')::numeric,0)+1;
  exception when others then raise exception 'Invalid lineage' using errcode='22023'; end;
  if expected_generation not between 1 and 9007199254740991 or trunc(expected_generation)<>expected_generation
    or jsonb_typeof(record) is distinct from 'object' or record->>'type' is distinct from 'event'
    or record->>'authorId' is distinct from seed.uid() or record->>'descendsFromId' is distinct from parent_id
    or record->>'lineageRootId' is distinct from coalesce(nullif(parent->>'lineageRootId',''),parent_id)
    or record->'generation' is distinct from to_jsonb(expected_generation)
    or record->>'previousHash' is distinct from root
    or record->'loveCount' is distinct from '0'::jsonb or record->'commentCount' is distinct from '0'::jsonb
    or record ?| array['lifetreeId','visionId','authorSignature','birthPreimage','circleCommunityId','participantUids']
    or coalesce(event_id,'') !~ '^[A-Za-z0-9_-]{1,128}$'
    or coalesce(record->>'lid','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(link_lid,'') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or record->>'lid'=link_lid or event_id=parent_id
    or coalesce(record->>'hash','') !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(proof->'preimage') is distinct from 'string'
    or proof->>'authorId' is distinct from seed.uid() or proof->'mintedAt' is distinct from record->'mintedAt'
    or proof->'visibility' is distinct from record->'visibility'
    or record->>'hash' is distinct from encode(public.digest(convert_to(proof->>'preimage','UTF8'),'sha256'),'hex') then
    raise exception 'Invalid event copy' using errcode='22023'; end if;
  -- These references cannot be changed through duplication, including private reach.
  if record->'communityId' is distinct from nullif(parent->'communityId','null'::jsonb)
    or record->'domain' is distinct from nullif(parent->'domain','null'::jsonb)
    or record->>'visibility' is distinct from (case when jsonb_typeof(parent->'visibility')='string' then parent->>'visibility' else 'public' end) then
    raise exception 'Event place changed' using errcode='22023'; end if;
  insert into public.pulses(id,doc) values(event_id,record);
  insert into seed.event_birth_proofs(event_id,author_id,visibility,preimage,minted_at,hash)
    values(event_id,seed.uid(),proof->>'visibility',proof->>'preimage',(proof->>'mintedAt')::bigint,record->>'hash');
  insert into public.links(from_id,rel,to_id,lid) values(event_id,'descends_from',parent_id,link_lid);
  return jsonb_build_object('event',record);
end;
$$;
revoke all on function seed.apply_event_copy(text,jsonb,jsonb,text) from public;
