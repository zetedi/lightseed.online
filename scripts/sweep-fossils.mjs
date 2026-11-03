#!/usr/bin/env node
// sweep-fossils — the origin's fossils named, and removed only on the hand's word (ring 2026-11-03).
//   node scripts/sweep-fossils.mjs [--project <id>] [--apply] [--mend-user-lids] [--resolve-two-lids]
// Dry run by default: lists every fossil it would remove and every fault it will not touch.
//   --apply removes the fossils: the `organisations` collection (the organisation-per-domain of
//     2025, read by nothing since communities became the circle), beings-index entries whose being
//     is gone, blocks whose chain does not meet (the debris of deleted beings, with the loves,
//     signatures and witnesses that hung under them) and subcollection records under a deleted parent.
//   --mend-user-lids copies persons.lid onto a users record that carries none (the beings index reads
//     a person's name from users) and writes the missing index entry — create-only, never re-pointed.
//   --resolve-two-lids gives a person wearing two lids ONE name (Zoltán's word, 2026-11-03): the lid
//     persons carries — the one ensurePersonEntity serves on every login — is written onto users, the
//     index entry under the other lid is removed and the entry under the kept lid written. Re-pointing
//     a name is a governed act; this flag is that act, taken by the keeper.
// Reported, never touched: links wearing a lid that is not a version-7 true name, and departed uids
// still named by their traces.
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { portableValue, pruneBrokenChains, localUidCensus } from '../seed/generated/chain.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
if (args.some(a => a.startsWith('--') && !['--project', '--apply', '--mend-user-lids', '--resolve-two-lids'].includes(a)) || args.some((a, i) => !a.startsWith('--') && args[i - 1] !== '--project')) {
  console.error('Usage: node scripts/sweep-fossils.mjs [--project <id>] [--apply] [--mend-user-lids] [--resolve-two-lids]');
  process.exit(1);
}
const app = await import('firebase-admin/app');
const firestore = await import('firebase-admin/firestore');
const projectId = option('--project') ?? JSON.parse(readFileSync(resolve(root, 'src/config/charter.json'), 'utf8')).firebase?.projectId;
const localKey = resolve(root, 'serviceAccount.json');
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(localKey)) {
  const account = JSON.parse(readFileSync(localKey, 'utf8'));
  app.initializeApp({ credential: app.cert(account), projectId: account.project_id || projectId });
} else app.initializeApp({ credential: app.applicationDefault(), projectId });
const db = firestore.getFirestore();

const LID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BEING_ROOTS = ['users', 'lifetrees', 'visions', 'lightHouses', 'communities', 'pulses'];
const ROOTS = [...BEING_ROOTS, 'persons', 'links', 'secretLinks', 'covenants', 'alignments', 'beings', 'organisations'];
const GROUPS = ['keys', 'keyEvents', 'keyRecoveries', 'witnesses', 'occupancy', 'signatures', 'loves', 'pushSubscriptions', 'holds'];
const records = snapshot => snapshot.docs.map(d => ({ path: d.ref.path, data: d.data() }));
const soil = new Map();
for (const name of ROOTS) for (const r of records(await db.collection(name).get())) soil.set(r.path, r.data);
const groups = new Map();
for (const name of GROUPS) groups.set(name, records(await db.collectionGroup(name).get()));
const parentOf = path => path.split('/').slice(0, -2).join('/');

// A. The fossil collection.
const organisations = [...soil.keys()].filter(path => path.startsWith('organisations/'));
// C. Blocks whose chain does not meet, by the crossing's own closure law, with what hung under them.
const docs = [...soil.entries()].filter(([path]) => !path.startsWith('beings/') && !path.startsWith('organisations/'))
  .map(([path, data]) => ({ path, data: portableValue(data).value ?? {} }));
