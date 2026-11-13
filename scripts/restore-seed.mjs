#!/usr/bin/env node
// seed:restore — THE KEEPING's other hand (ring 2026-11-03, mended by the review the same day): a backup
// seed:backup wrote, held to its manifest first (every file present, its size and sha256 its own), then
// EVERY PLACE LOOKED AT before anything is written — the database, the store, the issuer's database — and
// refused as one report if any part would land where something stands; then landed part by part:
//   npm run seed:restore -- [--local] <dir> [--database <name>] [--media-dir <absolute path>]
//                            [--without-database] [--without-media] [--without-identity] [--without-config]
// the database into an EMPTY database (--database, `lightseed` by default; it must exist and carry no
// `seed` schema — a soil is never written over; one transaction), the media into the API's EMPTY store
// (or --media-dir, a new or empty directory, for a look before trusting), the identity into an EMPTY
// issuer database (one transaction), the configuration files only where none stands (never overwritten;
// what was skipped is named). A part that already stands is left out with its --without flag, so a
// restore stopped halfway is finished, never redone over itself. Runs the Compose project in seed/.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { backupManifestIssues } from '../src/domain/seedBackup.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seed = join(root, 'seed');
const args = process.argv.slice(2);
const named = ['--database', '--media-dir'];
const flags = ['--local', '--without-database', '--without-media', '--without-identity', '--without-config'];
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const positional = args.filter((a, i) => !a.startsWith('--') && !named.includes(args[i - 1]));
if (positional.length !== 1 || args.some(a => a.startsWith('--') && !named.includes(a) && !flags.includes(a))) {
  console.error('Usage: npm run seed:restore -- [--local] <backup directory> [--database <name>] [--media-dir <absolute path>] [--without-database] [--without-media] [--without-identity] [--without-config]');
  process.exit(1);
}
const local = args.includes('--local');
const without = part => args.includes(`--without-${part}`);
const compose = local ? ['compose', '--env-file', 'local/.env', '-f', 'docker-compose.yml', '-f', 'compose.local.yml', '--profile', 'api', '--profile', 'edge'] : ['compose'];
const identityCompose = ['compose', '--env-file', local ? 'local/identity.env' : 'identity/.env', '-f', 'identity/compose.yml'];
const database = option('--database') ?? 'lightseed';
if (!/^[a-z][a-z0-9_]{0,62}$/.test(database)) { console.error('The database name must be a plain lowercase identifier.'); process.exit(1); }
const mediaDir = option('--media-dir');
if (mediaDir !== undefined && !isAbsolute(mediaDir)) { console.error('--media-dir must be an absolute path.'); process.exit(1); }

