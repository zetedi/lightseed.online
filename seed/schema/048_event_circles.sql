-- Formation shares the node-capacity lock with ordinary community founding.
-- Lineage/event locks serialize repeated asks; captured participation cannot
-- disappear or change tree ownership between preparation and commit.
create function seed.event_circle_context(event_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); event jsonb; root jsonb; host jsonb; community jsonb;
  root_id text; circle_id text; occurrences text[]; candidates text[]; trees jsonb; allowed boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if event_id is null or length(event_id) not between 1 and 512 then raise exception 'Invalid event' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('community:capacity',0));
  perform 1 from public.admins where id=actor for share;
  perform 1 from public.config where id='superadmin' for share;
  select doc into event from public.pulses where id=event_id;
  if event is null or event->>'type' is distinct from 'event' then raise exception 'Event unavailable' using errcode='LS038'; end if;
  root_id:=case when jsonb_typeof(event->'lineageRootId')='string' and event->>'lineageRootId'<>'' then event->>'lineageRootId' else event_id end;
  perform 1 from public.pulses where id in (event_id,root_id)
    or (doc->>'type'='event' and doc->>'lineageRootId'=root_id) order by id collate "C" for update;
  select doc into event from public.pulses where id=event_id;
  select doc into root from public.pulses where id=root_id;
  if event is null or event->>'type' is distinct from 'event' or root is null or root->>'type' is distinct from 'event'
    or (case when jsonb_typeof(event->'lineageRootId')='string' and event->>'lineageRootId'<>'' then event->>'lineageRootId' else event_id end)<>root_id then
    raise exception 'Event lineage unavailable' using errcode='LS038'; end if;
  select doc into host from public.communities where id=event->>'communityId' for share;
  perform 1 from public.links where from_id=actor and to_id=event->>'communityId' and rel='keeper' for share;
  allowed:=seed.is_staff() or (jsonb_typeof(event->'authorId')='string' and event->>'authorId'=actor)
    or (jsonb_typeof(event->'communityId')='string' and host is not null and ((jsonb_typeof(host->'anchorUid')='string' and host->>'anchorUid'=actor)
      or exists(select 1 from public.links where from_id=actor and to_id=event->>'communityId' and rel='keeper')));
  if not coalesce(allowed,false) then raise exception 'Not the event host' using errcode='42501'; end if;
  occurrences:=array(select id from public.pulses where id=root_id or (doc->>'type'='event' and doc->>'lineageRootId'=root_id));
  candidates:=array(select distinct from_id from public.links where rel='participant' and to_id=any(occurrences));
  perform 1 from public.lifetrees where id=any(candidates) order by id collate "C" for share;
  perform 1 from public.links where from_id=any(candidates) and rel='participant' and to_id=any(occurrences) order by id collate "C" for share;
  select coalesce(jsonb_agg(t.doc || jsonb_build_object('id',t.id) order by t.id collate "C"),'[]'::jsonb) into trees
    from public.lifetrees t where t.id=any(candidates) and coalesce(t.doc->>'treeType','') not in ('BED','SECRET')
      and exists(select 1 from public.links where from_id=t.id and rel='participant' and to_id=any(occurrences));
  if jsonb_array_length(trees)=0 then raise exception 'Event has no rooted participants' using errcode='LS039'; end if;
  if root ? 'circleCommunityId' and root->'circleCommunityId'<>'null'::jsonb and jsonb_typeof(root->'circleCommunityId') is distinct from 'string' then
    raise exception 'Invalid circle binding' using errcode='LS039'; end if;
  circle_id:=nullif(root->>'circleCommunityId','');
  if nullif(event->>'circleCommunityId','') is not null and event->>'circleCommunityId' is distinct from circle_id then
    raise exception 'Invalid occurrence binding' using errcode='LS039'; end if;
  if circle_id is not null then
    select doc into community from public.communities where id=circle_id for update;
    if community is null or community->>'formation' is distinct from 'event' or community->>'rootEventId' is distinct from root_id then
      raise exception 'Event circle needs review' using errcode='LS039'; end if;
  end if;
  return jsonb_build_object('event',event,'root',root,'rootId',root_id,'isHand',true,'trees',trees,'community',community);
