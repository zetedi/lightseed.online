#!/usr/bin/env node

/**
 * Staff unwind (2026-08-15): take back the top N blocks of a tree's chain, head first, each
 * with its head rollback — the chain only ever shortens from the top, never severs. The
 * staff twin of the user-side unmint (domain/unmint), for founding-era test blocks that are
 * already CO-HELD (seen/loved) and therefore rightly refused to the user's own hand.
 *
 * Witnesses are CHECKED (the rehome-events pattern): the walk follows hash → previousHash
 * links and aborts before writing if any link disagrees, if the head is a ghost (a hash no
 * stored block carries — the careForTree debt), or if a block is a guardian-witnessed
 * watering (its light is minted; this script NEVER takes those, staff or not).
 *
 *   node scripts/unwind-head-blocks.mjs --tree <treeId> --count N          # dry run
 *   node scripts/unwind-head-blocks.mjs --tree <treeId> --count N --apply
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const apply = process.argv.includes('--apply');
const treeId = arg('tree');
const count = Number(arg('count', '0'));
if (!treeId || !Number.isInteger(count) || count < 1) {
  console.error('Usage: node scripts/unwind-head-blocks.mjs --tree <treeId> --count N [--apply]');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: 'lifeseed-75dfe' });
const db = getFirestore();

const treeRef = db.collection('lifetrees').doc(treeId);
const treeSnap = await treeRef.get();
if (!treeSnap.exists) { console.error(`No tree at lifetrees/${treeId}.`); process.exit(1); }
const tree = treeSnap.data();
console.log(`Tree: ${tree.name || treeId} · head ${String(tree.latestHash).slice(0, 10)}… · height ${tree.blockHeight}\n`);

// Walk the chain from the head, binding every witness before anything is written.
const toUnwind = [];
let cursorHash = tree.latestHash;
for (let i = 0; i < count; i++) {
  const q = await db.collection('pulses')
    .where('lifetreeId', '==', treeId).where('hash', '==', cursorHash).limit(2).get();
  if (q.empty) {
    console.error(`ABORTED at step ${i + 1}: no stored block carries hash ${String(cursorHash).slice(0, 12)}… ` +
      (i === 0 ? '(a ghost head — the careForTree debt; nothing was written)' : '(chain gap; nothing was written)'));
    process.exit(1);
  }
  if (q.size > 1) { console.error(`ABORTED: two blocks share hash ${String(cursorHash).slice(0, 12)}…; nothing was written.`); process.exit(1); }
  const doc = q.docs[0];
  const p = doc.data();
  if (p.wateringConfirmedBy === 'guardian') {
    console.error(`ABORTED at step ${i + 1}: ${doc.id} is a guardian-witnessed watering — its light stands; nothing was written.`);
    process.exit(1);
  }
  const seen = (p.seenBy || []).filter((u) => u !== p.authorId);
  toUnwind.push({ ref: doc.ref, id: doc.id, title: p.title || p.type, type: p.type, hash: p.hash, prev: p.previousHash,
    coheld: seen.length ? `seen by ${seen.length}` : (p.loveCount ? `loved ×${p.loveCount}` : '') });
  cursorHash = p.previousHash;
}

for (const [i, b] of toUnwind.entries()) {
  console.log(`${apply ? 'unwinding' : 'would unwind'} ${String(i + 1).padStart(2)}. ${b.type.padEnd(12)} ${String(b.title).slice(0, 40).padEnd(42)} ${b.hash.slice(0, 10)}… ${b.coheld ? `[${b.coheld}]` : ''}`);
}
console.log(`\nHead would come to rest at ${String(cursorHash).slice(0, 12)}… · height ${tree.blockHeight - toUnwind.length}`);

if (apply) {
  // One transaction per link, newest first — each delete rides with its own head rollback,
  // so an interruption at any point leaves a whole, shorter chain, never a severed one.
  for (const b of toUnwind) {
    await db.runTransaction(async (tx) => {
      const t = (await tx.get(treeRef)).data();
      if (t.latestHash !== b.hash) throw new Error(`head moved (${String(t.latestHash).slice(0, 10)}… ≠ ${b.hash.slice(0, 10)}…) — stopping.`);
      tx.delete(b.ref);
      tx.update(treeRef, { latestHash: b.prev, blockHeight: (t.blockHeight || 1) - 1, updatedAt: FieldValue.serverTimestamp() });
    });
    console.log(`unwound ${b.id}`);
  }
  console.log(`\n${toUnwind.length} block(s) taken back. The chain is whole.`);
} else {
  console.log('\nDry run. Nothing was written — run with --apply to unwind.');
}
