#!/usr/bin/env node
/**
 * One-time rays/ cleanup — ONLY needed if the flawed trigger mint (3cabab7) was deployed
 * before the server-ground rework (9a3f571). Those triggers could be driven with forged
 * pulses, so any ray minted by them is untrusted; before any spending exists, the clean
 * state is an empty ledger and light re-kindled through witnessWatering.
 *
 * SAFE BY DEFAULT: with no flag it only LISTS what it would delete.
 *
 *   node scripts/cleanup-rays.mjs           # list the rays (dry run)
 *   node scripts/cleanup-rays.mjs --burn    # delete them all
 *
 * Auth (Admin SDK — bypasses Firestore rules), same as seed-lightseed.mjs:
 *   Option A: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   Option B: gcloud auth application-default login
 *   Option C: drop a serviceAccount.json next to the repo root.
 */
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Bare ADC (gcloud auth application-default login) often carries no project id, so read it
// from .firebaserc (or an env override) and hand it over explicitly. A serviceAccount.json
// already embeds its own project_id, so that branch needs nothing extra.
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || (() => {
    try { return JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8')).projects?.default; }
    catch { return undefined; }
})();
const saPath = new URL('../serviceAccount.json', import.meta.url);
initializeApp(existsSync(saPath)
    ? { credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) }
    : { credential: applicationDefault(), projectId });

const db = getFirestore();
const burn = process.argv.includes('--burn');

const snap = await db.collection('rays').get();
if (snap.empty) {
    console.log('The rays ledger is already empty. Nothing to clean.');
    process.exit(0);
}

let total = 0;
for (const d of snap.docs) {
    const r = d.data();
    total += r.units || 0;
    console.log(`  ${d.id}  holder=${r.holderUid}  ${r.units} units  (${r.dayKey || 'no day'})`);
}
console.log(`\n${snap.size} ray(s), ${total} units in all.`);

if (!burn) {
    console.log('Dry run. Re-run with --burn to delete them.');
    process.exit(0);
}

for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
}
console.log(`Deleted ${snap.size} ray(s). The ledger is clean; light re-enters only through witnessed care.`);
