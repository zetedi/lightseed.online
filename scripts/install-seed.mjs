#!/usr/bin/env node
// THE WHOLE FIRST WALK, IN ONE HAND (README → "Run a seed"): the eight steps a new independent
// node takes from an empty machine to a keeper signed in — the soil, the node's own name, the
// API's database login, hosts and certificates, the application built as this node, the sign-in
// issuer, the trust file, and the keeper's seat.
//
// Guaranteed: every secret is generated here (never asked for, never printed, never an argument
//   of a command) and written to owner-only files; nothing that already stands is overwritten —
//   the installer refuses before its first write if any of its files, containers or volumes exist.
// Not guaranteed: DNS, open ports, SMTP, a permanent issuer operator, backups (README → "On a
//   VPS"). A walk that fails halfway is left standing for inspection; the way to clear it is said.
// It only drives the hands that already exist (seed:migrate, seed:configure, seed:provision,
// seed:identity:configure, seed:keeper, the Compose files): no law of its own.
import { mkdir, writeFile, readFile, readdir, rmdir, access, chmod, chown } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { join, delimiter, relative } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { uuidv7 } from '../src/domain/uuidv7.mjs';
import { charterCustodyOf, SEED_API_UID } from '../src/domain/seedInstall.mjs';
import { root, seed, seedLayoutOf, INSTALL_MARK, PROJECT_NAME } from './seed-layout.mjs';

const USAGE = `Usage: npm run seed:install -- [options]

A local walk needs no option: https://seed.localhost:8443, Caddy as its own certificate authority.

  --host <host>            the application host (default seed.localhost)
  --identity-host <host>   the sign-in host (default identity.localhost; required for a real host)
  --acme-email <address>   certificates by ACME (required for a real host; ports 80 and 443)
  --name <name>            the node's name (default "Lightseed node")
  --keeper-email <address> the keeper's sign-in address (default keeper@<host>; required for a real host)
  --keeper-name <name>     the keeper's name at the issuer (default "Node Keeper")
  --open-registration      people may register themselves (default: closed, the keeper alone)
  --https-port <n> --http-port <n>   the edge's ports (default 8443/8080 locally, 443/80 by ACME)
  --db-port <n> --api-port <n> --identity-port <n>   loopback ports (default 5433 / 8081 / 8082)
  --dir <directory>        keep every generated file in this one new private directory
  --project <name>         the Compose project (default "seed"; a second node on a machine needs its own)
  --edge-network <name>    the Docker network shared with the issuer (default <project>_edge, lightseed_edge for "seed")
`;

// ── What was asked ──────────────────────────────────────────────────────────────────────────
const FLAGS = ['host', 'identity-host', 'acme-email', 'name', 'keeper-email', 'keeper-name', 'https-port', 'http-port',
  'db-port', 'api-port', 'identity-port', 'dir', 'project', 'edge-network'];
