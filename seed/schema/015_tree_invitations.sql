-- Invitations are capabilities only at single-document lookup. Lists never gain
-- public access merely because some rows contain open invitations.
create function seed.tree_invite_pending(invite jsonb) returns boolean
language plpgsql stable set search_path=pg_catalog as $$
begin
  if invite->>'status' is distinct from 'pending' or (invite ? 'revokedAt' and invite->'revokedAt'<>'null'::jsonb) then return false; end if;
  if invite ? 'expiresAt' and invite->'expiresAt'<>'null'::jsonb then
    return (invite->>'expiresAt')::timestamptz>now();
  end if;
  return true;
exception when others then return false;
end;
$$;
revoke all on function seed.tree_invite_pending(jsonb) from public;
create function seed.tree_invite_visible(invite jsonb, held boolean) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select coalesce((held and invite->'open'='true'::jsonb and seed.tree_invite_pending(invite))
    or (seed.uid() is not null and (invite->>'invitedUserId'=seed.uid() or invite->>'invitedByUserId'=seed.uid() or seed.is_staff()
      or exists(select 1 from public.lifetrees t where t.id=invite->>'lifetreeId' and
        (seed.is_tree_keeper(t.id,t.doc) or (t.doc->>'treeType' is distinct from 'SECRET' and exists
          (select 1 from public.links l where l.from_id=seed.uid() and l.rel='steward' and l.to_id=t.id)))))),false);
$$;
revoke all on function seed.tree_invite_visible(jsonb,boolean) from public;
create index tree_invites_tree_id on public.tree_keeping_invites((doc->>'lifetreeId'),id);
create index tree_invites_recipient_id on public.tree_keeping_invites((doc->>'invitedUserId'),id);
create function seed.tree_invites(invite_id text, tree_id text, mine boolean, after_id text, page_size integer) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb; cursor_id text; total integer;
begin
  if page_size is null or page_size not between 1 and 100 or
    ((invite_id is not null)::integer+(tree_id is not null)::integer+coalesce(mine,false)::integer)<>1
    then raise exception 'Invalid query' using errcode='22023'; end if;
  if invite_id is not null then
    select doc || jsonb_build_object('id',id) into result from public.tree_keeping_invites where id=invite_id and seed.tree_invite_visible(doc,true);
    return jsonb_build_object('invite',result);
  end if;
  if seed.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  with page as (
    select id,doc from public.tree_keeping_invites where doc->>'status'='pending'
      and (tree_id is null or doc->>'lifetreeId'=tree_id)
      and (not coalesce(mine,false) or doc->>'invitedUserId'=seed.uid())
      and (after_id is null or id>after_id) and seed.tree_invite_visible(doc,false) order by id limit page_size+1
  ), numbered as (select *,row_number() over(order by id) n from page)
  select coalesce(jsonb_agg(doc || jsonb_build_object('id',id) order by id) filter(where n<=page_size),'[]'::jsonb),
    max(id) filter(where n=page_size),count(*) into result,cursor_id,total from numbered;
  return jsonb_build_object('invites',result,'next',case when total>page_size then cursor_id else null end);
end;
$$;
revoke all on function seed.tree_invites(text,text,boolean,text,integer) from public;

