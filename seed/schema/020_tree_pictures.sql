-- Picture lists contain ordered media references, never relationship authority.
create function seed.tree_pictures(command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare target text:=command->>'id'; tree jsonb; item jsonb; object_path text; images jsonb:='[]'::jsonb;
begin
  if seed.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or command->>'action' is distinct from 'set_pictures'
    or jsonb_typeof(command->'id') is distinct from 'string' or length(target) not between 1 and 512
    or target ~ '[[:space:][:cntrl:]]'
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','id','paths'))
    or jsonb_typeof(command->'paths') is distinct from 'array' then raise exception 'Invalid command' using errcode='22023'; end if;
  if jsonb_array_length(command->'paths')>100
    or (select count(*) from jsonb_array_elements(command->'paths'))<>(select count(distinct value) from jsonb_array_elements(command->'paths')) then
    raise exception 'Invalid command' using errcode='22023'; end if;
  select doc into tree from public.lifetrees where id=target for update;
  if not found or not coalesce(seed.can_read_tree(target,tree),false) then raise exception 'Tree missing' using errcode='LS014'; end if;
  if not coalesce(seed.can_edit_tree(target,tree),false) then raise exception 'Forbidden' using errcode='42501'; end if;
  for item in select value from jsonb_array_elements(command->'paths') loop
    object_path:=item#>>'{}';
    if jsonb_typeof(item) is distinct from 'string' or not seed.media_path_valid(object_path)
      or not exists(select 1 from seed.media_objects where path=object_path) then
      raise exception 'Published image required' using errcode='22023'; end if;
    -- Validated paths contain no query delimiters; relative URLs stay on this node.
    images:=images || jsonb_build_array('/v1/media?path=' || object_path);
  end loop;
  tree:=tree || jsonb_build_object('imageUrls',images,'imageUrl',coalesce(images->>0,''),'updatedAt',now());
  update public.lifetrees set doc=tree where id=target;
  -- No chain or latestGrowthUrl edits: signed growth is a separate operation.
  return jsonb_build_object('tree',tree || jsonb_build_object('id',target));
end;
$$;
revoke all on function seed.tree_pictures(jsonb) from public;