const asked = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const flag = argv[i].replace(/^--/, '');
  if (argv[i] === '--help') { console.log(USAGE); process.exit(0); }
  if (argv[i] === '--open-registration') { asked.open = true; continue; }
  if (!argv[i].startsWith('--') || !FLAGS.includes(flag) || argv[i + 1] === undefined || argv[i + 1].startsWith('--')) {
    console.error(USAGE); process.exit(1);
  }
  asked[flag] = argv[++i];
}
const refuse = message => { console.error(message); process.exit(1); };
const HOST = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const port = (flag, fallback) => {
  const n = asked[flag] === undefined ? fallback : Number(asked[flag]);
  if (!Number.isInteger(n) || n < 1 || n > 65535) refuse(`--${flag} must be a port number.`);
  return n;
};
const host = asked.host ?? 'seed.localhost';
const local = host.endsWith('.localhost');
const identityHost = asked['identity-host'] ?? (local ? 'identity.localhost' : null);
if (!HOST.test(host)) refuse('--host must be a lowercase host name with a dot (seed.localhost, app.your-node.example).');
if (!identityHost) refuse('A real host needs --identity-host: the sign-in issuer answers at its own name.');
if (!HOST.test(identityHost) || identityHost === host) refuse('--identity-host must be a host name of its own.');
if (!local && !asked['acme-email']) refuse('A real host needs --acme-email: its certificates come from ACME.');
if (!local && !asked['keeper-email']) refuse('A real host needs --keeper-email: the address the keeper signs in with.');
const acmeEmail = asked['acme-email'] ?? '';
const keeperEmail = (asked['keeper-email'] ?? `keeper@${host}`).toLowerCase();
for (const [flag, value] of [['acme-email', acmeEmail], ['keeper-email', keeperEmail]]) {
  if (value && !EMAIL.test(value)) refuse(`--${flag} must be an e-mail address.`);
}
// These land in JSON files and env files: one line, no quotes to escape.
const plain = (flag, fallback) => {
  const value = (asked[flag] ?? fallback).trim();
  if (!value || /[\u0000-\u001f\u007f"\\<>]/.test(value) || value.length > 60) refuse(`--${flag} must be a short plain name.`);
  return value;
};
const nodeName = plain('name', 'Lightseed node');
const keeperName = plain('keeper-name', 'Node Keeper');
const project = asked.project ?? 'seed';
if (!PROJECT_NAME.test(project)) refuse('--project must be a lowercase Compose project name.');
const edgeNetwork = asked['edge-network'] ?? (project === 'seed' ? 'lightseed_edge' : `${project}_edge`);
if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,60}$/.test(edgeNetwork)) refuse('--edge-network must be a Docker network name.');
const tls = local ? 'internal' : 'acme';
const httpsPort = port('https-port', local ? 8443 : 443);
const httpPort = port('http-port', local ? 8080 : 80);
const dbPort = port('db-port', 5433);
const apiPort = port('api-port', 8081);
const identityPort = port('identity-port', 8082);
const at = name => `https://${name}${httpsPort === 443 ? '' : `:${httpsPort}`}`;
const origin = at(host);
const identityOrigin = at(identityHost);
const issuer = `${identityOrigin}/realms/lightseed`;

// ── Where everything is kept (scripts/seed-layout.mjs) ───────────────────────────────────────
const { home, priv, paths, identityProject, namedVolume } = seedLayoutOf({ dir: asked.dir, project });
// The issuer's first and last name from one name: the last word is the family name (as domain/seedEnrollment).
const namePartsOf = name => { const w = name.split(/\s+/); return w.length === 1 ? { firstName: w[0], lastName: '' } : { firstName: w.slice(0, -1).join(' '), lastName: w.at(-1) }; };
// A path as the operator would type it: relative inside the checkout, whole outside it.
const show = file => { const near = relative(process.cwd(), file); return !near ? '.' : near.startsWith('..') ? file : near; };

// ── Hands ───────────────────────────────────────────────────────────────────────────────────
const composeEnv = {
  ...process.env, COMPOSE_PROJECT_NAME: project, COMPOSE_ENV_FILES: paths.env,
  COMPOSE_FILE: [join(seed, 'docker-compose.yml'), paths.override].join(delimiter),
};
const run = (command, args, { env = process.env, cwd = root, quiet = false } = {}) => new Promise((accept, reject) => {
  const child = spawn(command, args, { env, cwd, stdio: ['ignore', quiet ? 'pipe' : 'inherit', quiet ? 'pipe' : 'inherit'] });
  let out = '', err = '';
  child.stdout?.on('data', b => { out += b; }); child.stderr?.on('data', b => { err += b; });
  child.on('error', reject);
  child.on('close', code => code === 0 ? accept(out) : reject(new Error(`${command} ${args.slice(0, 3).join(' ')} … failed${err ? ': ' + err.trim().slice(-600) : ''}`)));
});
const compose = (...args) => run('docker', ['compose', ...args], { env: composeEnv, cwd: seed });
const identityCompose = (...args) => run('docker', ['compose', '-p', identityProject, '--env-file', paths.identityEnv, '-f', join(seed, 'identity', 'compose.yml'), ...args]);
// The node's own scripts, run as children so each keeps its own refusals; they reach the database
// through `docker compose exec` in seed/, which the Compose variables above point at THIS node.
const hand = (script, ...args) => run(process.execPath, [join(root, 'scripts', script), ...args], { env: composeEnv });
const secret = (bytes = 32) => randomBytes(bytes).toString('base64url');
const keep = (file, text, mode = 0o600) => writeFile(file, text, { flag: 'wx', mode });
const exists = file => access(file).then(() => true, () => false);
const overrideOf = trusted => `${INSTALL_MARK} for the Compose project "${project}" — this installation's private Compose override (never committed).
services:
  api:
    env_file: !override
      - ${paths.runtime}
${trusted ? `    environment:
      SEED_AUTH_CONFIG: /run/lightseed-auth.json
    volumes:
      - type: bind
        source: ${paths.auth}
        target: /run/lightseed-auth.json
        read_only: true
