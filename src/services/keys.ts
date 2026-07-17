import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase/core';
import { seedToPhrase, phraseToSeed } from '../domain/signing';
import {
  keypairFromSeed,
  signPayload,
  verifyPayload,
  subtleEd25519Available,
  type SigningKeypair,
} from './signingCrypto';

// The device keystore — key custody = DEVICE KEY + BACKUP (Zoltán's decision).
//
//   • The private key lives ONLY on this device, as a NON-EXTRACTABLE CryptoKey in IndexedDB. Script
//     or XSS on the page cannot export it or read its bytes — it can be USED to sign, never stolen.
//   • It is NEVER written to Firestore, logs, or React state. Only the PUBLIC key is published, to
//     persons/{uid}.publicKeyPem (base64 SPKI/DER — the initiation format), so anyone can verify.
//   • The ONE bridge off the device is the recovery phrase, shown exactly once at creation. The being
//     writes it down; it (and only it) restores the same keypair on another device or after a wipe.
//
// This module is browser-only (IndexedDB + Firebase). The pure crypto lives in services/signingCrypto
// and the pure preimage/phrase codec in domain/signing — both are unit-tested without a browser.

const DB_NAME = 'lifeseed-keys';
const STORE = 'signingKeys';
const DB_VERSION = 1;

interface StoredKey {
  uid: string;
  privateKey: CryptoKey;   // non-extractable — structured-clonable, survives reload
  publicKey: CryptoKey;
  publicKeyB64: string;
}

// ── IndexedDB (tiny, promise-wrapped) ──────────────────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'uid' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(uid: string): Promise<StoredKey | undefined> {
  const dbi = await openDB();
  try {
    return await new Promise<StoredKey | undefined>((resolve, reject) => {
      const req = dbi.transaction(STORE, 'readonly').objectStore(STORE).get(uid);
      req.onsuccess = () => resolve(req.result as StoredKey | undefined);
      req.onerror = () => reject(req.error);
    });
  } finally { dbi.close(); }
}

async function idbPut(record: StoredKey): Promise<void> {
  const dbi = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = dbi.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally { dbi.close(); }
}

// ── Public-key publication (the only thing that ever touches Firestore) ────────────────────────
async function publishPublicKey(uid: string, publicKeyB64: string): Promise<void> {
  // persons/{uid} is world-readable; rules let only the owner (uid) write their own doc. The private
  // key is never in this write — just the public half, in the same base64 SPKI shape as initiation.
  await setDoc(doc(db, 'persons', uid), { publicKeyPem: publicKeyB64 }, { merge: true });
}

// (Re)publish a known public key to persons/{uid}.publicKeyPem. Used defensively by the covenant seal
// path to self-heal a party's published identity key when a prior publish failed — the covenant seal
// counts a signature only if its pubkey matches this published key, so it must be present and correct.
export async function publishSigningKey(uid: string, publicKeyB64: string): Promise<void> {
  await publishPublicKey(uid, publicKeyB64);
}

const currentUid = (uid?: string): string => {
  const resolved = uid ?? auth.currentUser?.uid;
  if (!resolved) throw new Error('No signing identity — sign in first.');
  return resolved;
};

async function storeAndPublish(uid: string, kp: SigningKeypair): Promise<void> {
  await idbPut({ uid, privateKey: kp.privateKey, publicKey: kp.publicKey, publicKeyB64: kp.publicKeyB64 });
  await publishPublicKey(uid, kp.publicKeyB64);
}

// ── Public API ─────────────────────────────────────────────────────────────────────────────────

// Has this device a signing key for the user? (The private key lives only here — another device
// answers false until the phrase is restored there.)
export async function hasSigningKey(uid?: string): Promise<boolean> {
  return (await idbGet(currentUid(uid))) !== undefined;
}

export interface EnsureKeyResult {
  created: boolean;
  publicKeyB64: string;
  // The recovery phrase — returned ONCE, only when a key is freshly created. Show it to the being
  // for backup and then let it go; it is never persisted and cannot be shown again.
  recoveryPhrase?: string[];
}

// Get-or-create the user's Ed25519 keypair on THIS device. Idempotent: if a key already exists in
// IndexedDB it is reused and NO phrase is returned (the seed is long gone). On first creation the
// seed is generated via crypto.subtle.generateKey, exported once to build the recovery phrase, then
// the private key is stored non-extractable and the public key published.
export async function ensureSigningKey(uid?: string): Promise<EnsureKeyResult> {
  const id = currentUid(uid);
  const existing = await idbGet(id);
  if (existing) {
    // Self-heal: make sure the published pubkey is present even if a past publish failed.
    try { await publishPublicKey(id, existing.publicKeyB64); } catch { /* non-fatal */ }
    return { created: false, publicKeyB64: existing.publicKeyB64 };
  }

  // Generate an extractable key, export the raw 32-byte seed ONCE (JWK `d`), derive the phrase, then
  // re-import everything through keypairFromSeed so the stored private key is non-extractable and the
  // published public key is provably the one the seed (and thus the phrase) determines.
  const gen = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', gen.privateKey);
  if (!jwk.d) throw new Error('Could not export the new signing seed.');
  const seed = b64UrlToBytes(jwk.d);

  const recoveryPhrase = seedToPhrase(seed);
  const kp = await keypairFromSeed(seed);
  seed.fill(0); // best-effort scrub of the raw seed from memory
  await storeAndPublish(id, kp);
  return { created: true, publicKeyB64: kp.publicKeyB64, recoveryPhrase };
}

// Re-derive the keypair from a recovery phrase and install it on THIS device (non-extractable),
// re-publishing the public key. phraseToSeed throws on a mistyped phrase (checksum). The restored
// public key is identical to the original — same seed, same key (proven in the tests).
export async function restoreFromPhrase(words: string[], uid?: string): Promise<{ publicKeyB64: string }> {
  const id = currentUid(uid);
  const seed = phraseToSeed(words); // throws on unknown word / bad checksum
  const kp = await keypairFromSeed(seed);
  seed.fill(0);
  await storeAndPublish(id, kp);
  return { publicKeyB64: kp.publicKeyB64 };
}

// Sign a payload under a domain tag with THIS device's private key. Throws if no key is installed.
export async function sign(payload: unknown, domainTag: string, uid?: string): Promise<string> {
  const record = await idbGet(currentUid(uid));
  if (!record) throw new Error('No signing key on this device. Create or restore one first.');
  return signPayload(record.privateKey, payload, domainTag);
}

// Verify a signature with ONLY a published public key — no device key needed. Re-exported from the
// crypto layer so call sites have one import surface.
export const verify = verifyPayload;

// Whether this browser can do Ed25519 at all (the key UI gates its create/restore actions on it).
export const signingAvailable = subtleEd25519Available;

function b64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
