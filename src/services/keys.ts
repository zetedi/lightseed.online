import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase/core';
import { sha256 } from '../utils/crypto';
import { seedToPhrase, phraseToSeed, keyCustody, restoreConflictsWithPublished, type KeyCustody } from '../domain/signing';
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

// A stable fingerprint of a published key: hex SHA-256 of its base64 SPKI string (the one shared
// sha256 — the same digest the chain uses). Used as the doc id of the append-only key-history
// record, so re-publishing the same key always lands on the SAME doc (a no-op) and can never
// overwrite a DIFFERENT key's history — and isKeyInLineage recomputes the identical fingerprint.
const keyFingerprint = (publicKeyB64: string): Promise<string> => sha256(publicKeyB64);

async function publishPublicKey(uid: string, publicKeyB64: string): Promise<void> {
  // persons/{uid} is world-readable; rules let only the owner (uid) write their own doc. The private
  // key is never in this write — just the public half, in the same base64 SPKI shape as initiation.
  await setDoc(doc(db, 'persons', uid), { publicKeyPem: publicKeyB64 }, { merge: true });
  // APPEND-ONLY KEY HISTORY: every key ever published leaves a permanent, world-readable record at
  // persons/{uid}/keys/{fingerprint} — lineage for verify-at-signing-time, without changing today's
  // verification (which still binds to the currently-published key). Created once; re-publishing the
  // same key is a no-op (the doc already exists, publishedAt stays the FIRST publication). Best-
  // effort: a history hiccup must never block a signing action the identity key itself allows.
  try {
    const ref = doc(db, 'persons', uid, 'keys', await keyFingerprint(publicKeyB64));
    const existing = await getDoc(ref);
    if (!existing.exists()) await setDoc(ref, { pubkey: publicKeyB64, publishedAt: serverTimestamp() });
  } catch { /* lineage only — the published identity key above is the load-bearing write */ }
}

// The being's currently-PUBLISHED identity key (persons/{uid}.publicKeyPem) — '' if none is
// published. Throws when the doc cannot be READ (offline, rules hiccup): the callers decide what an
// unreadable published key means (ensureSigningKey tolerates it for a device that already holds a
// key; verification paths let it surface rather than verify against a guess).
export async function getPublishedSigningKey(uid: string): Promise<string> {
  const snap = await getDoc(doc(db, 'persons', uid));
  return snap.exists() ? ((snap.data() as { publicKeyPem?: string }).publicKeyPem ?? '') : '';
}

// Is this pubkey part of the being's APPEND-ONLY key lineage (persons/{uid}/keys/{fingerprint})?
// The lineage is the being's own permanent commitment: only the owner can create a record, the
// pubkey under a fingerprint can never change, and no one — not even staff — can delete one. So a
// key found here was genuinely published by the being at some recorded moment, even if the CURRENT
// identity key has since rotated. This is the continuity check verification falls back to: history
// survives rotation, while a throwaway key (never published) still never counts.
export async function isKeyInLineage(uid: string, publicKeyB64: string): Promise<boolean> {
  if (!publicKeyB64) return false;
  try {
    const snap = await getDoc(doc(db, 'persons', uid, 'keys', await keyFingerprint(publicKeyB64)));
    return snap.exists() && (snap.data() as { pubkey?: string }).pubkey === publicKeyB64;
  } catch {
    return false; // unreadable lineage never widens what counts
  }
}

