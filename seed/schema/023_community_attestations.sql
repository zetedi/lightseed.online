-- Each direction is one community's independent statement, never a stored mutual flag.
create function seed.community_attestation(command jsonb,new_lid text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); action text:=command->>'action'; source text:=command->>'from';
  target text:=command->>'to'; relation text:=command->>'rel'; community jsonb; keeps boolean; staff_allowed boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or coalesce(action,'') not in ('link','unlink')
    or coalesce(relation,'') not in ('collaborates_with','recognises','shares_resources_with','accepts_coin_of')
    or jsonb_typeof(command->'from') is distinct from 'string' or length(source) not between 1 and 128 or source ~ '[[:space:][:cntrl:]]'
    or jsonb_typeof(command->'to') is distinct from 'string' or length(target) not between 1 and 128 or target ~ '[[:space:][:cntrl:]]'
    or source=target or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','from','rel','to'))
    or new_lid is null or new_lid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then raise exception 'Invalid command' using errcode='22023'; end if;
  -- Opposite-direction requests lock in the same order. Keeper departure also locks its community.
  perform id from public.communities where id in (source,target) order by id collate "C" for update;
  select doc into community from public.communities where id=source;
  if not found or not exists(select 1 from public.communities where id=target) then
    raise exception 'Invalid communities' using errcode='22023'; end if;
  keeps:=community->>'anchorUid'=actor or exists(select 1 from public.links where from_id=actor and rel='keeper' and to_id=source);
  staff_allowed:=seed.is_staff() and (action='unlink' or not exists(select 1 from public.config
    where id='staffHands' and doc ? 'link_mint' and doc->'link_mint' is distinct from 'true'::jsonb));
  if not coalesce(keeps or staff_allowed,false) then raise exception 'Forbidden' using errcode='42501'; end if;
  if action='link' then
    insert into public.links(from_id,rel,to_id,lid,doc) values(source,relation,target,new_lid,'{"type":"link"}') on conflict do nothing;
  else
    delete from public.links where from_id=source and rel=relation and to_id=target;
  end if;
  return jsonb_build_object('from',source,'rel',relation,'to',target,'linked',action='link');
end;
$$;
revoke all on function seed.community_attestation(jsonb,text) from public;
