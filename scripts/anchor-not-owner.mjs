/**
 * THE ANCHOR, NOT THE OWNER (ring 2026-09-30) — the last "owner" leaves the data.
 *
 *   node scripts/anchor-not-owner.mjs                 # dry run: counts
 *   node scripts/anchor-not-owner.mjs --write         # pass 1: write the new field BESIDE the old
 *   node scripts/anchor-not-owner.mjs --strip         # pass 2: after the code is deployed, remove the old
 *
 * The kept beings — lifetrees, communities, lightHouses — carry `anchorUid` (the one seat that is
 * never empty; who planted or founded is the history's). The made things — intelligences,
 * memories — carry `authorId`, the word visions and pulses already use. Two aliases retire:
 * communities.founderUserId and intelligences.credentialOwnerId (→ credentialHolderUid), and the
 * server-only providerCredentials rows rename ownerId → holderId.
 *
 * Order: --write, then deploy indexes → rules → functions → hosting, then --strip. Between --write
 * and the deploy the data carries both names and nothing in code reads the old as legacy; the
 * --strip pass first adds the new field to anything born in between, then strips. Idempotent.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const write = process.argv.includes('--write');
const strip = process.argv.includes('--strip');
initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || 'lifeseed-75dfe' });
const db = getFirestore();

// collection → [old field, new field, extra renames]
const MOVES = [
  ['lifetrees', 'ownerId', 'anchorUid', {}],
  ['communities', 'ownerId', 'anchorUid', { founderUserId: null }],
  ['lightHouses', 'ownerId', 'anchorUid', {}],
  ['intelligences', 'ownerId', 'authorId', { credentialOwnerId: 'credentialHolderUid' }],
  ['memories', 'ownerId', 'authorId', {}],
  ['providerCredentials', 'ownerId', 'holderId', {}],
];

const main = async () => {
  let wrote = 0, stripped = 0, pending = 0;
  for (const [coll, oldField, newField, extra] of MOVES) {
    const snap = await db.collection(coll).get();
    for (const d of snap.docs) {
      const x = d.data();
      const hasOld = x[oldField] !== undefined;
      const hasNew = x[newField] !== undefined;
      const extraPending = Object.entries(extra).some(([from, to]) => x[from] !== undefined && (to === null || x[to] === undefined));
      if (!hasOld && !extraPending) continue;
      const patch = {};
      if (hasOld && !hasNew) patch[newField] = x[oldField];
      for (const [from, to] of Object.entries(extra)) {
        if (x[from] !== undefined && to && x[to] === undefined) patch[to] = x[from];
      }
      const stripPatch = {};
      if (hasOld) stripPatch[oldField] = FieldValue.delete();
      for (const from of Object.keys(extra)) if (x[from] !== undefined) stripPatch[from] = FieldValue.delete();
      const what = `${coll}/${d.id}: ${Object.keys(patch).length ? 'write ' + Object.keys(patch).join(',') : ''}${strip ? ' strip ' + Object.keys(stripPatch).join(',') : ''}`.trim();
      console.log('  ' + what);
      if (write || strip) {
        if (Object.keys(patch).length) { await d.ref.update(patch); wrote++; }
        if (strip && Object.keys(stripPatch).length) { await d.ref.update(stripPatch); stripped++; }
      } else pending++;
    }
  }
  console.log(`\n${write || strip ? `wrote ${wrote}, stripped ${stripped}` : `WOULD TOUCH ${pending} documents`}`);
};
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
