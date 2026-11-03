#!/usr/bin/env node
// seed:export — the node leaves by its travel plan, sealed by its custodian (ring 2026-11-02).
//   npm run seed:export -- --charter node.json --key custodian.pem [--community <id>] [--without-authority] bundle.json
// Connects as the migration owner through the PG* environment (PGHOST, PGPORT, PGDATABASE, PGUSER,
// PGPASSWORD). Writes the bundle (owner-only, never overwriting) and, beside it, the custodian's
// PUBLIC anchor (<bundle>.anchor.json) to hand to the receiving node OUTSIDE the bundle. With
// --community, ONE community's world leaves (domain/communityCrossing) and what touches it but
// stays is named in <bundle>.left.json.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { communityCrossing, placeResolverOf } from '../generated/chain.mjs';
import { ownerClient, readSnapshot, buildBundle, custodianOf, sealBundle, writeSealedBundle, exportCommitOf, charterHashesOf } from './bundle.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const named = ['--charter', '--key', '--community'];
const charterPath = option('--charter'), keyPath = option('--key'), communityId = option('--community');
const positional = args.filter((a, i) => !a.startsWith('--') && !named.includes(args[i - 1]));
if (!charterPath || !keyPath || positional.length !== 1 || args.some(a => a.startsWith('--') && ![...named, '--without-authority'].includes(a))) {
  console.error('Usage: npm run seed:export -- --charter node.json --key custodian.pem [--community <id>] [--without-authority] bundle.json');
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
  let snapshot = await readSnapshot(client);
  await client.query('COMMIT');
  let outside = null;
  if (communityId !== undefined) {
    const world = communityCrossing(snapshot, communityId, { placeOf: placeResolverOf(snapshot, Array.isArray(charter.faces) ? charter.faces : []) });
    if (typeof world === 'string') throw new Error(`No such community in the soil: ${communityId} (${world}).`);
    snapshot = world.docs; outside = world.left;
    console.log(`The world of ${communityId}: ${world.members.length} in the circle, ${world.named.length} named by their records, ${world.docs.length} records; ${world.left.length} touching it stay.`);
  }
  const bundle = sealBundle(await buildBundle({ snapshot, charter, exportCommit, charterHashes, withoutAuthority: args.includes('--without-authority') }), custodian);
  const out = resolve(positional[0]);
  await writeSealedBundle(out, bundle, custodian);
  if (outside !== null) await writeFile(`${out}.left.json`, JSON.stringify({ outside }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(`Bundle sealed: ${bundle.docs.length} records in ${bundle.head.census.length} collections, manifest ${bundle.manifestHash.slice(0, 16)}…, custodian ${custodian.fingerprint.slice(0, 16)}….`);
  console.log(`Hand the receiving node ${out}.anchor.json by another road than the bundle; media and queues do not travel.`);
} catch (error) {
  console.error(error instanceof SyntaxError ? 'Invalid JSON input.' : error instanceof Error ? error.message : 'Export failed.');
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
