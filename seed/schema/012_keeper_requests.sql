-- Keepership is consent: a person's request plus a sitting keeper's acceptance.
-- Roots match rootsABeing: beds and secret trees confer no outside standing.
create function seed.keeper_request_command(command jsonb, keeper_lid text, member_lid text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); action text:=command->>'action'; target text:=command->>'id';
  subject text:=command->>'member'; community jsonb; keeps boolean; rooted text;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or coalesce(action,'') not in
    ('request_keeper','cancel_keeper_request','accept_keeper_request','decline_keeper_request')
    or target is null or length(target) not between 1 and 128 or target ~ '[[:space:][:cntrl:]]'
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','id','member'))
    then raise exception 'Invalid command' using errcode='22023'; end if;
  if action in ('request_keeper','cancel_keeper_request') then
    if command ? 'member' then raise exception 'Invalid command' using errcode='22023'; end if;
    subject:=actor;
  elsif subject is null or length(subject) not between 1 and 128 or subject ~ '[[:space:][:cntrl:]]' then
    raise exception 'Invalid command' using errcode='22023';
  end if;
  select doc into community from public.communities where id=target for update;
  if not found then raise exception 'Community missing' using errcode='LS003'; end if;
  if coalesce(community->>'anchorUid','')='' then raise exception 'Community identity needs review' using errcode='LS012'; end if;
  keeps:=community->>'anchorUid'=actor or exists(select 1 from public.links where from_id=actor and rel='keeper' and to_id=target);
  if action in ('accept_keeper_request','decline_keeper_request') and not keeps then
    raise exception 'Forbidden' using errcode='42501'; end if;
  if action in ('cancel_keeper_request','decline_keeper_request') then
    delete from public.links where from_id=subject and rel='keeper_request' and to_id=target;
    return jsonb_build_object('id',target,'member',subject,'requested',false);
  end if;
  if community->>'anchorUid'=subject or exists(select 1 from public.links where from_id=subject and rel='keeper' and to_id=target)
    then raise exception 'Already keeper' using errcode='LS016'; end if;
  if keeper_lid is null or member_lid is null or keeper_lid=member_lid or exists(select 1 from unnest(array[keeper_lid,member_lid]) v
    where v !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
    raise exception 'Invalid identity' using errcode='22023'; end if;
  if action='request_keeper' then
    insert into public.links(from_id,rel,to_id,lid) values(actor,'keeper_request',target,keeper_lid) on conflict do nothing;
    return jsonb_build_object('id',target,'member',subject,'requested',true);
  end if;
  -- Lock the consent edge so its owner cannot withdraw it during acceptance.
  perform 1 from public.links where from_id=subject and rel='keeper_request' and to_id=target for update;
  if not found then raise exception 'Request missing' using errcode='LS006'; end if;
  select t.id into rooted from public.lifetrees t where coalesce(t.doc->>'treeType','') not in ('BED','SECRET') and
    (t.doc->>'anchorUid'=subject or exists(select 1 from public.links l where l.from_id=subject and l.rel='keeper' and l.to_id=t.id))
    order by t.id limit 1 for share of t;
  if rooted is null then raise exception 'Rooted tree required' using errcode='LS017'; end if;
  -- A co-keeper's seat is also held until the new relationship commits.
  if not exists(select 1 from public.lifetrees where id=rooted and doc->>'anchorUid'=subject) then
    perform 1 from public.links where from_id=subject and rel='keeper' and to_id=rooted for share;
    if not found then raise exception 'Rooted tree required' using errcode='LS017'; end if;
  end if;
  insert into public.links(from_id,rel,to_id,lid) values(subject,'keeper',target,keeper_lid) on conflict do nothing;
  insert into public.links(from_id,rel,to_id,lid) values(subject,'member',target,member_lid) on conflict do nothing;
  delete from public.links where from_id=subject and rel='keeper_request' and to_id=target;
  community:=community || jsonb_build_object('updatedAt',now(),'keeperUids',
    (select coalesce(jsonb_agg(from_id order by from_id collate "C"),'[]'::jsonb) from public.links
      where rel='keeper' and to_id=target and from_id<>community->>'anchorUid'));
  update public.communities set doc=community where id=target;
  return jsonb_build_object('id',target,'member',subject,'keeper',true);
end;
$$;
revoke all on function seed.keeper_request_command(jsonb,text,text) from public;
