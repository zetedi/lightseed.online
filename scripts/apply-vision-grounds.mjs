#!/usr/bin/env node
// apply-vision-grounds — step 4b of the ground (ring 2026-11-18): the old tie becomes a ground.
//   node scripts/apply-vision-grounds.mjs [--project <id>] [--receipt <file>]            the dry run
//   node scripts/apply-vision-grounds.mjs --project <id> --apply [--receipt <file>]      the crossing
// WITHOUT --apply IT WRITES NOTHING: it reads the origin once, asks the shared plan
// (src/domain/groundMigration.ts) and lists the acts it would take. WITH --apply (which must name
// its project in so many words) it carries out exactly those acts, as the keeper decided them on
// 2026-11-18, and nothing else:
//   - a GROUND for every vision whose own author cares for the tree its field names: the link
//     `visionId__grounded_in__treeId`, marked `self` and `migrated` (and `birth` for the tree's
//     Root Vision). LINKS ALONE — no block is written on either chain: these grounds were never
//     asked and answered, and a block saying they were would overstate what happened.
//   - the FIELD CLEARED on every vision that names a tree that is gone: it stands on its own,
//     seeking ground. Nothing else of the vision is touched.
//   - a grounded vision KEEPS its `lifetreeId` until every reader has moved to the link (step 5).
//   - whatever needs another being's yes, or the law refuses, is left exactly as it is.
// Every act is its own transaction and RE-PROVES what the plan believed against the records as
// they are at that moment (the same shared plan, asked of that one vision and tree); what no
// longer agrees is skipped and said. Idempotent: run twice, the second run finds nothing to do.
// The independent node's twin is the keeper's repair `vision_grounds` with `apply` (migration 067).
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { planGroundMigration, groundMigrationActs, migratedGroundFields } from '../seed/generated/chain.mjs';
import { uuidv7 } from '../src/domain/uuidv7.mjs';
import { openOrigin, readGroundFacts, treeFactsOf, visionFactsOf } from './vision-ground-facts.mjs';

const MAX_GROUNDS_PER_VISION = 12;   // domain/grounding; the tree's twelve is the plan's own
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const valued = ['--project', '--receipt'];
const apply = args.includes('--apply');
if (args.some(a => a.startsWith('--') && ![...valued, '--apply'].includes(a)) || args.some((a, i) => !a.startsWith('--') && !valued.includes(args[i - 1]))
  || (apply && !option('--project'))) {
  console.error('Usage: node scripts/apply-vision-grounds.mjs [--project <id>] [--receipt <file>]   (dry run)\n       node scripts/apply-vision-grounds.mjs --project <id> --apply [--receipt <file>]');
  process.exit(1);
}
const { db, projectId, FieldValue } = await openOrigin(option('--project'));
const { visions, trees, standing, treeName, visionTitle } = await readGroundFacts(db);
const plan = planGroundMigration(visions, trees, standing);
const acts = groundMigrationActs(plan);
const say = act => `"${(visionTitle.get(act.visionId) ?? '').slice(0, 40)}" (${act.visionId})`;

console.log(`${apply ? 'THE CROSSING' : 'DRY RUN — nothing is written'}. Project ${projectId}.`);
console.log(`Visions read: ${plan.counts.visions}. Grounds to write: ${acts.grounds.length} (${acts.grounds.filter(a => a.birth).length} birth grounds). Fields to clear: ${acts.cleared.length}.`);
console.log(`Left as they are: ${plan.counts.needs_yes} needing a yes, ${plan.counts.refused} refused by the law, ${plan.counts.tree_full} at a full tree, ${plan.counts.already} already grounded, ${plan.counts.withoutField} without the field.`);

const linkRef = (visionId, rel, treeId) => db.doc(`links/${visionId}__${rel}__${treeId}`);
const linksOf = (end, id) => db.collection('links').where(end, '==', id).where('rel', '==', 'grounded_in');

