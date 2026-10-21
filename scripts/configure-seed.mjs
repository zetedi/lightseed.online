#!/usr/bin/env node
// Prepare reviewed configuration only; this does not deploy or select an app backend.
import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const args = process.argv.slice(2);
if (args.length !== 2 || args.some(a => a.startsWith('--'))) {
  console.error('Usage: npm run seed:configure -- independent-node.json new-output-directory');
  process.exit(args.includes('--help') ? 0 : 1);
}
let loader;
let created = false;
const output = resolve(args[1]);
try {
  if ((await stat(resolve(args[0]))).size > 1024 * 1024) throw new Error('Charter exceeds 1 MiB.');
  const charter = JSON.parse(await readFile(resolve(args[0]), 'utf8'));
  loader = await createServer({
    root: resolve(dirname(fileURLToPath(import.meta.url)), '..'), configFile: false,
    logLevel: 'silent', server: { middlewareMode: true, watch: null }, appType: 'custom',
  });
  const { independentCharterProblem } = await loader.ssrLoadModule('/src/domain/independentCharter.ts');
  const { charterPublicOf, charterHosts } = await loader.ssrLoadModule('/src/domain/charter.ts');
  const issue = independentCharterProblem(charter);
  if (issue) throw new Error(`Invalid independent charter: ${issue}.`);
  // Exclusive directory creation refuses existing files, directories and symlinks.
  await mkdir(output, { mode: 0o700 });
  created = true;
  for (const [name, data] of Object.entries({
    'node.json': charter,
    'lightseed.json': charterPublicOf(charter),
    'hosts.json': charterHosts(charter),
  })) {
    await writeFile(join(output, name), JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  console.log('Independent configuration prepared. No services deployed; the application backend still requires porting.');
} catch (error) {
  if (created) await rm(output, { recursive: true, force: true });
  console.error(error instanceof SyntaxError ? 'Invalid JSON input.' : error instanceof Error ? error.message : 'Configuration failed.');
  process.exitCode = 1;
} finally {
  await loader?.close();
}
