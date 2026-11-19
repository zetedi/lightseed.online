#!/usr/bin/env node
// THE NODE TAKEN OFF THE MACHINE — the opposite hand of seed:install. It removes the node's
// containers, volumes, networks and built image (both Compose projects: the node and its
// issuer) and the files the installer wrote.
//
// THIS DESTROYS THE NODE: its database, its pictures, its sign-in accounts and the issuer's
// signing keys, and every generated secret. Nothing here can bring them back. Take the keeping
// first if any of it matters: npm run seed:backup.
//
// Guaranteed: it shows everything it would remove and removes nothing until the project's name
//   is typed back (or given as --confirm <project> where there is no terminal); it only removes
//   a node the installer made, and reads WHICH Compose project from the installation itself (the
//   first line of its private override) — a node set up by hand is refused, not guessed at; it removes Docker things by the Compose
//   project's own label and files by their fixed names, never a pattern.
// Not guaranteed: backups (seed/backups/) are left; under the default layout so are the built
//   application (dist-independent/) and seed/local/ itself, with anything else kept there; on Linux
//   the default node's seed/data belongs to the database's own user and may need sudo to remove.
import { readFile, rm, rmdir, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, relative } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { seed, seedLayoutOf, installedProjectOf } from './seed-layout.mjs';

const USAGE = `Usage: npm run seed:uninstall -- [options]

Removes the node seed:install made: containers, volumes (ALL ITS DATA), networks, image, files.

  --dir <directory>     the private directory the node was installed into (seed:install --dir)
  --confirm <project>   the node's Compose project name, in place of typing it at the prompt
`;
const asked = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const flag = argv[i].replace(/^--/, '');
  if (argv[i] === '--help') { console.log(USAGE); process.exit(0); }
  if (!argv[i].startsWith('--') || !['dir', 'confirm'].includes(flag) || argv[i + 1] === undefined || argv[i + 1].startsWith('--')) {
    console.error(USAGE); process.exit(1);
  }
  asked[flag] = argv[++i];
}
const refuse = message => { console.error(message); process.exit(1); };
// Which node: the installation says so itself. The private override's first line carries the
// installer's mark and the Compose project it was installed as.
const found = seedLayoutOf({ dir: asked.dir });
const project = await readFile(found.paths.override, 'utf8').then(installedProjectOf, () => null);
if (!project) {
  refuse(`No node made by seed:install was found here (${found.paths.override} is missing or was not written by the installer).\n`
    + 'Nothing was removed. A node set up by hand is taken down by hand; one installed with --dir needs the same --dir here.');
}
const { home, paths, identityProject, namedVolume } = seedLayoutOf({ dir: asked.dir, project });
const show = file => { const near = relative(process.cwd(), file); return !near ? '.' : near.startsWith('..') ? file : near; };
const exists = file => access(file).then(() => true, () => false);
const docker = (...args) => new Promise((accept, reject) => {
  const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stdout.on('data', b => { out += b; }); child.stderr.on('data', b => { err += b; });
  child.on('error', reject);
  child.on('close', code => code === 0 ? accept(out.split('\n').map(l => l.trim()).filter(Boolean)) : reject(new Error(err.trim().slice(-400) || `docker ${args[0]} failed`)));
});

try {
  await docker('info').catch(() => refuse('Docker is not running: the node\'s containers and volumes cannot be seen, so nothing was removed.'));
  // ── What stands ───────────────────────────────────────────────────────────────────────────
  // The issuer first: its container holds the node's edge network.
  const things = [];
  for (const name of [identityProject, project]) {
    const label = `label=com.docker.compose.project=${name}`;
    things.push({
      name,
      containers: await docker('ps', '-aq', '--filter', label),
      containerNames: await docker('ps', '-a', '--filter', label, '--format', '{{.Names}}'),
      volumes: await docker('volume', 'ls', '-q', '--filter', label),
      networks: await docker('network', 'ls', '--filter', label, '--format', '{{.Name}}'),
      images: await docker('image', 'ls', '-q', '--filter', label),
    });
  }
  const files = [];
  if (home) files.push(home);
  else {
    for (const file of [paths.env, paths.runtime, paths.identityEnv, paths.override, paths.charter, paths.node, paths.auth, paths.realm, paths.login, paths.rootCert,
      ...(namedVolume ? [] : [join(seed, 'data')])]) {
      if (await exists(file)) files.push(file);
    }
  }
  console.log(`This removes the node "${project}" from this machine — its database, pictures, sign-in accounts, signing keys and secrets. It cannot be undone.\n`);
  for (const t of things) {
    console.log(`Compose project "${t.name}":`);
    console.log(`  containers: ${t.containerNames.join(', ') || 'none'}`);
    console.log(`  volumes:    ${t.volumes.join(', ') || 'none'}`);
    console.log(`  networks:   ${t.networks.join(', ') || 'none'}`);
    console.log(`  images:     ${t.images.length || 'none'}`);
  }
  console.log(`Files:\n  ${files.map(show).join('\n  ') || 'none'}`);
  console.log('\nLeft in place: ' + (home ? 'backups (seed/backups/).' : 'the built application (dist-independent/), backups (seed/backups/), and anything else in seed/local/.'));
  console.log('If any of this matters, stop and take the keeping first: npm run seed:backup\n');

  // ── The asking ────────────────────────────────────────────────────────────────────────────
  let answer = asked.confirm;
  if (answer === undefined) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) refuse(`Nothing was removed. Without a terminal, say the project's name again: --confirm ${project}`);
    const line = createInterface({ input: process.stdin, output: process.stdout });
    answer = (await line.question(`Type the project's name (${project}) to remove it: `)).trim();
    line.close();
  }
  if (answer !== project) refuse('The name does not match. Nothing was removed.');

  // ── The removing ──────────────────────────────────────────────────────────────────────────
  const failed = [];
  const attempt = async (what, work) => { try { await work(); } catch (error) { failed.push(`${what}: ${error instanceof Error ? error.message : error}`); } };
  for (const t of things) if (t.containers.length) await attempt(`containers of "${t.name}"`, () => docker('rm', '-f', '-v', ...t.containers));
  for (const t of things) if (t.volumes.length) await attempt(`volumes of "${t.name}"`, () => docker('volume', 'rm', ...t.volumes));
  for (const t of things) if (t.networks.length) await attempt(`networks of "${t.name}"`, () => docker('network', 'rm', ...t.networks));
  for (const t of things) if (t.images.length) await attempt(`images of "${t.name}"`, () => docker('image', 'rm', ...new Set(t.images)));
  for (const file of files) await attempt(show(file), () => rm(file, { recursive: true, force: true }));
  // An emptied seed/local is only the installer's own leaving; one that still holds anything stays.
  if (!home) await rmdir(join(seed, 'local')).catch(() => {});

  if (failed.length) {
    console.error(`\nNot everything could be removed:\n  ${failed.join('\n  ')}\nRun it again after mending, or remove these by hand.`);
    process.exitCode = 1;
  } else {
    console.log('\nThe node is gone from this machine. A new one can be installed: npm run seed:install');
  }
} catch (error) {
  console.error(`The removal stopped: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
