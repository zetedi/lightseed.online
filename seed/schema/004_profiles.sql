-- Narrow, audited privileged operations. Runtime keeps NO table grants for users/persons.
-- seed.uid() is supplied only by the token-verifying server, never by browser SQL.
-- Duplicate preexisting person LIDs require operator resolution before migration.
create unique index persons_lid_unique on public.persons ((doc->>'lid')) where doc ? 'lid';

create function seed.my_profile() returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object('uid', p.id, 'lid', p.doc->>'lid', 'displayName', p.doc->>'displayName')
  from public.persons p where p.id = seed.uid() and seed.uid() is not null;
$$;
revoke all on function seed.my_profile() from public;

create function seed.save_profile(display_name text, new_lid text) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare actor text := seed.uid(); existing jsonb; existing_user jsonb;
begin
  if actor is null or length(actor) > 128 then raise exception 'Authentication required' using errcode = '28000'; end if;
  if display_name is null or length(display_name) not between 1 and 60
    or display_name ~ '[[:cntrl:]]' or display_name <> btrim(display_name)
    or new_lid is null or new_lid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then raise exception 'Invalid profile' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('profile:' || actor, 0));
  select doc into existing_user from public.users where id = actor for update;
  if found and jsonb_typeof(existing_user) <> 'object' then
    raise exception 'Profile needs review' using errcode = '23514';
  end if;
  select doc into existing from public.persons where id = actor for update;
  if found then
    if existing->>'uid' is distinct from actor
      or coalesce(existing->>'lid', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then raise exception 'Identity needs review' using errcode = '23514'; end if;
    -- Preserve the LID, signing state, history and every unrelated imported field.
    update public.persons set doc = doc || jsonb_build_object('displayName', display_name) where id = actor;
  else
    insert into public.persons(id, doc) values (actor, jsonb_build_object(
      'uid', actor, 'lid', new_lid, 'displayName', display_name, 'publicKeyPem', null, 'createdAt', now()));
  end if;
  insert into public.users(id, doc) values (actor, jsonb_build_object('displayName', display_name))
    on conflict(id) do update set doc = public.users.doc || excluded.doc;
  return seed.my_profile();
end;
$$;
revoke all on function seed.save_profile(text, text) from public;
