#!/usr/bin/env node

/**
 * One-doc repair: stamp visibility:'public' on The Aspen, the single tree born without the
 * field (planted by script before plantLifetree stamped visibility itself). A doc missing
 * `visibility` is invisible to every `visibility in [...]` query — forest, map, invite search.
 * Idempotent: a tree already carrying a visibility is left exactly as it is.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'lifeseed-75dfe' });
const db = getFirestore();

const snap = await db.collection('lifetrees').where('name', '==', 'The Aspen').get();
for (const d of snap.docs) {
  if (!d.data().visibility) {
    await d.ref.set({ visibility: 'public' }, { merge: true });
    console.log(`stamped ${d.id} (${d.data().name}) visibility=public`);
  } else {
    console.log(`${d.id} already ${d.data().visibility} — untouched`);
  }
}
console.log(`${snap.size} tree(s) checked.`);
