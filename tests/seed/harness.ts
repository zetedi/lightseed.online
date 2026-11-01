// A shared real-PostgreSQL harness for the seed's test files (ring 2026-11-02): one isolated
// cluster per file (unix socket in its own temp directory, never the developer's database), the
// actual migrations, the actual provisioning script, and a database handle that authenticates as
// the restricted runtime login — exactly what tests/seed/migrations.postgres-test.ts does inline.
// PostgreSQL's bin directory must be on PATH or supplied in SEED_PG_BIN.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { seedMigrationSql } from '../../src/domain/seedMigrations';
import { createDatabase } from '../../seed/api/database.mjs';

const bin = (name: string) => process.env.SEED_PG_BIN ? join(process.env.SEED_PG_BIN, name) : name;
const sources = readdirSync(resolve('seed/schema')).filter(n => n.endsWith('.sql'))
  .map(name => ({ name, sql: readFileSync(resolve('seed/schema', name), 'utf8') }));

export interface Cluster {
  sql(query: string): string;
  migrate(): Promise<void>;
  // A fresh database (migrated, provisioned) and the API's handle on it as the runtime role.
  fresh(max?: number): Promise<{ db: ReturnType<typeof createDatabase>; credentials: Record<string, string>; connection: { host: string; port: number; database: string; user: string } }>;
  stop(): void;
}

export function startCluster(port: number): Cluster {
  const directory = mkdtempSync('/tmp/lightseed-pg-');
  const environment: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(environment)) if (key.startsWith('PG')) delete environment[key];
  Object.assign(environment, { PGHOST: directory, PGPORT: String(port), PGUSER: 'seedtest', PGDATABASE: 'postgres' });
  const command = (name: string, args: string[], input?: string) => execFileSync(bin(name), args, {
    env: environment, encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'], timeout: 25_000,
  });
  const sql = (query: string) => command('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], query).trim();
  command('initdb', ['-D', join(directory, 'data'), '--auth=trust', '--username=seedtest', '--no-locale', '-E', 'UTF8']);
  writeFileSync(join(directory, 'data/pg_hba.conf'), 'local all seedtest trust\nlocal all all scram-sha-256\n');
  command('pg_ctl', ['-D', join(directory, 'data'), '-l', join(directory, 'server.log'), '-o', `-F -k ${directory} -h '' -p ${port}`, '-w', 'start']);
  let count = 0;
  const migrate = async () => {
    const path = join(directory, 'migration.sql');
    writeFileSync(path, await seedMigrationSql(sources));
    try { command('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path]); } finally { rmSync(path, { force: true }); }
  };
  return {
    sql, migrate,
    async fresh(max = 2) {
      environment.PGDATABASE = 'postgres';
      sql(`CREATE DATABASE door_test_${++count};`);
      environment.PGDATABASE = `door_test_${count}`;
      await migrate();
      const output = join(directory, `runtime-${count}.env`);
      execFileSync(process.execPath, [resolve('scripts/provision-seed.mjs'), '--local', output],
        { env: { ...environment, SEED_PSQL: bin('psql') }, encoding: 'utf8', timeout: 25_000, stdio: ['pipe', 'pipe', 'pipe'] });
      const credentials = Object.fromEntries(readFileSync(output, 'utf8').split('\n')
        .filter(line => /^PG(USER|PASSWORD)=/.test(line)).map(line => line.split('='))) as Record<string, string>;
      const db = createDatabase({ host: directory, port, database: environment.PGDATABASE, user: credentials.PGUSER, password: credentials.PGPASSWORD, max });
      // The owner's own door (trust on the socket): what the installation's ceremonies connect as.
      return { db, credentials, connection: { host: directory, port, database: environment.PGDATABASE, user: 'seedtest' } };
    },
    stop() {
      try { command('pg_ctl', ['-D', join(directory, 'data'), '-m', 'immediate', '-w', 'stop']); } catch { /* already down */ }
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
