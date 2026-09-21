#!/usr/bin/env node
/**
 * THE VISION BECOMES THE FIRST PAPER (ring 2026-09-21). A community's words are PAPERS now —
 * an ordered list of chapters on the record, the vision first (domain/papers) — and the old
 * `vision` field is retired, not read through: no legacy. Two hands, run in this order:
 *
 *   node scripts/move-vision-to-papers.mjs            # dry run: who carries a vision, what would move
 *   node scripts/move-vision-to-papers.mjs --apply    # write papers[0] = the vision (kept if papers already lead with one)
 *   … deploy the code that reads papers only …
 *   node scripts/move-vision-to-papers.mjs --retire   # delete the old `vision` field everywhere
 *
 * Idempotent: a community whose papers already open with a vision is left alone by --apply;
 * --retire deletes only where the field still exists. Witnessed by count: the run prints every
 * community it touches. Runs with the machine's application-default credentials.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const apply = process.argv.includes('--apply');
const retire = process.argv.includes('--retire');
initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || 'lifeseed-75dfe' });
const db = getFirestore();

const snap = await db.collection('communities').get();
let moved = 0, kept = 0, retired = 0, bare = 0;
for (const d of snap.docs) {
  const c = d.data();
  const vision = typeof c.vision === 'string' ? c.vision : '';
  const papers = Array.isArray(c.papers) ? c.papers : [];
  const hasVisionPaper = papers.some((p) => p && p.key === 'vision');
  const label = `${d.id.padEnd(22)} ${String(c.name || '').padEnd(24)}`;
  if (retire) {
    if ('vision' in c) {
      // An EMPTY field has nothing to lose; a field with words goes only once a vision paper stands.
      const safe = hasVisionPaper || !vision.trim();
      console.log(`${label} retire vision (${vision.length} chars)${safe ? '' : '  ! no vision paper stands — refusing'}`);
      if (safe) { await d.ref.update({ vision: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }); retired++; }
    }
    continue;
  }
  if (hasVisionPaper) { kept++; console.log(`${label} = papers already open with the vision`); continue; }
  if (!vision.trim()) { bare++; console.log(`${label} · no vision to move`); continue; }
  console.log(`${label} → papers[0] = vision (${vision.length} chars)`);
  if (apply) { await d.ref.update({ papers: [{ key: 'vision', title: '', html: vision }, ...papers], updatedAt: FieldValue.serverTimestamp() }); moved++; }
}
if (retire) console.log(`\n${retired} vision field(s) retired.`);
else console.log(`\n${apply ? 'Moved' : 'DRY RUN: would move'} ${apply ? moved : snap.docs.filter(d => { const c=d.data(); return typeof c.vision==='string' && c.vision.trim() && !(Array.isArray(c.papers) && c.papers.some(p=>p&&p.key==='vision')); }).length} vision(s); ${kept} already papers; ${bare} bare.${apply ? '' : ' Re-run with --apply.'}`);
