-- Door delegation and keeper resignation share the community lock used by admission
-- and editing. Keeper seats cannot be appointed here: rooted acceptance is separate.
create function seed.community_role_command(command jsonb, new_lid text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); target text:=command->>'id'; action text:=command->>'action';
  subject text:=command->>'member'; community jsonb; anchor text; keeps boolean; successor text;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or coalesce(action,'') not in ('grant_steward','revoke_steward','resign_keeper')
    or target is null or length(target) not between 1 and 128
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','id','member'))
    or (action='resign_keeper' and command ? 'member')
    then raise exception 'Invalid command' using errcode='22023'; end if;
  select doc into community from public.communities where id=target for update;
  if not found then raise exception 'Community missing' using errcode='LS003'; end if;
  anchor:=community->>'anchorUid';
  if anchor is null or anchor='' then raise exception 'Community identity needs review' using errcode='LS012'; end if;
  keeps:=anchor=actor or exists(select 1 from public.links where from_id=actor and rel='keeper' and to_id=target);
  if action='resign_keeper' then
    if not keeps then raise exception 'Forbidden' using errcode='42501'; end if;
    if anchor=actor then
      select from_id into successor from public.links where rel='keeper' and to_id=target and from_id<>actor
        order by created_at, from_id collate "C" limit 1;
      if successor is null then raise exception 'Last keeper' using errcode='LS011'; end if;
      -- Remove both the promoted seat and any stray duplicate of the old anchor.
      delete from public.links where rel='keeper' and to_id=target and from_id in (actor,successor);
      community:=community || jsonb_build_object('anchorUid',successor);
    else
      delete from public.links where from_id=actor and rel='keeper' and to_id=target;
    end if;
    -- Compatibility ACL mirror, derived from canonical links rather than caller arrays.
    community:=community || jsonb_build_object('updatedAt',now(),'keeperUids',
      (select coalesce(jsonb_agg(from_id order by from_id collate "C"),'[]'::jsonb) from public.links
        where rel='keeper' and to_id=target and from_id<>community->>'anchorUid'));
    update public.communities set doc=community where id=target;
    return jsonb_build_object('resigned',actor,'successor',successor);
  end if;
  if subject is null or length(subject) not between 1 and 128 or subject ~ '[[:space:][:cntrl:]]'
    then raise exception 'Invalid command' using errcode='22023'; end if;
  if not keeps and not (action='revoke_steward' and subject=actor)
    then raise exception 'Forbidden' using errcode='42501'; end if;
  if action='grant_steward' then
    if new_lid is null or new_lid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then raise exception 'Invalid identity' using errcode='22023'; end if;
    if anchor<>subject and not exists(select 1 from public.links where from_id=subject and rel='member' and to_id=target)
      then raise exception 'Membership required' using errcode='LS013'; end if;
    insert into public.links(from_id,rel,to_id,lid) values(subject,'steward',target,new_lid) on conflict do nothing;
  else
    delete from public.links where from_id=subject and rel='steward' and to_id=target;
  end if;
  return jsonb_build_object('id',target,'member',subject,'steward',action='grant_steward');
end;
$$;
revoke all on function seed.community_role_command(jsonb,text) from public;
