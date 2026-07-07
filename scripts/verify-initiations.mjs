#!/usr/bin/env node
// Verify the initiation ledger (initiations/*.json). This is the rule made into math:
// a non-genesis initiate must be signed by THREE existing initiates, and every signature must
// verify against the sponsor's public key. Run in CI; exits non-zero on any violation.
//
//   node scripts/verify-initiations.mjs
//
// Keys are ed25519. A pubkey is base64 of the SPKI/DER encoding. A sponsor signs the message:
//   lightseed.initiation.v1\n<handle>\n<pubkey>\n<lid>\n<uid-or-empty>\n<visionId>
// The lid (the UUIDv7 Lightseed ID — the initiate's portable true name, equal to their person
// entity's lid), the uid, and the vision are INSIDE the signature on purpose: they bind the ledger
// identity to the network person, the app account, and the validated vision it grows from —
// re-pointing any of them in a later PR breaks all three signatures.
//
// The genesis ring is PINNED in initiations/_GENESIS_RING.json (handle -> pubkey). A record may
// claim `genesis: true` only if it appears there with a matching pubkey — a self-declared genesis
// record cannot bypass the three-sponsor rule.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createPublicKey, verify as edVerify } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, '..', 'initiations');
const SIG_VERSION = 'lightseed.initiation.v1';
const REQUIRED_SPONSORS = 3;

const signingMessage = (rec) =>
  Buffer.from([SIG_VERSION, rec.handle, rec.pubkey, rec.lid || '', rec.uid || '', rec.vision?.id || ''].join('\n'), 'utf8');

// The LID is a UUIDv7 — version nibble 7, RFC 4122 variant.
const LID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const keyFromPub = (pubkeyB64) =>
  createPublicKey({ key: Buffer.from(pubkeyB64, 'base64'), format: 'der', type: 'spki' });

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

// The pinned founding ring: { "<handle>": "<pubkey>" }. Absent file = empty ring (no genesis
// records allowed). Changing this file is changing the constitution — it shows in any diff.
const RING_PATH = join(DIR, '_GENESIS_RING.json');
const genesisRing = existsSync(RING_PATH) ? JSON.parse(readFileSync(RING_PATH, 'utf8')) : {};

// Load records — skip metadata (schema.json, anything starting with "_").
const files = readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'schema.json' && !f.startsWith('_'));
const records = new Map();      // handle -> record
const pubkeys = new Map();      // pubkey -> handle (uniqueness)
const lids = new Map();         // lid -> handle (uniqueness)

for (const f of files) {
  let rec;
  try { rec = JSON.parse(readFileSync(join(DIR, f), 'utf8')); }
  catch (e) { fail(f, `invalid JSON: ${e.message}`); continue; }
  const stem = f.replace(/\.json$/, '');
  if (rec.handle !== stem) fail(f, `handle "${rec.handle}" must equal filename stem "${stem}"`);
  if (records.has(rec.handle)) fail(f, `duplicate handle "${rec.handle}"`);
  if (!rec.pubkey) fail(f, 'missing pubkey');
  else {
    try { keyFromPub(rec.pubkey); } catch { fail(f, 'pubkey is not a valid base64 SPKI/DER ed25519 key'); }
    if (pubkeys.has(rec.pubkey)) fail(f, `pubkey reused (also ${pubkeys.get(rec.pubkey)})`);
    pubkeys.set(rec.pubkey, rec.handle);
  }
  if (!rec.lid || !LID_RE.test(rec.lid)) fail(f, 'missing or malformed lid (must be a UUIDv7 Lightseed ID)');
  else {
    if (lids.has(rec.lid)) fail(f, `lid reused (also ${lids.get(rec.lid)})`);
    lids.set(rec.lid, rec.handle);
  }
  if (!rec.vision?.id) fail(f, 'must be built on a validated vision (vision.id)');
  records.set(rec.handle, { rec, file: f });
}

// Verify the web of trust.
for (const { rec, file } of records.values()) {
  const sponsors = rec.sponsors || [];
  if (rec.genesis) {
    // Founding ring — exempt from the three-sponsor rule, but ONLY if pinned in _GENESIS_RING.json
    // with this exact pubkey. Any sponsors it does carry must still verify.
    if (genesisRing[rec.handle] !== rec.pubkey) {
      fail(file, 'claims genesis but is not pinned in _GENESIS_RING.json (or pubkey differs)');
    }
  } else if (sponsors.length < REQUIRED_SPONSORS) {
    fail(file, `needs ${REQUIRED_SPONSORS} sponsors, has ${sponsors.length}`);
  }
  const seen = new Set();
  const msg = signingMessage(rec);
  for (const s of sponsors) {
    if (s.handle === rec.handle) { fail(file, 'cannot sponsor yourself'); continue; }
    if (seen.has(s.handle)) { fail(file, `duplicate sponsor "${s.handle}"`); continue; }
    seen.add(s.handle);
    const sponsor = records.get(s.handle);
    if (!sponsor) { fail(file, `unknown sponsor "${s.handle}"`); continue; }
    let ok = false;
    try { ok = edVerify(null, msg, keyFromPub(sponsor.rec.pubkey), Buffer.from(s.signature, 'base64')); }
    catch (e) { fail(file, `signature from "${s.handle}" could not be checked: ${e.message}`); continue; }
    if (!ok) fail(file, `signature from "${s.handle}" does not verify`);
  }
}

if (errors.length) {
  console.error(`✗ initiation ledger invalid (${errors.length} problem${errors.length > 1 ? 's' : ''}):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✓ initiation ledger valid — ${records.size} initiate${records.size === 1 ? '' : 's'}.`);
