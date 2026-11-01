-- The existing collection is visible to signed-in people, as in Firestore.
-- Offers carry no authority until the named recipient accepts.
create policy keeper_offers_signed_read on public.community_keeper_invites for select using (seed.uid() is not null);
create index keeper_offers_recipient on public.community_keeper_invites ((doc->>'invitedUserId'),id);
create index keeper_offers_community on public.community_keeper_invites ((doc->>'communityId'),id);
create function seed.keeper_offer_command(command jsonb, offer_lid text, keeper_lid text, member_lid text, welcome_lid text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); action text:=command->>'action'; target text:=command->>'id'; subject text:=command->>'member';
  invite_id text:=command->>'inviteId'; community jsonb; offer jsonb; rooted text;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or coalesce(action,'') not in ('offer_keeper','accept_keeper_offer','decline_keeper_offer')
    or target is null or length(target) not between 1 and 128 or target ~ '[[:space:][:cntrl:]]'
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','id','member','inviteId')) then
    raise exception 'Invalid command' using errcode='22023'; end if;
  if action='offer_keeper' then
    if command ? 'inviteId' or subject is null or length(subject) not between 1 and 128 or subject ~ '[[:space:][:cntrl:]]' then
      raise exception 'Invalid command' using errcode='22023'; end if;
  elsif command ? 'member' or invite_id is null or length(invite_id) not between 1 and 128 then
    raise exception 'Invalid command' using errcode='22023';
  end if;
  if offer_lid is null or keeper_lid is null or member_lid is null or welcome_lid is null
    or (select count(distinct v) from unnest(array[offer_lid,keeper_lid,member_lid,welcome_lid]) v)<>4
    or exists(select 1 from unnest(array[offer_lid,keeper_lid,member_lid,welcome_lid]) v
      where v !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
    raise exception 'Invalid identity' using errcode='22023'; end if;
  select doc into community from public.communities where id=target for update;
  if not found then raise exception 'Community missing' using errcode='LS003'; end if;
  if coalesce(community->>'anchorUid','')='' then raise exception 'Community identity needs review' using errcode='LS012'; end if;
  if action='offer_keeper' then
    if community->>'anchorUid'<>actor and not exists(select 1 from public.links where from_id=actor and rel='keeper' and to_id=target) then
      raise exception 'Forbidden' using errcode='42501'; end if;
    if community->>'anchorUid'=subject or exists(select 1 from public.links where from_id=subject and rel='keeper' and to_id=target) then
      raise exception 'Already keeper' using errcode='LS016'; end if;
    -- Repeated clicks reuse a pending offer from this hand.
    select id,doc into invite_id,offer from public.community_keeper_invites where doc->>'communityId'=target
      and doc->>'invitedUserId'=subject and doc->>'invitedByUserId'=actor and doc->>'status'='pending' order by id limit 1;
    if not found then
      invite_id:=offer_lid;
      offer:=jsonb_build_object('communityId',target,'communityName',community->>'name','invitedByUserId',actor,
        'invitedUserId',subject,'status','pending','createdAt',now());
      insert into public.community_keeper_invites(id,doc) values(invite_id,offer);
    end if;
    return jsonb_build_object('invite',offer || jsonb_build_object('id',invite_id));
  end if;
  select doc into offer from public.community_keeper_invites where id=invite_id for update;
  if not found or offer->>'communityId' is distinct from target then raise exception 'Invite missing' using errcode='LS007'; end if;
  if offer->>'invitedUserId' is distinct from actor and (action<>'decline_keeper_offer' or offer->>'invitedByUserId' is distinct from actor) then
    raise exception 'Forbidden' using errcode='42501'; end if;
  if offer->>'status' is distinct from 'pending' then raise exception 'Invite closed' using errcode='LS018'; end if;
  if action='decline_keeper_offer' then
    offer:=offer || jsonb_build_object('status','declined','respondedAt',now(),'updatedAt',now());
    update public.community_keeper_invites set doc=offer where id=invite_id;
    return jsonb_build_object('invite',offer || jsonb_build_object('id',invite_id));
  end if;
  if community->>'anchorUid'=actor or exists(select 1 from public.links where from_id=actor and rel='keeper' and to_id=target) then
    raise exception 'Already keeper' using errcode='LS016'; end if;
  select t.id into rooted from public.lifetrees t where coalesce(t.doc->>'treeType','') not in ('BED','SECRET') and
    (t.doc->>'anchorUid'=actor or exists(select 1 from public.links l where l.from_id=actor and l.rel='keeper' and l.to_id=t.id))
    order by t.id limit 1 for share of t;
  if rooted is null then raise exception 'Rooted tree required' using errcode='LS017'; end if;
  if not exists(select 1 from public.lifetrees where id=rooted and doc->>'anchorUid'=actor) then
    perform 1 from public.links where from_id=actor and rel='keeper' and to_id=rooted for share;
    if not found then raise exception 'Rooted tree required' using errcode='LS017'; end if;
  end if;
  insert into public.links(from_id,rel,to_id,lid) values(actor,'keeper',target,keeper_lid) on conflict do nothing;
  insert into public.links(from_id,rel,to_id,lid) values(actor,'member',target,member_lid) on conflict do nothing;
  if coalesce(offer->>'invitedByUserId','')<>'' and offer->>'invitedByUserId'<>actor then
    insert into public.links(from_id,rel,to_id,lid,doc) values(actor,'welcomed_by',offer->>'invitedByUserId',welcome_lid,
      jsonb_build_object('inviteId',invite_id)) on conflict do nothing;
  end if;
  delete from public.links where from_id=actor and rel='keeper_request' and to_id=target;
  community:=community || jsonb_build_object('updatedAt',now(),'keeperUids',
    (select coalesce(jsonb_agg(from_id order by from_id collate "C"),'[]'::jsonb) from public.links
      where rel='keeper' and to_id=target and from_id<>community->>'anchorUid'));
  update public.communities set doc=community where id=target;
  offer:=offer || jsonb_build_object('status','accepted','acceptedAt',now(),'updatedAt',now());
  update public.community_keeper_invites set doc=offer where id=invite_id;
  return jsonb_build_object('invite',offer || jsonb_build_object('id',invite_id));
end;
$$;
revoke all on function seed.keeper_offer_command(jsonb,text,text,text,text) from public;
