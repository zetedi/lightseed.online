#!/usr/bin/env node

/**
 * Backfill visibility on legacy pulses (ring 2026-08-25) — the ground Path B stands on.
 * `visibility` is HASHED block content (BLOCK_CONTENT_FIELDS), so writing it onto a
 * canonically-SEALED block would change its preimage and break its hash. This migration
 * therefore touches ONLY unsealed pulses lacking the field (verified: the sealed blocks
 * already carry visibility), writing 'public' — the value the rules already treated absent
 * as, so no visible behavior changes. It refuses to touch any sealed block, loudly.
 *
 *   node scripts/backfill-pulse-visibility.mjs            # dry run
 *   node scripts/backfill-pulse-visibility.mjs --apply
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const apply = process.argv.includes('--apply');
initializeApp({ credential: applicationDefault(), projectId: 'lifeseed-75dfe' });
const db = getFirestore();

const snap = await db.collection('pulses').get();
let candidates = 0, sealedSkipped = 0;
const batch = db.batch();
for (const d of snap.docs) {
  const p = d.data();
  if (p.visibility !== undefined) continue;
  if (p.hashVersion) { // a sealed block hashed WITHOUT visibility — writing it breaks the hash
    sealedSkipped++;
    console.log(`  REFUSED (sealed, would break hash): ${d.id}`);
    continue;
  }
  candidates++;
  console.log(`  ${apply ? 'backfilling' : 'would backfill'} ${d.id}  type=${p.type || '?'}  title=${JSON.stringify(p.title || '')}`);
  if (apply) batch.update(d.ref, { visibility: 'public' });
}
if (apply && candidates) await batch.commit();
console.log(`\n${candidates} ${apply ? 'backfilled' : 'to backfill'} · ${sealedSkipped} sealed-refused · ${snap.size} total`);
if (!apply && candidates) console.log('Run with --apply to write visibility: public on the unsealed legacy pulses.');