for (const list of groups.values()) for (const r of list) docs.push({ path: r.path, data: portableValue(r.data).value ?? {} });
const debris = pruneBrokenChains(docs).broken.map(b => b.path);
// B. Index entries whose being is gone — or goes with the debris.
const staleIndex = [...soil.entries()].filter(([path, data]) => path.startsWith('beings/') && (!soil.has(`${data.collection}/${data.docId}`) || debris.includes(`${data.collection}/${data.docId}`))).map(([path]) => path);
// D. Subcollection records under a deleted parent (Firestore keeps them alive; the soil does not).
const orphans = [];
for (const list of groups.values()) for (const r of list) {
  let parent = parentOf(r.path);
  while (parent.includes('/') && soil.has(parent)) parent = parentOf(parent);
  if (!soil.has(parent) && !debris.includes(r.path)) orphans.push(r.path);
}
// E. Reported, never touched.
const oldLids = [...soil.entries()].filter(([path, data]) => /^(links|secretLinks)\//.test(path) && !LID.test(String(data.lid))).map(([path, data]) => `${path} (${data.lid})`);
const users = [...soil.entries()].filter(([path]) => path.startsWith('users/'));
const lidMissing = users.filter(([path, data]) => typeof data.lid !== 'string' && typeof soil.get(`persons/${path.slice(6)}`)?.lid === 'string').map(([path]) => path.slice(6));
const twoLids = users.filter(([path, data]) => typeof data.lid === 'string' && typeof soil.get(`persons/${path.slice(6)}`)?.lid === 'string' && data.lid !== soil.get(`persons/${path.slice(6)}`).lid)
  .map(([path, data]) => ({ uid: path.slice(6), users: data.lid, persons: soil.get(`persons/${path.slice(6)}`).lid }));
const lidDisagrees = twoLids.map(({ uid, users: u, persons: p }) => `${uid}: users ${u}${soil.has(`beings/${u}`) ? ' (indexed)' : ''} / persons ${p}${soil.has(`beings/${p}`) ? ' (indexed)' : ''}`);
const departed = localUidCensus(docs).filter(uid => !soil.has(`users/${uid}`) && !soil.has(`persons/${uid}`));

const section = (title, items) => { console.log(`${title}: ${items.length}`); for (const item of items) console.log(`  ${item}`); };
section('A. organisations (fossil collection, removed with --apply)', organisations);
section('B. beings-index entries whose being is gone (removed with --apply)', staleIndex);
section('C. blocks whose chain does not meet, and what hung under them (removed with --apply)', debris);
section('D. subcollection records under a deleted parent (removed with --apply)', orphans);
section('E1. links whose lid is not a version-7 true name (reported only)', oldLids);
section('E2. users without a lid while persons has one (mended with --mend-user-lids)', lidMissing);
section('E3. persons wearing two lids (resolved with --resolve-two-lids: the persons lid is kept)', lidDisagrees);
section('E4. departed uids still named by their traces (reported only)', departed);

const deleteAll = async paths => {
  for (let start = 0; start < paths.length; start += 400) {
    const batch = db.batch();
    for (const path of paths.slice(start, start + 400)) batch.delete(db.doc(path));
    await batch.commit();
  }
};
if (args.includes('--apply')) {
  const removal = [...organisations, ...staleIndex, ...debris, ...orphans];
  await deleteAll(removal);
  console.log(`Removed ${removal.length} fossils.`);
}
if (args.includes('--mend-user-lids')) {
  let mended = 0;
  for (const uid of lidMissing) {
    const lid = soil.get(`persons/${uid}`).lid;
    await db.doc(`users/${uid}`).set({ lid }, { merge: true });
    try { await db.doc(`beings/${lid}`).create({ lid, kind: 'person', collection: 'users', docId: uid, recordedAt: firestore.FieldValue.serverTimestamp() }); } catch (error) { if (error?.code !== 6) throw error; }
    mended++;
  }
  console.log(`Mended ${mended} users with their person's lid (index entries written where missing).`);
}
if (args.includes('--resolve-two-lids')) {
  for (const { uid, users: old, persons: kept } of twoLids) {
    await db.doc(`users/${uid}`).set({ lid: kept }, { merge: true });
    const stale = await db.doc(`beings/${old}`).get();
    if (stale.exists && stale.data()?.collection === 'users' && stale.data()?.docId === uid) await db.doc(`beings/${old}`).delete();
    try { await db.doc(`beings/${kept}`).create({ lid: kept, kind: 'person', collection: 'users', docId: uid, recordedAt: firestore.FieldValue.serverTimestamp() }); } catch (error) { if (error?.code !== 6) throw error; }
  }
  console.log(`Resolved ${twoLids.length} persons to one name each (the persons lid kept, the index re-pointed).`);
}
if (!args.includes('--apply') && !args.includes('--mend-user-lids') && !args.includes('--resolve-two-lids')) console.log('Dry run: nothing was changed. Pass --apply to remove A–D, --mend-user-lids for E2, --resolve-two-lids for E3.');
