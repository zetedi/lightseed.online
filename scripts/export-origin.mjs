#!/usr/bin/env node
// seed:export:origin — THE ORIGIN LEAVES (ring 2026-11-03). The first node's Firestore soil leaves by
// the same travel plan, as the same sealed bundle, that an independent node exports with seed:export —
// so the crossing into a PostgreSQL node is one law whichever soil a node grew in.
//   npm run seed:export:origin -- --key custodian.pem [--charter src/config/charter.json] [--project <id>]
//     [--without-authority] [--survey] [--leave <collection>]... [--leave-unlandable] bundle.json
// Reads with the Admin SDK (GOOGLE_APPLICATION_CREDENTIALS, `gcloud auth application-default login`,
// or a serviceAccount.json beside the repository) inside ONE read-only transaction at one moment, so
// the census is a snapshot, not a smear. Writes bundle.json (owner-only, never overwriting), its PUBLIC
// anchor beside it (<bundle>.anchor.json — hand it over by another road), the census of identities
// (<bundle>.identities.json — the receiving node's identities.json once every login is bound) and what
// stayed behind (<bundle>.left.json). Exit 0 = sealed, 2 = refused (an unknown collection, a record
// that could not land), 1 = error.
import { existsSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBundle, custodianOf, sealBundle, writeSealedBundle, exportCommitOf, charterHashesOf } from '../seed/api/bundle.mjs';
import { originSnapshot, originIdentities, pruneBrokenChains, communityCrossing, placeResolverOf, expectedBeingsIndex, verifyBundle } from '../seed/generated/chain.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const named = ['--charter', '--key', '--project', '--leave', '--community', '--place'];
const flags = ['--without-authority', '--survey', '--leave-unlandable', '--leave-broken'];
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const every = name => args.flatMap((a, i) => (a === name && args[i + 1] !== undefined ? [args[i + 1]] : []));
const positional = args.filter((a, i) => !a.startsWith('--') && !named.includes(args[i - 1]));
const usage = 'Usage: npm run seed:export:origin -- --key custodian.pem [--charter src/config/charter.json] [--project <id>] [--community <id> [--place <alias>=<communityId>]...] [--without-authority] [--survey] [--leave <collection>]... [--leave-unlandable] [--leave-broken] bundle.json';
if (!option('--key') || positional.length !== 1 || args.some(a => a.startsWith('--') && !named.includes(a) && !flags.includes(a))) {
  console.error(usage);
  process.exit(1);
}

let app, firestore;
try {
  app = await import('firebase-admin/app');
  firestore = await import('firebase-admin/firestore');
} catch {
  console.error('firebase-admin is not installed beside the repository: npm i firebase-admin');
  process.exit(1);
}

// The origin's door: a service account beside the repository, or application-default credentials.
const openOrigin = projectId => {
  const localKey = resolve(root, 'serviceAccount.json');
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(localKey)) {
    const account = JSON.parse(readFileSync(localKey, 'utf8'));
    app.initializeApp({ credential: app.cert(account), projectId: account.project_id || projectId });
  } else {
    app.initializeApp({ credential: app.applicationDefault(), projectId });
  }
  return firestore.getFirestore();
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const writeOwnerOnly = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });

