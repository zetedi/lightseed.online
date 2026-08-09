#!/usr/bin/env node

/**
 * Name the nameless: mint a lid for every document in the six indexed collections that has
 * none, and write its beings/{lid} entry in the same batch (the create-triggers cannot —
 * these are updates to existing documents, not births).
 *
 * Mirrors ensurePersonEntity's own backfill (accounts.ts), done centrally and for every kind.
 * Only ABSENT/malformed lids are touched; a document already named is never re-pointed —
 * the frozen half of the law (domain/beingIndex.ts) holds here too.
 *
 * Usage:
 *   node scripts/name-the-nameless.mjs                 # dry run — prints what it WOULD do
 *   node scripts/name-the-nameless.mjs --apply         # mint + index
 */
import { randomBytes } from 'node:crypto';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const apply = process.argv.includes('--apply');
const projectId = process.argv.includes('--project')
  ? process.argv[process.argv.indexOf('--project') + 1]
  : 'lifeseed-75dfe';

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

// UUIDv7 — the same algorithm as src/utils/id.ts / functions/src/mint.ts (RFC 9562).
const uuidv7 = () => {
  const bytes = new Uint8Array(16);
  let ts = Date.now();
  for (let i = 5; i >= 0; i--) { bytes[i] = ts % 256; ts = Math.floor(ts / 256); }
  bytes.set(randomBytes(10), 6);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KIND_FOR = { users: 'person', lifetrees: 'tree', visions: 'vision', lightHouses: 'lightHouse', communities: 'community', pulses: 'pulse' };

let named = 0;
const batch = db.batch();
for (const [collection, kind] of Object.entries(KIND_FOR)) {
  const snap = await db.collection(collection).get();
  for (const doc of snap.docs) {
    if (UUID_V7.test(doc.data()?.lid ?? '')) continue;
    const lid = uuidv7();
    console.log(`${apply ? 'naming' : 'would name'}  ${collection}/${doc.id}  ->  ${lid}`);
    if (apply) {
      batch.set(doc.ref, { lid }, { merge: true });
      batch.set(db.collection('beings').doc(lid), {
        lid, kind, collection, docId: doc.id,
        recordedAt: FieldValue.serverTimestamp(),
      });
    }
    named++;
  }
}
if (apply && named) await batch.commit();
console.log(`\n${named} beings ${apply ? 'named and indexed' : 'would be named'}.${apply ? '' : ' Run with --apply to write.'}`);
