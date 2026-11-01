-- Asking grants no role. Answering creates a pending invitation, never a keeper seat.
create function seed.tree_keeper_request(command jsonb,new_lid text,token text,ids text[]) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); action text:=command->>'action'; target text:=command->>'id';
  subject text:=command->>'member'; tree jsonb; private_request boolean; result jsonb; asked boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or coalesce(action,'') not in ('request_keeper','cancel_keeper_request','decline_keeper_request','answer_keeper_request')
    or jsonb_typeof(command->'id') is distinct from 'string' or length(target) not between 1 and 128 or target ~ '[[:space:][:cntrl:]]'
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','id','member','role'))
    or new_lid is null or new_lid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then raise exception 'Invalid command' using errcode='22023'; end if;
  if action in ('request_keeper','cancel_keeper_request') then
    if command ? 'member' then raise exception 'Invalid command' using errcode='22023'; end if;subject:=actor;
  elsif jsonb_typeof(command->'member') is distinct from 'string' or length(subject) not between 1 and 128 or subject ~ '[[:space:][:cntrl:]]' then
    raise exception 'Invalid command' using errcode='22023'; end if;
  if action='answer_keeper_request' then
    if coalesce(command->>'role','') not in ('keeper','steward','guardian','observer') then raise exception 'Invalid role' using errcode='22023'; end if;
  elsif command ? 'role' then raise exception 'Invalid command' using errcode='22023'; end if;
  select doc into tree from public.lifetrees where id=target for update;
  if not found then raise exception 'Tree missing' using errcode='LS014'; end if;
  private_request:=coalesce(tree->>'treeType'='SECRET',false);
  if action='request_keeper' then
    if seed.is_tree_keeper(target,tree) then raise exception 'Already keeper' using errcode='LS016'; end if;
    if private_request then
      insert into public.secret_links(from_id,rel,to_id,lid) values(actor,'keeper_request',target,new_lid) on conflict do nothing;
      delete from public.links where from_id=actor and rel='keeper_request' and to_id=target;
    else
      insert into public.links(from_id,rel,to_id,lid) values(actor,'keeper_request',target,new_lid) on conflict do nothing;
    end if;
    return jsonb_build_object('id',target,'requested',true);
  end if;
  if action='decline_keeper_request' and not(seed.is_tree_keeper(target,tree) or seed.is_staff()) then
    raise exception 'Forbidden' using errcode='42501'; end if;
  if action='answer_keeper_request' then
    -- The invitation command rechecks keeper/steward authority and secret role limits.
    -- Check authority before revealing whether this person has a pending request.
    if not(seed.is_tree_keeper(target,tree) or seed.is_staff() or exists(select 1 from public.links where from_id=actor and rel='steward' and to_id=target)) then
      raise exception 'Forbidden' using errcode='42501'; end if;
    asked:=exists(select 1 from public.links where from_id=subject and rel='keeper_request' and to_id=target)
      or (private_request and exists(select 1 from public.secret_links where from_id=subject and rel='keeper_request' and to_id=target));
    if not asked then raise exception 'Request missing' using errcode='LS006'; end if;
    result:=seed.tree_invite_command(jsonb_build_object('action','mint','treeId',target,'member',subject,'open',false,'role',command->>'role'),token,ids);
  end if;
  delete from public.links where from_id=subject and rel='keeper_request' and to_id=target;
  if private_request then delete from public.secret_links where from_id=subject and rel='keeper_request' and to_id=target; end if;
  return coalesce(result,jsonb_build_object('id',target,'requested',false));
end;
$$;
revoke all on function seed.tree_keeper_request(jsonb,text,text,text[]) from public;
