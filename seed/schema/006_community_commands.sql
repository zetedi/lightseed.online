-- Community writes are narrow operations, not unrestricted JSON/table mutations.
-- A per-community row lock serializes doors, membership and edits. Founding also
-- serializes node capacity checks. The actor is never a command field.
create function seed.community_command(command jsonb, new_id text, birth_domain text) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare actor text := seed.uid(); action text := command->>'action'; target text := command->>'id';
  community jsonb; person jsonb; subject text; keeps boolean; answers boolean;
  cap numeric := 144; configured text; member_now boolean; requested boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) <> 'object' or action is null
    or action not in ('create','edit','join','request','leave','cancel','accept','decline','remove')
    or new_id is null or new_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then raise exception 'Invalid command' using errcode='22023'; end if;
  if exists (select 1 from jsonb_object_keys(command) k where k not in
    ('action','id','name','domain','door','member')) then raise exception 'Invalid command' using errcode='22023'; end if;
  select doc into person from public.persons where id=actor;
  if person is null or person->>'uid' is distinct from actor or coalesce(person->>'lid','') !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then raise exception 'Profile required' using errcode='LS001'; end if;
  if action in ('create','edit') then
    if jsonb_typeof(command->'name') is distinct from 'string' or length(command->>'name') not between 1 and 120
      or command->>'name' ~ '[[:cntrl:]]' or btrim(command->>'name') = ''
      or jsonb_typeof(command->'domain') is distinct from 'string' or length(command->>'domain') > 253
      or command->>'domain' !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
      or coalesce(command->>'door','') not in ('open','invite','closed')
      then raise exception 'Invalid command' using errcode='22023'; end if;
  end if;
  if action = 'create' then
    if birth_domain is null or birth_domain = '' then raise exception 'Node domain required' using errcode='22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended('community:capacity',0));
    select doc->>'maxNodeCommunities' into configured from public.config where id='limits';
    if configured ~ '^[0-9]+(\.[0-9]+)?$' and configured::numeric >= 1 then cap := floor(configured::numeric); end if;
    if (select count(*) from public.communities where doc->>'formation' is distinct from 'tree_keeping') >= cap
      then raise exception 'Node full' using errcode='LS002'; end if;
    target := new_id;
    community := jsonb_build_object('lid',new_id,'anchorUid',actor,'name',command->>'name',
      'domain',command->>'domain','door',command->>'door','bornOn',birth_domain,
      'formation','manual','imageUrls','[]'::jsonb,'createdAt',now(),'updatedAt',now());
    insert into public.communities(id,doc) values(target,community);
    -- Founding grants the documented invitation allowance, never staff or validation.
    update public.users set doc = doc || jsonb_build_object('invitesRemaining', greatest(144,
      case when doc->>'invitesRemaining' ~ '^[0-9]+$' then (doc->>'invitesRemaining')::numeric else 0 end)) where id=actor;
    return jsonb_build_object('community',community || jsonb_build_object('id',target));
  end if;
  if target is null or length(target) not between 1 and 128 then raise exception 'Invalid command' using errcode='22023'; end if;
  select doc into community from public.communities where id=target for update;
  if not found then raise exception 'Community missing' using errcode='LS003'; end if;
  keeps := community->>'anchorUid'=actor or exists(select 1 from public.links where from_id=actor and rel='keeper' and to_id=target);
  answers := keeps or exists(select 1 from public.links where from_id=actor and rel='steward' and to_id=target);
  if action='edit' then
    if not coalesce(keeps,false) then raise exception 'Forbidden' using errcode='42501'; end if;
    community := community || jsonb_build_object('name',command->>'name','domain',command->>'domain','door',command->>'door','updatedAt',now());
    update public.communities set doc=community where id=target;
    return jsonb_build_object('community',community || jsonb_build_object('id',target));
  end if;
  subject := case when action in ('accept','decline','remove') then command->>'member' else actor end;
  if subject is null or length(subject) not between 1 and 128 then raise exception 'Invalid command' using errcode='22023'; end if;
  if action in ('accept','decline','remove') and not coalesce(answers,false) then raise exception 'Forbidden' using errcode='42501'; end if;
  if action in ('leave','remove') and (community->>'anchorUid'=subject or exists
    (select 1 from public.links where from_id=subject and rel='keeper' and to_id=target))
    then raise exception 'Keeper must resign first' using errcode='LS004'; end if;
  member_now := community->>'anchorUid'=subject or exists(select 1 from public.links where from_id=subject and rel='member' and to_id=target);
  if action='join' and not coalesce(member_now,false) and community->>'door' is distinct from 'open'
    then raise exception 'Door refused' using errcode='LS005'; end if;
  if action='request' and not coalesce(member_now,false) and community->>'door'='closed'
    then raise exception 'Door refused' using errcode='LS005'; end if;
  if action='accept' and not coalesce(member_now,false) and not exists
    (select 1 from public.links where from_id=subject and rel='join_request' and to_id=target)
    then raise exception 'Request missing' using errcode='LS006'; end if;
  if action in ('join','accept') then
    if not coalesce(member_now,false) then
      insert into public.links(from_id,rel,to_id,lid) values(subject,'member',target,new_id) on conflict do nothing;
    end if;
    delete from public.links where from_id=subject and rel='join_request' and to_id=target;
  elsif action='request' and not coalesce(member_now,false) then
    insert into public.links(from_id,rel,to_id,lid) values(subject,'join_request',target,new_id) on conflict do nothing;
  elsif action in ('cancel','decline') then
    delete from public.links where from_id=subject and rel='join_request' and to_id=target;
  elsif action in ('leave','remove') then
    delete from public.links where from_id=subject and rel in ('member','steward','join_request') and to_id=target;
  end if;
  member_now := community->>'anchorUid'=subject or exists(select 1 from public.links where from_id=subject and rel='member' and to_id=target);
  requested := exists(select 1 from public.links where from_id=subject and rel='join_request' and to_id=target);
  return jsonb_build_object('id',target,'member',subject,'joined',coalesce(member_now,false),'requested',requested);
end;
$$;
revoke all on function seed.community_command(jsonb,text,text) from public;

-- Membership and its delegated power leave together through the command above.
-- Generic own-link withdrawal must not bypass that transaction or keeper refusal.
drop policy links_own_withdraw on public.links;
create policy links_own_withdraw on public.links for delete using (
  seed.uid() is not null and from_id=seed.uid()
  and rel not in ('invited_by','welcomed_by','party','collaborates_with',
    'recognises','shares_resources_with','accepts_coin_of','descends_from')
  and not (rel in ('member','steward','keeper') and exists
    (select 1 from public.communities c where c.id=to_id))
);
