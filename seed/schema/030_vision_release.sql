-- Mirrors the existing public-link withdrawal policy for release cleanup only.
-- This helper is not a general client graph mutation capability.
create function seed.release_link_allowed(source text, relation text, target text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and (
    seed.is_staff()
    or (source=seed.uid() and relation not in ('invited_by','welcomed_by','party','collaborates_with','recognises','shares_resources_with','accepts_coin_of','descends_from'))
    or (relation='participant' and seed.is_tree_keeper(source,(select doc from public.lifetrees where id=source)))
    or (relation in ('guardian','keeper_request') and seed.is_tree_keeper(target,(select doc from public.lifetrees where id=target)))
    or (relation='grows_in' and (seed.is_tree_keeper(source,(select doc from public.lifetrees where id=source))
      or exists(select 1 from public.links where from_id=seed.uid() and rel='steward' and to_id=source)))
    or (relation in ('rooted','shelters') and exists(select 1 from public.light_houses where id=source and jsonb_typeof(doc->'anchorUid')='string' and doc->>'anchorUid'=seed.uid()))
    or (relation in ('collaborates_with','recognises','shares_resources_with','accepts_coin_of') and (
      exists(select 1 from public.communities where id=source and jsonb_typeof(doc->'anchorUid')='string' and doc->>'anchorUid'=seed.uid())
      or exists(select 1 from public.links where from_id=seed.uid() and rel='keeper' and to_id=source)))
    or (relation in ('grows_in','member','join_request','keeper_request','steward') and (
      exists(select 1 from public.communities where id=target and jsonb_typeof(doc->'anchorUid')='string' and doc->>'anchorUid'=seed.uid())
      or exists(select 1 from public.links where from_id=seed.uid() and to_id=target and (rel='keeper' or (rel='steward' and relation<>'steward')))))
  );
$$;
revoke all on function seed.release_link_allowed(text,text,text) from public;

create function seed.vision_release(command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare target text:=command->>'id'; vision jsonb; removed bigint;
begin
  if seed.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or command->>'action' is distinct from 'release'
    or jsonb_typeof(command->'id') is distinct from 'string' or length(target) not between 1 and 512 or target ~ '[[:cntrl:]]'
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','id')) then
    raise exception 'Invalid command' using errcode='22023'; end if;
  select doc into vision from public.visions where id=target for update;
  if not found or not coalesce(seed.can_read_vision(vision),false) then raise exception 'Vision missing' using errcode='LS025'; end if;
  if not seed.is_staff() and (jsonb_typeof(vision->'authorId') is distinct from 'string' or vision->>'authorId' is distinct from seed.uid()) then
    raise exception 'Forbidden' using errcode='42501'; end if;
  -- As with the existing best-effort release, inaccessible incoming edges survive.
  -- Outgoing edges, media, private ledgers and signed contribution records stand.
  delete from public.links where to_id=target and seed.release_link_allowed(from_id,rel,to_id);
  get diagnostics removed = row_count;
  delete from public.visions where id=target;
  return jsonb_build_object('released',target,'removedLinks',removed);
end;
$$;
revoke all on function seed.vision_release(jsonb) from public;
