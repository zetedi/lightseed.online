// The API's database hand is separate from migration custody. Only the graph operations
// whose policies are already tested are granted. This is NOT an end-user identity: the
// eventual API must verify the caller before setting transaction-local seed.uid.
// New roles only: never repair/reuse an existing name whose grants may be unknown.
export function seedRuntimeSql(role: string, verifier: string): string | null {
  if (!/^lightseed_api_[a-f0-9]{16}$/.test(role)
    || !/^SCRAM-SHA-256\$4096:[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=[\:][A-Za-z0-9+/]{43}=$/.test(verifier)) return null;
  return `\\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL search_path = pg_catalog;
DO $ready$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM seed.schema_migrations WHERE name = '003_access_baseline.sql') THEN
    RAISE EXCEPTION 'Run seed:migrate before provisioning a runtime account.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'Runtime provisioning requires RLS on every application table.';
  END IF;
END
$ready$;
CREATE ROLE ${role} LOGIN PASSWORD '${verifier}'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE ${role} SET search_path = pg_catalog, public;
ALTER ROLE ${role} SET row_security = on;
ALTER ROLE ${role} SET statement_timeout = '15s';
ALTER ROLE ${role} SET idle_in_transaction_session_timeout = '10s';
DO $connect$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO ${role}', current_database());
END
$connect$;
GRANT USAGE ON SCHEMA public, seed TO ${role};
GRANT EXECUTE ON FUNCTION seed.uid() TO ${role};
GRANT SELECT, INSERT, DELETE ON public.links TO ${role};
GRANT SELECT ON public.secret_links TO ${role};
COMMIT;
`;
}
