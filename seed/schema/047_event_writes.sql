-- Server preparation and this capability share one transaction. Standing, event
-- words and community place stay locked until their edit/birth is committed.
create function seed.event_draft_context(command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); action text:=command->>'action'; profile jsonb; event jsonb; community jsonb;
  community_id text; keeps boolean; staff boolean; own boolean; adopting boolean:=false;
  item jsonb; object_path text; images jsonb:='[]';
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or coalesce(action,'') not in ('create','edit')
    or octet_length(command::text)>262144
    or command - array['action','id','title','body','eventDate','eventEndDate','eventLocation','eventMaxParticipants','webLinks','visibility','communityId','paths'] <> '{}'::jsonb
    or (action='create' and command ? 'id')
    or jsonb_typeof(command->'title') is distinct from 'string' or length(command->>'title') not between 1 and 240
    or btrim(command->>'title')='' or command->>'title' ~ '[[:cntrl:]]'
    or jsonb_typeof(command->'body') is distinct from 'string' or length(command->>'body')>64000
    or jsonb_typeof(command->'eventDate') is distinct from 'string' or length(command->>'eventDate')>64
    or jsonb_typeof(command->'eventEndDate') is distinct from 'string' or length(command->>'eventEndDate')>64
    or jsonb_typeof(command->'eventLocation') is distinct from 'string' or length(command->>'eventLocation')>2000
    or jsonb_typeof(command->'webLinks') is distinct from 'array'
    or coalesce(command->>'visibility','') not in ('public','node','community','private') then
    raise exception 'Invalid event draft' using errcode='22023'; end if;
  if command->'eventMaxParticipants' is distinct from 'null'::jsonb and
    (jsonb_typeof(command->'eventMaxParticipants') is distinct from 'number'
    or (command->>'eventMaxParticipants')::numeric not between 1 and 9007199254740991
    or trunc((command->>'eventMaxParticipants')::numeric)<>(command->>'eventMaxParticipants')::numeric) then
    raise exception 'Invalid event capacity' using errcode='22023'; end if;
  select doc into profile from public.users where id=actor for share;
  if action='create' and (profile is null or jsonb_typeof(profile->'uid') is distinct from 'string' or profile->>'uid'<>actor) then
    raise exception 'Profile required' using errcode='LS001'; end if;
  perform 1 from public.admins where id=actor for share;
  perform 1 from public.config where id='superadmin' for share;
  staff:=seed.is_staff();
  if action='edit' then
    if jsonb_typeof(command->'id') is distinct from 'string' or length(command->>'id') not between 1 and 512 then
      raise exception 'Invalid event' using errcode='22023'; end if;
    select doc into event from public.pulses where id=command->>'id' for update;
    if event is null or event->>'type' is distinct from 'event' then raise exception 'Event unavailable' using errcode='LS038'; end if;
    if event ?| array['hashVersion','authorSignature','lifetreeId','visionId'] then
      raise exception 'Chain records cannot be edited as events' using errcode='22023'; end if;
    if event ? 'communityId' and (jsonb_typeof(event->'communityId') is distinct from 'string' or event->>'communityId'='') then
      raise exception 'Invalid event place' using errcode='22023'; end if;
    community_id:=event->>'communityId';
    own:=coalesce(jsonb_typeof(event->'authorId')='string' and event->>'authorId'=actor,false);
  end if;
  if command ? 'communityId' then
    if jsonb_typeof(command->'communityId') is distinct from 'string' or length(command->>'communityId') not between 1 and 512 then
      raise exception 'Invalid event community' using errcode='22023'; end if;
    if community_id is not null and community_id<>command->>'communityId' then
      raise exception 'Event place is fixed' using errcode='22023'; end if;
    adopting:=action='edit' and community_id is null;
    community_id:=command->>'communityId';
  end if;
  if community_id is not null then
    select doc into community from public.communities where id=community_id for share;
    if community is null then raise exception 'Community unavailable' using errcode='LS003'; end if;
    perform 1 from public.links where from_id=actor and to_id=community_id and rel='keeper' for share;
    keeps:=coalesce(jsonb_typeof(community->'anchorUid')='string' and community->>'anchorUid'=actor,false)
      or exists(select 1 from public.links where from_id=actor and to_id=community_id and rel='keeper');
  else keeps:=false; end if;
  if action='create' and community_id is not null and not staff and not keeps then
    raise exception 'Not a community keeper' using errcode='42501'; end if;
  if action='edit' and not adopting and not own and not staff and not keeps then
    raise exception 'Not an event editor' using errcode='42501'; end if;
  if adopting and (not keeps or jsonb_typeof(event->'domain') is distinct from 'string'
    or coalesce(event->>'domain','')='' or community->>'domain' is distinct from event->>'domain') then
    raise exception 'Adoption requires the event place keeper' using errcode='42501'; end if;
  if (community_id is null and command->>'visibility'='community') or (community_id is not null and command->>'visibility'='node') then
    raise exception 'Visibility does not belong to this place' using errcode='22023'; end if;
  if action='create' and not(command ? 'paths') then raise exception 'Pictures required' using errcode='22023'; end if;
  if command ? 'paths' then
    if jsonb_typeof(command->'paths') is distinct from 'array' then raise exception 'Invalid pictures' using errcode='22023'; end if;
    if jsonb_array_length(command->'paths')>100 or (select count(*) from jsonb_array_elements(command->'paths'))<>
      (select count(distinct value) from jsonb_array_elements(command->'paths')) then raise exception 'Invalid pictures' using errcode='22023'; end if;
    for item in select value from jsonb_array_elements(command->'paths') loop
      object_path:=item#>>'{}';
      if jsonb_typeof(item) is distinct from 'string' or not seed.media_path_valid(object_path)
        or not exists(select 1 from seed.media_objects where path=object_path) then raise exception 'Published picture required' using errcode='22023'; end if;
      images:=images || jsonb_build_array('/v1/media?path=' || object_path);
    end loop;
  end if;
  return jsonb_build_object('profile',coalesce(profile,'{}'::jsonb),'event',event,'community',community,'communityId',community_id,'adopting',adopting,'images',images);
