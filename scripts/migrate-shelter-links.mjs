#!/usr/bin/env node
/**
 * Belonging is links, never arrays: migrate every sanctuary's legacy communityIds[] into
 * LIN edges (links/{sanctuaryId}__shelters__{communityId}), then delete the array field.
 * The primary communityId scalar stays (the rules' denormalised read gate). Idempotent.
 * Auth like the other seeds: gcloud auth application-default login.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let admin;
try {
  admin = (await import('firebase-admin')).default;
} catch {
  console.error('✗ firebase-admin is not installed.\n  Run:  npm i firebase-admin');
  process.exit(1);
}

const PROJECT_ID = 'lifeseed-75dfe';
const saPath = resolve('serviceAccount.json');
if (process.env.GOOGLE_APPLICATION_CREDENTIALS || !existsSync(saPath)) {
  admin.initializeApp({ projectId: PROJECT_ID });
} else {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(saPath, 'utf8'))), projectId: PROJECT_ID });
}
const db = admin.firestore();
const { randomUUID } = await import('node:crypto');

const snap = await db.collection('sanctuaries').get();
let minted = 0, cleaned = 0;
for (const docSnap of snap.docs) {
  const d = docSnap.data();
  const ids = Array.isArray(d.communityIds) ? d.communityIds : [];
  for (const cid of ids) {
    if (cid === d.communityId) continue; // the primary scalar already carries it
    const linkId = `${docSnap.id}__shelters__${cid}`;
    await db.collection('links').doc(linkId).set({
      lid: randomUUID(), type: 'link', rel: 'shelters', from: docSnap.id, to: cid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    minted++;
    console.log(`✓ link ${linkId}`);
  }
  if ('communityIds' in d) {
    await docSnap.ref.update({ communityIds: admin.firestore.FieldValue.delete() });
    cleaned++;
  }
}
console.log(`Done — ${minted} shelter link(s) minted, ${cleaned} array field(s) removed.`);
