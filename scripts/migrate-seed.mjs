#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.length > 1 || args.some(a => !['--sql', '--local'].includes(a))) {
  console.error('Usage: npm run seed:migrate -- [--sql | --local]');
  process.exit(1);
}
let loader;
try {
  const directory = resolve(root, 'seed/schema');
  const names = (await readdir(directory)).filter(name => name.endsWith('.sql'));
  const files = await Promise.all(names.map(async name => ({ name, sql: await readFile(resolve(directory, name), 'utf8') })));
  loader = await createServer({ root, configFile: false, logLevel: 'silent', server: { middlewareMode: true, watch: null }, appType: 'custom' });
  const { seedMigrationSql } = await loader.ssrLoadModule('/src/domain/seedMigrations.ts');
  const sql = await seedMigrationSql(files);
  await loader.close();
  loader = undefined;
  if (args[0] === '--sql') {
    process.stdout.write(sql);
  } else {
    const local = args[0] === '--local';
    const child = spawn(local ? (process.env.SEED_PSQL || 'psql') : 'docker', local
      ? ['-X', '-v', 'ON_ERROR_STOP=1']
      : ['compose', 'exec', '-T', 'db', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'lightseed', '-d', 'lightseed'],
    { cwd: resolve(root, 'seed'), stdio: ['pipe', 'inherit', 'inherit'] });
    child.stdin.on('error', error => { if (error.code !== 'EPIPE') console.error(error.message); });
    process.exitCode = await new Promise((accept, reject) => {
      child.on('error', reject);
      child.on('close', code => accept(code ?? 1));
      child.stdin.end(sql);
    });
  }
} catch (error) {
  const sourceErrors = {
    empty: 'No seed migrations found.', invalid_name: 'Invalid migration filename.',
    duplicate_version: 'Duplicate migration version.', sql_only: 'Migration must contain SQL only.',
  };
  console.error(sourceErrors[error?.code]
    ? `${sourceErrors[error.code]}${error.file ? ` File: ${error.file}` : ''}`
    : error instanceof Error ? error.message : 'Seed migration failed.');
  process.exitCode = 1;
} finally {
  await loader?.close();
}
