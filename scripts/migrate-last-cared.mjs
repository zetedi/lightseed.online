#!/usr/bin/env node

/**
 * Field migration (2026-08-11): lifetrees.lastTendedAt → lastCaredAt — the tend→care rename,
 * finished in the data. Copies the timestamp to its new name and deletes the old field
 * (lifetree doc fields are not chain-hashed — only pulse block fields are — so this is safe).
 * Idempotent: a tree already migrated, or never tended, is left alone.
 *
 *   node scripts/migrate-last-cared.mjs           # dry run
 *   node scripts/migrate-last-cared.mjs --apply
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const apply = process.argv.includes('--apply');
initializeApp({ credential: applicationDefault(), projectId: 'lifeseed-75dfe' });
const db = getFirestore();

const snap = await db.collection('lifetrees').get();
let moved = 0;
const batch = db.batch();
for (const d of snap.docs) {
  const t = d.data();
  if (t.lastTendedAt === undefined) continue;
  console.log(`${apply ? 'migrating' : 'would migrate'}  ${(t.name || d.id).padEnd(24)} lastTendedAt → lastCaredAt`);
  if (apply) {
    batch.update(d.ref, {
      ...(t.lastCaredAt === undefined ? { lastCaredAt: t.lastTendedAt } : {}),
      lastTendedAt: FieldValue.delete(),
    });
  }
  moved++;
}
if (apply && moved) await batch.commit();
console.log(`\n${moved} tree(s) ${apply ? 'migrated' : 'would migrate'}. ${apply ? '' : 'Run with --apply to write.'}`);
