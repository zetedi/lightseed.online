-- THE REMAINING SELF-SERVE EDGES (ring 2026-11-02): the link command (022) learns the three
-- relations firestore.rules lets a hand mint by its own authority and the independent node had
-- not grown — a Light House's keeper roots it in a tree and shelters a community with it
-- (rooted / shelters, from = the house), and a covenant's proposer names its roster (party,
-- to = the covenant) while it is still proposed. A party link is load-bearing for a signed
-- identity, so no hand but staff's lays one down; the house's edges go as they came.
create or replace function seed.link_command(command jsonb,new_lid text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); action text:=command->>'action'; subject text:=command->>'from';
  relation text:=command->>'rel'; target text:=command->>'to'; tree jsonb; house jsonb; covenant jsonb; allowed boolean:=false;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or coalesce(action,'') not in ('link','unlink')
    or coalesce(relation,'') not in ('joined','guardian','observer','steward','rooted','shelters','party')
    or (action='link' and relation not in ('joined','guardian','rooted','shelters','party'))
    or jsonb_typeof(command->'from') is distinct from 'string' or length(subject) not between 1 and 128 or subject ~ '[[:space:][:cntrl:]]'
    or jsonb_typeof(command->'to') is distinct from 'string' or length(target) not between 1 and 512 or target ~ '[[:space:][:cntrl:]]'
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','from','rel','to'))
    or new_lid is null or new_lid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then raise exception 'Invalid command' using errcode='22023'; end if;
  if relation='joined' then
    allowed:=subject=actor;
  elsif relation in ('rooted','shelters') then
    -- The house's keeper alone roots or shelters with it; the edge is the keeper's to lay down too.
    select doc into house from public.light_houses where id=subject for update;
    allowed:=house is not null and jsonb_typeof(house->'anchorUid')='string' and house->>'anchorUid'=actor;
    if action='link' and allowed then
      allowed:=case relation when 'rooted' then exists(select 1 from public.lifetrees where id=target)
        else exists(select 1 from public.communities where id=target) end;
    end if;
  elsif relation='party' then
    select doc into covenant from public.covenants where id=target for update;
    if action='link' then
      allowed:=covenant is not null and covenant->>'proposedBy'=actor and coalesce(covenant->>'status','proposed')='proposed';
    else
      allowed:=seed.is_staff();
    end if;
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
-- The community's root tree is a filter the circle walks (acceptTreeInvite names the circle it joined).
create index communities_root_tree on public.communities((doc->>'rootLifetreeId'),id);
