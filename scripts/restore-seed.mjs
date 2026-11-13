#!/usr/bin/env node
// seed:restore — THE KEEPING's other hand (ring 2026-11-03): a backup seed:backup wrote, held to its manifest
// first (every file present, its size and sha256 its own), then landed part by part, each only where
// nothing stands:
//   npm run seed:restore -- [--local] <dir> [--database <name>] [--media-dir <absolute path>] [--without-identity] [--without-config]
// the database into an EMPTY database (--database, `lightseed` by default; it must exist and carry no
// `seed` schema — a soil is never written over), the media into the API's store (or --media-dir, for a
// look before trusting), the identity into an EMPTY issuer database, the configuration files only where
// none stands (never overwritten; what was skipped is named). Runs the Compose project in seed/.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { backupManifestIssues } from '../src/domain/seedBackup.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seed = join(root, 'seed');
const args = process.argv.slice(2);
const named = ['--database', '--media-dir'];
const flags = ['--local', '--without-identity', '--without-config'];
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const positional = args.filter((a, i) => !a.startsWith('--') && !named.includes(args[i - 1]));
if (positional.length !== 1 || args.some(a => a.startsWith('--') && !named.includes(a) && !flags.includes(a))) {
  console.error('Usage: npm run seed:restore -- [--local] <backup directory> [--database <name>] [--media-dir <absolute path>] [--without-identity] [--without-config]');
  process.exit(1);
}
const local = args.includes('--local');
const compose = local ? ['compose', '--env-file', 'local/.env', '-f', 'docker-compose.yml', '-f', 'compose.local.yml', '--profile', 'api', '--profile', 'edge'] : ['compose'];
const identityCompose = ['compose', '--env-file', local ? 'local/identity.env' : 'identity/.env', '-f', 'identity/compose.yml'];
const database = option('--database') ?? 'lightseed';
if (!/^[a-z][a-z0-9_]{0,62}$/.test(database)) { console.error('The database name must be a plain lowercase identifier.'); process.exit(1); }

// A file fed to a command's stdin; the exit code is the law.
const feed = (commandArgs, file) => new Promise((done, fail) => {
  const child = spawn('docker', commandArgs, { cwd: seed, stdio: ['pipe', 'inherit', 'inherit'] });
  child.on('error', fail);
  child.on('close', code => (code === 0 ? done() : fail(Object.assign(new Error(`docker ${commandArgs.slice(0, 3).join(' ')} exited ${code}`), { code: 'restore_part_failed' }))));
  readFile(file).then(bytes => { child.stdin.end(bytes); }).catch(fail);
});
const psql = (composeArgs, service, user, db, query) => execFileSync('docker', [...composeArgs, 'exec', '-T', service, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', db, '-c', query], { cwd: seed, encoding: 'utf8' }).trim();

const dir = resolve(positional[0]);
try {
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  const held = async name => { try { const s = await stat(join(dir, name)); return { bytes: s.size, sha256: createHash('sha256').update(await readFile(join(dir, name))).digest('hex') }; } catch { return null; } };
  const found = new Map();
  for (const file of Array.isArray(manifest?.files) ? manifest.files : []) found.set(file.name, await held(String(file.name)));
  const issues = backupManifestIssues(manifest, name => found.get(name) ?? null);
  if (issues.length) {
    console.error(`The backup does not answer to its manifest (${issues.length} issues):`);
    for (const issue of issues.slice(0, 20)) console.error(`  ${issue.code}${issue.name ? ' ' + issue.name : ''}`);
    process.exitCode = 2;
  } else {
    const has = part => manifest.files.some(f => f.part === part);
    console.log(`Backup of ${manifest.takenAt} (soil at ${manifest.migration ?? 'an unknown migration'}): ${manifest.parts.join(', ')} — every file answers to its name.`);
    // THE DATABASE: only into an empty database.
    if (psql(compose, 'db', 'lightseed', database, "SELECT count(*) FROM pg_namespace WHERE nspname='seed'") !== '0') {
      throw Object.assign(new Error(`The database ${database} already carries a seed schema; a soil is never written over. Restore into an empty database (--database).`), { code: 'database_not_empty' });
    }
    await feed([...compose, 'exec', '-T', 'db', 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'lightseed', '-d', database], join(dir, 'database.sql'));
    const landed = psql(compose, 'db', 'lightseed', database, 'SELECT max(name) FROM seed.schema_migrations');
    console.log(`Database restored into ${database}: soil at ${landed}.`);
    // THE MEDIA: into the store, or into a directory for a look first.
    if (has('media')) {
      const mediaDir = option('--media-dir');
      if (mediaDir !== undefined) {
        if (!isAbsolute(mediaDir)) throw Object.assign(new Error('--media-dir must be an absolute path.'), { code: 'media_dir_unsound' });
        await mkdir(mediaDir, { recursive: true, mode: 0o700 });
        execFileSync('tar', ['-C', mediaDir, '-xf', join(dir, 'media.tar')], { stdio: 'inherit' });
        console.log(`Media restored into ${mediaDir}.`);
      } else {
        await feed([...compose, 'exec', '-T', 'api', 'tar', '-C', '/app/media', '-xf', '-'], join(dir, 'media.tar'));
        console.log('Media restored into the API\'s store (same bytes under the same names stand as they were).');
      }
    }
    // THE IDENTITY: only into an empty issuer database.
    if (has('identity') && !args.includes('--without-identity')) {
      if (psql(identityCompose, 'identity-db', 'keycloak', 'keycloak', "SELECT count(*) FROM pg_tables WHERE schemaname='public'") !== '0') {
        throw Object.assign(new Error('The identity database already carries tables; a realm is never written over. Stop and empty it first, or pass --without-identity.'), { code: 'identity_not_empty' });
      }
      await feed([...identityCompose, 'exec', '-T', 'identity-db', 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'keycloak', '-d', 'keycloak'], join(dir, 'identity.sql'));
      console.log('Identity restored: restart the identity service so it reads its realm anew.');
    }
    // THE CONFIGURATION: only where nothing stands.
    if (has('config') && !args.includes('--without-config')) {
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
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Restore failed.');
  process.exitCode = process.exitCode ?? 1;
}
