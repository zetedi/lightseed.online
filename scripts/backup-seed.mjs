#!/usr/bin/env node
// seed:backup — THE KEEPING (ring 2026-11-03): a whole independent node into one new directory, owner-only:
//   npm run seed:backup -- [--local] [--without-identity] [--without-media] <dir>
// the database (pg_dump of the soil, --no-owner --no-acl, so it restores into any empty database), the
// media (the pictures by hash, as one tar from the API's store), the identity (pg_dump of the issuer's own
// database: the realm and every login), and the configuration (the environment, the charter, the trust
// file, the runtime secrets — the custodian's key stays outside by design). A manifest names every file
// with its size and sha256 (domain/seedBackup), the migration the soil stands at and the commit the hand ran
// from; seed:restore refuses a backup that does not answer to it. Runs the Compose project in seed/ (the
// local walk's files with --local). A part whose service is not running is left out and said so.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, stat, writeFile, open } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { backupManifestOf } from '../src/domain/seedBackup.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seed = join(root, 'seed');
const args = process.argv.slice(2);
const flags = ['--local', '--without-identity', '--without-media'];
const positional = args.filter(a => !a.startsWith('--'));
if (positional.length !== 1 || args.some(a => a.startsWith('--') && !flags.includes(a))) {
  console.error('Usage: npm run seed:backup -- [--local] [--without-identity] [--without-media] <new directory>');
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
const sha256Of = async file => createHash('sha256').update(await readFile(file)).digest('hex');

const dir = resolve(positional[0]);
const files = [];
const take = async (name, part) => { const s = await stat(join(dir, name)); files.push({ name, part, bytes: s.size, sha256: await sha256Of(join(dir, name)) }); };
try {
  await mkdir(dir, { mode: 0o700 }); // refuses an existing directory: a backup is never written over
  if (!running('db')) throw Object.assign(new Error('The database service is not running; nothing to keep.'), { code: 'db_not_running' });
  // THE DATABASE: the soil whole.
  await capture([...compose, 'exec', '-T', 'db', 'pg_dump', '-U', 'lightseed', '--no-owner', '--no-acl', 'lightseed'], join(dir, 'database.sql'));
  await take('database.sql', 'database');
  const migration = execFileSync('docker', [...compose, 'exec', '-T', 'db', 'psql', '-X', '-qAt', '-U', 'lightseed', '-d', 'lightseed', '-c', 'SELECT max(name) FROM seed.schema_migrations'], { cwd: seed, encoding: 'utf8' }).trim() || null;
  // THE MEDIA: the store as one tar, from the API's own mount.
  const notes = [];
  if (args.includes('--without-media')) notes.push('media left out by the hand');
  else if (!running('api')) notes.push('media left out: the api service is not running');
  else { await capture([...compose, 'exec', '-T', 'api', 'tar', '-C', '/app/media', '-cf', '-', '.'], join(dir, 'media.tar')); await take('media.tar', 'media'); }
  // THE IDENTITY: the issuer's own database (the realm, every login).
  if (args.includes('--without-identity')) notes.push('identity left out by the hand');
  else if (!identityRunning()) notes.push('identity left out: the identity stack is not running');
  else { await capture([...identityCompose, 'exec', '-T', 'identity-db', 'pg_dump', '-U', 'keycloak', '--no-owner', '--no-acl', 'keycloak'], join(dir, 'identity.sql')); await take('identity.sql', 'identity'); }
  // THE CONFIGURATION: what exists of the installation's files, under config/ with their own paths.
  const candidates = local
    ? ['local/.env', 'local/runtime.env', 'local/auth.json', 'local/identity.env', 'local/charter']
    : ['.env', 'runtime.env', 'identity/.env', process.env.SEED_CHARTER_DIR ?? 'charter'];
  for (const candidate of candidates) {
    const source = resolve(seed, candidate);
    let s; try { s = await stat(source); } catch { continue; }
    const entries = s.isDirectory() ? (await readdir(source)).filter(n => n.endsWith('.json')).map(n => join(candidate, n)) : [candidate];
    for (const entry of entries) {
      const name = `config/${entry.replace(/^\.\//, '')}`;
      await mkdir(dirname(join(dir, name)), { recursive: true, mode: 0o700 });
      await copyFile(resolve(seed, entry), join(dir, name), constants.COPYFILE_EXCL);
      await take(name, 'config');
    }
  }
  let commit = null; try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* not a checkout */ }
  const manifest = backupManifestOf({ takenAtMs: Date.now(), commit, migration, files });
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const bytes = files.reduce((sum, f) => sum + f.bytes, 0);
  console.log(`Kept at ${manifest.takenAt} into ${dir}: ${manifest.parts.join(', ')} — ${files.length} files, ${bytes} bytes, soil at ${migration ?? 'an unknown migration'}${commit ? `, hand at ${commit.slice(0, 12)}` : ''}.`);
  for (const note of notes) console.log(`  ${note}.`);
  console.log('The custodian key, the TLS certificates and the edge are not in a backup by design; the manifest names what is. Keep this directory where only the keeper can read it.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Backup failed.');
  process.exitCode = 1;
}