end;
$$;
revoke all on function seed.event_circle_context(text) from public;

create function seed.apply_event_circle(event_id text,prepared jsonb,edges jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare context jsonb; circle_id text; root_id text; community jsonb; forming boolean; members text[]; tree_ids text[];
  edge jsonb; inserted integer; gathered integer:=0; cap numeric:=144; configured text;
begin
  context:=seed.event_circle_context(event_id);root_id:=context->>'rootId';
  forming:=nullif(context->'root'->>'circleCommunityId','') is null;
  members:=array(select distinct uid from (
    select seed.uid() as uid union all select value->>'anchorUid' from jsonb_array_elements(context->'trees') where jsonb_typeof(value->'anchorUid')='string' and value->>'anchorUid'<>''
  ) names);
  tree_ids:=array(select value->>'id' from jsonb_array_elements(context->'trees'));
  circle_id:=prepared->>'communityId';
  if forming then
    community:=prepared->'community';
    if prepared->>'action' is distinct from 'form' or coalesce(circle_id,'') !~ '^[A-Za-z0-9_-]{1,128}$'
      or jsonb_typeof(community) is distinct from 'object' or community->>'id' is distinct from circle_id
      or coalesce(community->>'lid','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or community->>'rootEventId' is distinct from root_id or community->>'anchorUid' is distinct from seed.uid()
      or community->>'formation' is distinct from 'event' or community->>'door' is distinct from 'invite'
      or community->>'visibility' is distinct from 'invited' or community->>'domain' is distinct from ''
      or jsonb_typeof(community->'name') is distinct from 'string' or btrim(community->>'name')=''
      or community ?| array['members','participants','latestHash','blockHeight'] then raise exception 'Invalid event circle' using errcode='22023'; end if;
    select doc->>'maxNodeCommunities' into configured from public.config where id='limits' for share;
    if configured ~ '^[0-9]+(\.[0-9]+)?$' and configured::numeric>=1 then cap:=floor(configured::numeric); end if;
    if (select count(*) from public.communities where doc->>'formation' is distinct from 'tree_keeping')>=cap then
      raise exception 'Node full' using errcode='LS002'; end if;
  else
    if prepared->>'action' is distinct from 'gather' or circle_id is distinct from context->'root'->>'circleCommunityId' then
      raise exception 'Circle binding changed' using errcode='LS039'; end if;
    community:=context->'community';
  end if;
  if jsonb_typeof(edges) is distinct from 'array' then raise exception 'Invalid circle links' using errcode='22023'; end if;
  if jsonb_array_length(edges)<>cardinality(members)+cardinality(tree_ids)
    or (select count(distinct (value->>'from',value->>'rel',value->>'to')) from jsonb_array_elements(edges))<>jsonb_array_length(edges) then
    raise exception 'Incomplete circle links' using errcode='22023'; end if;
  for edge in select value from jsonb_array_elements(edges) loop
    if edge->>'to' is distinct from circle_id or jsonb_typeof(edge->'from') is distinct from 'string'
      or coalesce(edge->>'lid','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or not coalesce((edge->>'rel'='member' and edge->>'from'=any(members)) or (edge->>'rel'='participant' and edge->>'from'=any(tree_ids)),false) then
      raise exception 'Invalid circle link' using errcode='22023'; end if;
  end loop;
  if forming then insert into public.communities(id,doc) values(circle_id,community); end if;
  for edge in select value from jsonb_array_elements(edges) loop
    insert into public.links(from_id,rel,to_id,lid,doc) values(edge->>'from',edge->>'rel',circle_id,edge->>'lid','{"type":"link"}') on conflict do nothing;
    get diagnostics inserted=row_count;
    if edge->>'rel'='member' then gathered:=gathered+inserted; end if;
  end loop;
  update public.pulses set doc=doc || jsonb_build_object('circleCommunityId',circle_id,'updatedAt',clock_timestamp()) where id in (root_id,event_id)
    and nullif(doc->>'circleCommunityId','') is null;
  return jsonb_build_object('communityId',circle_id,'name',community->>'name','members',gathered,'gathered',not forming);
end;
$$;
revoke all on function seed.apply_event_circle(text,jsonb,jsonb) from public;
