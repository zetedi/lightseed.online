#!/usr/bin/env node
/**
 * The letter of a place (ring 2026-09-08): every subscription is stamped with the place it was
 * made at, under the id <place>__<address>. The rows from before carried no place and stood
 * under the bare address: they were all made at the node, so this hand stamps them with the
 * node's domain and moves them to the new id (the unsubscribe token travels with them).
 *
 *   node scripts/rehome-subscriptions.mjs            # dry run
 *   node scripts/rehome-subscriptions.mjs --apply
 */
import { readFileSync } from 'node:fs';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const charter = JSON.parse(readFileSync(new URL('../node.json', import.meta.url), 'utf8'));
const HOME = charter.domain;
const apply = process.argv.includes('--apply');
initializeApp({ credential: applicationDefault(), projectId: charter.firebase.projectId });
const db = getFirestore();

const idOf = (place, email) => `${encodeURIComponent(place)}__${encodeURIComponent(email.trim().toLowerCase())}`;
const snap = await db.collection('subscriptions').get();
let kept = 0;
// Several legacy rows may name one address (a signup, a toggle, a re-signup): they fold into ONE
// row per address — active if any was active, the first token and uid kept, the oldest birth.
const folded = new Map();
for (const d of snap.docs) {
  const s = d.data();
  if (typeof s.domain === 'string' && s.domain) { kept++; continue; }
  if (typeof s.email !== 'string' || !s.email) { console.log(`  ? ${d.id} has no address — left as is`); continue; }
  const id = idOf(HOME, s.email);
  const row = folded.get(id) || { email: s.email.trim().toLowerCase(), domain: HOME, active: false, sources: [] };
  row.active = row.active || s.active === true;
  if (!row.unsubToken && s.unsubToken) row.unsubToken = s.unsubToken;
  if (!row.uid && s.uid) row.uid = s.uid;
  if (!row.createdAt || (s.createdAt && s.createdAt.toMillis && s.createdAt.toMillis() < row.createdAt.toMillis())) row.createdAt = s.createdAt || row.createdAt;
  row.sources.push(d.ref);
  folded.set(id, row);
}
for (const [id, row] of folded) console.log(`  ${row.sources.map(r => r.id).join(' + ')}  →  ${id}  (${row.active ? 'active' : 'resting'})`);
if (apply && folded.size) {
  const batch = db.batch();
  for (const [id, row] of folded) {
    const { sources, ...data } = row;
    batch.set(db.collection('subscriptions').doc(id), { ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    for (const ref of sources) if (ref.id !== id) batch.delete(ref);
  }
  await batch.commit();
}
console.log(`${apply ? 'folded' : 'would fold'} ${snap.size - kept} legacy row(s) into ${folded.size} at '${HOME}'; ${kept} already stamped.`);
