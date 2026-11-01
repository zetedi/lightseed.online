-- Mirror the portable person identity into the private account atomically.
-- Existing disagreements or an imported private identity without its person need review.
create or replace function seed.save_profile(display_name text, new_lid text) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare actor text := seed.uid(); existing jsonb; existing_user jsonb; stable_lid text;
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
  if existing_user ? 'uid' and existing_user->>'uid' is distinct from actor then
    raise exception 'Identity needs review' using errcode='23514'; end if;
  select doc into existing from public.persons where id = actor for update;
  if found then
    if existing->>'uid' is distinct from actor
      or coalesce(existing->>'lid', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then raise exception 'Identity needs review' using errcode = '23514'; end if;
    stable_lid:=existing->>'lid';
    if existing_user ? 'lid' and existing_user->'lid'<>'null'::jsonb and existing_user->>'lid' is distinct from stable_lid then
      raise exception 'Identity needs review' using errcode='23514'; end if;
    -- Preserve the LID, signing state, history and every unrelated imported field.
    update public.persons set doc = doc || jsonb_build_object('displayName', display_name) where id = actor;
  else
    if existing_user ? 'lid' and existing_user->'lid'<>'null'::jsonb then
      raise exception 'Identity needs review' using errcode='23514'; end if;
    stable_lid:=new_lid;
    insert into public.persons(id, doc) values (actor, jsonb_build_object(
      'uid', actor, 'lid', new_lid, 'displayName', display_name, 'publicKeyPem', null, 'createdAt', now()));
  end if;
  insert into public.users(id, doc) values (actor, jsonb_build_object('displayName', display_name,'lid',stable_lid,'uid',actor))
    on conflict(id) do update set doc = public.users.doc || excluded.doc;
  return seed.my_profile();
end;
$$;
revoke all on function seed.save_profile(text, text) from public;
