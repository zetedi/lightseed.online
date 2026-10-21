import { sha256 } from './chain/hash';

export interface SeedMigration { name: string; sql: string }
export class SeedMigrationSourceError extends Error {
  constructor(readonly code: 'empty' | 'invalid_name' | 'duplicate_version' | 'sql_only', readonly file?: string) {
    super(code);
  }
}

// Migrations are trusted, reviewed SQL source, never browser input. They must not
// contain transaction control: this runner owns one transaction for the whole batch.
// Names and checksums are fixed once applied; later changes require a new file.
export async function seedMigrationSql(files: readonly SeedMigration[]): Promise<string> {
  if (!files.length) throw new SeedMigrationSourceError('empty');
  const ordered = [...files].sort((a, b) => a.name < b.name ? -1 : 1);
  const versions = new Set<string>();
  for (const file of ordered) {
    if (!/^\d{3}_[a-z][a-z0-9_]*\.sql$/.test(file.name)) throw new SeedMigrationSourceError('invalid_name', file.name);
    const version = file.name.slice(0, 3);
    if (versions.has(version)) throw new SeedMigrationSourceError('duplicate_version', file.name);
    versions.add(version);
    if (!file.sql.trim() || /^\s*\\/m.test(file.sql)) throw new SeedMigrationSourceError('sql_only', file.name);
  }
  const hashes = await Promise.all(ordered.map(file => sha256(file.sql)));
  const expected = ordered.map((file, i) => `('${file.name}', '${hashes[i]}', ${i})`).join(',\n');
  const steps = ordered.map((file, i) => `
SELECT NOT EXISTS (SELECT 1 FROM seed.schema_migrations WHERE name = '${file.name}') AS apply_${i} \\gset
\\if :apply_${i}
${file.sql}
INSERT INTO seed.schema_migrations(name, checksum) VALUES ('${file.name}', '${hashes[i]}');
\\endif`).join('\n');
  return `\\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '30s';
SET LOCAL search_path = public;
SELECT pg_advisory_xact_lock(174826304, 1);
DO $seed_preflight$
BEGIN
  IF to_regclass('seed.schema_migrations') IS NULL AND EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  ) THEN
    RAISE EXCEPTION 'Existing database has no migration ledger; inspect and baseline it before upgrading. No changes applied.';
  END IF;
END
$seed_preflight$;
CREATE SCHEMA IF NOT EXISTS seed;
CREATE TABLE IF NOT EXISTS seed.schema_migrations (
  name text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
DO $seed_history$
BEGIN
  IF EXISTS (
    SELECT 1 FROM seed.schema_migrations applied
    LEFT JOIN (VALUES ${expected}) AS expected(name, checksum, position) USING (name)
    WHERE expected.name IS NULL OR applied.checksum <> expected.checksum
  ) THEN
    RAISE EXCEPTION 'Migration history differs from source (changed or missing file). No changes applied.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES ${expected}) AS earlier(name, checksum, position)
    WHERE NOT EXISTS (SELECT 1 FROM seed.schema_migrations a WHERE a.name = earlier.name)
    AND EXISTS (
      SELECT 1 FROM seed.schema_migrations a
      JOIN (VALUES ${expected}) AS later(name, checksum, position) USING (name)
      WHERE later.position > earlier.position
    )
  ) THEN
    RAISE EXCEPTION 'Migration history is not a prefix of source. No changes applied.';
  END IF;
END
$seed_history$;
${steps}
COMMIT;
`;
}
