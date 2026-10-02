/**
 * GUARDIAN KEYS ON PRIVATE TREES (the mend of 2026-10-02) — a READ-ONLY audit. Writes nothing.
 *
 *   node scripts/audit-guardian-keys.mjs
 *
 * Since 2026-10-01 a guardian link reads a private tree (rules canReadLifetree), and until the
 * "no key cut by the burglar" ring was deployed any signed-in hand could mint that link on any
 * tree. A guardian who stepped in while a tree was public also keeps the read after it is drawn
 * private. This lists every guardian link whose tree is PRIVATE today and says how it came to be:
 *
 *   anchor     — the tree's own anchor (the planter's first-guardian link; no new sight)
 *   invited    — an accepted tree-circle invitation stands behind it (the server minted it)
 *   uninvited  — neither: self-minted. The tree's keepers may release it from the circle
 *                (TreeCircle → Release), or leave it if the guardian is welcome.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || 'lifeseed-75dfe' });
const db = getFirestore();

const main = async () => {
  const links = await db.collection('links').where('rel', '==', 'guardian').get();
  const trees = new Map();
  const treeOf = async (id) => {
    if (!trees.has(id)) {
      const snap = await db.collection('lifetrees').doc(id).get();
      trees.set(id, snap.exists ? snap.data() : null);
    }
    return trees.get(id);
  };
  const rows = [];
  for (const l of links.docs) {
    const { from, to } = l.data();
    if (!from || !to) continue;
    const tree = await treeOf(String(to));
    if (!tree || tree.visibility !== 'private') continue;
    let how = 'uninvited';
    if (tree.anchorUid === from) how = 'anchor';
    else {
      const inv = await db.collection('treeKeepingInvites')
        .where('lifetreeId', '==', to).where('invitedUserId', '==', from).where('status', '==', 'accepted').limit(1).get();
      if (!inv.empty) how = 'invited';
    }
    const created = l.data().createdAt?.toDate?.()?.toISOString?.().slice(0, 10) || '—';
    rows.push({ how, tree: `${tree.name || '(unnamed)'} [${to}]`, kind: tree.treeType || 'LIFETREE', guardian: from, since: created });
  }
  rows.sort((a, b) => a.how.localeCompare(b.how) || a.tree.localeCompare(b.tree));
  console.log(`guardian links in all: ${links.size} · on private trees: ${rows.length}`);
  for (const r of rows) console.log(`  ${r.how.padEnd(9)}  ${r.tree}  (${r.kind})  ← ${r.guardian}  since ${r.since}`);
  const loose = rows.filter(r => r.how === 'uninvited').length;
  console.log(loose ? `\n${loose} uninvited key(s): each tree's keepers may release them from its circle.` : '\nNo uninvited keys on private trees.');
};

main().catch((e) => { console.error(e); process.exit(1); });