try {
  const charterPath = resolve(root, option('--charter') ?? 'src/config/charter.json');
  const charter = JSON.parse(await readFile(charterPath, 'utf8'));
  const custodian = custodianOf(await readFile(resolve(option('--key')), 'utf8'));
  const projectId = option('--project') ?? charter?.firebase?.projectId;
  if (typeof projectId !== 'string' || !projectId) throw new Error('No Firebase project: pass --project or a version-1 charter that names one.');
  const out = resolve(positional[0]);
  const survey = args.includes('--survey');
  const leave = every('--leave');

  const db = openOrigin(projectId);
  const readTime = firestore.Timestamp.now();
  const records = snapshot => snapshot.docs.map(d => ({ path: d.ref.path, data: d.data() }));
  const { snapshot, beingsOnOrigin } = await db.runTransaction(async transaction => {
    const reader = {
      roots: async () => (await db.listCollections()).map(c => c.id),
      docs: async name => records(await transaction.get(db.collection(name))),
      group: async name => records(await transaction.get(db.collectionGroup(name))),
      subcollections: async path => (await db.doc(path).listCollections()).map(c => c.id),
    };
    const gathered = await originSnapshot(reader, { survey, leave });
    const beings = gathered.rebuilt.includes('beings') ? records(await transaction.get(db.collection('beings'))).map(b => b.path.slice('beings/'.length)) : [];
    return { snapshot: gathered, beingsOnOrigin: beings };
  }, { readOnly: true, readTime });

  if (snapshot.unknown.length) {
    console.error(`The travel plan has never named ${plural(snapshot.unknown.length, 'collection')} that stand in the soil: ${snapshot.unknown.join(', ')}.`);
    console.error('Name each in the plan (domain/bundle TRAVEL_PLAN), or leave it behind knowingly with --leave <collection>.');
    process.exit(2);
  }
  if (snapshot.unlandable.length && !args.includes('--leave-unlandable')) {
    console.error(`${plural(snapshot.unlandable.length, 'record')} could not land on the far side:`);
    for (const item of snapshot.unlandable.slice(0, 20)) console.error(`  ${item.path}: ${item.reason}`);
    if (snapshot.unlandable.length > 20) console.error(`  … ${snapshot.unlandable.length - 20} more.`);
    console.error('Mend them at the origin, or leave them behind knowingly with --leave-unlandable (they are named in <bundle>.left.json).');
    process.exit(2);
  }

  // A block whose chain does not meet (its predecessor or its being no longer carried — debris of a
  // deleted being) would fail the far side's verification and block the whole crossing. Named here;
  // left behind, with everything that descends from it, only when the hand says so.
  const pruned = pruneBrokenChains(snapshot.docs);
  if (pruned.broken.length && !args.includes('--leave-broken')) {
    console.error(`${plural(pruned.broken.length, 'block')} whose chain does not meet would block the crossing:`);
    for (const item of pruned.broken.slice(0, 20)) console.error(`  ${item.path}: ${item.reason}`);
    if (pruned.broken.length > 20) console.error(`  … ${pruned.broken.length - 20} more.`);
    console.error('Mend the chains at the origin, or leave these blocks behind knowingly with --leave-broken (they are named in <bundle>.left.json).');
    process.exit(2);
  }
  // One community's world (domain/communityCrossing), when the hand names one: the circle, their
  // beings with whole chains, what belongs by field, the edges whose both ends travel, the public
  // record of everyone named — and what touches the community but stays, named.
  const communityId = option('--community');
  let travelling = pruned.docs;
  let outside = [];
  if (communityId !== undefined) {
    // Places of record resolve through the charter's faces; the hand may add an old door by name.
    const aliases = every('--place').map(pair => { const [alias, id] = pair.split('='); if (!alias || !id) throw new Error(`--place wants <alias>=<communityId>, got ${pair}.`); return { alias, communityId: id }; });
    const world = communityCrossing(pruned.docs, communityId, { placeOf: placeResolverOf(pruned.docs, Array.isArray(charter.faces) ? charter.faces : [], aliases) });
    if (typeof world === 'string') throw new Error(`No such community in the soil: ${communityId} (${world}).`);
    travelling = world.docs; outside = world.left;
    console.log(`The world of ${communityId}: ${plural(world.members.length, 'member')} in the circle, ${plural(world.named.length, 'person')} named by their records, ${plural(world.docs.length, 'record')}; ${plural(world.left.length, 'record')} touching it stay (named in <bundle>.left.json).`);
  }
  const bundle = sealBundle(await buildBundle({
    snapshot: travelling, charter, exportCommit: exportCommitOf(root), charterHashes: await charterHashesOf(root),
    exportedAtMs: readTime.toMillis(), withoutAuthority: args.includes('--without-authority'),
  }), custodian);
  // The hand verifies what it sealed before anyone else must: a bundle the far side would refuse is no export.
  const verdict = await verifyBundle(bundle);
  if (!verdict.ok) {
    console.error(`The sealed bundle does not verify (${plural(verdict.issues.length, 'issue')}):`);
    for (const issue of verdict.issues.slice(0, 20)) console.error(`  ${issue.code}${issue.path ? ' ' + issue.path : ''}${issue.detail ? ': ' + issue.detail : ''}`);
    process.exit(2);
  }
  const { identities, ghosts } = originIdentities(bundle.docs);
  const witness = new Set(expectedBeingsIndex(bundle.docs).map(entry => entry.lid));
  const origin = new Set(beingsOnOrigin);
  const beings = {
    onOrigin: origin.size, inWitness: witness.size,
    onlyOnOrigin: [...origin].filter(lid => !witness.has(lid)).sort(),
    onlyInWitness: [...witness].filter(lid => !origin.has(lid)).sort(),
  };

  await writeSealedBundle(out, bundle, custodian);
  await writeOwnerOnly(`${out}.identities.json`, identities);
  await writeOwnerOnly(`${out}.left.json`, { left: snapshot.left, rebuilt: snapshot.rebuilt, unlandable: snapshot.unlandable, broken: pruned.broken, outside, ghosts, beings });

  console.log(`Bundle sealed at ${readTime.toDate().toISOString()}: ${bundle.docs.length} records in ${bundle.head.census.length} collections, manifest ${bundle.manifestHash.slice(0, 16)}…, custodian ${custodian.fingerprint.slice(0, 16)}….`);
  console.log(`  ${bundle.head.census.map(c => `${c.path} ${c.count}`).join(', ')}`);
  if (snapshot.left.length) console.log(`Left behind (${snapshot.left.length}): ${snapshot.left.map(l => l.path).join(', ')} — reasons in ${out}.left.json.`);
  if (snapshot.unlandable.length) console.log(`Left behind unlandable (${snapshot.unlandable.length}) — named in ${out}.left.json.`);
  if (pruned.broken.length) console.log(`Left behind broken (${pruned.broken.length} blocks whose chain does not meet) — named in ${out}.left.json.`);
  if (snapshot.rebuilt.length) console.log(`Rebuilt on the far side: ${snapshot.rebuilt.join(', ')} (${beings.onOrigin} beings on the origin, ${beings.inWitness} in the witness; only on the origin ${beings.onlyOnOrigin.length}, only in the witness ${beings.onlyInWitness.length}).`);
  console.log(`Identities: ${identities.length} bound to a person (${out}.identities.json); ghosts ${ghosts.length}${ghosts.length ? ': ' + ghosts.map(g => `${g.uid} (${g.reason})`).join(', ') : ''}.`);
  console.log(`Hand the receiving node ${out}.anchor.json by another road than the bundle; media and queues do not travel.`);
} catch (error) {
  console.error(error instanceof SyntaxError ? 'Invalid JSON input.' : error instanceof Error ? error.message : 'Export failed.');
  process.exitCode = 1;
}
