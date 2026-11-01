#!/usr/bin/env node
// THE NODE'S KEEPER IS APPOINTED BY THE INSTALLATION (ring 2026-11-02). The origin node let the
// first hand that clicked claim config/superadmin; an independent node's keeper is named here, by
// whoever holds the database — the owner's hand, the same that runs the migrations — never by a
// public first-visitor race. A second appointment must say --replace: a standing keeper is not
// quietly overwritten. The uid is the account's local uid (GET /v1/me as that account, or the
// explicit binding in the auth configuration).
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith('--'));
const uid = args.find(a => !a.startsWith('--'));
if (!uid || args.filter(a => !a.startsWith('--')).length !== 1 || flags.some(f => !['--replace', '--local'].includes(f))) {
  console.error('Usage: npm run seed:keeper -- <uid> [--replace] [--local]');
  process.exit(1);
}
// The uid is embedded in SQL: only the identifier alphabet the node mints or the configuration binds.
if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) { console.error('Invalid uid.'); process.exit(1); }
const sql = `\\set ON_ERROR_STOP on
SELECT seed.appoint_keeper('${uid}', ${flags.includes('--replace') ? 'true' : 'false'});
`;
const local = flags.includes('--local');
const child = spawn(local ? (process.env.SEED_PSQL || 'psql') : 'docker', local
  ? ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1']
  : ['compose', 'exec', '-T', 'db', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'lightseed', '-d', 'lightseed'],
{ cwd: resolve(root, 'seed'), stdio: ['pipe', 'inherit', 'inherit'] });
child.stdin.on('error', error => { if (error.code !== 'EPIPE') console.error(error.message); });
process.exitCode = await new Promise((accept, reject) => {
  child.on('error', reject);
  child.on('close', code => accept(code ?? 1));
  child.stdin.end(sql);
});
if (process.exitCode === 0) console.log(`The node's keeper is ${uid}.`);
else console.error('The appointment did not stand (a keeper already stands? pass --replace to replace them).');
