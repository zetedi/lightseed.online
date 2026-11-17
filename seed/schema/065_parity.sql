-- THE PARITY AUDIT (ring 2026-11-17): what the independent node did less than the origin, closed.

-- THE FAREWELL (the origin's deleteMyAccount sends a goodbye before the record is gone). When a
-- being erases its OWN account, the address the node held is handed to the outbox in the same
-- transaction — the account will not exist when the courier comes, so the effect carries the
-- address itself. Staff removing an account send nothing, as on the origin.
create function seed.outbox_on_user_gone() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if seed.uid() is not null and old.id=seed.uid() and jsonb_typeof(old.doc->'email')='string'
    and old.doc->>'email' ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    insert into seed.outbox(kind,ref) values('farewell',old.doc->>'email');
  end if;
  return old;
end;
$$;
revoke all on function seed.outbox_on_user_gone() from public;
create trigger users_farewell before delete on public.users for each row execute function seed.outbox_on_user_gone();
