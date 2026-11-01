-- An invitation is a capability: public get by unguessable ID, keeper-only lists.
-- No direct table access, mutation or deletion is granted to the runtime role.
create function seed.community_invites(invite_id text, community_id text, after_id text, page_size integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare value jsonb; actor text:=seed.uid();
begin
  if invite_id is not null then
    if community_id is not null or after_id is not null or length(invite_id) not between 1 and 128 then raise exception 'Invalid query' using errcode='22023'; end if;
    select doc || jsonb_build_object('id',id) into value from public.community_invites where id=invite_id;
    return jsonb_build_object('invite',value);
  end if;
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if community_id is null or page_size is null or page_size not between 1 and 100 then raise exception 'Invalid query' using errcode='22023'; end if;
  if not exists(select 1 from public.communities where id=community_id and
    (doc->>'anchorUid'=actor or exists(select 1 from public.links where from_id=actor and rel in ('keeper','steward') and to_id=community_id)))
    then raise exception 'Forbidden' using errcode='42501'; end if;
  with page as (select id,doc from public.community_invites where doc->>'communityId'=community_id
    and (after_id is null or id>after_id) order by id limit page_size+1),
  shown as (select * from page order by id limit page_size)
  select jsonb_build_object('invites',coalesce((select jsonb_agg(doc || jsonb_build_object('id',id) order by id) from shown),'[]'::jsonb),
    'next',case when (select count(*) from page)>page_size then (select max(id) from shown) else null end) into value;
  return value;
end;
$$;
revoke all on function seed.community_invites(text,text,text,integer) from public;
create index community_invites_community_id on public.community_invites((doc->>'communityId'),id);

create function seed.invite_command(command jsonb, token text, member_lid text, provenance_lid text, welcome_lid text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); action text:=command->>'action'; target text; invitation jsonb; community jsonb;
  expiry timestamptz; invitation_id text:=command->>'id'; person jsonb; inviter text;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or coalesce(action,'') not in ('mint','accept','revoke')
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','communityId','label','expiresAt','id'))
    then raise exception 'Invalid command' using errcode='22023'; end if;
  if action='mint' then target:=command->>'communityId';
  else
    select doc into invitation from public.community_invites where id=invitation_id;
    if not found then raise exception 'Invitation missing' using errcode='LS007'; end if;
    target:=invitation->>'communityId';
  end if;
  -- Same lock order as community commands: community before invitation/links.
  select doc into community from public.communities where id=target for update;
  if not found then raise exception 'Community missing' using errcode='LS003'; end if;
  if action in ('mint','revoke') and not (coalesce(community->>'anchorUid'=actor,false) or exists
    (select 1 from public.links where from_id=actor and rel in ('keeper','steward') and to_id=target))
    then raise exception 'Forbidden' using errcode='42501'; end if;
  if action='mint' then
    if token is null or token !~ '^[0-9a-f]{48}$' or
      (command ? 'label' and (jsonb_typeof(command->'label') is distinct from 'string' or length(command->>'label')>120 or command->>'label' ~ '[[:cntrl:]]'))
      then raise exception 'Invalid command' using errcode='22023'; end if;
    if command->>'expiresAt' is not null then
      begin expiry:=(command->>'expiresAt')::timestamptz;
      exception when others then raise exception 'Invalid expiry' using errcode='22023'; end;
      if not isfinite(expiry) or expiry<=now() then raise exception 'Invalid expiry' using errcode='22023'; end if;
    end if;
    invitation_id:=token;
    invitation:=jsonb_build_object('communityId',target,'createdBy',actor,'createdAt',now(),'expiresAt',expiry);
    if command ? 'label' then invitation:=invitation || jsonb_build_object('label',command->>'label'); end if;
    insert into public.community_invites(id,doc) values(invitation_id,invitation);
  else
    select doc into invitation from public.community_invites where id=invitation_id for update;
    if action='revoke' then
      if invitation->>'revokedAt' is null then
        invitation:=invitation || jsonb_build_object('revokedAt',now());
        update public.community_invites set doc=invitation where id=invitation_id;
      end if;
    else
      select doc into person from public.persons where id=actor;
      if person is null or person->>'uid' is distinct from actor or coalesce(person->>'lid','') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then raise exception 'Profile required' using errcode='LS001'; end if;
      if community->>'door'='closed' then raise exception 'Door refused' using errcode='LS005'; end if;
      if invitation->>'revokedAt' is not null then raise exception 'Invitation revoked' using errcode='LS008'; end if;
      if invitation->>'expiresAt' is not null and (invitation->>'expiresAt')::timestamptz<=now()
        then raise exception 'Invitation expired' using errcode='LS009'; end if;
      if member_lid is null or provenance_lid is null or welcome_lid is null or exists
        (select 1 from unnest(array[member_lid,provenance_lid,welcome_lid]) v where v !~
          '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
        then raise exception 'Invalid identity' using errcode='22023'; end if;
      insert into public.links(from_id,rel,to_id,lid,doc) values(actor,'member',target,member_lid,jsonb_build_object('inviteId',invitation_id)) on conflict do nothing;
      insert into public.links(from_id,rel,to_id,lid,doc) values(actor,'invited_by',target,provenance_lid,jsonb_build_object('inviteId',invitation_id)) on conflict do nothing;
      inviter:=invitation->>'createdBy';
      if inviter is not null and inviter<>actor then
        insert into public.links(from_id,rel,to_id,lid,doc) values(actor,'welcomed_by',inviter,welcome_lid,jsonb_build_object('inviteId',invitation_id)) on conflict do nothing;
      end if;
      delete from public.links where from_id=actor and rel='join_request' and to_id=target;
      return jsonb_build_object('id',target,'joined',true,'remembered',true);
    end if;
  end if;
  return jsonb_build_object('invite',invitation || jsonb_build_object('id',invitation_id));
end;
$$;
revoke all on function seed.invite_command(jsonb,text,text,text,text) from public;
