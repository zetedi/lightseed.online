#!/usr/bin/env node
/**
 * MOVE A COMMUNITY'S PLACE OF RECORD (ring 2026-09-18). The place of record is the ONE
 * `domain` stamp every scoped feed asks for; the convention from this ring on is the host the
 * seed actually ANSWERS at (seed.<domain>), never the mother site's apex — two communities may
 * one day stand under one apex on two seeds, and an apex that serves no seed page stamps
 * nothing anyone can find. When a community's place of record moves, every being it stamped
 * must move with it, or the face goes blind to its own happenings (the Dance Therapy event,
 * stamped seed.perauset.org while the record said perauset.org).
 *
 * This hand: sets the community's `domain` to the new host, keeps the doors it still answers
 * at as aliases (never the new host itself, never the old apex unless --keep-old-as-alias),
 * and re-stamps every pulse, lifetree, vision, Light House and subscription that carried the
 * OLD domain. `domain` rides OUTSIDE the hashed block fields (domain/chain
 * BLOCK_CONTENT_FIELDS), so no seal breaks. A vision moving home is also grounded in the
 * community (communityId), as mendVisionDomain does.
 *
 * Witnessed: the community's name must match --expect-name, or nothing is written.
 *
 *   node scripts/move-place-of-record.mjs <communityId> <newDomain> --expect-name "Per Auset" [--keep-old-as-alias] [--apply]
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i > -1 ? args[i + 1] : null; };
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--expect-name');
const [id, newRaw] = positional;
const expectName = opt('expect-name');
const apply = flag('apply');
const keepOld = flag('keep-old-as-alias');
const norm = (d) => String(d || '').trim().toLowerCase().replace(/^www\./, '');
const newDomain = norm(newRaw);
if (!id || !newDomain || !expectName || !/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(newDomain)) {
  console.error('usage: move-place-of-record.mjs <communityId> <newDomain> --expect-name "<name>" [--keep-old-as-alias] [--apply]');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || 'lifeseed-75dfe' });
const db = getFirestore();
const ref = db.collection('communities').doc(id);
const snap = await ref.get();
if (!snap.exists) { console.error(`no community ${id}`); process.exit(1); }
const c = snap.data();
if (c.name !== expectName) { console.error(`witness failed: community is "${c.name}", expected "${expectName}"`); process.exit(1); }
const oldDomain = norm(c.domain);
if (oldDomain === newDomain) { console.log(`${c.name} already stands at ${newDomain}; nothing to do.`); process.exit(0); }
const aliases = new Set((c.domainAliases || []).map(norm).filter(Boolean));
aliases.delete(newDomain);
if (keepOld) aliases.add(oldDomain); else aliases.delete(oldDomain);
console.log(`${c.name} (${id}) — place of record: ${oldDomain} → ${newDomain}; aliases after: [${[...aliases].join(', ')}]`);
if (c.domainVerification?.domain && norm(c.domainVerification.domain) !== newDomain) {
  console.log(`  note: the DNS proof stands for ${c.domainVerification.domain}; the verified badge falls silent until ${newDomain} is proven.`);
}

const moves = [];
for (const coll of ['pulses', 'lifetrees', 'visions', 'lightHouses', 'subscriptions']) {
  const rows = await db.collection(coll).where('domain', '==', oldDomain).get();
  console.log(`  ${coll}: ${rows.size}`);
  rows.docs.forEach((d) => {
    const x = d.data();
    console.log(`    ${d.id}  ${x.type || coll} · ${x.title || x.name || x.email || ''}`);
    moves.push({ ref: d.ref, coll });
  });
}
if (!apply) { console.log(`\nDRY RUN: would move the place of record and re-stamp ${moves.length} being(s). Re-run with --apply.`); process.exit(0); }

const stamp = { updatedAt: FieldValue.serverTimestamp(), rehomedAt: FieldValue.serverTimestamp() };
let batch = db.batch(); let n = 0;
batch.update(ref, { domain: newDomain, domainAliases: [...aliases], updatedAt: FieldValue.serverTimestamp() }); n++;
for (const m of moves) {
  batch.update(m.ref, { domain: newDomain, ...(m.coll === 'visions' ? { communityId: id } : {}), ...stamp }); n++;
  if (n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
}
if (n) await batch.commit();
console.log(`\nDone: ${c.name} stands at ${newDomain}; ${moves.length} being(s) came home.`);
