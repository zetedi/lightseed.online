#!/usr/bin/env node

/**
 * Landing sections, authored from here (ring 2026-08-16): compositions are DATA — this
 * script writes a community's landingSections (and optionally flips its portal flags)
 * from a JSON file crafted in-session. The COMPONENTS live in the repo behind the gate;
 * nothing executable ever travels through this script.
 *
 * Witnessed (the house pattern): the community's NAME must match --expect-name or nothing
 * is written; kinds are checked against the registered set (keep in step with
 * src/domain/appearance.ts SECTION_KINDS — the app-side law is the source of truth and
 * drops junk on read regardless, so drift here fails loud, not silent).
 *
 *   node scripts/set-landing-sections.mjs --community <id> --expect-name "The O House" \
 *        --file sections.json [--strict-scope] [--custom-landing] [--apply]
 */
import { readFileSync } from 'node:fs';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const SECTION_KINDS = ['hearth_hero']; // mirror of src/domain/appearance.ts — never-drift comment

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : null; };
const has = (name) => process.argv.includes(`--${name}`);
const apply = has('apply');
const communityId = arg('community');
const expectName = arg('expect-name');
const file = arg('file');
if (!communityId || !expectName || !file) {
  console.error('Usage: node scripts/set-landing-sections.mjs --community <id> --expect-name "<name>" --file <json> [--strict-scope] [--custom-landing] [--apply]');
  process.exit(1);
}

const sections = JSON.parse(readFileSync(file, 'utf8'));
if (!Array.isArray(sections)) { console.error('ABORTED: the file must hold an array of sections.'); process.exit(1); }
for (const s of sections) {
  if (!SECTION_KINDS.includes(s.kind)) { console.error(`ABORTED: unknown section kind '${s.kind}' — register it in the app first.`); process.exit(1); }
}

initializeApp({ credential: applicationDefault(), projectId: 'lifeseed-75dfe' });
const db = getFirestore();
const ref = db.collection('communities').doc(communityId);
const snap = await ref.get();
if (!snap.exists) { console.error(`ABORTED: no community at ${communityId}.`); process.exit(1); }
const c = snap.data();
if (c.name !== expectName) { console.error(`ABORTED: community is named '${c.name}', expected '${expectName}' — nothing written.`); process.exit(1); }

const update = { landingSections: sections, updatedAt: FieldValue.serverTimestamp() };
if (has('strict-scope')) update.strictScope = true;
if (has('custom-landing')) update.customLanding = true;

console.log(`${apply ? 'writing' : 'would write'} to '${c.name}' (${communityId}) at ${c.domain || '(no domain)'}:`);
console.log(`  landingSections: ${sections.length} section(s): ${sections.map(s => s.kind).join(', ')}`);
if (update.strictScope) console.log('  strictScope: true (a place that shows only itself)');
if (update.customLanding) console.log('  customLanding: true (the landing answers this domain)');

if (apply) { await ref.update(update); console.log('\nDone. The landing composes itself from the database.'); }
else console.log('\nDry run. Nothing was written — run with --apply to compose.');
