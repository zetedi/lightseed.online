-- Participation is a marker from a tree, never a person membership or admission key.
create function seed.participation_command(command jsonb,new_lid text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); action text:=command->>'action'; source text:=command->>'from'; target text:=command->>'to';
  tree jsonb; staff_allowed boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or coalesce(action,'') not in ('link','unlink')
    or command->>'rel' is distinct from 'participant'
    or jsonb_typeof(command->'from') is distinct from 'string' or length(source) not between 1 and 128 or source ~ '[[:space:][:cntrl:]]'
    or jsonb_typeof(command->'to') is distinct from 'string' or length(target) not between 1 and 512 or target ~ '[[:space:][:cntrl:]]'
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','from','rel','to'))
    or new_lid is null or new_lid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then raise exception 'Invalid command' using errcode='22023'; end if;
  select doc into tree from public.lifetrees where id=source for update;
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  staff_allowed:=seed.is_staff() and (action='unlink' or not exists(select 1 from public.config
    where id='staffHands' and doc ? 'link_mint' and doc->'link_mint' is distinct from 'true'::jsonb));
  if not(seed.is_tree_keeper(source,tree) or staff_allowed) then raise exception 'Forbidden' using errcode='42501'; end if;
  if action='link' then
    if tree->>'treeType'='SECRET' then raise exception 'Forbidden' using errcode='42501'; end if;
    insert into public.links(from_id,rel,to_id,lid,doc) values(source,'participant',target,new_lid,'{"type":"link"}') on conflict do nothing;
  else
    delete from public.links where from_id=source and rel='participant' and to_id=target;
  end if;
  return jsonb_build_object('from',source,'rel','participant','to',target,'linked',action='link');
end;
$$;
revoke all on function seed.participation_command(jsonb,text) from public;
