-- Self-following never grants keeper authority. Circle seat grants stay invitation-only.
create function seed.link_command(command jsonb,new_lid text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); action text:=command->>'action'; subject text:=command->>'from';
  relation text:=command->>'rel'; target text:=command->>'to'; tree jsonb; allowed boolean:=false;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or coalesce(action,'') not in ('link','unlink')
    or coalesce(relation,'') not in ('joined','guardian','observer','steward')
    or (action='link' and relation not in ('joined','guardian'))
    or jsonb_typeof(command->'from') is distinct from 'string' or length(subject) not between 1 and 128 or subject ~ '[[:space:][:cntrl:]]'
    or jsonb_typeof(command->'to') is distinct from 'string' or length(target) not between 1 and 512 or target ~ '[[:space:][:cntrl:]]'
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','from','rel','to'))
    or new_lid is null or new_lid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then raise exception 'Invalid command' using errcode='22023'; end if;
  if relation='joined' then
    allowed:=subject=actor;
  else
    -- Same target-row order as tree invitations, edits and succession.
    select doc into tree from public.lifetrees where id=target for update;
    if not found and not(action='unlink' and subject=actor) then raise exception 'Forbidden' using errcode='42501'; end if;
    -- Community stewardship must use the community command and its membership locks.
    if relation='steward' and exists(select 1 from public.communities where id=target) then
      raise exception 'Invalid command' using errcode='22023'; end if;
    if action='link' then
      allowed:=subject=actor and coalesce(tree->>'treeType','')<>'SECRET'
        and coalesce(tree->>'visibility','public')<>'private';
    else
      allowed:=subject=actor or (relation='guardian' and seed.is_tree_keeper(target,tree));
    end if;
  end if;
  if not coalesce(allowed,false) then raise exception 'Forbidden' using errcode='42501'; end if;
  if action='link' then
    -- Repeating a follow retains its original LID and tenure, including veto standing.
    insert into public.links(from_id,rel,to_id,lid,doc) values(subject,relation,target,new_lid,'{"type":"link"}') on conflict do nothing;
  else
    delete from public.links where from_id=subject and rel=relation and to_id=target;
  end if;
  return jsonb_build_object('from',subject,'rel',relation,'to',target,'linked',action='link');
end;
$$;
revoke all on function seed.link_command(jsonb,text) from public;