` : ''}${namedVolume ? `  db:
    volumes: !override
      - db_data:/var/lib/postgresql/data
volumes:
  db_data:
` : ''}`;
let step = 'the preflight';
const say = (n, title) => { step = `step ${n} (${title})`; console.log(`\n── ${n}/8  ${title}`); };

try {
  // ── Preflight: refuse before the first write ──────────────────────────────────────────────
  if (!await exists(join(root, 'node_modules', 'vite'))) refuse('Install the repository\'s dependencies first: npm install');
  await run('docker', ['compose', 'version'], { quiet: true }).catch(() => refuse('Docker Compose was not found.'));
  const docker = await run('docker', ['info', '--format', '{{json .}}'], { quiet: true }).then(JSON.parse).catch(() => refuse('Docker is not running.'));
  // The API reads the owner-only charter inside its container as UID 1000: settle now whether it
  // can, instead of finding out at step 5 with half a node standing (domain/seedInstall).
  const custody = charterCustodyOf({
    platform: process.platform, uid: process.getuid?.() ?? -1,
    dockerDesktop: /docker desktop/i.test(String(docker.OperatingSystem ?? '')),
    securityOptions: Array.isArray(docker.SecurityOptions) ? docker.SecurityOptions : [],
  });
  if (custody.action === 'refuse') {
    refuse(custody.reason === 'remapped_daemon'
      ? `This Docker runs rootless or with remapped users: the API container's UID ${SEED_API_UID} is another account of this machine and could not read the node's owner-only charter. Nothing was written. Install against an ordinary (rootful) Docker daemon.`
      : `The API container reads the node's owner-only charter as UID ${SEED_API_UID}, and this account (UID ${process.getuid()}) can neither be that hand nor give the charter to it. Nothing was written. Run the installer as UID ${SEED_API_UID}, or as root (it then gives the charter to UID ${SEED_API_UID}).`);
  }
  const standing = [];
  for (const file of [paths.env, paths.runtime, paths.identityEnv, paths.override, paths.node, paths.auth, paths.realm, paths.login]) {
    if (await exists(file)) standing.push(show(file));
  }
  if (home && await exists(home)) standing.push(show(home));
  // An empty charter directory is only the mark an earlier Compose mount left behind.
  if (await exists(paths.charter) && (await readdir(paths.charter)).length) standing.push(show(paths.charter));
  if (!namedVolume && await exists(join(seed, 'data')) && (await readdir(join(seed, 'data'))).length) standing.push('seed/data');
  for (const name of [project, identityProject]) {
    const label = `label=com.docker.compose.project=${name}`;
    if ((await run('docker', ['ps', '-aq', '--filter', label], { quiet: true })).trim()) standing.push(`containers of the Compose project "${name}"`);
    if ((await run('docker', ['volume', 'ls', '-q', '--filter', label], { quiet: true })).trim()) standing.push(`volumes of the Compose project "${name}"`);
  }
  if (standing.length) {
    refuse(`A node already stands here; nothing was written. Found:\n  ${standing.join('\n  ')}\n`
      + 'Install a second node beside it with its own --dir, --project and ports, or remove the first deliberately.');
  }

  // ── 1. The soil ───────────────────────────────────────────────────────────────────────────
  say(1, 'the soil: the database and its schema');
  await mkdir(priv, { recursive: !home, mode: 0o700 });
  if (await exists(paths.charter)) await rmdir(paths.charter);
  const example = await readFile(join(seed, '.env.example'), 'utf8');
  const settings = {
    SEED_DB_PASSWORD: secret(), SEED_DB_PORT: dbPort, SEED_APP_HOST: host, SEED_IDENTITY_HOST: identityHost,
    SEED_TLS: tls, SEED_ACME_EMAIL: acmeEmail, SEED_EDGE_HTTP_PORT: httpPort, SEED_EDGE_HTTPS_PORT: httpsPort,
    SEED_EDGE_NETWORK: edgeNetwork, SEED_APP_DIST: paths.dist, SEED_NODE_ORIGIN: origin, SEED_CHARTER_DIR: paths.charter,
  };
  // The example's own lines and comments, with this installation's values filled in.
  const filled = example.split('\n').map(line => {
    const key = line.match(/^([A-Z_]+)=/)?.[1];
    return key && key in settings ? `${key}=${settings[key]}` : line;
  }).join('\n').trimEnd();
  const missing = Object.keys(settings).filter(key => !new RegExp(`^${key}=`, 'm').test(example));
  if (missing.length) throw new Error(`seed/.env.example no longer names ${missing.join(', ')}; the installer must be brought in step.`);
  await keep(paths.env, `${filled}
# Written by seed:install.
SEED_API_PORT=${apiPort}
SEED_AUTH_CONFIG_FILE=${paths.auth}
${home ? '' : `# Every \`docker compose\` in seed/ reads the private override too.\nCOMPOSE_FILE=docker-compose.yml${delimiter}compose.local.yml\n`}`);
  await keep(paths.override, overrideOf(false));
  await compose('up', '-d', '--wait', 'db');
  await hand('migrate-seed.mjs');

  // ── 2. The node's own name ────────────────────────────────────────────────────────────────
  say(2, 'the node\'s own name: a new identity and its charter');
  const checkout = JSON.parse(await readFile(join(root, 'src', 'config', 'charter.json'), 'utf8'));
  const example2 = JSON.parse(await readFile(join(seed, 'node.example.json'), 'utf8'));
  await keep(paths.node, JSON.stringify({
    ...example2, nodeLid: uuidv7(Date.now(), randomBytes(10)), name: nodeName, shortName: nodeName.slice(0, 24),
    domain: host, aliases: [], repo: checkout.repo, keeper: { email: keeperEmail },
    mail: { from: `${nodeName} <${keeperEmail}>` }, push: { subject: `mailto:${keeperEmail}`, publicKey: '' },
    faces: [{ id: 'home', door: host, domains: [] }],
  }, null, 2) + '\n');
  await hand('configure-seed.mjs', paths.node, paths.charter);
  if (custody.action === 'give') {
    // Root installs: the charter goes to the API's hand and stays owner-only (root still reads it for the keeping).
    for (const file of [paths.charter, ...(await readdir(paths.charter)).map(name => join(paths.charter, name))]) await chown(file, SEED_API_UID, SEED_API_UID);
    console.log(`${show(paths.charter)} given to UID ${SEED_API_UID}, the API container's hand; it stays owner-only.`);
  }

  // ── 3. The API's database login ───────────────────────────────────────────────────────────
  say(3, 'the API\'s database login: a restricted role, never the owner');
  await hand('provision-seed.mjs', paths.runtime);

  // ── 4 + 5. Hosts, certificates, the application built as this node, the API and the edge ──
  say(4, `hosts and certificates: ${host}, ${identityHost}, TLS ${tls}`);
  console.log(`Already written to ${show(paths.env)}.`);
  say(5, 'the application built as this node; the API and the edge');
  await run(join(root, 'node_modules', '.bin', 'vite'), ['build', '--mode', 'independent', '--outDir', paths.dist, '--emptyOutDir'], {
    env: { ...process.env, SEED_CHARTER: join(paths.charter, 'node.json'), SEED_WEB_ORIGIN: origin, SEED_IDENTITY_ISSUER: issuer },
  });
  await compose('--profile', 'api', '--profile', 'edge', 'up', '-d', '--build', '--wait');

  // ── 6. Sign-in ────────────────────────────────────────────────────────────────────────────
  say(6, 'sign-in: the realm and the issuer');
  await hand('configure-seed-identity.mjs', origin, paths.realm, ...(asked.open ? ['--open-registration'] : []));
  await chmod(paths.realm, 0o644); // configuration only, no secret; the issuer's container (UID 1000) must read it
  const admin = { name: 'bootstrap-admin', password: secret() };
  await keep(paths.identityEnv, `# Written by seed:install. Private: never commit.
SEED_IDENTITY_ORIGIN=${identityOrigin}
SEED_IDENTITY_REALM_FILE=${paths.realm}
SEED_IDENTITY_DB_PASSWORD=${secret()}
SEED_IDENTITY_ADMIN=${admin.name}
SEED_IDENTITY_ADMIN_PASSWORD=${admin.password}
SEED_IDENTITY_PORT=${identityPort}
SEED_EDGE_NETWORK=${edgeNetwork}
`);
  await identityCompose('up', '-d');
  // The issuer is asked over its loopback port, with the forwarded headers its public name expects.
  const base = `http://127.0.0.1:${identityPort}`;
  const ask = (path, options = {}) => fetch(base + path, {
    ...options, redirect: 'manual', signal: AbortSignal.timeout(15000),
    headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': identityHost, 'x-forwarded-port': String(httpsPort), ...options.headers },
  });
  process.stdout.write('Waiting for the issuer');
  let ready = false;
  for (let attempt = 0; attempt < 180 && !ready; attempt++) {
    try { ready = (await ask('/realms/lightseed/.well-known/openid-configuration')).ok; } catch { /* still starting */ }
    if (!ready) { process.stdout.write('.'); await new Promise(done => setTimeout(done, 2000)); }
  }
  console.log('');
  if (!ready) throw new Error('The issuer did not become ready in six minutes.');

  // ── 7. Whom the API trusts ────────────────────────────────────────────────────────────────
  say(7, 'whom the API trusts: the issuer\'s public keys and the keeper\'s binding');
  const certs = await (await ask('/realms/lightseed/protocol/openid-connect/certs')).json();
  const keys = (certs.keys ?? []).filter(k => k.kty === 'RSA' && k.alg === 'RS256' && (k.use ?? 'sig') === 'sig')
    .map(({ kty, kid, n, e, alg, use }) => ({ kty, kid, n, e, alg, use }));
  if (!keys.length) throw new Error('The issuer published no RS256 signing key.');
  // The keeper's own login: made through the issuer's administrator API, its password generated
  // here and kept in an owner-only file. The address is marked verified by this installation —
  // the operator vouches for their own address; no SMTP is needed to walk in.
  const tokenResponse = await ask('/realms/master/protocol/openid-connect/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password', username: admin.name, password: admin.password }),
  });
  if (!tokenResponse.ok) throw new Error(`The issuer refused its bootstrap administrator (${tokenResponse.status}).`);
  const bearer = { authorization: 'Bearer ' + (await tokenResponse.json()).access_token };
  const keeperPassword = secret(18);
  const made = await ask('/admin/realms/lightseed/users', {
    method: 'POST', headers: { ...bearer, 'content-type': 'application/json' },
    body: JSON.stringify({ username: keeperEmail, email: keeperEmail, enabled: true, emailVerified: true, ...namePartsOf(keeperName),
      credentials: [{ type: 'password', value: keeperPassword, temporary: false }] }),
  });
  if (made.status !== 201) throw new Error(`The issuer did not make the keeper's account (${made.status}).`);
  const subject = made.headers.get('location')?.split('/').pop();
  if (!subject || !/^[0-9a-f-]{36}$/.test(subject)) throw new Error('The issuer did not name the keeper\'s account.');
  // The same shape of uid the node mints for a self-enrolled login; here it is an explicit binding.
  const keeperUid = `oidc_${uuidv7(Date.now(), randomBytes(10))}`;
  await keep(paths.auth, JSON.stringify({
    version: 1, issuer, audience: 'lightseed-api', tokenProfile: 'keycloak', clientId: 'lightseed-web',
    enrollment: asked.open ? 'open' : 'closed', bindings: [{ subject, uid: keeperUid }], jwks: { keys },
  }, null, 2) + '\n', 0o644); // public keys and a binding, no secret; the API's container (UID 1000) must read it
  await keep(paths.login, `The keeper's first sign-in at ${origin}
address:  ${keeperEmail}
password: ${keeperPassword}
uid:      ${keeperUid}

Change the password after the first sign-in (the issuer's account page), then delete this file.
The issuer's bootstrap administrator is in ${show(paths.identityEnv)} (console: ${identityOrigin}/admin/).
`);
  await writeFile(paths.override, overrideOf(true), { mode: 0o600 });
  await compose('--profile', 'api', '--profile', 'edge', 'up', '-d', '--wait');
  const readiness = await fetch(`http://127.0.0.1:${apiPort}/readyz`, { signal: AbortSignal.timeout(15000) });
  if (!readiness.ok) throw new Error(`The API is not ready with its trust file (${readiness.status}).`);

  // ── 8. Walk in ────────────────────────────────────────────────────────────────────────────
  say(8, 'walk in: sign in, and the keeper takes the seat');
  if (local) {
    await compose('cp', 'proxy:/data/caddy/pki/authorities/local/root.crt', paths.rootCert);
    console.log(`Caddy's local root certificate: ${show(paths.rootCert)} — trust it, or accept the warning at each host.`);
    // Named, never run: trusting a root is the operator's own decision about their own machine.
    if (process.platform === 'darwin') console.log(`  macOS: security add-trusted-cert -r trustRoot -k ~/Library/Keychains/login.keychain-db ${paths.rootCert}`);
  }
  const prefix = home ? `COMPOSE_PROJECT_NAME=${project} COMPOSE_ENV_FILES=${paths.env} COMPOSE_FILE=${composeEnv.COMPOSE_FILE} ` : '';
  const appoint = `${prefix}npm run seed:keeper -- ${keeperUid}`;
  console.log(`\nThe node stands at ${origin}\nSign in with the address and password in ${show(paths.login)}.`);
  // The keeper's seat raises the keeper's own record, which the first sign-in writes: sign in first.
  if (process.stdin.isTTY && process.stdout.isTTY) {
    const line = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await line.question('\nSign in now, then press Enter here to take the keeper\'s seat (or type "later"): ');
    line.close();
    if (answer.trim().toLowerCase() !== 'later') await hand('appoint-seed-keeper.mjs', keeperUid);
    else console.log(`After your first sign-in:\n  ${appoint}`);
  } else {
    console.log(`After your first sign-in, take the keeper's seat:\n  ${appoint}`);
  }
  if (home) console.log(`\nThis node's later Compose and seed:* commands need the same three variables:\n  ${prefix.trim()}`);
  console.log('\nStill yours to do: SMTP for the node and the issuer, a permanent issuer operator in place of the bootstrap administrator, backups (README → "Run a seed").');
} catch (error) {
  console.error(`\nThe installation stopped at ${step}: ${error instanceof Error ? error.message : error}`);
  console.error('What it wrote and started still stands, for inspection. To clear it and begin again:');
  console.error(`  docker compose -p ${identityProject} --env-file ${paths.identityEnv} -f seed/identity/compose.yml down -v`);
  console.error(`  (cd seed && COMPOSE_PROJECT_NAME=${project} COMPOSE_ENV_FILES=${paths.env} COMPOSE_FILE=${composeEnv.COMPOSE_FILE} docker compose --profile api --profile edge down -v)`);
  console.error(`  then remove ${home ? show(home) : [paths.env, paths.runtime, paths.charter, paths.identityEnv, paths.override, paths.node, paths.auth, paths.realm, paths.login].map(show).join(' ')}`);
  process.exitCode = 1;
}
