#!/usr/bin/env node
// plan-vision-grounds — step 4 of the ground (ring 2026-11-17): the DRY RUN, and only the dry run.
//   node scripts/plan-vision-grounds.mjs [--project <id>] [--rows] [--json <file>]
// Reads the origin's visions, trees and links ONCE, read-only, and asks the shared plan
// (src/domain/groundMigration.ts) what carrying every old `vision.lifetreeId` across to a
// `grounded_in` link would do: which visions would be grounded (and which is each tree's Root
// Vision), which need the tree's yes, which the law refuses today and why, which name a tree
// that is gone. It WRITES NOTHING to the database and has no --apply: the apply is a separate
// script (scripts/apply-vision-grounds.mjs), run only on the guardian's word after this report has been read.
//   --rows   also print one line per vision that carries the field
//   --json   also save the whole plan (ids, verdicts, names) to a file of your choosing
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { planGroundMigration } from '../seed/generated/chain.mjs';
import { openOrigin, readGroundFacts } from './vision-ground-facts.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const valued = ['--project', '--json'];
if (args.some(a => a.startsWith('--') && ![...valued, '--rows'].includes(a)) || args.some((a, i) => !a.startsWith('--') && !valued.includes(args[i - 1]))) {
  console.error('Usage: node scripts/plan-vision-grounds.mjs [--project <id>] [--rows] [--json <file>]');
  process.exit(1);
}
const { db, projectId } = await openOrigin(option('--project'));
const { visions, trees, standing, treeName, visionTitle } = await readGroundFacts(db);

const plan = planGroundMigration(visions, trees, standing);
const c = plan.counts;
console.log(`DRY RUN — nothing was written. Project ${projectId}.`);
console.log(`Visions read: ${c.visions} (${c.withoutField} carry no tree field and are left alone). Trees read: ${trees.length}. Grounds already standing: ${standing.length}.`);
console.log(`Of the ${plan.rows.length} visions that name a tree:`);
console.log(`  would be grounded ............ ${c.ground}   (of these, ${c.births} are a tree's Root Vision: a birth ground)`);
console.log(`  need the tree's yes .......... ${c.needs_yes}   (the author is no keeper or steward of that tree)`);
console.log(`  refused by the law today ..... ${c.refused}   (they keep the old field)`);
for (const [key, n] of Object.entries(plan.refusals)) console.log(`      ${key}: ${n}`);
console.log(`  name a tree that is gone ..... ${c.tree_gone}`);
console.log(`  tree already full (12) ....... ${c.tree_full}`);
console.log(`  already grounded ............. ${c.already}`);
const named = plan.rows.map(r => ({ ...r, visionTitle: visionTitle.get(r.visionId) ?? '', treeName: treeName.get(r.treeId) ?? '' }));
if (args.includes('--rows')) {
  console.log('');
  for (const r of named) console.log(`${r.verdict.padEnd(10)} ${r.birth ? 'birth' : '     '} ${r.refusal ? r.refusal.padEnd(22) : ''.padEnd(22)} "${r.visionTitle.slice(0, 40)}" → "${r.treeName.slice(0, 40)}"`);
}
const out = option('--json');
if (out) { writeFileSync(resolve(out), JSON.stringify({ projectId, counts: plan.counts, refusals: plan.refusals, rows: named }, null, 2)); console.log(`\nPlan saved to ${resolve(out)}`); }
