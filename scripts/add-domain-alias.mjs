#!/usr/bin/env node

/**
 * Add a hostname to a community's domainAliases — the witnessed hand for opening a new
 * DOOR to an existing place (ring 2026-08-19, the hybrid adoption shape). The community's
 * `domain` stays the sole scoping stamp (the NAME of the place); aliases are only the
 * hostnames its portal answers at (getCommunityByDomain falls back to array-contains).
 *
 *   node scripts/add-domain-alias.mjs <communityId> <alias> --expect-name "The O House"
 *   node scripts/add-domain-alias.mjs <communityId> <alias> --expect-name "…" --apply
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const [id, aliasRaw] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const apply = process.argv.includes('--apply');
const nameIdx = process.argv.indexOf('--expect-name');
const expectName = nameIdx > -1 ? process.argv[nameIdx + 1] : null;

if (!id || !aliasRaw || !expectName) {
  console.error('usage: add-domain-alias.mjs <communityId> <alias> --expect-name "<name>" [--apply]');
  process.exit(1);
}
const alias = aliasRaw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(alias)) { console.error(`not a hostname: ${alias}`); process.exit(1); }

initializeApp({ credential: applicationDefault(), projectId: 'lifeseed-75dfe' });
const db = getFirestore();

const snap = await db.collection('communities').doc(id).get();
if (!snap.exists) { console.error(`no community '${id}'`); process.exit(1); }
const c = snap.data();
if (c.name !== expectName) { console.error(`witness refused: community is '${c.name}', expected '${expectName}'`); process.exit(1); }
const existing = c.domainAliases || [];
console.log(`${c.name} (${id}) — domain: ${c.domain}, aliases: [${existing.join(', ')}]`);
if (existing.includes(alias) || c.domain === alias) { console.log(`'${alias}' already answers — nothing to do.`); process.exit(0); }
if (!apply) { console.log(`DRY RUN: would add alias '${alias}'. Re-run with --apply.`); process.exit(0); }
await snap.ref.update({ domainAliases: FieldValue.arrayUnion(alias), updatedAt: FieldValue.serverTimestamp() });
console.log(`added: ${c.name} now also answers at '${alias}'.`);
