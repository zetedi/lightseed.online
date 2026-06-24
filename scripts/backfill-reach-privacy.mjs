#!/usr/bin/env node
/**
 * Backfill privacy fields onto EXISTING direct-message reaches so the hardened Firestore
 * rules protect them and the new queries still find them.
 *
 * Why: historically a reach (type 'reach' with a recipientUid) was written without
 * `participantUids`, `threadId`, or a private `visibility`. The new rules confine reach
 * reads to {author, recipient, participants}; legacy reaches that lack these fields stay
 * world-readable (the old leak) and won't appear in the participantUids-based inbox query.
 * This makes each legacy 1:1 reach private and re-routable:
 *    participantUids = unique([authorId, recipientUid])
 *    threadId        = [lifetreeId, reachTreeId].sort().join('__')   (if missing)
 *    visibility      = 'private'                                     (if missing)
 *
 * Minted, PUBLIC "reach" reflections (type 'reach' with NO recipientUid) are left untouched
 * — they are meant to stay world-readable.
 *
 * Idempotent: a reach that already has participantUids is skipped.
 *
 * Auth (Admin SDK — bypasses Firestore rules):
 *   Option A: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   Option B: gcloud auth application-default login
 *   Option C: drop a serviceAccount.json next to the repo root.
 *
 * Run:
 *   node scripts/backfill-reach-privacy.mjs            # apply
 *   node scripts/backfill-reach-privacy.mjs --dry-run  # report only, no writes
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let admin;
try {
  admin = (await import('firebase-admin')).default;
} catch {
  console.error('✗ firebase-admin is not installed.\n  Run:  npm i firebase-admin   (it is already a dependency of ./functions)');
  process.exit(1);
}

const PROJECT_ID = 'lifeseed-75dfe';
const DRY_RUN = process.argv.includes('--dry-run');

function initAdmin() {
  const localKey = resolve(process.cwd(), 'serviceAccount.json');
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(localKey)) {
    const sa = JSON.parse(readFileSync(localKey, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id || PROJECT_ID });
    return sa.project_id || PROJECT_ID;
  }
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT_ID });
  return PROJECT_ID;
}

const buildThreadId = (a, b) => [a || '', b || ''].sort().join('__');

async function run() {
  const projectId = initAdmin();
  const db = admin.firestore();
  console.log(`Project: ${projectId}`);
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Backfilling reach privacy fields…\n`);

  const snap = await db.collection('pulses').where('type', '==', 'reach').get();
  let scanned = 0, updated = 0, skippedPublic = 0, skippedDone = 0;

  let batch = db.batch();
  let pending = 0;

  for (const doc of snap.docs) {
    scanned++;
    const p = doc.data();

    // Already migrated.
    if (Array.isArray(p.participantUids) && p.participantUids.length) { skippedDone++; continue; }
    // Minted public reflection (no recipient) — leave world-readable.
    if (!p.recipientUid) { skippedPublic++; continue; }

    const participantUids = Array.from(new Set([p.authorId, p.recipientUid].filter(Boolean)));
    const update = {
      participantUids,
      visibility: p.visibility || 'private',
      threadId: p.threadId || buildThreadId(p.lifetreeId, p.reachTreeId),
    };

    if (DRY_RUN) {
      updated++;
      if (updated <= 10) console.log(`  would update ${doc.id}: participants=${participantUids.join(',')} thread=${update.threadId}`);
      continue;
    }

    batch.set(doc.ref, update, { merge: true });
    updated++; pending++;
    if (pending >= 400) { await batch.commit(); batch = db.batch(); pending = 0; }
  }

  if (!DRY_RUN && pending > 0) await batch.commit();

  console.log(`\nScanned ${scanned} reach pulses.`);
  console.log(`  ${DRY_RUN ? 'would update' : 'updated'}: ${updated}`);
  console.log(`  skipped (already migrated): ${skippedDone}`);
  console.log(`  skipped (public minted reach, no recipient): ${skippedPublic}`);
  console.log(DRY_RUN ? '\n[DRY RUN] No writes were made.' : '\n✓ Done.');
}

run().catch(e => { console.error(e); process.exit(1); });
