#!/usr/bin/env node
// seed:backup — THE KEEPING (ring 2026-11-03): a whole independent node into one new directory, owner-only:
//   npm run seed:backup -- [--local] [--without-identity] [--without-media] [--without-config]
//                           [--charter <dir>] [--trust <file>] <dir>
// the database (pg_dump of the soil, --no-owner --no-acl, so it restores into any empty database — and after
// it the one privilege a fresh restore would lose: every function the migrations withhold from PUBLIC), the
// media (the pictures by hash, as one tar from the API's store), the identity (pg_dump of the issuer's own
// database: the realm and every login), and the configuration (the environment, the charter, the trust
// file, the runtime secrets — the custodian's key stays outside by design; the charter directory is read
// from --charter, the environment or seed/.env (SEED_CHARTER_DIR), the trust file from --trust or
// SEED_AUTH_CONFIG_FILE, and one that is not found is SAID, never passed over). A manifest names every file
// with its size and sha256 (domain/seedBackup), the migration the soil stands at and the commit the hand ran
// from; seed:restore refuses a backup that does not answer to it. Runs the Compose project in seed/ (the
// local walk's files with --local). A part whose service is not running is left out and said so.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import { appendFile, copyFile, mkdir, readFile, readdir, stat, writeFile, open } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { backupManifestOf, backupConfigNameOf, envValueOf, WITHHELD_ROUTINES_SQL, withheldRoutinesSectionOf } from '../src/domain/seedBackup.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seed = join(root, 'seed');
const args = process.argv.slice(2);
const flags = ['--local', '--without-identity', '--without-media', '--without-config'];
const named = ['--charter', '--trust'];
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const positional = args.filter((a, i) => !a.startsWith('--') && !named.includes(args[i - 1]));
if (positional.length !== 1 || args.some(a => a.startsWith('--') && !flags.includes(a) && !named.includes(a)) || named.some(n => args.includes(n) && !option(n))) {
  console.error('Usage: npm run seed:backup -- [--local] [--without-identity] [--without-media] [--without-config] [--charter <dir>] [--trust <file>] <new directory>');
  process.exit(1);
}
const local = args.includes('--local');
const compose = local ? ['compose', '--env-file', 'local/.env', '-f', 'docker-compose.yml', '-f', 'compose.local.yml', '--profile', 'api', '--profile', 'edge'] : ['compose'];
const identityCompose = ['compose', '--env-file', local ? 'local/identity.env' : 'identity/.env', '-f', 'identity/compose.yml'];

// A command's stdout into a new owner-only file, its stderr to ours; the exit code is the law.
const capture = (commandArgs, file) => new Promise((done, fail) => {
  open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600).then(handle => {
    const out = handle.createWriteStream();
    const child = spawn('docker', commandArgs, { cwd: seed, stdio: ['ignore', 'pipe', 'inherit'] });
    child.stdout.pipe(out);
    child.on('error', fail);
    child.on('close', code => { out.end(() => (code === 0 ? done() : fail(Object.assign(new Error(`docker ${commandArgs.slice(0, 3).join(' ')} exited ${code}`), { code: 'backup_part_failed' })))); });
  }).catch(fail);
});
const running = service => {
  try { return execFileSync('docker', [...compose, 'ps', '--status', 'running', '--services'], { cwd: seed, encoding: 'utf8' }).split('\n').includes(service); } catch { return false; }
};
const identityRunning = () => {
  try { return execFileSync('docker', [...identityCompose, 'ps', '--status', 'running', '--services'], { cwd: seed, encoding: 'utf8' }).split('\n').includes('identity-db'); } catch { return false; }
};
// Streamed: a media tar or a soil dump may be larger than one buffer can hold (2 GiB).
const sha256Of = file => new Promise((done, fail) => {
  const hash = createHash('sha256');
  createReadStream(file).on('error', fail).on('data', chunk => hash.update(chunk)).on('end', () => done(hash.digest('hex')));
});

