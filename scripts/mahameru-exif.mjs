#!/usr/bin/env node
/**
 * MAHAMERU's birth certificate — the Original Tree's real planting moment, read from the
 * birth photo's EXIF (DSC_0013.JPG, Sony Xperia):
 *
 *   Planted:  2019-08-18 19:27:23 (Europe/Brussels, UTC+2)
 *   Where:    50.838535 N, 4.380400 E · 85.9 m — a pond-side in Brussels
 *   Moment:   the branch touched, then cut from its parent willow.
 *
 * Mahameru died; Phoenix was planted into the soil where its roots lay. So this writes the
 * provenance onto GENESIS_TREE (Mahameru) and REMOVES it from Phoenix (where an earlier run
 * had mistakenly placed it). createdAt and the chain stay untouched.
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

// THE MOMENT — mirrors src/domain/genesis.ts (golden; never drift). Connected to
// enlightenment: the end of the search. createdAt becomes the Moment too — Mahameru is
// the oldest being on every sort, as it is in truth. The chain fields stay untouched.
const PLANTED_AT = new Date('2019-08-18T19:27:23+02:00');
const MOMENT = admin.firestore.Timestamp.fromDate(PLANTED_AT);
const PROVENANCE = {
  createdAt: MOMENT,
  plantedAt: MOMENT,
  plantedLatitude: 50.838535,
  plantedLongitude: 4.3804,
  plantedAltitudeM: 85.9,
  latitude: 50.838535,
  longitude: 4.3804,
  locationName: 'The Source',
};

// 1. Mahameru — the Original Tree — receives its birth.
const genesisRef = db.collection('lifetrees').doc('GENESIS_TREE');
const genesis = await genesisRef.get();
if (!genesis.exists) {
  console.error('✗ GENESIS_TREE not found.');
  process.exit(1);
}
await genesisRef.update(PROVENANCE);
console.log('✓ Mahameru (GENESIS_TREE): the Moment is the one — created & planted 2019-08-18 19:27:23 +02:00 · 50.838535, 4.380400 · 85.9 m · The Source (Place Jourdain pond, Brussels)');

// 2. Phoenix — the earlier mistaken write comes off.
const strip = {
  plantedAt: admin.firestore.FieldValue.delete(),
  plantedLatitude: admin.firestore.FieldValue.delete(),
  plantedLongitude: admin.firestore.FieldValue.delete(),
  plantedAltitudeM: admin.firestore.FieldValue.delete(),
};
const phoenixes = await db.collection('lifetrees').where('name', '==', 'Phoenix').get();
for (const doc of phoenixes.docs) {
  await doc.ref.update(strip);
  console.log(`✓ ${doc.id}: provenance removed (it belongs to Mahameru).`);
}
console.log('Done — Mahameru remembers its birth; Phoenix grows from its soil.');
