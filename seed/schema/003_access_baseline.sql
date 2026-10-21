-- Fail closed while collection-specific permissions are ported. Application connections
-- must use a non-owner, non-superuser role WITHOUT BYPASSRLS or membership in the owner
-- role. Migration credentials must never be used by the API or handed to browsers.
-- These tables are the node's dedicated schema, not a shared application's database.
do $baseline$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on table public.%I from public', t.tablename);
  end loop;
end
$baseline$;
revoke create on schema public from public;
revoke all on table seed.schema_migrations from public;

-- 002 predates the private-tree guarding gate. Until tree visibility is ported and
-- tested, do not allow clients to mint guardian keys. Invitation/server roles are
-- still unimplemented; only the existing joined clause is safe to expose here.
drop policy links_self_serve_insert on links;
create policy links_self_serve_insert on links for insert
  with check (seed.uid() is not null and from_id = seed.uid() and rel = 'joined');

-- Keep the full current append-only exclusion list. Staff/keeper withdrawal requires
-- its own separately tested authorization path; this policy grants only one's own hand.
drop policy links_own_withdraw on links;
create policy links_own_withdraw on links for delete
  using (seed.uid() is not null and from_id = seed.uid()
    and rel not in ('invited_by', 'welcomed_by', 'party', 'collaborates_with',
      'recognises', 'shares_resources_with', 'accepts_coin_of', 'descends_from'));

-- RLS does not govern TRUNCATE, DDL or owner privileges. No runtime grants or LOGIN
-- roles are created here. Future provisioning must grant only the operations tested
-- for each role. SET LOCAL seed.uid remains trusted server context, not authentication.
