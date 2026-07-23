#!/usr/bin/env node
/**
 * Inspect the light economy: where the glow sits, and whether any rays are ORPHANED (their
 * holder's account is gone but the ray survived — a sign the deletion cascade did not run,
 * i.e. the functions weren't redeployed with the "last spend" code).
 *
 *   node scripts/inspect-light.mjs
 *
 * Auth (Admin SDK): GOOGLE_APPLICATION_CREDENTIALS, gcloud ADC, or a serviceAccount.json at
 * the repo root (project id is read from .firebaserc / GOOGLE_CLOUD_PROJECT).
 */
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || (() => {
    try { return JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8')).projects?.default; }
    catch { return undefined; }
})();
const saPath = new URL('../serviceAccount.json', import.meta.url);
initializeApp(existsSync(saPath)
    ? { credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) }
    : { credential: applicationDefault(), projectId });

const db = getFirestore();

// 1) The glow ledger — where dissolved light has accumulated.
const glow = await db.collection('glow').get();
console.log(`\n── GLOW (${glow.size} home${glow.size === 1 ? '' : 's'}) ──`);
if (glow.empty) console.log('  (empty — no light has dissolved into any commons yet)');
for (const d of glow.docs) {
    console.log(`  glow/${d.id}  =  ${d.data().units || 0} units`);
}

// 2) The rays still in the world, grouped by holder — and whether each holder still exists.
const rays = await db.collection('rays').get();
console.log(`\n── RAYS (${rays.size}) ──`);
const byHolder = new Map();
let withCommunity = 0, withoutCommunity = 0;
for (const d of rays.docs) {
    const r = d.data();
    byHolder.set(r.holderUid, (byHolder.get(r.holderUid) || 0) + (r.units || 0));
    if (r.communityId) withCommunity++; else withoutCommunity++;
}
console.log(`  ${withCommunity} ray(s) carry a communityId; ${withoutCommunity} do NOT (those dissolve to glow/NODE on the holder's departure).`);
let orphans = 0;
for (const [uid, units] of byHolder) {
    const person = await db.collection('persons').doc(uid).get();
    const alive = person.exists;
    if (!alive) orphans++;
    console.log(`  holder ${uid}  ${units} units  ${alive ? '(account exists)' : '⚠ ORPHAN — account is gone'}`);
}
if (orphans > 0) {
    console.log(`\n⚠ ${orphans} orphaned holder(s): rays survived a deleted account. The deletion cascade did`);
    console.log('  not release them — most likely the functions were not redeployed with the last-spend code.');
    console.log('  Fix: `firebase deploy --only functions`, then delete again (or re-home manually).');
} else if (withoutCommunity > 0) {
    console.log('\nℹ Light from a solo tree (no community) dissolves into glow/NODE, not a community —');
    console.log('  which is why a test user\'s light may not appear on any community.');
}
console.log('');