// One ground. Everything the plan believed is read again inside the transaction and put to the
// same shared plan, so a record that changed since the first reading is skipped, never forced.
const ground = act => db.runTransaction(async t => {
  const [visionSnap, treeSnap, groundSnap, askSnap] = await Promise.all([
    t.get(db.doc(`visions/${act.visionId}`)), t.get(db.doc(`lifetrees/${act.treeId}`)),
    t.get(linkRef(act.visionId, 'grounded_in', act.treeId)), t.get(linkRef(act.visionId, 'ground_request', act.treeId)),
  ]);
  if (!visionSnap.exists || !treeSnap.exists) return 'a record is gone';
  if (groundSnap.exists) return 'already grounded';
  const vision = visionFactsOf(act.visionId, visionSnap.data());
  if (vision.lifetreeId !== act.treeId) return 'the field changed';
  if (!vision.authorId) return 'no author';
  const [keeper, steward, visionGrounds, treeGrounds] = await Promise.all([
    t.get(db.doc(`links/${vision.authorId}__keeper__${act.treeId}`)), t.get(db.doc(`links/${vision.authorId}__steward__${act.treeId}`)),
    t.get(linksOf('from', act.visionId)), t.get(linksOf('to', act.treeId)),
  ]);
  const tree = treeFactsOf(act.treeId, treeSnap.data(), keeper.exists || steward.exists ? [vision.authorId] : []);
  const row = planGroundMigration([vision], [tree], treeGrounds.docs.map(d => ({ visionId: String(d.data().from ?? ''), treeId: act.treeId }))).rows[0];
  if (row?.verdict !== 'ground') return `the law now says ${row?.refusal ?? row?.verdict ?? 'nothing'}`;
  if (visionGrounds.size >= MAX_GROUNDS_PER_VISION) return 'the vision already stands in twelve';
  // A tree is born once: the birth mark only for its anchor's own vision, and only where none stands.
  if (act.birth && (tree.anchorUid !== vision.authorId || treeGrounds.docs.some(d => d.data().birth === true))) return 'the tree already has its birth ground';
  t.set(linkRef(act.visionId, 'grounded_in', act.treeId), {
    lid: uuidv7(Date.now()), type: 'link', rel: 'grounded_in', from: act.visionId, to: act.treeId,
    ...migratedGroundFields(vision.authorId, act.birth), createdAt: FieldValue.serverTimestamp(),
  });
  if (askSnap.exists) t.delete(askSnap.ref);   // a standing knock is answered by the ground
  return null;
});

// One orphan set free: only while the field still names that tree and the tree is still gone.
const clear = act => db.runTransaction(async t => {
  const [visionSnap, treeSnap] = await Promise.all([t.get(db.doc(`visions/${act.visionId}`)), t.get(db.doc(`lifetrees/${act.treeId}`))]);
  if (!visionSnap.exists) return 'the vision is gone';
  if (treeSnap.exists) return 'the tree is back';
  if (visionSnap.data().lifetreeId !== act.treeId) return 'the field changed';
  t.update(visionSnap.ref, { lifetreeId: FieldValue.delete() });
  return null;
});

const receipt = { projectId, applied: apply, at: new Date().toISOString(), counts: plan.counts, grounded: [], cleared: [], skipped: [] };
const names = act => ({ ...act, visionTitle: visionTitle.get(act.visionId) ?? '', treeName: treeName.get(act.treeId) ?? '' });
for (const [kind, list, hand] of [['ground', acts.grounds, ground], ['clear', acts.cleared, clear]]) {
  for (const act of list) {
    if (!apply) { console.log(`  would ${kind === 'ground' ? `ground${act.birth ? ' (birth)' : ''}` : 'clear the field of'} ${say(act)}${kind === 'ground' ? ` in "${(treeName.get(act.treeId) ?? '').slice(0, 40)}"` : ''}`); continue; }
    const why = await hand(act);
    if (why) { receipt.skipped.push({ kind, ...names(act), why }); console.log(`  skipped ${say(act)}: ${why}`); }
    else receipt[kind === 'ground' ? 'grounded' : 'cleared'].push(names(act));
  }
}
if (apply) console.log(`Grounded: ${receipt.grounded.length}. Fields cleared: ${receipt.cleared.length}. Skipped: ${receipt.skipped.length}.`);
else { receipt.grounded = acts.grounds.map(names); receipt.cleared = acts.cleared.map(names); console.log('Nothing was written. To carry it out: add --project <id> --apply.'); }
const out = option('--receipt');
if (out) { writeFileSync(resolve(out), JSON.stringify(receipt, null, 2)); console.log(`Receipt saved to ${resolve(out)}`); }