// THE CONFIGURATION, PLANNED BEFORE ANYTHING IS DUMPED: every file with the name it will carry in the backup
// (domain/seedBackup: inside seed/ its own path, outside it a fixed label), so an unsound name stops the hand
// first and a part that was expected and not found is said.
const configPlan = async notes => {
  const plan = [];
  const add = async (source, label, expected) => {
    let s; try { s = await stat(source); } catch { if (expected) notes.push(`${expected} left out: nothing stands at ${source}`); return; }
    const within = relative(seed, source);
    const inside = within && !within.startsWith('..') && !within.startsWith(sep) && !/^[A-Za-z]:/.test(within);
    const files = s.isDirectory() ? (await readdir(source)).filter(n => n.endsWith('.json')).sort() : [null];
    if (s.isDirectory() && !files.length && expected) notes.push(`${expected} left out: ${source} holds no .json file`);
    for (const file of files) {
      const path = file === null ? source : join(source, file);
      plan.push({ source: path, name: backupConfigNameOf({ inside: inside ? relative(seed, path) : null, label, file: basename(path) }) });
    }
  };
  if (local) {
    for (const file of ['local/.env', 'local/runtime.env', 'local/identity.env']) await add(resolve(seed, file), 'env', null);
    await add(resolve(seed, option('--trust') ?? 'local/auth.json'), 'trust', 'the trust file');
    await add(resolve(seed, option('--charter') ?? 'local/charter'), 'charter', 'the charter');
    return plan;
  }
  for (const file of ['.env', 'runtime.env', 'identity/.env']) await add(resolve(seed, file), 'env', null);
  let env = ''; try { env = await readFile(join(seed, '.env'), 'utf8'); } catch { /* no .env: the defaults stand */ }
  // Compose reads SEED_CHARTER_DIR from the shell first, then from seed/.env; a relative path is relative to seed/.
  await add(resolve(seed, option('--charter') ?? process.env.SEED_CHARTER_DIR ?? envValueOf(env, 'SEED_CHARTER_DIR') ?? 'charter'), 'charter', 'the charter');
  // The trust file is mounted by the installation's own Compose override, so only the keeper knows its place.
  const trust = option('--trust') ?? process.env.SEED_AUTH_CONFIG_FILE ?? envValueOf(env, 'SEED_AUTH_CONFIG_FILE');
  if (trust) await add(resolve(seed, trust), 'trust', 'the trust file');
  else notes.push('the trust file left out: name it with --trust <file> (or SEED_AUTH_CONFIG_FILE in seed/.env)');
  return plan;
};

const dir = resolve(positional[0]);
const files = [];
const take = async (name, part) => { const s = await stat(join(dir, name)); files.push({ name, part, bytes: s.size, sha256: await sha256Of(join(dir, name)) }); };
try {
  const notes = [];
  const config = args.includes('--without-config') ? [] : await configPlan(notes);
  await mkdir(dir, { mode: 0o700 }); // refuses an existing directory: a backup is never written over
  if (!running('db')) throw Object.assign(new Error('The database service is not running; nothing to keep.'), { code: 'db_not_running' });
  // THE DATABASE: the soil whole.
  await capture([...compose, 'exec', '-T', 'db', 'pg_dump', '-U', 'lightseed', '--no-owner', '--no-acl', 'lightseed'], join(dir, 'database.sql'));
  // THE WITHHELD FUNCTIONS, after the dump (domain/seedBackup): --no-acl would let PUBLIC execute every one of them again.
  const withheld = withheldRoutinesSectionOf(execFileSync('docker', [...compose, 'exec', '-T', 'db', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'lightseed', '-d', 'lightseed', '-c', "SET search_path TO ''", '-c', WITHHELD_ROUTINES_SQL], { cwd: seed, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  await appendFile(join(dir, 'database.sql'), withheld.sql);
  await take('database.sql', 'database');
  const migration = execFileSync('docker', [...compose, 'exec', '-T', 'db', 'psql', '-X', '-qAt', '-U', 'lightseed', '-d', 'lightseed', '-c', 'SELECT max(name) FROM seed.schema_migrations'], { cwd: seed, encoding: 'utf8' }).trim() || null;
  // THE MEDIA: the store as one tar, from the API's own mount.
  if (args.includes('--without-media')) notes.push('media left out by the hand');
  else if (!running('api')) notes.push('media left out: the api service is not running');
  else { await capture([...compose, 'exec', '-T', 'api', 'tar', '-C', '/app/media', '-cf', '-', '.'], join(dir, 'media.tar')); await take('media.tar', 'media'); }
  // THE IDENTITY: the issuer's own database (the realm, every login).
  if (args.includes('--without-identity')) notes.push('identity left out by the hand');
  else if (!identityRunning()) notes.push('identity left out: the identity stack is not running');
  else { await capture([...identityCompose, 'exec', '-T', 'identity-db', 'pg_dump', '-U', 'keycloak', '--no-owner', '--no-acl', 'keycloak'], join(dir, 'identity.sql')); await take('identity.sql', 'identity'); }
  // THE CONFIGURATION: what exists of the installation's files, under config/ with their own paths
  // (--without-config leaves them out and says so: the Docker proof keeps a node without reading the installation's files).
  if (args.includes('--without-config')) notes.push('configuration left out by the hand');
  for (const { source, name } of config) {
    await mkdir(dirname(join(dir, name)), { recursive: true, mode: 0o700 });
    await copyFile(source, join(dir, name), constants.COPYFILE_EXCL);
    await take(name, 'config');
  }
  let commit = null; try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* not a checkout */ }
  const manifest = backupManifestOf({ takenAtMs: Date.now(), commit, migration, files });
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const bytes = files.reduce((sum, f) => sum + f.bytes, 0);
  console.log(`Kept at ${manifest.takenAt} into ${dir}: ${manifest.parts.join(', ')} — ${files.length} files, ${bytes} bytes, soil at ${migration ?? 'an unknown migration'}, ${withheld.count} functions withheld from PUBLIC${commit ? `, hand at ${commit.slice(0, 12)}` : ''}.`);
  for (const note of notes) console.log(`  ${note}.`);
  console.log('The custodian key, the TLS certificates and the edge are not in a backup by design; the manifest names what is. Keep this directory where only the keeper can read it.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Backup failed.');
  process.exitCode = 1;
}
