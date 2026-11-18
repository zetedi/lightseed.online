#!/usr/bin/env node
// retire-vision-tree-field — step 5 of the ground (ring 2026-11-18): the old field leaves the records.
//   node scripts/retire-vision-tree-field.mjs [--project <id>] [--receipt <file>]            the dry run
//   node scripts/retire-vision-tree-field.mjs --project <id> --apply [--receipt <file>]      the retiring
// Every reader now finds a vision's tree through its grounds (`grounded_in` links), so
// `vision.lifetreeId` says nothing the link does not. WITHOUT --apply IT WRITES NOTHING. WITH it,
// the field is removed ONLY from a vision whose ground in that very tree stands (the shared plan,
// src/domain/groundMigration.ts planFieldRetirement); a vision carrying the field with no such
// ground KEEPS it and is listed, for a human to decide. Each removal is its own transaction and
// re-proves both facts at that moment. Nothing else of a vision is touched; the receipt records
// every (vision, tree) pair removed, so the step can be undone by hand.
// RUN ONLY AFTER the shell that no longer reads the field is deployed: older shells still do.
// The independent node's twin is the keeper's repair `vision_tree_field` (migration 068).
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { planFieldRetirement } from '../seed/generated/chain.mjs';
import { openOrigin, readGroundFacts } from './vision-ground-facts.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const valued = ['--project', '--receipt'];
const apply = args.includes('--apply');
if (args.some(a => a.startsWith('--') && ![...valued, '--apply'].includes(a)) || args.some((a, i) => !a.startsWith('--') && !valued.includes(args[i - 1]))
  || (apply && !option('--project'))) {
  console.error('Usage: node scripts/retire-vision-tree-field.mjs [--project <id>] [--receipt <file>]   (dry run)\n       node scripts/retire-vision-tree-field.mjs --project <id> --apply [--receipt <file>]');
  process.exit(1);
}
const { db, projectId, FieldValue } = await openOrigin(option('--project'));
const { visions, standing, treeName, visionTitle } = await readGroundFacts(db);
const plan = planFieldRetirement(visions, standing);
const names = act => ({ ...act, visionTitle: visionTitle.get(act.visionId) ?? '', treeName: treeName.get(act.treeId) ?? '' });

console.log(`${apply ? 'THE RETIRING' : 'DRY RUN — nothing is written'}. Project ${projectId}.`);
console.log(`Visions read: ${visions.length}. Field to remove (the ground stands): ${plan.retire.length}. Field kept (no ground in that tree): ${plan.keep.length}.`);
for (const act of plan.keep) console.log(`  kept: "${(visionTitle.get(act.visionId) ?? '').slice(0, 40)}" (${act.visionId}) still names "${(treeName.get(act.treeId) ?? act.treeId).slice(0, 40)}"`);

const retire = act => db.runTransaction(async t => {
  const [visionSnap, groundSnap] = await Promise.all([t.get(db.doc(`visions/${act.visionId}`)), t.get(db.doc(`links/${act.visionId}__grounded_in__${act.treeId}`))]);
  if (!visionSnap.exists) return 'the vision is gone';
  if (!groundSnap.exists) return 'the ground no longer stands';
  if (visionSnap.data().lifetreeId !== act.treeId) return 'the field changed';
  t.update(visionSnap.ref, { lifetreeId: FieldValue.delete() });
  return null;
});

const receipt = { projectId, applied: apply, at: new Date().toISOString(), retired: [], kept: plan.keep.map(names), skipped: [] };
if (apply) {
  for (const act of plan.retire) {
    const why = await retire(act);
    if (why) { receipt.skipped.push({ ...names(act), why }); console.log(`  skipped ${act.visionId}: ${why}`); } else receipt.retired.push(names(act));
  }
  console.log(`Field removed: ${receipt.retired.length}. Skipped: ${receipt.skipped.length}.`);
} else { receipt.retired = plan.retire.map(names); console.log('Nothing was written. To carry it out: add --project <id> --apply.'); }
const out = option('--receipt');
if (out) { writeFileSync(resolve(out), JSON.stringify(receipt, null, 2)); console.log(`Receipt saved to ${resolve(out)}`); }
