#!/usr/bin/env node

/**
 * Data mend (2026-08-11): re-home the founding-era events. Events are stamped at birth with
 * `domain: window.location.hostname`, so six of the first nine were born in `localhost` — a
 * place that does not exist — and one ("The O House") was stamped lightseed.online though its
 * content is Per Auset. This sets each event's `domain` to its true place, named by Zoltán.
 *
 * The witnesses are CHECKED, not decorative (Lumo's review, 2026-08-11): each move binds
 * doc id + expected title + expected current domain, and the whole run aborts before writing
 * if any live record disagrees — a mistyped id or a drifted record stops the mend instead of
 * riding it. The write carries updatedAt + rehomedAt so the repair has a visible time.
 *
 * Chain-safe: events are blocks (hash/previousHash), but `domain` is not in
 * BLOCK_CONTENT_FIELDS — same lawful class as retractedAt/lastCaredAt. Idempotent: an event
 * already home, or unknown to the map, is left alone. theohouse.org and hernan-wachuma.com
 * have no rooted node yet — those events rest scoped and invisible until the places exist.
 *
 *   node scripts/rehome-events.mjs           # dry run
 *   node scripts/rehome-events.mjs --apply
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

// id + title + current domain must ALL match the live record, or nothing moves.
const MOVES = [
  { id: 'ytjrA1xrUfvFp7ciaJ6l', title: 'The O House',                       from: 'lightseed.online', to: 'theohouse.org' },
  { id: 'CZbW61oDeWKuwGuOLUtC', title: 'African Basil Desert Cream',        from: 'localhost',        to: 'perauset.web.app' },
  { id: 'HEaWMOAn6puMKJXhTmTi', title: 'Tree Planting in Aswan',            from: 'localhost',        to: 'perauset.web.app' },
  { id: 'gq1Db8xHOPgOztbyaL7s', title: 'Welcome',                           from: 'localhost',        to: 'lightseed.online' },
  { id: 'lcRqkQ30Yq65hGTufEYM', title: 'New Domain',                        from: 'localhost',        to: 'lightseed.online' },
  { id: 'QsMFjF6lOamj6JBocInQ', title: 'Code Finalisation',                 from: 'localhost',        to: 'lightseed.online' },
  { id: '4gQPgdphJj4JmCziSbdj', title: 'Medicine plant harwest in Espinar', from: 'localhost',        to: 'hernan-wachuma.com' },
];

const apply = process.argv.includes('--apply');
initializeApp({ credential: applicationDefault(), projectId: 'lifeseed-75dfe' });
const db = getFirestore();

const batch = db.batch();
let moved = 0, settled = 0;
const disagreements = [];
for (const m of MOVES) {
  const snap = await db.collection('pulses').doc(m.id).get();
  const p = snap.exists ? snap.data() : null;
  if (p && p.domain === m.to) { settled++; continue; } // already home — idempotent
  const complaint =
    !p ? 'document does not exist'
    : p.type !== 'event' ? `type is '${p.type}', not 'event'`
    : p.title !== m.title ? `title is '${p.title}', expected '${m.title}'`
    : p.domain !== m.from ? `domain is '${p.domain}', expected '${m.from}'`
    : null;
  if (complaint) { disagreements.push(`  ${m.id} (${m.title}): ${complaint}`); continue; }
  console.log(`${apply ? 'moving' : 'would move'}  ${m.title.padEnd(36)} ${m.from.padEnd(18)} → ${m.to}`);
  if (apply) batch.update(snap.ref, { domain: m.to, updatedAt: FieldValue.serverTimestamp(), rehomedAt: FieldValue.serverTimestamp() });
  moved++;
}

if (disagreements.length) {
  console.error(`\nABORTED — ${disagreements.length} witness(es) disagree with the live records; nothing was written:`);
  for (const d of disagreements) console.error(d);
  process.exit(1);
}
if (apply && moved) await batch.commit();
if (settled) console.log(`${settled} already home.`);
console.log(`\n${moved} event(s) ${apply ? 're-homed' : 'would re-home'}. ${apply ? '' : 'Run with --apply to write.'}`);