// The public half of THIS device's key, if one is installed (null otherwise). Only ever the public
// key — the private key is non-extractable and never surfaces. The modal uses this to compare the
// device against the published identity (keyCustody) without minting anything.
export async function getDeviceKeyInfo(uid?: string): Promise<{ publicKeyB64: string } | null> {
  const record = await idbGet(currentUid(uid));
  return record ? { publicKeyB64: record.publicKeyB64 } : null;
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

// Can this device sign RIGHT NOW without surfacing a custody choice? True only when it holds a key
// that is (or may immediately become) the published identity — 'ready' or 'publish_needed'. The
// resume-after-modal guard: a stale device also HAS a key, so resuming on hasSigningKey alone
// re-throws the very custody conflict the modal was opened for (an inescapable loop). Unreadable
// published key reads as not-ready — a skipped resume is harmless, a wrong one is not.
export async function readyToSign(uid?: string): Promise<boolean> {
  const id = currentUid(uid);
  const device = await idbGet(id);
  if (!device) return false;
  try {
    const custody = keyCustody(device.publicKeyB64, await getPublishedSigningKey(id));
    return custody === 'ready' || custody === 'publish_needed';
  } catch {
    return false;
  }
}

export interface EnsureKeyResult {
  created: boolean;
  publicKeyB64: string;
  // The recovery phrase — returned ONCE, only when a key is freshly created. Show it to the being
  // for backup and then let it go; it is never persisted and cannot be shown again.
  recoveryPhrase?: string[];
}

// Thrown when this device cannot sign under the PUBLISHED identity without a deliberate choice:
//   'needs_restore' — this device holds NO key but an identity key is published. Silently minting a
//       fresh keypair would replace it; the being must restore from the phrase (or explicitly
//       choose { replacePublished: true } — the modal's red-warned door, never a silent default).
//   'stale_device'  — this device holds a key, but a DIFFERENT identity key is published (another
//       device rotated or started fresh). Silently republishing the local key would hijack the
//       identity back; the being must restore the current phrase here, or explicitly take over.
export class SigningKeyNeedsRestoreError extends Error {
  readonly code = 'needs-restore' as const;
  constructor(readonly reason: 'needs_restore' | 'stale_device' = 'needs_restore') {
    super(reason === 'stale_device'
      ? 'This device holds an older signing key than the one published for this account. Restore your current recovery phrase here.'
      : 'A signing key is already published for this account, but this device holds no key. Restore it from your recovery phrase.');
    this.name = 'SigningKeyNeedsRestoreError';
  }
}

// Thrown by restoreFromPhrase when the phrase is VALID BIP39 but derives a key that is NOT the
// published identity key — a different phrase than the one backing this account. Installing it
// would silently replace the published identity (the exact bypass the needs_restore warning
// guards), so it is refused unless the being explicitly chooses { replacePublished: true }.
export class RestoreKeyMismatchError extends Error {
  readonly code = 'restore-mismatch' as const;
  constructor() {
    super('This recovery phrase restores a DIFFERENT key than the one published for this account. Check the phrase — or deliberately replace the published key.');
    this.name = 'RestoreKeyMismatchError';
  }
}

export interface EnsureKeyOptions {
  // The explicit, strongly-warned escape hatch: publish over a DIFFERENT published identity key —
  // minting a new keypair (needs_restore) or republishing this device's older one (stale_device).
  // A deliberate user choice surfaced by the modal; never the default. Prior signatures stay
  // verifiable through the append-only key lineage; only the CURRENT identity changes hands.
  replacePublished?: boolean;
}

// Get-or-create the user's Ed25519 keypair on THIS device, guarded by the pure custody rule
// (domain/signing.keyCustody). Idempotent when device and published identity agree: the key is
// reused and NO phrase is returned (the seed is long gone). On first creation the seed is generated
// via crypto.subtle.generateKey, exported once to build the recovery phrase, then the private key
// is stored non-extractable and the public key published. It REFUSES to silently change the
// published identity in BOTH directions — no device key while one is published (needs_restore),
// and an older device key while a NEWER one is published (stale_device) — throwing
// SigningKeyNeedsRestoreError so the caller surfaces the restore flow.
export async function ensureSigningKey(uid?: string, options?: EnsureKeyOptions): Promise<EnsureKeyResult> {
  const id = currentUid(uid);
  const existing = await idbGet(id);
  // The custody read. For a device that already holds a key, a TRANSIENT read failure must not
  // block signing (the old best-effort posture): treat the local key as current — the stale check
  // is skipped this once, and every later sign re-checks. Without a device key the read is
  // load-bearing (minting over an unreadable published key could silently replace an identity),
  // so the failure surfaces instead of being guessed away.
  let published: string;
  try {
    published = await getPublishedSigningKey(id);
  } catch {
    if (!existing) throw new Error('Could not check your published signing key. Please try again in a moment.');
    published = existing.publicKeyB64;
  }
  const custody: KeyCustody = keyCustody(existing?.publicKeyB64 ?? null, published);

  if (existing) {
    if (custody === 'stale_device') {
      // Another device rotated the identity: republishing this device's older key would silently
      // hijack it back. Only a deliberate takeover (replacePublished) may do that — and a
      // deliberate takeover must land, so ITS publish failure is fatal, not swallowed.
      if (!options?.replacePublished) throw new SigningKeyNeedsRestoreError('stale_device');
      await publishPublicKey(id, existing.publicKeyB64);
    } else {
      // 'ready' or 'publish_needed': self-heal the published key and its lineage record (a no-op
      // merge when everything is already in place). Best-effort — signing paths re-assert it.
      try { await publishPublicKey(id, existing.publicKeyB64); } catch { /* non-fatal */ }
    }
    return { created: false, publicKeyB64: existing.publicKeyB64 };
  }

  // No device key. If an identity key is already published, generating a fresh one would silently
  // replace it — refuse, unless the being explicitly chose to start fresh.
  if (custody === 'needs_restore' && !options?.replacePublished) {
    throw new SigningKeyNeedsRestoreError('needs_restore');
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

export interface RestoreOptions {
  // The explicit, red-warned escape hatch: install and publish this phrase's key even though a
  // DIFFERENT identity key is published. The door back for a being whose newest phrase is lost but
  // who still holds an older one — prior signatures stay verifiable through the key lineage.
  replacePublished?: boolean;
}

// Re-derive the keypair from a recovery phrase and install it on THIS device (non-extractable),
// re-publishing the public key. phraseToSeed throws on a mistyped phrase (checksum). The restored
// public key is identical to the original — same seed, same key (proven in the tests). A valid
// phrase that derives a DIFFERENT key than the published identity is REFUSED
// (RestoreKeyMismatchError) unless the being explicitly chose to replace it: "restore" may only
// land the key it claims to restore, never smuggle in a new identity past the start-fresh warning.
export async function restoreFromPhrase(words: string[], uid?: string, options?: RestoreOptions): Promise<{ publicKeyB64: string }> {
  const id = currentUid(uid);
  const seed = phraseToSeed(words); // throws on unknown word / bad checksum
  const kp = await keypairFromSeed(seed);
  seed.fill(0);
  if (!options?.replacePublished && restoreConflictsWithPublished(kp.publicKeyB64, await getPublishedSigningKey(id))) {
    throw new RestoreKeyMismatchError();
  }
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
