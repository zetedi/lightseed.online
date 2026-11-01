-- Personal appearance is private account state, not an identity-provider claim.
create or replace function seed.my_profile() returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select jsonb_build_object('uid',p.id,'lid',p.doc->>'lid','displayName',p.doc->>'displayName')
    || coalesce((select jsonb_object_agg(key,value) from jsonb_each(u.doc)
      where key in ('siteLogoUrl','siteHeroUrl')),'{}'::jsonb)
  from public.persons p left join public.users u on u.id=p.id
  where p.id=seed.uid() and seed.uid() is not null;
$$;
create function seed.profile_picture(command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); person jsonb; account jsonb; object_path text:=command->>'path'; picture_url text:='';
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or command->>'action' is distinct from 'set_picture'
    or coalesce(command->>'slot','') not in ('siteLogoUrl','siteHeroUrl')
    or not(command ? 'path') or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','slot','path'))
    then raise exception 'Invalid profile' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('profile:' || actor,0));
  select doc into account from public.users where id=actor for update;
  select doc into person from public.persons where id=actor for update;
  if person is null or account is null then raise exception 'Profile required' using errcode='LS001'; end if;
  if person->>'uid' is distinct from actor or account->>'uid' is distinct from actor
    or coalesce(person->>'lid','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or account->>'lid' is distinct from person->>'lid' then raise exception 'Identity needs review' using errcode='23514'; end if;
  if command->'path'<>'null'::jsonb then
    if jsonb_typeof(command->'path') is distinct from 'string' or not seed.media_path_valid(object_path)
      or not exists(select 1 from seed.media_objects where path=object_path) then
      raise exception 'Published picture required' using errcode='22023'; end if;
    picture_url:='/v1/media?path=' || object_path;
  end if;
  update public.users set doc=doc || jsonb_build_object(command->>'slot',picture_url,'updatedAt',now()) where id=actor;
  return seed.my_profile();
end;
$$;
revoke all on function seed.profile_picture(jsonb) from public;
