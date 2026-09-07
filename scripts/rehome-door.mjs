#!/usr/bin/env node

/**
 * Re-home a DOOR (ring 2026-09-07): claim a hostname as a community's alias and bring every
 * being stamped with that hostname home to the community's canonical domain — the ONE
 * place-of-record stamp the feeds scope by. A door that stood unclaimed (no community named
 * it, no alias opened it) had no host: what was planted there was stamped with the raw
 * hostname and belonged to nobody. This is the witnessed hand that makes it the place's.
 *
 * `domain` rides OUTSIDE the hashed block fields (domain/chain BLOCK_CONTENT_FIELDS), so no
 * seal breaks. A vision's community grounding is re-resolved the way mendVisionDomain does:
 * the new place is the community's, so the vision is linked to it.
 *
 *   node scripts/rehome-door.mjs <communityId> <door> --expect-name "Enlightened Nations"
 *   node scripts/rehome-door.mjs <communityId> <door> --expect-name "…" --apply
 *
 * Runs with the machine's application-default credentials, like add-domain-alias.mjs.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const [id, doorRaw] = process.argv.slice(2).filter(a => !a.startsWith('--') && a !== process.argv[process.argv.indexOf('--expect-name') + 1]);
const apply = process.argv.includes('--apply');
const nameIdx = process.argv.indexOf('--expect-name');
const expectName = nameIdx > -1 ? process.argv[nameIdx + 1] : null;

if (!id || !doorRaw || !expectName) {
  console.error('usage: rehome-door.mjs <communityId> <door> --expect-name "<name>" [--apply]');
  process.exit(1);
}
const door = doorRaw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(door)) { console.error(`not a hostname: ${door}`); process.exit(1); }

initializeApp({ credential: applicationDefault(), projectId: 'lifeseed-75dfe' });
const db = getFirestore();

const snap = await db.collection('communities').doc(id).get();
if (!snap.exists) { console.error(`no community '${id}'`); process.exit(1); }
const c = snap.data();
if (c.name !== expectName) { console.error(`witness refused: community is '${c.name}', expected '${expectName}'`); process.exit(1); }
const home = String(c.domain || '').toLowerCase();
if (!home) { console.error('the community has no canonical domain to come home to'); process.exit(1); }
if (home === door) { console.error(`'${door}' IS the community's domain — nothing to re-home`); process.exit(1); }
const aliases = c.domainAliases || [];
console.log(`${c.name} (${id}) — home: ${home}, aliases: [${aliases.join(', ')}]`);
console.log(aliases.includes(door) ? `  = '${door}' already opens the door` : `  + '${door}' becomes an alias`);

// What stands stamped with the door, by collection — and how each comes home.
const PLACES = [
  { col: 'pulses', label: p => `${p.type || 'pulse'} · ${p.title || p.content?.slice(0, 40) || ''}`, patch: () => ({ domain: home }) },
  { col: 'lifetrees', label: t => `tree · ${t.name || t.title || ''}`, patch: () => ({ domain: home }) },
  { col: 'visions', label: v => `vision · ${v.title || ''}`, patch: () => ({ domain: home, communityId: id }) },
];
const found = [];
for (const place of PLACES) {
  const q = await db.collection(place.col).where('domain', '==', door).get();
  console.log(`  ${place.col}: ${q.size}`);
  for (const d of q.docs) { console.log(`    ${d.id}  ${place.label(d.data())}`); found.push({ ref: d.ref, patch: place.patch(d.data()) }); }
}

if (!apply) { console.log(`\nDRY RUN: would re-home ${found.length} being(s) to '${home}'${aliases.includes(door) ? '' : ` and alias '${door}'`}. Re-run with --apply.`); process.exit(0); }

let batch = db.batch(); let n = 0;
const flush = async () => { if (n) { await batch.commit(); batch = db.batch(); n = 0; } };
if (!aliases.includes(door)) { batch.update(snap.ref, { domainAliases: FieldValue.arrayUnion(door), updatedAt: FieldValue.serverTimestamp() }); n++; }
for (const { ref, patch } of found) {
  batch.update(ref, { ...patch, updatedAt: FieldValue.serverTimestamp() }); n++;
  if (n >= 400) await flush();
}
await flush();
console.log(`\nhome: ${found.length} being(s) now stand at '${home}'; '${door}' opens its door.`);