create function seed.tree_invite_command(command jsonb, token text, ids text[]) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); action text:=command->>'action'; target text:=command->>'treeId'; invite_id text:=command->>'id';
  tree jsonb; invite jsonb; role_name text:=command->>'role'; recipient text:=command->>'member'; keeps boolean; stewards boolean;
  secret boolean; circle_id text; circle jsonb; root_id text; dial numeric:=1; raw_dial text; guardians bigint; validates boolean:=false; needed numeric:=0;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or coalesce(action,'') not in ('mint','claim','accept','decline','revoke')
    or octet_length(command::text)>8192 or exists(select 1 from jsonb_object_keys(command) k where k not in
      ('action','treeId','member','open','role','message','expiresAt','id')) then raise exception 'Invalid command' using errcode='22023'; end if;
  if action='mint' then
    if command ? 'id' or jsonb_typeof(command->'treeId') is distinct from 'string' or length(target) not between 1 and 128
      or target ~ '[[:space:][:cntrl:]]' or coalesce(role_name,'') not in ('keeper','steward','guardian','observer')
      or jsonb_typeof(command->'open') is distinct from 'boolean'
      or (command->'open'='true'::jsonb and command ? 'member')
      or (command->'open'='false'::jsonb and (jsonb_typeof(command->'member') is distinct from 'string' or length(recipient) not between 1 and 128 or recipient ~ '[[:space:][:cntrl:]]'))
      or (command ? 'message' and (jsonb_typeof(command->'message') is distinct from 'string' or length(command->>'message')>1000))
      then raise exception 'Invalid command' using errcode='22023'; end if;
    if command ? 'expiresAt' and command->'expiresAt'<>'null'::jsonb then
      begin
        if (command->>'expiresAt')::timestamptz<=now() then raise exception 'Invalid expiry' using errcode='22023'; end if;
      exception when others then raise exception 'Invalid expiry' using errcode='22023'; end;
    end if;
  else
    if jsonb_typeof(command->'id') is distinct from 'string' or length(invite_id) not between 1 and 128
      or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','id')) then raise exception 'Invalid command' using errcode='22023'; end if;
    select doc->>'lifetreeId' into target from public.tree_keeping_invites where id=invite_id;
    if not found then raise exception 'Invite missing' using errcode='LS007'; end if;
  end if;
  select doc into tree from public.lifetrees where id=target for update;
  if not found then raise exception 'Tree missing' using errcode='LS014'; end if;
  secret:=tree->>'treeType'='SECRET'; keeps:=seed.is_tree_keeper(target,tree);
  stewards:=tree->>'treeType' is distinct from 'SECRET' and exists(select 1 from public.links where from_id=actor and rel='steward' and to_id=target);
  if action='mint' then
    if not keeps and not seed.is_staff() and not (stewards and role_name in ('guardian','observer')) then raise exception 'Forbidden' using errcode='42501'; end if;
    if secret and role_name<>'keeper' then raise exception 'Secret keepers only' using errcode='LS019'; end if;
    if recipient=tree->>'anchorUid' or exists(select 1 from public.links where from_id=recipient and rel=role_name and to_id=target)
      or (secret and exists(select 1 from public.secret_links where from_id=recipient and rel=role_name and to_id=target))
      then raise exception 'Role already held' using errcode='LS020'; end if;
    if token is null or token !~ '^[a-f0-9]{48}$' then raise exception 'Invalid token' using errcode='22023'; end if;
    if recipient is not null then
      select id,doc into invite_id,invite from public.tree_keeping_invites where doc->>'lifetreeId'=target
        and doc->>'invitedUserId'=recipient and doc->>'role'=role_name and seed.tree_invite_pending(doc) order by id limit 1;
      if found then return jsonb_build_object('invite',invite || jsonb_build_object('id',invite_id)); end if;
    end if;
    invite:=(command-'action'-'treeId'-'member') || jsonb_build_object('lifetreeId',target,'lifetreeName',coalesce(tree->>'name',''),
      'invitedByUserId',actor,'invitedUserId',coalesce(recipient,''),'status','pending','createdAt',now(),'updatedAt',now());
    insert into public.tree_keeping_invites(id,doc) values(token,invite);
    return jsonb_build_object('invite',invite || jsonb_build_object('id',token));
  end if;
  select doc into invite from public.tree_keeping_invites where id=invite_id for update;
  if not found or invite->>'lifetreeId' is distinct from target then raise exception 'Invite missing' using errcode='LS007'; end if;
  -- Authorization precedes lifecycle errors, keeping private invitations opaque.
  if action='claim' then
    if invite->'open' is distinct from 'true'::jsonb or invite->>'invitedUserId' is distinct from '' or invite->>'invitedByUserId'=actor
      then raise exception 'Forbidden' using errcode='42501'; end if;
  elsif action='revoke' then
    if invite->>'invitedByUserId' is distinct from actor and not keeps and not seed.is_staff() then raise exception 'Forbidden' using errcode='42501'; end if;
  elsif invite->>'invitedUserId' is distinct from actor then raise exception 'Forbidden' using errcode='42501'; end if;
  if invite->>'status' is distinct from 'pending' then raise exception 'Invite closed' using errcode='LS018'; end if;
  if action in ('claim','accept') and not seed.tree_invite_pending(invite) then raise exception 'Invite expired' using errcode='LS009'; end if;
  if action='claim' then invite:=invite || jsonb_build_object('open',false,'invitedUserId',actor,'claimedAt',now(),'updatedAt',now());
  elsif action='revoke' then invite:=invite || jsonb_build_object('status','revoked','revokedAt',now(),'updatedAt',now());
  elsif action='decline' then invite:=invite || jsonb_build_object('status','declined','declinedAt',now(),'updatedAt',now());
  else
    role_name:=invite->>'role';
    if coalesce(role_name,'') not in ('keeper','steward','guardian','observer') then raise exception 'Invalid role' using errcode='22023'; end if;
    if secret and role_name<>'keeper' then raise exception 'Secret keepers only' using errcode='LS019'; end if;
    if cardinality(ids) is distinct from 5 or (select count(distinct id) from unnest(ids) id)<>5
      or exists(select 1 from unnest(ids) id where id is null or id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then raise exception 'Invalid identities' using errcode='22023'; end if;
    if role_name='guardian' then
      select id into root_id from public.lifetrees where doc->>'anchorUid'=actor and coalesce(doc->>'treeType','') in ('','LIFETREE')
        and doc->'isNature' is distinct from 'true'::jsonb and (not(doc ? 'diedAt') or doc->'diedAt'='null'::jsonb) order by id limit 1 for share;
      if root_id is null then raise exception 'Living tree required' using errcode='LS021'; end if;
      if coalesce(tree->>'treeType','') in ('','LIFETREE') and tree->'isNature' is distinct from 'true'::jsonb
        and (not(tree ? 'diedAt') or tree->'diedAt'='null'::jsonb) then
        select doc->>'guardiansToValidate' into raw_dial from public.config where id='limits';
        if raw_dial ~ '^[0-9]+(\.[0-9]+)?$' then if raw_dial::numeric>=1 then dial:=floor(raw_dial::numeric); end if; end if;
        select count(*)+1 into guardians from public.links where rel='guardian' and to_id=target and from_id<>actor;
        needed:=greatest(0,dial-guardians);validates:=guardians>=dial and not (tree->'validated'='true'::jsonb and coalesce(tree->>'validatorId','')<>'');
        validates:=coalesce(validates,guardians>=dial);
      end if;
    end if;
    if role_name<>'guardian' and coalesce(tree->>'anchorUid','')='' then raise exception 'Tree identity needs review' using errcode='LS012'; end if;
    circle_id:=nullif(tree->>'communityId','');
    if role_name<>'guardian' and not coalesce(secret,false) then
      if circle_id is null then
        circle_id:=ids[1];
        circle:=jsonb_build_object('lid',circle_id,'name',coalesce(tree->>'name','Lifetree') || ' Circle','rootLifetreeId',target,
          'anchorUid',tree->>'anchorUid','formation','tree_keeping','visibility','invited','domain','','papers','[]'::jsonb,'imageUrls','[]'::jsonb,'createdAt',now(),'updatedAt',now());
        insert into public.communities(id,doc) values(circle_id,circle);
        insert into public.links(from_id,rel,to_id,lid) values(tree->>'anchorUid','member',circle_id,ids[2]) on conflict do nothing;
        tree:=tree || jsonb_build_object('communityId',circle_id);
      else
        select doc into circle from public.communities where id=circle_id for update;
        if not found or circle->>'rootLifetreeId' is distinct from target then raise exception 'Circle identity needs review' using errcode='LS012'; end if;
      end if;
      insert into public.links(from_id,rel,to_id,lid) values(actor,'member',circle_id,ids[3]) on conflict do nothing;
    end if;
    if secret then insert into public.secret_links(from_id,rel,to_id,lid) values(actor,role_name,target,ids[4]) on conflict do nothing;
    else insert into public.links(from_id,rel,to_id,lid) values(actor,role_name,target,ids[4]) on conflict do nothing; end if;
    if coalesce(invite->>'invitedByUserId','')<>'' and invite->>'invitedByUserId'<>actor then
      insert into public.links(from_id,rel,to_id,lid,doc) values(actor,'welcomed_by',invite->>'invitedByUserId',ids[5],jsonb_build_object('inviteId',invite_id)) on conflict do nothing;
    end if;
    if validates then tree:=tree || jsonb_build_object('validated',true,'validatorId',actor,'validatedAt',now(),'validatedBy','guardian'); end if;
    update public.lifetrees set doc=tree || jsonb_build_object('updatedAt',now()) where id=target;
    invite:=invite || jsonb_build_object('status','accepted','acceptedAt',now(),'updatedAt',now());
  end if;
  update public.tree_keeping_invites set doc=invite where id=invite_id;
  return jsonb_build_object('invite',invite || jsonb_build_object('id',invite_id),'validated',validates,'guardiansNeeded',needed);
end;
$$;
revoke all on function seed.tree_invite_command(jsonb,text,text[]) from public;
