/**
 * A TREE IS KEPT, NOT OWNED (ring 2026-09-29) — the data follows the words, without a legacy:
 *
 *   node scripts/keepers-not-owners.mjs            # dry run: counts what would move
 *   node scripts/keepers-not-owners.mjs --apply    # move it
 *
 * Three moves, each idempotent (a second --apply finds nothing left to move):
 *   1. links   rel 'co_owner'  → 'keeper'   — the SAME being (its lid travels), at its new
 *                                              deterministic id (from__keeper__to); the old doc
 *                                              is deleted; `renamedFrom: 'co_owner'` marks the move.
 *   2. treeOwnershipInvites    → treeKeepingInvites — every document copied verbatim (its id kept),
 *                                              role 'co_owner' → 'keeper'; the old collection emptied.
 *   3. communities.formation 'tree_co_ownership' → 'tree_keeping'.
 *
 * Deploy the code that reads the new words FIRST (rules, functions, hosting), then run this at
 * once: between the two, a keeper by link is unread for the minutes it takes — no data is lost.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const apply = process.argv.includes('--apply');
initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || 'lifeseed-75dfe' });
const db = getFirestore();

const main = async () => {
  // 1. the rel
  const links = await db.collection('links').where('rel', '==', 'co_owner').get();
  let linksMoved = 0;
  for (const d of links.docs) {
    const x = d.data();
    const from = String(x.from || ''); const to = String(x.to || '');
    if (!from || !to) { console.warn(`  ! link ${d.id} has no from/to — left alone`); continue; }
    const newId = `${from}__keeper__${to}`;
    console.log(`  link ${d.id} → ${newId}`);
    if (apply) {
      const batch = db.batch();
      batch.set(db.collection('links').doc(newId), { ...x, rel: 'keeper', renamedFrom: 'co_owner', renamedAt: FieldValue.serverTimestamp() }, { merge: true });
      batch.delete(d.ref);
      await batch.commit();
    }
    linksMoved++;
  }
  // 2. the invitations
  const invites = await db.collection('treeOwnershipInvites').get();
  let invitesMoved = 0;
  for (const d of invites.docs) {
    const x = d.data();
    const role = x.role === 'co_owner' ? 'keeper' : x.role;
    console.log(`  invite ${d.id} (${x.role} → ${role})`);
    if (apply) {
      const batch = db.batch();
      batch.set(db.collection('treeKeepingInvites').doc(d.id), { ...x, role, ...(x.role === 'co_owner' ? { renamedFrom: 'co_owner' } : {}) });
      batch.delete(d.ref);
      await batch.commit();
    }
    invitesMoved++;
  }
  // 3. the formation token
  const circles = await db.collection('communities').where('formation', '==', 'tree_co_ownership').get();
  let circlesMoved = 0;
  for (const d of circles.docs) {
    console.log(`  circle ${d.id} (${d.data().name || ''}) formation → tree_keeping`);
    if (apply) await d.ref.update({ formation: 'tree_keeping', updatedAt: FieldValue.serverTimestamp() });
    circlesMoved++;
  }
  console.log(`\n${apply ? 'MOVED' : 'WOULD MOVE'}: ${linksMoved} links, ${invitesMoved} invitations, ${circlesMoved} circles${apply ? '' : ' — run with --apply to move them'}`);
};

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
