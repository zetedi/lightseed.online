#!/usr/bin/env node
// Offline review only: no database connection, no account enrollment, no import writes.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const usage = 'Usage: npm run node:merge:plan -- source-bundle.json destination-docs.json trusted-anchor.json identities.json report.json';
const args = process.argv.slice(2);
if (args.length !== 5 || args.some(arg => arg.startsWith('--'))) {
  console.error(usage);
  process.exit(args.includes('--help') ? 0 : 1);
}
const readJson = async path => {
  const absolute = resolve(path);
  if ((await stat(absolute)).size > 64 * 1024 * 1024) throw new Error('Input exceeds the 64 MiB offline planner limit.');
  return JSON.parse(await readFile(absolute, 'utf8'));
};
let loader;
try {
  const [incoming, destination, anchor, identities] = await Promise.all(args.slice(0, 4).map(readJson));
  if (!incoming?.head || !Array.isArray(incoming.docs) || !Array.isArray(incoming.head.census)
    || typeof incoming.manifestHash !== 'string'
    || !Array.isArray(destination) || !Array.isArray(identities)) {
    throw new Error('Expected a signed NodeBundle, destination document array and identity binding array.');
  }
  if (typeof anchor?.publicKeyB64 !== 'string' || typeof anchor.fingerprint !== 'string'
    || createHash('sha256').update(anchor.publicKeyB64).digest('hex') !== anchor.fingerprint) {
    throw new Error('Trusted anchor fingerprint must match its public key. Obtain this file outside the source bundle.');
  }
  for (const identity of identities) {
    if (!identity || ['sourceUid', 'targetUid', 'personLid'].some(key => typeof identity[key] !== 'string' || !identity[key])) {
      throw new Error('Each identity binding needs sourceUid, targetUid and personLid.');
    }
  }
  const key = createPublicKey({ key: Buffer.from(anchor.publicKeyB64, 'base64'), format: 'der', type: 'spki' });
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Trusted anchor must be an Ed25519 public key.');

  // Reuse the actual domain implementation rather than maintaining another merger in JS.
  // Middleware mode loads TypeScript locally; it does not listen on a network port.
  loader = await createServer({
    root, configFile: false, logLevel: 'silent',
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
  });
  const { planBundleMerge } = await loader.ssrLoadModule('/src/domain/bundleMerge.ts');
  const { signingPreimage } = await loader.ssrLoadModule('/src/domain/signing.ts');
  const plan = await planBundleMerge(incoming, destination, anchor,
    async (_publicKey, signature, payload, tag) =>
      verifySignature(null, Buffer.from(signingPreimage(tag, payload)), key, Buffer.from(signature, 'base64')),
    identities);
  // A report can contain private records. Refuse overwrites and give only its owner access.
  await writeFile(resolve(args[4]), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(`Merge proposal ${plan.ready ? 'has no planning conflicts' : 'is blocked'}: ${plan.inserts.length} candidates, ${plan.unchanged.length} unchanged, ${plan.issues.length} issues.`);
  console.log('No data imported. Execution still requires transactional revalidation, authorization, identity enrollment and media handling.');
  process.exitCode = plan.ready ? 0 : 2;
} catch (error) {
  // Parse failures may contain private input excerpts. Do not echo those into logs.
  console.error(error instanceof SyntaxError ? 'Invalid JSON input.' : error instanceof Error ? error.message : 'Merge planning failed.');
  process.exitCode = 1;
} finally {
  await loader?.close();
}
