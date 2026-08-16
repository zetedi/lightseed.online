#!/usr/bin/env node

/**
 * Heal the ghost blocks (ring 2026-08-17). careForTree used to advance a tree's head with
 * a hash while storing NO block — the timestamp died with the call, so the chain grew
 * GHOST links nobody could recompute, and end-to-end verification quietly died with them.
 *
 * The ghosts are RECOVERABLE WITH PROOF: each ghost's hash still stands in its successor's
 * previousHash (or the tree's latestHash), its content was exactly {care:true} (or
 * {tend:true} before the rename), its predecessor is one of the known hashes, and the lost
 * timestamp can be brute-forced: find ts such that
 *     sha256(JSON.stringify(content) + prevHash + ts) === ghostHash
 * If the bytes match the hash, they ARE the original — this is reconstruction, not forgery,
 * and each healed block carries `healedGhost: true` so the mend stays visible forever.
 *
 * Search window: bounded by the neighbouring blocks' createdAt (±10 minutes slack), the
 * tree's lastCaredAt when it's the head ghost, else its createdAt..now as a last resort.
 *
 *   node scripts/heal-ghost-blocks.mjs            # dry run: find + recover, write nothing
 *   node scripts/heal-ghost-blocks.mjs --apply    # store the healed blocks
 */
import { createHash, randomBytes } from 'node:crypto';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const apply = process.argv.includes('--apply');
initializeApp({ credential: applicationDefault(), projectId: 'lifeseed-75dfe' });
const db = getFirestore();

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
// Local uuidv7 mirror (the name-the-nameless precedent) — seeded from the recovered mint time.
const uuidv7 = (atMs) => {
  const b = randomBytes(10);
  const t = atMs.toString(16).padStart(12, '0');
  b[0] = (b[0] & 0x0f) | 0x70; b[2] = (b[2] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${t.slice(0, 8)}-${t.slice(8)}-${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 20)}`;
};

const CONTENTS = [JSON.stringify({ care: true }), JSON.stringify({ tend: true })];
const SENTINELS = new Set(['0', 'PERSON_REACH', 'DECISION', 'EVENT', 'OFFERING', 'COMMUNITY_EVENT', 'WATER_ALERT']);

// Brute the timestamp inside [fromMs, toMs] for any (content, prev) pair. ~1M+ hashes/s —
// so the CALLER must keep candidates few and windows tight, or the search runs for days.
const recover = (ghostHash, prevCandidates, fromMs, toMs) => {
  for (const content of CONTENTS) {
    for (const prev of prevCandidates) {
      const head = content + prev;
      for (let ts = fromMs; ts <= toMs; ts++) {
        if (sha256(head + ts) === ghostHash) return { content, prev, ts };
      }
    }
  }
  return null;
};

const trees = await db.collection('lifetrees').get();
let ghostsFound = 0, healed = 0, unrecovered = 0;

for (const treeDoc of trees.docs) {
  const tree = treeDoc.data();
  const pulses = await db.collection('pulses').where('lifetreeId', '==', treeDoc.id).get();
  const stored = new Map(pulses.docs.map((d) => [d.data().hash, d]));
  const knownHashes = new Set([...stored.keys(), tree.genesisHash].filter(Boolean));

  // Every hash the chain CLAIMS: the head, and every previousHash — minus what stands.
  const claims = new Map(); // ghostHash -> { successorCreatedMs | null }
  if (tree.latestHash && !knownHashes.has(tree.latestHash) && !SENTINELS.has(tree.latestHash)) {
    claims.set(tree.latestHash, { after: null, viaHead: true });
  }
  for (const d of pulses.docs) {
    const p = d.data();
    if (p.previousHash && !knownHashes.has(p.previousHash) && !SENTINELS.has(p.previousHash)) {
      claims.set(p.previousHash, { after: p.createdAt?.toMillis?.() || null, viaHead: false });
    }
  }
  if (claims.size === 0) continue;

  console.log(`\n${tree.name || treeDoc.id} (${treeDoc.id}): ${claims.size} ghost(s)`);
  ghostsFound += claims.size;

  // Recover iteratively: a healed ghost's hash becomes a prev-candidate for its siblings
  // (consecutive cares chained ghost→ghost). The search stays FEASIBLE by physics, not
  // hope: a care's prev is almost surely the block nearest below it in time (candidates
  // ordered by temporal closeness, capped at 6 + genesis), and its timestamp is near its
  // anchor (successor's birth, or lastCaredAt for the head ghost) — ±10min first, then
  // ±6h against only the 2 nearest candidates, then give up loudly.
  const blocksByTime = pulses.docs
    .map((d) => ({ hash: d.data().hash, ms: d.data().createdAt?.toMillis?.() || 0 }))
    .filter((b) => b.hash);
  const candidatesNear = (anchorMs, n) => {
    const ranked = [...blocksByTime].sort((a, b) => Math.abs(a.ms - anchorMs) - Math.abs(b.ms - anchorMs));
    const picks = ranked.slice(0, n).map((b) => b.hash);
    if (tree.genesisHash) picks.push(tree.genesisHash);
    for (const h of knownHashes) if (picks.length < n + 2 && !picks.includes(h)) picks.push(h);
    return [...new Set(picks)];
  };
  let progress = true;
  while (progress && claims.size > 0) {
    progress = false;
    for (const [ghost, meta] of [...claims.entries()]) {
      const anchorMs = meta.after
        || tree.lastCaredAt?.toMillis?.()
        || tree.updatedAt?.toMillis?.()
        || Date.now();
      let found = recover(ghost, candidatesNear(anchorMs, 6), Math.round(anchorMs - 600e3), Math.round(anchorMs + 600e3));
      if (!found) found = recover(ghost, candidatesNear(anchorMs, 2), Math.round(anchorMs - 21600e3), Math.round(anchorMs + 21600e3));
      if (!found) continue;
      const when = new Date(found.ts).toISOString();
      console.log(`  ${apply ? 'healing' : 'would heal'} ${ghost.slice(0, 12)}…  content=${found.content}  prev=${found.prev.slice(0, 12)}…  ts=${when}  ✓ hash-proof`);
      if (apply) {
        await db.collection('pulses').add({
          lid: uuidv7(found.ts),
          lifetreeId: treeDoc.id,
          type: 'tree_growth',
          care: true,
          title: 'Care',
          body: '',
          visibility: 'public',
          authorId: tree.ownerId || null,
          domain: tree.domain || '',
          mintedAt: found.ts,
          previousHash: found.prev,
          hash: ghost,
          healedGhost: true, // the mend stays visible forever — reconstruction, not forgery
          createdAt: Timestamp.fromMillis(found.ts),
        });
      }
      knownHashes.add(ghost);
      claims.delete(ghost);
      healed++;
      progress = true;
    }
  }
  for (const ghost of claims.keys()) {
    console.log(`  UNRECOVERED ${ghost.slice(0, 12)}… — no (content, prev, ts) matched; widen the window or accept the scar.`);
    unrecovered++;
  }
}

console.log(`\n${ghostsFound} ghost(s) found · ${healed} ${apply ? 'healed' : 'recoverable (dry run)'} · ${unrecovered} unrecovered.`);
if (!apply && healed > 0) console.log('Run with --apply to store the healed blocks.');
