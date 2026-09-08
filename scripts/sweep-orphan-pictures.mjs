#!/usr/bin/env node
/**
 * THE ORPHAN SWEEP (ring 2026-09-08). Before the release of a picture existed, every replaced
 * logo, removed hero and dropped gallery image left its file, two variants and original copy
 * in the bucket. This hand walks the bucket ONCE with the same law the server releases by
 * (functions/lib/pictureRelease — the compiled mirror of domain/pictureRelease, held equal by
 * the tests): for every primary in a RELEASABLE seat it reads the holder's document and, when
 * no string in it names the picture (or the holder is gone), lists the primary with its
 * variants and original. It also lists derived objects (thumbs/, originals/) of a releasable
 * seat whose primary is already gone. Everything a chain binds is outside the law and is
 * never touched. Dry run by default; --apply deletes what was listed.
 *
 *   npm --prefix functions run build          # the law's compiled mirror must exist
 *   node scripts/sweep-orphan-pictures.mjs                    # dry run
 *   node scripts/sweep-orphan-pictures.mjs --apply
 *   node scripts/sweep-orphan-pictures.mjs --prefix communities/ZRgx…   # one holder's folder
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const require = createRequire(import.meta.url);
const lawPath = new URL('../functions/lib/pictureRelease.js', import.meta.url);
if (!existsSync(lawPath)) { console.error('the law\'s compiled mirror is missing — run: npm --prefix functions run build'); process.exit(1); }
const { pictureReleaseOf, docReferencesPicture } = require(lawPath.pathname);
const { isDerivedImagePath } = require(new URL('../functions/lib/imageVariant.js', import.meta.url).pathname);

const charter = JSON.parse(readFileSync(new URL('../node.json', import.meta.url), 'utf8'));
const APPLY = process.argv.includes('--apply');
const prefixIdx = process.argv.indexOf('--prefix');
const PREFIX = prefixIdx > -1 ? process.argv[prefixIdx + 1] : '';

initializeApp({ credential: applicationDefault(), projectId: charter.firebase.projectId });
const db = getFirestore();
const bucket = getStorage().bucket(charter.firebase.bucket);

const [all] = await bucket.getFiles({ prefix: PREFIX });
const names = new Set(all.map((f) => f.name));
const sizeOf = new Map(all.map((f) => [f.name, Number(f.metadata?.size || 0)]));
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

// The holder's document, read once per holder.
const holders = new Map();
const holderDoc = async (holder) => {
  const key = `${holder.kind}:${holder.kind === 'community' ? holder.id : holder.uid}`;
  if (!holders.has(key)) {
    const ref = holder.kind === 'community' ? db.collection('communities').doc(holder.id) : db.collection('users').doc(holder.uid);
    const snap = await ref.get();
    holders.set(key, snap.exists ? snap.data() : null);
  }
  return holders.get(key);
};

// The primary a derived object was made from: thumbs/<path>@<size>.webp, originals/<path>.
const primaryOfDerived = (name) => {
  if (name.startsWith('originals/')) return name.slice('originals/'.length);
  const m = /^thumbs\/(.+)@(?:480|1200)\.webp$/.exec(name);
  return m ? m[1] : null;
};

const orphans = new Map(); // object name → reason
let primaries = 0, held = 0, outsideLaw = 0;
for (const f of all) {
  const name = f.name;
  if (isDerivedImagePath(name)) {
    const primary = primaryOfDerived(name);
    if (primary && !names.has(primary) && pictureReleaseOf(primary)) orphans.set(name, `its primary is gone (${primary})`);
    continue;
  }
  const release = pictureReleaseOf(name);
  if (!release) { outsideLaw++; continue; }
  primaries++;
  const doc = await holderDoc(release.holder);
  if (doc && docReferencesPicture(doc, name)) { held++; continue; }
  const why = doc ? 'the holder no longer shows it' : 'the holder is gone';
  for (const obj of release.objects) if (names.has(obj)) orphans.set(obj, why);
}

let bytes = 0;
for (const [name, why] of orphans) { bytes += sizeOf.get(name) || 0; console.log(`  ${name}  — ${why}`); }
console.log(`\n${all.length} objects under '${PREFIX || '(all)'}': ${primaries} releasable primaries (${held} still shown), ${outsideLaw} outside the law (chain-bound or foreign).`);
console.log(`${APPLY ? 'DELETING' : 'would delete'} ${orphans.size} orphan object(s), ${mb(bytes)}.`);

if (APPLY) {
  let done = 0;
  for (const name of orphans.keys()) {
    try { await bucket.file(name).delete(); done++; } catch (e) { console.warn(`  ! ${name}: ${e.message}`); }
  }
  console.log(`released ${done} object(s).`);
} else if (orphans.size) {
  console.log('Re-run with --apply to release them.');
}
