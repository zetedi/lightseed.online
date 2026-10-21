#!/usr/bin/env node
import { open } from 'node:fs/promises';
import { randomBytes, pbkdf2Sync, createHmac, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const local = args[0] === '--local';
const output = args[local ? 1 : 0];
if (!output || output.startsWith('--') || args.length !== (local ? 2 : 1)) {
  console.error('Usage: npm run seed:provision -- [--local] /private/path/runtime.env');
  process.exit(1);
}
let loader;
let saved = false;
try {
  const role = `lightseed_api_${randomBytes(8).toString('hex')}`;
  const password = randomBytes(32).toString('base64url');
  const salt = randomBytes(16);
  // SCRAM verifier only goes to PostgreSQL; the clear password never enters SQL,
  // process arguments, inherited environment, database statement logs or console output.
  const salted = pbkdf2Sync(password, salt, 4096, 32, 'sha256');
  const client = createHmac('sha256', salted).update('Client Key').digest();
  const stored = createHash('sha256').update(client).digest('base64');
  const server = createHmac('sha256', salted).update('Server Key').digest('base64');
  const verifier = `SCRAM-SHA-256$4096:${salt.toString('base64')}$${stored}:${server}`;
  loader = await createServer({ root, configFile: false, logLevel: 'silent',
    server: { middlewareMode: true, watch: null }, appType: 'custom' });
  const { seedRuntimeSql } = await loader.ssrLoadModule('/src/domain/seedRuntime.ts');
  const sql = seedRuntimeSql(role, verifier);
  if (!sql) throw new Error('Invalid generated runtime credentials.');
  await loader.close();
  loader = undefined;

  // Save durably before connecting: if the connection fails after COMMIT, the account's
  // credentials are still recoverable. Never overwrite or follow an existing symlink.
  const file = await open(resolve(output), 'wx', 0o600);
  try {
    await file.writeFile(`# Private server credentials. Never expose to a browser or commit.\nPGUSER=${role}\nPGPASSWORD=${password}\n`);
    await file.sync();
    saved = true;
  } finally { await file.close(); }
  const child = spawn(local ? (process.env.SEED_PSQL || 'psql') : 'docker', local
    ? ['-X', '-q', '-v', 'ON_ERROR_STOP=1']
    : ['compose', 'exec', '-T', 'db', 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'lightseed', '-d', 'lightseed'],
  { cwd: resolve(root, 'seed'), stdio: ['pipe', 'ignore', 'pipe'] });
  // Database error contexts may include the verifier. Do not forward them to logs.
  child.stderr.resume();
  child.stdin.on('error', () => {});
  const code = await new Promise((accept, reject) => {
    child.on('error', reject);
    child.on('close', code => accept(code ?? 1));
    child.stdin.end(sql);
  });
  if (code !== 0) throw new Error('Database provisioning failed. Check migration readiness and administrative connection settings.');
  console.log('Restricted database account created. Private credentials saved; application authentication is not installed yet.');
} catch (error) {
  console.error(error?.code === 'EEXIST' ? 'Credential file already exists; nothing overwritten.'
    : error?.code === 'ENOENT' ? 'Output directory or database command not found.'
    : 'Runtime account provisioning did not complete successfully.');
  if (saved) console.error('Credentials retained for recovery. Verify the account before retrying; a connection failure can leave the commit outcome unknown.');
  process.exitCode = 1;
} finally { await loader?.close(); }
