#!/usr/bin/env node
// Keys for the initiation ledger. ed25519. The public key is printed as base64 of its SPKI/DER
// encoding (what goes in an initiate's `pubkey`). Keep the private key secret — never commit it.
//
//   node scripts/initiation-keygen.mjs                                                  # new keypair
//   node scripts/initiation-keygen.mjs lid                                              # mint a UUIDv7 Lightseed ID
//   node scripts/initiation-keygen.mjs sign <handle> <pubkey> <lid> [uid] [visionId]    # sign a newcomer
//
// The private key is read from / written to ./initiation-private.pem (override with $INITIATION_KEY).
import { generateKeyPairSync, createPrivateKey, sign as edSign } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const KEY_PATH = process.env.INITIATION_KEY || 'initiation-private.pem';
const SIG_VERSION = 'lightseed.initiation.v1';
const [cmd, handle, pubkey, lid, uid, visionId] = process.argv.slice(2);

const pubB64 = (publicKey) =>
  publicKey.export({ format: 'der', type: 'spki' }).toString('base64');

// UUIDv7 — the Lightseed ID (LID), an initiate's portable true name. Same algorithm as
// src/utils/id.ts: 48-bit millisecond birth-time, then randomness, version 7, RFC 4122 variant.
const uuidv7 = (at = Date.now()) => {
  const bytes = new Uint8Array(16);
  let ts = Math.max(0, Math.floor(at));
  for (let i = 5; i >= 0; i--) { bytes[i] = ts % 256; ts = Math.floor(ts / 256); }
  crypto.getRandomValues(bytes.subarray(6));
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

if (cmd === 'lid') {
  console.log(uuidv7());
} else if (cmd === 'sign') {
  if (!handle || !pubkey || !lid) {
    console.error('usage: node scripts/initiation-keygen.mjs sign <handle> <pubkey> <lid> [uid] [visionId]');
    process.exit(2);
  }
  if (!existsSync(KEY_PATH)) {
    console.error(`No private key at ${KEY_PATH}. Generate one first (run with no args).`);
    process.exit(2);
  }
  const priv = createPrivateKey(readFileSync(KEY_PATH));
  // lid + uid + visionId are inside the signature — they bind the identity; see verify-initiations.mjs.
  const msg = Buffer.from([SIG_VERSION, handle, pubkey, lid, uid || '', visionId || ''].join('\n'), 'utf8');
  const sig = edSign(null, msg, priv).toString('base64');
  console.log(sig);
} else {
  if (existsSync(KEY_PATH)) {
    console.error(`Refusing to overwrite ${KEY_PATH}. Move it aside or set $INITIATION_KEY.`);
    process.exit(2);
  }
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  writeFileSync(KEY_PATH, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });
  console.log('Private key written to ' + KEY_PATH + '  (keep it secret — it is git-ignored)');
  console.log('\nYour pubkey (put this in your initiate record):\n');
  console.log(pubB64(publicKey));
}