// A file streamed to a command's stdin; the exit code is the law.
const feed = (commandArgs, file) => new Promise((done, fail) => {
  const child = spawn('docker', commandArgs, { cwd: seed, stdio: ['pipe', 'inherit', 'inherit'] });
  child.on('error', fail);
  child.on('close', code => (code === 0 ? done() : fail(Object.assign(new Error(`docker ${commandArgs.slice(0, 3).join(' ')} exited ${code}`), { code: 'restore_part_failed' }))));
  const source = createReadStream(file);
  source.on('error', error => { child.kill(); fail(error); });
  source.pipe(child.stdin);
});
const docker = commandArgs => execFileSync('docker', commandArgs, { cwd: seed, encoding: 'utf8' }).trim();
const psql = (composeArgs, service, user, db, query) => docker([...composeArgs, 'exec', '-T', service, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', db, '-c', query]);
const running = (composeArgs, service) => { try { return docker([...composeArgs, 'ps', '--status', 'running', '--services']).split('\n').includes(service); } catch { return false; } };
const emptyDirectory = async path => { try { return (await readdir(path)).length === 0; } catch (error) { if (error?.code === 'ENOENT') return true; throw error; } };

const dir = resolve(positional[0]);
const restore = async () => {
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  const held = async name => { try { const s = await stat(join(dir, name)); return { bytes: s.size, sha256: createHash('sha256').update(await readFile(join(dir, name))).digest('hex') }; } catch { return null; } };
  const found = new Map();
  for (const file of Array.isArray(manifest?.files) ? manifest.files : []) found.set(file.name, await held(String(file.name)));
  const issues = backupManifestIssues(manifest, name => found.get(name) ?? null);
  if (issues.length) {
    console.error(`The backup does not answer to its manifest (${issues.length} issues):`);
    for (const issue of issues.slice(0, 20)) console.error(`  ${issue.code}${issue.name ? ' ' + issue.name : ''}`);
    return 2;
  }
  const has = part => manifest.files.some(f => f.part === part) && !without(part);
  console.log(`Backup of ${manifest.takenAt} (soil at ${manifest.migration ?? 'an unknown migration'}): ${manifest.parts.join(', ')} — every file answers to its name.`);

  // EVERY PLACE FIRST: nothing is written while any part would land where something stands.
  const standing = [];
  if (has('database')) {
    if (!running(compose, 'db')) standing.push('database: the db service is not running');
    else if (psql(compose, 'db', 'lightseed', database, "SELECT count(*) FROM pg_namespace WHERE nspname='seed'") !== '0') standing.push(`database: ${database} already carries a seed schema — name an empty database (--database) or leave it (--without-database)`);
  }
  if (has('media')) {
    if (mediaDir !== undefined) { if (!(await emptyDirectory(mediaDir))) standing.push(`media: ${mediaDir} is not empty`); }
    else if (!running(compose, 'api')) standing.push('media: the api service is not running — --media-dir lands the pictures in a directory instead');
    else if (docker([...compose, 'exec', '-T', 'api', 'sh', '-c', 'find /app/media -type f | head -n 1']) !== '') standing.push('media: the store already holds files (--without-media)');
  }
  if (has('identity')) {
    if (!running(identityCompose, 'identity-db')) standing.push('identity: the identity stack is not running (--without-identity)');
    else if (psql(identityCompose, 'identity-db', 'keycloak', 'keycloak', "SELECT count(*) FROM pg_tables WHERE schemaname='public'") !== '0') standing.push('identity: the issuer database already carries tables — stop and empty it first, or --without-identity');
  }
  if (standing.length) {
    console.error(`Nothing restored: a part would land where something stands (${standing.length}).`);
    for (const line of standing) console.error(`  ${line}`);
    return 2;
  }

  // THE DATABASE: into the empty database, one transaction.
  if (has('database')) {
    await feed([...compose, 'exec', '-T', 'db', 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-U', 'lightseed', '-d', database], join(dir, 'database.sql'));
    console.log(`Database restored into ${database}: soil at ${psql(compose, 'db', 'lightseed', database, 'SELECT max(name) FROM seed.schema_migrations')}.`);
  }
  // THE MEDIA: into the empty store, or into a directory for a look first; a file standing is never replaced (-k).
  if (has('media')) {
    if (mediaDir !== undefined) {
      await mkdir(mediaDir, { recursive: true, mode: 0o700 });
      execFileSync('tar', ['-C', mediaDir, '-xkf', join(dir, 'media.tar')], { stdio: 'inherit' });
      console.log(`Media restored into ${mediaDir}.`);
    } else {
      await feed([...compose, 'exec', '-T', 'api', 'tar', '-C', '/app/media', '-xkf', '-'], join(dir, 'media.tar'));
      console.log("Media restored into the API's store.");
    }
  }
  // THE IDENTITY: into the empty issuer database, one transaction.
  if (has('identity')) {
    await feed([...identityCompose, 'exec', '-T', 'identity-db', 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-U', 'keycloak', '-d', 'keycloak'], join(dir, 'identity.sql'));
    console.log('Identity restored: restart the identity service so it reads its realm anew.');
  }
  // THE CONFIGURATION: only where nothing stands.
  if (has('config')) {
    const kept = [], skipped = [];
    for (const file of manifest.files.filter(f => f.part === 'config')) {
      const target = resolve(seed, file.name.replace(/^config\//, ''));
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      try { await copyFile(join(dir, file.name), target, constants.COPYFILE_EXCL); kept.push(file.name); }
      catch (error) { if (error?.code === 'EEXIST') skipped.push(file.name); else throw error; }
    }
    console.log(`Configuration: ${kept.length} files placed${skipped.length ? `, ${skipped.length} already standing and left as they are (${skipped.join(', ')})` : ''}.`);
  }
  console.log('Restored. Provision the runtime role anew (seed:provision) if the restored soil is to be served, and restart the API.');
  return 0;
};
try {
  process.exitCode = await restore();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Restore failed.');
  console.error('Stopped before the end: the parts already restored stand; finish with the --without flag of each part that stands.');
  process.exitCode = 1;
}
