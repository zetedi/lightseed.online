#!/usr/bin/env node
// seed:export — the node leaves by its travel plan, sealed by its custodian (ring 2026-11-02).
//   npm run seed:export -- --charter node.json --key custodian.pem [--without-authority] bundle.json
// Connects as the migration owner through the PG* environment (PGHOST, PGPORT, PGDATABASE, PGUSER,
// PGPASSWORD). Writes the bundle (owner-only, never overwriting) and, beside it, the custodian's
// PUBLIC anchor (<bundle>.anchor.json) to hand to the receiving node OUTSIDE the bundle.
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownerClient, readSnapshot, buildBundle, custodianOf, sealBundle, writeSealedBundle, exportCommitOf, charterHashesOf } from './bundle.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const charterPath = option('--charter'), keyPath = option('--key');
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--charter' && args[i - 1] !== '--key');
if (!charterPath || !keyPath || positional.length !== 1 || args.some(a => a.startsWith('--') && !['--charter', '--key', '--without-authority'].includes(a))) {
  console.error('Usage: npm run seed:export -- --charter node.json --key custodian.pem [--without-authority] bundle.json');
  process.exit(1);
}
const client = ownerClient();
try {
  const charter = JSON.parse(await readFile(resolve(charterPath), 'utf8'));
  const custodian = custodianOf(await readFile(resolve(keyPath), 'utf8'));
  const exportCommit = exportCommitOf(root);
  const charterHashes = await charterHashesOf(root);
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const snapshot = await readSnapshot(client);
  await client.query('COMMIT');
  const bundle = sealBundle(await buildBundle({ snapshot, charter, exportCommit, charterHashes, withoutAuthority: args.includes('--without-authority') }), custodian);
  const out = resolve(positional[0]);
  await writeSealedBundle(out, bundle, custodian);
  console.log(`Bundle sealed: ${bundle.docs.length} records in ${bundle.head.census.length} collections, manifest ${bundle.manifestHash.slice(0, 16)}…, custodian ${custodian.fingerprint.slice(0, 16)}….`);
  console.log(`Hand the receiving node ${out}.anchor.json by another road than the bundle; media and queues do not travel.`);
} catch (error) {
  console.error(error instanceof SyntaxError ? 'Invalid JSON input.' : error instanceof Error ? error.message : 'Export failed.');
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
