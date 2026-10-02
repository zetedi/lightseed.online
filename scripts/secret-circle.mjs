/**
 * THE SECRET CIRCLE (ring 2026-10-02) — a secret tree's keeper seats leave the world-readable LIN.
 *
 *   node scripts/secret-circle.mjs            # dry run: what would move
 *   node scripts/secret-circle.mjs --write    # move: each seat is written into `secretLinks`
 *                                             # (same id, same data, its birth time kept) and
 *                                             # deleted from `links`, one atomic batch per seat
 *
 * ORDER: deploy rules → functions → hosting FIRST. They honour BOTH ledgers (the rules'
 * isTreeKeeper, the server's standing checks, the shell's loaders), so nothing breaks before the
 * move and nothing breaks after it. Moving before the deploy would lock a secret tree's keepers
 * out until the deploy lands. Idempotent: a second run finds nothing left to move.
 *
 * Only `keeper` seats move — a secret tree's only seat is keeping. Any other link pointing at a
 * secret tree is reported and left where it is, for a human eye.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const write = process.argv.includes('--write');
initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || 'lifeseed-75dfe' });
const db = getFirestore();

const main = async () => {
  const secrets = await db.collection('lifetrees').where('treeType', '==', 'SECRET').get();
  let moved = 0, pending = 0, already = 0, other = 0;
  for (const tree of secrets.docs) {
    const [open, secret] = await Promise.all([
      db.collection('links').where('to', '==', tree.id).get(),
      db.collection('secretLinks').where('to', '==', tree.id).get(),
    ]);
    already += secret.size;
    console.log(`${tree.data().name || '(unnamed)'} [${tree.id}] — open links: ${open.size}, secret seats: ${secret.size}`);
    for (const l of open.docs) {
      const x = l.data();
      if (x.rel !== 'keeper') { other++; console.log(`  left in place: ${l.id} (rel ${x.rel})`); continue; }
      if (!write) { pending++; console.log(`  would move: ${l.id}`); continue; }
      const batch = db.batch();
      batch.set(db.collection('secretLinks').doc(l.id), x);
      batch.delete(l.ref);
      await batch.commit();
      moved++;
      console.log(`  moved: ${l.id}`);
    }
  }
  console.log(`\nsecret trees: ${secrets.size} · seats already secret: ${already} · ${write ? `moved: ${moved}` : `to move: ${pending}`} · other links left in place: ${other}`);
  if (!write && pending) console.log('Dry run. Deploy rules → functions → hosting, then run with --write.');
};

main().catch((e) => { console.error(e); process.exit(1); });
