import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { seedMigrationSql, type SeedMigration } from '../../src/domain/seedMigrations';
import { seedRuntimeSql } from '../../src/domain/seedRuntime';

// An isolated real cluster, never the developer's database. PostgreSQL's bin directory
// must be on PATH or explicitly supplied in SEED_PG_BIN. No network listener is opened.
const bin = (name: string) => process.env.SEED_PG_BIN ? join(process.env.SEED_PG_BIN, name) : name;
let directory: string;
let started = false;
let database = 0;
let environment: NodeJS.ProcessEnv;
const sources = readdirSync(resolve('seed/schema')).filter(n => n.endsWith('.sql'))
  .map(name => ({ name, sql: readFileSync(resolve('seed/schema', name), 'utf8') }));
const command = (name: string, args: string[], input?: string) => execFileSync(bin(name), args, {
  env: environment, encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'], timeout: 25_000,
});
const sql = (query: string) => command('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], query).trim();
const migrate = async (files: SeedMigration[] = sources) => sql(await seedMigrationSql(files));

beforeAll(() => {
  directory = mkdtempSync('/tmp/lightseed-postgres-');
  environment = { ...process.env };
  for (const key of Object.keys(environment)) if (key.startsWith('PG')) delete environment[key];
  Object.assign(environment, { PGHOST: directory, PGPORT: '55439', PGUSER: 'seedtest', PGDATABASE: 'postgres' });
  command('initdb', ['-D', join(directory, 'data'), '--auth=trust', '--username=seedtest', '--no-locale', '-E', 'UTF8']);
  // Admin remains local-only trust. Every provisioned runtime login must actually
  // authenticate with SCRAM, so these tests cannot pass with a broken password hash.
  writeFileSync(join(directory, 'data/pg_hba.conf'), 'local all seedtest trust\nlocal all all scram-sha-256\n');
  command('pg_ctl', ['-D', join(directory, 'data'), '-l', join(directory, 'server.log'), '-o', `-F -k ${directory} -h '' -p 55439`, '-w', 'start']);
  started = true;
  sql('CREATE ROLE seed_runtime_test NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;');
});
beforeEach(() => {
  environment.PGDATABASE = 'postgres';
  sql(`CREATE DATABASE migration_test_${++database};`);
  environment.PGDATABASE = `migration_test_${database}`;
});
afterAll(() => {
  if (started) command('pg_ctl', ['-D', join(directory, 'data'), '-m', 'immediate', '-w', 'stop']);
  if (directory) rmSync(directory, { recursive: true, force: true });
});

describe('real PostgreSQL migrations', () => {
  it('runs the actual local CLI against the isolated database', () => {
    execFileSync(process.execPath, [resolve('scripts/migrate-seed.mjs'), '--local'], {
      env: { ...environment, SEED_PSQL: bin('psql') }, encoding: 'utf8', timeout: 25_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    expect(sql('SELECT count(*) FROM seed.schema_migrations;')).toBe(String(sources.length));
  });
  it('initializes the actual schema, then reruns without changing data or ledger timestamps', async () => {
    await migrate();
    const ledger = sql('SELECT name, checksum, applied_at FROM seed.schema_migrations ORDER BY name;');
    sql(`INSERT INTO lifetrees(id, doc) VALUES ('preserve-me', '{"name":"Oak"}');`);
    await migrate();
    expect(sql('SELECT name, checksum, applied_at FROM seed.schema_migrations ORDER BY name;')).toBe(ledger);
    expect(sql("SELECT doc->>'name' FROM lifetrees WHERE id = 'preserve-me';")).toBe('Oak');
    expect(sql('SELECT count(*) FROM seed.schema_migrations;')).toBe(String(sources.length));
  });
  it('adds later schema without replaying earlier migrations', async () => {
    await migrate();
    await migrate([...sources, { name: '900_example.sql', sql: 'CREATE TABLE example(id integer);' }]);
    expect(sql("SELECT to_regclass('public.example');")).toBe('example');
    expect(sql('SELECT count(*) FROM seed.schema_migrations;')).toBe(String(sources.length + 1));
  });
  it('rolls back earlier pending DDL and the ledger when a later migration fails', async () => {
    await migrate();
    await expect(migrate([...sources,
      { name: '900_example.sql', sql: 'CREATE TABLE example(id integer);' },
      { name: '901_failure.sql', sql: 'SELECT nonexistent_function();' },
    ])).rejects.toThrow();
    expect(sql("SELECT to_regclass('public.example');")).toBe('');
    expect(sql('SELECT count(*) FROM seed.schema_migrations;')).toBe(String(sources.length));
  });
  it('refuses changed or missing applied files', async () => {
    await migrate();
    await expect(migrate(sources.map((f, i) => i === 0 ? { ...f, sql: f.sql + '\n-- changed' } : f))).rejects.toThrow('history differs');
    await expect(migrate(sources.slice(1))).rejects.toThrow('history differs');
  });
  it('refuses holes in migration history', async () => {
    await migrate();
    sql("DELETE FROM seed.schema_migrations WHERE name = '001_collections.sql';");
    await expect(migrate()).rejects.toThrow('not a prefix');
  });
  it('refuses an untracked existing database without touching its data', async () => {
    sql("CREATE TABLE existing(value text); INSERT INTO existing VALUES ('keep');");
    await expect(migrate()).rejects.toThrow('no migration ledger');
    expect(sql('SELECT value FROM existing;')).toBe('keep');
    expect(sql("SELECT to_regclass('seed.schema_migrations');")).toBe('');
  });
  it('serializes simultaneous invocations so each migration runs exactly once', async () => {
    const batch = await seedMigrationSql([...sources, { name: '900_once.sql', sql: 'SELECT pg_sleep(0.2); CREATE TABLE once_only(id integer);' }]);
    const invoke = () => new Promise<void>((accept, reject) => {
      const child = spawn(bin('psql'), ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { env: environment });
      let errors = '';
      child.stdout.resume();
      child.stderr.on('data', chunk => { errors += chunk; });
      child.on('error', reject);
      child.on('close', code => code === 0 ? accept() : reject(new Error(errors)));
      child.stdin.end(batch);
    });
    await Promise.all([invoke(), invoke()]);
    expect(sql('SELECT count(*) FROM seed.schema_migrations;')).toBe(String(sources.length + 1));
  });
});

// Deliberately grant DML in tests: absence of GRANT alone must not disguise missing RLS.
const asRuntime = (query: string, uid = '') => sql(`BEGIN;
  SET LOCAL ROLE seed_runtime_test;
  SELECT set_config('seed.uid', '${uid}', true);
  ${query}
  COMMIT;`);
const prepareAccess = async () => {
  await migrate();
  sql(`GRANT USAGE ON SCHEMA public, seed TO seed_runtime_test;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO seed_runtime_test;
    INSERT INTO users VALUES ('alice', '{"private":"profile"}');
    INSERT INTO lifetrees VALUES ('private-tree', '{"visibility":"private"}');
    INSERT INTO secret_links(from_id, rel, to_id, lid) VALUES
      ('alice', 'keeper', 'secret-tree', 'seat-a'), ('bob', 'keeper', 'secret-tree', 'seat-b');`);
};

describe('non-owner database access', () => {
  it('has RLS on every collection and denies unported private reads and writes', async () => {
    await prepareAccess();
    expect(sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity;")).toBe('0');
    expect(asRuntime('SELECT count(*) FROM users;', 'alice')).toBe('alice\n0');
    expect(asRuntime('SELECT count(*) FROM lifetrees;', 'alice')).toBe('alice\n0');
    expect(() => asRuntime("INSERT INTO users VALUES ('mallory', '{}');", 'alice')).toThrow(/row-level security/);
    expect(() => asRuntime('TRUNCATE users;', 'alice')).toThrow(/permission denied/);
    expect(() => asRuntime('SELECT * FROM seed.schema_migrations;', 'alice')).toThrow(/permission denied/);
    expect(() => asRuntime('CREATE TABLE public.forbidden(id text);', 'alice')).toThrow(/permission denied/);
  });
  it('keeps secret seats scoped to the asking hand and rejects client seat writes', async () => {
    await prepareAccess();
    expect(asRuntime('SELECT from_id FROM secret_links;', 'alice')).toBe('alice\nalice');
    expect(asRuntime('SELECT count(*) FROM secret_links;')).toBe('0');
    expect(() => asRuntime("INSERT INTO secret_links(from_id,rel,to_id,lid) VALUES ('alice','keeper','other','x');", 'alice')).toThrow(/row-level security/);
    asRuntime("DELETE FROM secret_links; UPDATE secret_links SET lid='changed';", 'alice');
    expect(sql("SELECT count(*) FROM secret_links WHERE lid IN ('seat-a','seat-b');")).toBe('2');
  });
  it('allows only own joined inserts, denies forged or anonymous hands and guardian keys', async () => {
    await prepareAccess();
    const insert = (from: string, rel: string) => `INSERT INTO links(from_id,rel,to_id,lid) VALUES ('${from}','${rel}','private-tree','test');`;
    asRuntime(insert('alice', 'joined'), 'alice');
    expect(asRuntime('SELECT id FROM links;')).toBe('alice__joined__private-tree');
    for (const [from, rel, uid] of [['bob','joined','alice'], ['alice','joined',''], ['alice','guardian','alice'], ['alice','keeper','alice']]) {
      expect(() => asRuntime(insert(from, rel), uid)).toThrow(/row-level security/);
    }
    asRuntime("UPDATE links SET lid='changed'; DELETE FROM links;", 'bob');
    expect(sql('SELECT lid FROM links;')).toBe('test');
    asRuntime('DELETE FROM links;', 'alice');
    expect(sql('SELECT count(*) FROM links;')).toBe('0');
  });
  it('preserves every permanent link even against its own subject', async () => {
    await prepareAccess();
    const rels = ['invited_by', 'welcomed_by', 'party', 'collaborates_with', 'recognises', 'shares_resources_with', 'accepts_coin_of', 'descends_from'];
    for (const rel of rels) sql(`INSERT INTO links(from_id,rel,to_id,lid) VALUES ('alice','${rel}','target','test');`);
    asRuntime('DELETE FROM links;', 'alice');
    expect(sql('SELECT count(*) FROM links;')).toBe(String(rels.length));
  });
  it('clears transaction-local identity before reusing a connection', async () => {
    await prepareAccess();
    expect(sql(`SET ROLE seed_runtime_test;
      BEGIN; SELECT set_config('seed.uid','alice',true); SELECT count(*) FROM secret_links; COMMIT;
      BEGIN; SELECT coalesce(seed.uid(),'anonymous'); SELECT count(*) FROM secret_links; COMMIT;`)).toBe('alice\n1\nanonymous\n0');
  });
});

const provision = (output: string) => execFileSync(process.execPath,
  [resolve('scripts/provision-seed.mjs'), '--local', output], {
    env: { ...environment, SEED_PSQL: bin('psql') }, encoding: 'utf8', timeout: 25_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
const runtimeCredentials = (file: string) => Object.fromEntries(readFileSync(file, 'utf8').split('\n')
  .filter(line => /^PG(USER|PASSWORD)=/.test(line)).map(line => line.split('=')));
const runtimeQuery = (credentials: Record<string, string>, query: string) => execFileSync(bin('psql'),
  ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { env: { ...environment, ...credentials },
    encoding: 'utf8', input: query, stdio: ['pipe', 'pipe', 'pipe'], timeout: 25_000 }).trim();

describe('provisioned runtime account', () => {
  it('authenticates via SCRAM with only the implemented graph privileges', async () => {
    await migrate();
    const output = join(directory, `runtime-${database}.env`);
    const message = provision(output);
    const credentials = runtimeCredentials(output);
    expect((statSync(output).mode & 0o777)).toBe(0o600);
    expect(message).not.toContain(credentials.PGPASSWORD);
    expect(runtimeQuery(credentials, 'SELECT current_user;')).toBe(credentials.PGUSER);
    expect(() => runtimeQuery({ ...credentials, PGPASSWORD: 'wrong-password' }, 'SELECT 1;')).toThrow(/password authentication failed/);
    expect(sql(`SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolinherit FROM pg_roles WHERE rolname='${credentials.PGUSER}';`)).toBe('f');
    expect(sql(`SELECT count(*) FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='${credentials.PGUSER}');`)).toBe('0');
    sql("INSERT INTO secret_links(from_id,rel,to_id,lid) VALUES ('alice','keeper','tree','seat');");
    expect(runtimeQuery(credentials, 'SELECT count(*) FROM secret_links;')).toBe('0');
    expect(runtimeQuery(credentials, "BEGIN; SELECT set_config('seed.uid','alice',true); SELECT from_id FROM secret_links; COMMIT;")).toBe('alice\nalice');
    runtimeQuery(credentials, "BEGIN; SET LOCAL seed.uid='alice'; INSERT INTO links(from_id,rel,to_id,lid) VALUES ('alice','joined','vision','link'); COMMIT;");
    expect(runtimeQuery(credentials, 'SELECT id FROM links;')).toBe('alice__joined__vision');
    for (const forbidden of [
      'SELECT * FROM users;', 'SELECT * FROM seed.schema_migrations;',
      'TRUNCATE links;', "UPDATE links SET lid='changed';",
      'CREATE TABLE public.forbidden(id text);', 'SET ROLE seedtest;',
      'CREATE ROLE forbidden;', 'ALTER TABLE links DISABLE ROW LEVEL SECURITY;',
      "INSERT INTO secret_links(from_id,rel,to_id,lid) VALUES ('alice','keeper','other','seat');",
      "BEGIN; SET LOCAL seed.uid='alice'; INSERT INTO links(from_id,rel,to_id,lid) VALUES ('alice','guardian','private','link');",
    ]) expect(() => runtimeQuery(credentials, forbidden)).toThrow();
    runtimeQuery(credentials, "BEGIN; SET LOCAL seed.uid='alice'; DELETE FROM links; COMMIT;");
    expect(sql('SELECT count(*) FROM links;')).toBe('0');
  });
  it('refuses overwrite or existing roles without rotating or broadening credentials', async () => {
    await migrate();
    const output = join(directory, `runtime-${database}.env`);
    provision(output);
    const before = readFileSync(output, 'utf8');
    const credentials = runtimeCredentials(output);
    const count = sql("SELECT count(*) FROM pg_roles WHERE rolname LIKE 'lightseed_api_%';");
    expect(() => provision(output)).toThrow(/already exists/);
    expect(readFileSync(output, 'utf8')).toBe(before);
    expect(sql("SELECT count(*) FROM pg_roles WHERE rolname LIKE 'lightseed_api_%';")).toBe(count);
    const verifier = sql(`SELECT rolpassword FROM pg_authid WHERE rolname='${credentials.PGUSER}';`);
    expect(() => sql(seedRuntimeSql(credentials.PGUSER, verifier)!)).toThrow(/already exists/);
    expect(runtimeQuery(credentials, 'SELECT current_user;')).toBe(credentials.PGUSER);
  });
  it('retains credentials for recovery on database failure without leaving a role behind', () => {
    const output = join(directory, `runtime-${database}.env`);
    expect(() => provision(output)).toThrow(/Credentials retained/);
    const credentials = runtimeCredentials(output);
    expect(sql(`SELECT count(*) FROM pg_roles WHERE rolname='${credentials.PGUSER}';`)).toBe('0');
    expect((statSync(output).mode & 0o777)).toBe(0o600);
  });
  it('refuses provisioning if a later migration leaves a table without RLS', async () => {
    await migrate();
    sql('CREATE TABLE unprotected(id text);');
    const output = join(directory, `runtime-${database}.env`);
    expect(() => provision(output)).toThrow();
    const credentials = runtimeCredentials(output);
    expect(sql(`SELECT count(*) FROM pg_roles WHERE rolname='${credentials.PGUSER}';`)).toBe('0');
  });
});