end;
$$;
revoke all on function seed.event_draft_context(jsonb) from public;

create function seed.apply_event_write(command jsonb,prepared jsonb,proof jsonb,node_domain text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare context jsonb; event jsonb; record jsonb; expected_domain text; community_id text;
begin
  context:=seed.event_draft_context(command);community_id:=context->>'communityId';
  if command->>'action'='edit' then
    if jsonb_typeof(prepared) is distinct from 'object' or prepared - array['title','body','content','eventDate','eventEndDate','eventLocation','eventMaxParticipants','webLinks','visibility','imageUrl','imageUrls'] <> '{}'::jsonb
      or (not(command ? 'paths') and prepared ?| array['imageUrl','imageUrls']) then
      raise exception 'Invalid event patch' using errcode='22023'; end if;
    record:=(context->'event') || prepared || jsonb_build_object('updatedAt',clock_timestamp());
    if context->'adopting'='true'::jsonb then
      record:=record || jsonb_build_object('communityId',community_id,'communityName',context->'community'->>'name');
    end if;
  else
    record:=prepared;
    expected_domain:=coalesce(nullif(context->'community'->>'domain',''),node_domain);
    if jsonb_typeof(record) is distinct from 'object' or record->>'type' is distinct from 'event'
      or record->>'authorId' is distinct from seed.uid() or record->>'domain' is distinct from expected_domain
      or coalesce(expected_domain,'')='' or record->>'communityId' is distinct from community_id
      or record->>'previousHash' is distinct from (case when community_id is null then 'EVENT' else 'COMMUNITY_EVENT' end)
      or record->'loveCount' is distinct from '0'::jsonb or record->'commentCount' is distinct from '0'::jsonb
      or record ?| array['lifetreeId','visionId','authorSignature','birthPreimage','circleCommunityId','participantUids','descendsFromId','lineageRootId','generation']
      or coalesce(record->>'id','') !~ '^[A-Za-z0-9_-]{1,128}$'
      or coalesce(record->>'lid','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(record->>'hash','') !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(proof->'preimage') is distinct from 'string' or proof->>'authorId' is distinct from seed.uid()
      or proof->'mintedAt' is distinct from record->'mintedAt' or proof->'visibility' is distinct from record->'visibility'
      or record->>'hash' is distinct from encode(public.digest(convert_to(proof->>'preimage','UTF8'),'sha256'),'hex') then
      raise exception 'Invalid event birth' using errcode='22023'; end if;
  end if;
  if record->>'title' is distinct from command->>'title' or record->>'body' is distinct from command->>'body'
    or record->>'content' is distinct from command->>'body' or record->>'visibility' is distinct from command->>'visibility'
    or record->'eventDate' is distinct from command->'eventDate' or record->'eventEndDate' is distinct from command->'eventEndDate'
    or record->'eventLocation' is distinct from command->'eventLocation' or record->'eventMaxParticipants' is distinct from command->'eventMaxParticipants'
    or (command ? 'paths' and (record->'imageUrls' is distinct from context->'images' or record->>'imageUrl' is distinct from coalesce(context->'images'->>0,''))) then
    raise exception 'Event content changed' using errcode='22023'; end if;
  if command->>'action'='edit' then
    update public.pulses set doc=record where id=command->>'id';
    return jsonb_build_object('event',record || jsonb_build_object('id',command->>'id'));
  end if;
  insert into public.pulses(id,doc) values(record->>'id',record);
  insert into seed.event_birth_proofs(event_id,author_id,visibility,preimage,minted_at,hash)
    values(record->>'id',seed.uid(),proof->>'visibility',proof->>'preimage',(proof->>'mintedAt')::bigint,record->>'hash');
  return jsonb_build_object('event',record);
end;
$$;
revoke all on function seed.apply_event_write(jsonb,jsonb,jsonb,text) from public;
