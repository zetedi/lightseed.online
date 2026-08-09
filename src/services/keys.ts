import {
  collection, doc, getDoc, getDocs, serverTimestamp, Timestamp, writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from './firebase/core';
import { sha256 } from '../utils/crypto';
import { uuidv7 } from '../utils/id';
import { seedToPhrase, phraseToSeed, keyCustody, restoreConflictsWithPublished, type KeyCustody } from '../domain/signing';
import {
  keyStandingAt, keyStandingCounts,
  keyRotationPreimage, keyRecoveryPreimage, keyRecoveryWitnessPreimage,
  type KeyEpoch, type KeyEvent, type KeyStanding,
} from '../domain/keyEpoch';
import {
  keypairFromSeed,
  signPreimage,
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
const PENDING_STORE = 'pendingSigningKeys';
const DB_VERSION = 2;

interface StoredKey {
  uid: string;
  privateKey: CryptoKey;   // non-extractable — structured-clonable, survives reload
  publicKey: CryptoKey;
  publicKeyB64: string;
}

interface PendingRecoveryKey extends StoredKey {
  eventId: string;
  recoveryCode: string;
}

// ── IndexedDB (tiny, promise-wrapped) ──────────────────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'uid' });
      if (!req.result.objectStoreNames.contains(PENDING_STORE)) {
        req.result.createObjectStore(PENDING_STORE, { keyPath: 'eventId' });
      }
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

async function idbPendingFor(uid: string): Promise<PendingRecoveryKey | undefined> {
  const dbi = await openDB();
  try {
    return await new Promise<PendingRecoveryKey | undefined>((resolve, reject) => {
      const req = dbi.transaction(PENDING_STORE, 'readonly').objectStore(PENDING_STORE).getAll();
      req.onsuccess = () => resolve(
        (req.result as PendingRecoveryKey[]).find(record => record.uid === uid),
      );
      req.onerror = () => reject(req.error);
    });
  } finally { dbi.close(); }
}

async function idbPutPending(record: PendingRecoveryKey): Promise<void> {
  const dbi = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = dbi.transaction(PENDING_STORE, 'readwrite');
      tx.objectStore(PENDING_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally { dbi.close(); }
}

async function idbDeletePending(eventId: string): Promise<void> {
  const dbi = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = dbi.transaction(PENDING_STORE, 'readwrite');
      tx.objectStore(PENDING_STORE).delete(eventId);
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
export const keyFingerprint = (publicKeyB64: string): Promise<string> => sha256(publicKeyB64);

export type SigningKeyState = 'active' | 'frozen';

export interface PublishedSigningIdentity {
  lid: string;
  publicKeyB64: string;
  fingerprint: string;
  epochId: string;
  state: SigningKeyState;
}

const timestampMillis = (value: unknown): number =>
  typeof value === 'number'
    ? value
    : (value as { toMillis?: () => number } | null)?.toMillis?.() ?? 0;

// First publication (and the one-time anchoring of a pre-epoch key) is one atomic gesture: current
// key, append-only lineage, and a server-timed anchor event. A DIFFERENT already-published key can
// never be replaced here; rotation/recovery must pass through their proof-bearing server functions.
async function publishPublicKey(uid: string, publicKeyB64: string): Promise<PublishedSigningIdentity> {
  const personRef = doc(db, 'persons', uid);
  const fingerprint = await keyFingerprint(publicKeyB64);
  const keyRef = doc(personRef, 'keys', fingerprint);
  const anchorId = `anchor_${fingerprint}`;
  const anchorRef = doc(personRef, 'keyEvents', anchorId);
  const [personSnap, keySnap, anchorSnap] = await Promise.all([
    getDoc(personRef), getDoc(keyRef), getDoc(anchorRef),
  ]);
  const person = personSnap.exists() ? personSnap.data() as Record<string, unknown> : {};
  const lid = typeof person.lid === 'string' ? person.lid : '';
  if (!lid) throw new Error('err_lid_before_publish');
  const published = typeof person.publicKeyPem === 'string' ? person.publicKeyPem : '';
  if (published && published !== publicKeyB64) {
    throw new SigningKeyNeedsRestoreError(await idbGet(uid) ? 'stale_device' : 'needs_restore');
  }

  const existingFingerprint = typeof person.signingKeyFingerprint === 'string'
    ? person.signingKeyFingerprint : '';
  const existingEpochId = typeof person.signingEpochId === 'string' ? person.signingEpochId : '';
  const state: SigningKeyState = person.signingState === 'frozen' ? 'frozen' : 'active';

  // Already anchored: only repair a missing lineage doc. The current identity fields are untouched.
  if (existingFingerprint && existingEpochId) {
    if (existingFingerprint !== fingerprint || published !== publicKeyB64) {
      throw new Error('err_anchor_mismatch');
    }
    if (!keySnap.exists()) {
      const batch = writeBatch(db);
      batch.set(keyRef, { pubkey: publicKeyB64, publishedAt: serverTimestamp() });
      try {
        await batch.commit();
      } catch (error) {
        const after = await getDoc(keyRef).catch(() => null);
        if (!after?.exists() || (after.data() as { pubkey?: string }).pubkey !== publicKeyB64) throw error;
      }
    }
    return { lid, publicKeyB64, fingerprint, epochId: existingEpochId, state };
  }

  const batch = writeBatch(db);
  if (!keySnap.exists()) batch.set(keyRef, { pubkey: publicKeyB64, publishedAt: serverTimestamp() });
  if (!anchorSnap.exists()) {
    batch.set(anchorRef, {
      version: 1,
      type: 'anchor',
      uid,
      lid,
      epochId: anchorId,
      keyFingerprint: fingerprint,
      recordedAt: serverTimestamp(),
    });
  }
  batch.set(personRef, {
    publicKeyPem: publicKeyB64,
    signingKeyFingerprint: fingerprint,
    signingEpochId: anchorId,
    signingState: 'active',
    signingAnchoredAt: serverTimestamp(),
  }, { merge: true });
  try {
    await batch.commit();
  } catch (error) {
    // Two first-use tabs may race the same deterministic anchor. If the other tab landed the exact
    // identity, converge on it; any different result remains an error.
    const after = await getPublishedSigningIdentity(uid).catch(() => null);
    if (
      !after
      || after.publicKeyB64 !== publicKeyB64
      || after.fingerprint !== fingerprint
      || after.epochId !== anchorId
    ) throw error;
  }
  return { lid, publicKeyB64, fingerprint, epochId: anchorId, state: 'active' };
}

// The being's currently-PUBLISHED identity key (persons/{uid}.publicKeyPem) — '' if none is
// published. Throws when the doc cannot be READ (offline, rules hiccup): the callers decide what an
// unreadable published key means (ensureSigningKey tolerates it for a device that already holds a
// key; verification paths let it surface rather than verify against a guess).
export async function getPublishedSigningKey(uid: string): Promise<string> {
  const snap = await getDoc(doc(db, 'persons', uid));
  return snap.exists() ? ((snap.data() as { publicKeyPem?: string }).publicKeyPem ?? '') : '';
}

export async function getPublishedSigningIdentity(uid: string): Promise<PublishedSigningIdentity | null> {
  const snap = await getDoc(doc(db, 'persons', uid));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  if (
    typeof data.publicKeyPem !== 'string' || !data.publicKeyPem
    || typeof data.signingKeyFingerprint !== 'string' || !data.signingKeyFingerprint
    || typeof data.signingEpochId !== 'string' || !data.signingEpochId
  ) return null;
  return {
    lid: typeof data.lid === 'string' ? data.lid : '',
    publicKeyB64: data.publicKeyPem,
    fingerprint: data.signingKeyFingerprint,
    epochId: data.signingEpochId,
    state: data.signingState === 'frozen' ? 'frozen' : 'active',
  };
}

// Is this pubkey part of the being's APPEND-ONLY key lineage (persons/{uid}/keys/{fingerprint})?
// The lineage is the being's own permanent commitment: only the owner can create a record, the
// pubkey under a fingerprint can never change, and no one — not even staff — can delete one. So a
// key found here was genuinely published by the being at some recorded moment, even if the CURRENT
// identity key has since rotated. This is the continuity check verification falls back to: history
// survives rotation, while a throwaway key (never published) still never counts.
interface EpochBoundSignature {
  version?: 3;
  keyFingerprint?: string;
  epochId?: string;
  recordedAt?: unknown;
}

export async function getSignatureKeyStanding(
  uid: string,
  publicKeyB64: string,
  signature: EpochBoundSignature,
): Promise<KeyStanding> {
  if (
    signature.version !== 3
    || !signature.keyFingerprint
    || !signature.epochId
    || !timestampMillis(signature.recordedAt)
  ) return 'unanchored';
  if (await keyFingerprint(publicKeyB64) !== signature.keyFingerprint) return 'unknown_epoch';

  const [personSnap, eventsSnap] = await Promise.all([
    getDoc(doc(db, 'persons', uid)),
    getDocs(collection(db, 'persons', uid, 'keyEvents')),
  ]);
  if (!personSnap.exists()) return 'unknown_epoch';
  const person = personSnap.data() as Record<string, unknown>;
  const currentFingerprint = typeof person.signingKeyFingerprint === 'string'
    ? person.signingKeyFingerprint : '';
  const personLid = typeof person.lid === 'string' ? person.lid : '';
  const events: KeyEvent[] = eventsSnap.docs.flatMap(eventDoc => {
    const event = eventDoc.data() as Record<string, unknown>;
    const type = event.type;
    const recordedAtMs = timestampMillis(event.recordedAt);
    if (
      !['anchor', 'rotate', 'freeze', 'recover'].includes(String(type))
      || event.lid !== personLid
      || typeof event.epochId !== 'string'
      || typeof event.keyFingerprint !== 'string'
      || !recordedAtMs
    ) return [];
    return [{
      eventId: eventDoc.id,
      type: type as KeyEvent['type'],
      epochId: event.epochId,
      keyFingerprint: event.keyFingerprint,
      recordedAtMs,
      ...(typeof event.previousFingerprint === 'string'
        ? { previousFingerprint: event.previousFingerprint } : {}),
      ...(timestampMillis(event.suspectedSince)
        ? { suspectedSinceMs: timestampMillis(event.suspectedSince) } : {}),
    }];
  });
  const epochs: KeyEpoch[] = events
    .filter(event => event.type === 'anchor' || event.type === 'rotate' || event.type === 'recover')
    .map(event => ({
      epochId: event.epochId,
      fingerprint: event.keyFingerprint,
      anchoredAtMs: event.recordedAtMs,
    }));
  return keyStandingAt({
    epochId: signature.epochId,
    keyFingerprint: signature.keyFingerprint,
    recordedAtMs: timestampMillis(signature.recordedAt),
  }, epochs, events, currentFingerprint);
}

export async function isKeyInLineage(
  uid: string,
  publicKeyB64: string,
  signature?: EpochBoundSignature,
): Promise<boolean> {
  if (!publicKeyB64) return false;
  try {
    const snap = await getDoc(doc(db, 'persons', uid, 'keys', await keyFingerprint(publicKeyB64)));
    const inLineage = snap.exists() && (snap.data() as { pubkey?: string }).pubkey === publicKeyB64;
    if (!inLineage || signature?.version !== 3) return inLineage;
    return keyStandingCounts(await getSignatureKeyStanding(uid, publicKeyB64, signature));
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
  if (!resolved) throw new Error('err_no_identity');
  return resolved;
};

async function storeAndPublish(uid: string, kp: SigningKeypair): Promise<PublishedSigningIdentity> {
  const identity = await publishPublicKey(uid, kp.publicKeyB64);
  await idbPut({ uid, privateKey: kp.privateKey, publicKey: kp.publicKey, publicKeyB64: kp.publicKeyB64 });
  return identity;
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
    if (custody !== 'ready' && custody !== 'publish_needed') return false;
    const identity = await getPublishedSigningIdentity(id);
    return !identity || identity.state === 'active';
  } catch {
    return false;
  }
}

export interface EnsureKeyResult {
  created: boolean;
  publicKeyB64: string;
  fingerprint: string;
  epochId: string;
  // The recovery phrase — returned ONCE, only when a key is freshly created. Show it to the being
  // for backup and then let it go; it is never persisted and cannot be shown again.
  recoveryPhrase?: string[];
}

// Thrown when this device cannot sign under the PUBLISHED identity:
//   'needs_restore' — this device holds NO key but an identity key is published. Silently minting a
//       fresh keypair would replace it; the being must restore from the phrase or use witnessed
//       recovery after freezing the old epoch.
//   'stale_device'  — this device holds a key, but a DIFFERENT identity key is published (another
//       device rotated). Republishing the local key would hijack the identity back; it is refused.
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
// guards), so it is refused. A different key enters only by cross-signed rotation or witnessed
// recovery, never through this restore path.
export class RestoreKeyMismatchError extends Error {
  readonly code = 'restore-mismatch' as const;
  constructor() {
    super('This recovery phrase restores a DIFFERENT key than the one published for this identity. Check the phrase; replacement needs cross-signed rotation or witnessed recovery.');
    this.name = 'RestoreKeyMismatchError';
  }
}

// Get-or-create the user's Ed25519 keypair on THIS device, guarded by the pure custody rule
// (domain/signing.keyCustody). Idempotent when device and published identity agree: the key is
// reused and NO phrase is returned (the seed is long gone). On first creation the seed is generated
// via crypto.subtle.generateKey, exported once to build the recovery phrase, then the private key
// is stored non-extractable and the public key published. It REFUSES to silently change the
// published identity in BOTH directions — no device key while one is published (needs_restore),
// and an older device key while a NEWER one is published (stale_device) — throwing
// SigningKeyNeedsRestoreError so the caller surfaces the restore flow.
export async function ensureSigningKey(uid?: string): Promise<EnsureKeyResult> {
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
    if (!existing) throw new Error('err_pubkey_check');
    published = existing.publicKeyB64;
  }
  const custody: KeyCustody = keyCustody(existing?.publicKeyB64 ?? null, published);

  if (existing) {
    if (custody === 'stale_device') {
      throw new SigningKeyNeedsRestoreError('stale_device');
    }
    const identity = await publishPublicKey(id, existing.publicKeyB64);
    if (identity.state === 'frozen') throw new SigningKeyFrozenError();
    return {
      created: false,
      publicKeyB64: existing.publicKeyB64,
      fingerprint: identity.fingerprint,
      epochId: identity.epochId,
    };
  }

  // No device key. If an identity key is already published, generating a fresh one would silently
  // replace it — refuse. Only the witnessed-recovery path may appoint a different key.
  if (custody === 'needs_restore') throw new SigningKeyNeedsRestoreError('needs_restore');

  // Generate an extractable key, export the raw 32-byte seed ONCE (JWK `d`), derive the phrase, then
  // re-import everything through keypairFromSeed so the stored private key is non-extractable and the
  // published public key is provably the one the seed (and thus the phrase) determines.
  const gen = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', gen.privateKey);
  if (!jwk.d) throw new Error('err_seed_export');
  const seed = b64UrlToBytes(jwk.d);

  const recoveryPhrase = seedToPhrase(seed);
  const kp = await keypairFromSeed(seed);
  seed.fill(0); // best-effort scrub of the raw seed from memory
  const identity = await storeAndPublish(id, kp);
  return {
    created: true,
    publicKeyB64: kp.publicKeyB64,
    fingerprint: identity.fingerprint,
    epochId: identity.epochId,
    recoveryPhrase,
  };
}

// Re-derive the keypair from a recovery phrase and install it on THIS device (non-extractable),
// re-publishing the public key. phraseToSeed throws on a mistyped phrase (checksum). The restored
// public key is identical to the original — same seed, same key (proven in the tests). A valid
// phrase that derives a DIFFERENT key than the published identity is REFUSED
// (RestoreKeyMismatchError) unless the being explicitly chose to replace it: "restore" may only
// land the key it claims to restore, never smuggle in a new identity past the start-fresh warning.
export async function restoreFromPhrase(words: string[], uid?: string): Promise<{ publicKeyB64: string }> {
  const id = currentUid(uid);
  const seed = phraseToSeed(words); // throws on unknown word / bad checksum
  const kp = await keypairFromSeed(seed);
  seed.fill(0);
  if (restoreConflictsWithPublished(kp.publicKeyB64, await getPublishedSigningKey(id))) {
    throw new RestoreKeyMismatchError();
  }
  await storeAndPublish(id, kp);
  return { publicKeyB64: kp.publicKeyB64 };
}

export interface RotateSigningKeyResult {
  publicKeyB64: string;
  fingerprint: string;
  epochId: string;
  recoveryPhrase: string[];
}

// Planned rotation is continuity, not account takeover: the CURRENT private key and the NEW private
// key cross-sign one transition. A callable verifies both proofs, atomically retires the old epoch,
// anchors the new one, and only then does this device install the new non-extractable key.
export async function rotateSigningKey(uid?: string): Promise<RotateSigningKeyResult> {
  const id = currentUid(uid);
  const current = await idbGet(id);
  if (!current) throw new SigningKeyNeedsRestoreError('needs_restore');
  const published = await getPublishedSigningIdentity(id);
  if (!published || published.publicKeyB64 !== current.publicKeyB64) {
    throw new SigningKeyNeedsRestoreError(published ? 'stale_device' : 'needs_restore');
  }
  if (published.state === 'frozen') throw new SigningKeyFrozenError();
  if (!published.lid) throw new Error('err_lid_before_rotation');

  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  const recoveryPhrase = seedToPhrase(seed);
  const next = await keypairFromSeed(seed);
  seed.fill(0);
  const toFingerprint = await keyFingerprint(next.publicKeyB64);
  const eventId = uuidv7();
  const claim = {
    uid: id,
    lid: published.lid,
    eventId,
    fromFingerprint: published.fingerprint,
    toFingerprint,
  };
  const preimage = keyRotationPreimage(claim);
  const [oldSig, newSig] = await Promise.all([
    signPreimage(current.privateKey, preimage),
    signPreimage(next.privateKey, preimage),
  ]);
  const rotate = httpsCallable(functions, 'rotateSigningKey');
  try {
    await rotate({
      eventId,
      lid: published.lid,
      fromPubkey: current.publicKeyB64,
      toPubkey: next.publicKeyB64,
      fromFingerprint: published.fingerprint,
      toFingerprint,
      oldSig,
      newSig,
    });
  } catch (error) {
    // A lost response after a committed transaction must not strand the being between epochs.
    const after = await getPublishedSigningIdentity(id).catch(() => null);
    if (!after || after.epochId !== eventId || after.publicKeyB64 !== next.publicKeyB64) throw error;
  }
  await idbPut({
    uid: id,
    privateKey: next.privateKey,
    publicKey: next.publicKey,
    publicKeyB64: next.publicKeyB64,
  });
  return {
    publicKeyB64: next.publicKeyB64,
    fingerprint: toFingerprint,
    epochId: eventId,
    recoveryPhrase,
  };
}

// Emergency freeze is intentionally possible from authenticated account access even when the
// private key is gone: its only power is to STOP future signatures. It cannot appoint a replacement
// key or erase an earlier seal. Recovery remains a separate witnessed act.
export async function freezeSigningKey(uid?: string, suspectedSinceMs?: number): Promise<void> {
  const id = currentUid(uid);
  const identity = await getPublishedSigningIdentity(id);
  if (!identity) throw new Error('err_no_anchor_freeze');
  if (identity.state === 'frozen') return;
  if (
    suspectedSinceMs !== undefined
    && (!Number.isFinite(suspectedSinceMs) || suspectedSinceMs > Date.now())
  ) throw new Error('err_compromise_future');
  if (suspectedSinceMs !== undefined) {
    const epoch = await getDoc(doc(db, 'persons', id, 'keyEvents', identity.epochId));
    const anchoredAt = timestampMillis(epoch.data()?.recordedAt);
    if (!anchoredAt || suspectedSinceMs < anchoredAt) {
      throw new Error('err_compromise_predates');
    }
  }

  const personRef = doc(db, 'persons', id);
  const eventId = `freeze_${identity.epochId}`;
  const batch = writeBatch(db);
  batch.set(doc(personRef, 'keyEvents', eventId), {
    version: 1,
    type: 'freeze',
    uid: id,
    lid: identity.lid,
    epochId: identity.epochId,
    keyFingerprint: identity.fingerprint,
    recordedAt: serverTimestamp(),
    ...(suspectedSinceMs !== undefined
      ? { claimedSuspectedSince: Timestamp.fromMillis(suspectedSinceMs) } : {}),
  });
  batch.update(personRef, {
    signingState: 'frozen',
    signingFrozenAt: serverTimestamp(),
    signingFreezeEventId: eventId,
  });
  try {
    await batch.commit();
  } catch (error) {
    // Concurrent emergency gestures converge on the same one-way frozen state.
    const after = await getPublishedSigningIdentity(id).catch(() => null);
    if (after?.state !== 'frozen' || after.fingerprint !== identity.fingerprint) throw error;
  }
}

interface RecoveryProposal {
  uid: string;
  lid: string;
  status: 'open' | 'activated';
  fromFingerprint: string;
  toFingerprint: string;
  toPubkey: string;
  suspectedSinceMs: number;
}

export interface PendingRecovery {
  eventId: string;
  recoveryCode: string;
  witnessCount: number;
}

export async function getPendingSigningKeyRecovery(uid?: string): Promise<PendingRecovery | null> {
  const id = currentUid(uid);
  const pending = await idbPendingFor(id);
  if (!pending) return null;
  const witnesses = await getDocs(collection(
    db, 'persons', id, 'keyRecoveries', pending.eventId, 'witnesses',
  ));
  return {
    eventId: pending.eventId,
    recoveryCode: pending.recoveryCode,
    witnessCount: new Set(witnesses.docs.flatMap(witness => {
      const witnessUid = (witness.data() as { witnessUid?: unknown }).witnessUid;
      return typeof witnessUid === 'string' ? [witnessUid] : [];
    })).size,
  };
}

export interface BeginRecoveryResult extends PendingRecovery {
  recoveryPhrase: string[];
}

export async function beginSigningKeyRecovery(uid?: string): Promise<BeginRecoveryResult> {
  const id = currentUid(uid);
  if (await idbPendingFor(id)) {
    throw new Error('err_recovery_pending');
  }
  const personRef = doc(db, 'persons', id);
  const personSnap = await getDoc(personRef);
  const person = personSnap.data() as Record<string, unknown> | undefined;
  if (
    !person
    || person.signingState !== 'frozen'
    || typeof person.lid !== 'string'
    || typeof person.signingKeyFingerprint !== 'string'
    || typeof person.signingFreezeEventId !== 'string'
  ) throw new Error('err_freeze_before_recovery');
  const freezeSnap = await getDoc(doc(personRef, 'keyEvents', person.signingFreezeEventId));
  const freeze = freezeSnap.data() as Record<string, unknown> | undefined;
  const freezeAt = timestampMillis(freeze?.recordedAt);
  const suspectedSinceMs = timestampMillis(freeze?.claimedSuspectedSince) || freezeAt;
  if (!freezeAt || suspectedSinceMs > freezeAt) throw new Error('err_freeze_incomplete');

  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  const recoveryPhrase = seedToPhrase(seed);
  const next = await keypairFromSeed(seed);
  seed.fill(0);
  const toFingerprint = await keyFingerprint(next.publicKeyB64);
  const eventId = uuidv7();
  const claim = {
    uid: id,
    lid: person.lid,
    eventId,
    fromFingerprint: person.signingKeyFingerprint,
    toFingerprint,
    suspectedSinceMs,
  };
  const newSig = await signPreimage(next.privateKey, keyRecoveryPreimage(claim));
  const begin = httpsCallable(functions, 'beginSigningKeyRecovery');
  try {
    await begin({ eventId, toPubkey: next.publicKeyB64, toFingerprint, newSig });
  } catch (error) {
    // As with rotation, recover from a committed callable whose response was lost.
    const proposal = await getDoc(doc(personRef, 'keyRecoveries', eventId)).catch(() => null);
    if (
      !proposal?.exists()
      || (proposal.data() as RecoveryProposal).toPubkey !== next.publicKeyB64
    ) throw error;
  }
  const recoveryCode = `${id}:${eventId}`;
  await idbPutPending({
    uid: id,
    eventId,
    recoveryCode,
    privateKey: next.privateKey,
    publicKey: next.publicKey,
    publicKeyB64: next.publicKeyB64,
  });
  return { eventId, recoveryCode, witnessCount: 0, recoveryPhrase };
}

const parseRecoveryCode = (code: string): { targetUid: string; eventId: string } => {
  const split = code.trim().lastIndexOf(':');
  if (split < 1 || split === code.trim().length - 1) {
    throw new Error('err_recovery_code_incomplete');
  }
  return {
    targetUid: code.trim().slice(0, split),
    eventId: code.trim().slice(split + 1),
  };
};

export interface RecoveryPreview {
  targetUid: string;
  targetName: string;
  targetLid: string;
  eventId: string;
  fromFingerprint: string;
  toFingerprint: string;
  suspectedSinceMs: number;
}

export async function getSigningKeyRecoveryPreview(code: string): Promise<RecoveryPreview> {
  const { targetUid, eventId } = parseRecoveryCode(code);
  const [personSnap, proposalSnap] = await Promise.all([
    getDoc(doc(db, 'persons', targetUid)),
    getDoc(doc(db, 'persons', targetUid, 'keyRecoveries', eventId)),
  ]);
  if (!proposalSnap.exists()) throw new Error('err_recovery_not_open');
  const proposal = proposalSnap.data() as RecoveryProposal;
  if (proposal.status !== 'open') throw new Error('err_recovery_closed');
  const person = personSnap.data() as Record<string, unknown> | undefined;
  return {
    targetUid,
    targetName: typeof person?.displayName === 'string' && person.displayName
      ? person.displayName : targetUid,
    targetLid: proposal.lid,
    eventId,
    fromFingerprint: proposal.fromFingerprint,
    toFingerprint: proposal.toFingerprint,
    suspectedSinceMs: proposal.suspectedSinceMs,
  };
}

export async function witnessSigningKeyRecovery(code: string, uid?: string): Promise<void> {
  const witnessUid = currentUid(uid);
  const { targetUid, eventId } = parseRecoveryCode(code);
  if (targetUid === witnessUid) throw new Error('err_own_recovery');
  const proposalSnap = await getDoc(doc(db, 'persons', targetUid, 'keyRecoveries', eventId));
  if (!proposalSnap.exists()) throw new Error('err_recovery_not_open');
  const proposal = proposalSnap.data() as RecoveryProposal;
  if (proposal.status !== 'open') throw new Error('err_recovery_closed');
  if (!(await idbGet(witnessUid))) {
    throw new Error('err_witness_key_first');
  }
  const key = await ensureSigningKey(witnessUid);
  const claim = {
    uid: targetUid,
    lid: proposal.lid,
    eventId,
    fromFingerprint: proposal.fromFingerprint,
    toFingerprint: proposal.toFingerprint,
    suspectedSinceMs: proposal.suspectedSinceMs,
  };
  const sig = await signPreimage(
    (await idbGet(witnessUid))!.privateKey,
    keyRecoveryWitnessPreimage(claim, witnessUid),
  );
  const witness = httpsCallable(functions, 'witnessSigningKeyRecovery');
  await witness({
    targetUid,
    eventId,
    sig,
    pubkey: key.publicKeyB64,
    keyFingerprint: key.fingerprint,
    epochId: key.epochId,
  });
}

export async function activateSigningKeyRecovery(uid?: string): Promise<PublishedSigningIdentity> {
  const id = currentUid(uid);
  const pending = await idbPendingFor(id);
  if (!pending) throw new Error('err_recovery_key_absent');
  const activate = httpsCallable(functions, 'activateSigningKeyRecovery');
  try {
    await activate({ eventId: pending.eventId });
  } catch (error) {
    const after = await getPublishedSigningIdentity(id).catch(() => null);
    if (!after || after.epochId !== pending.eventId || after.publicKeyB64 !== pending.publicKeyB64) {
      throw error;
    }
  }
  await idbPut({
    uid: id,
    privateKey: pending.privateKey,
    publicKey: pending.publicKey,
    publicKeyB64: pending.publicKeyB64,
  });
  await idbDeletePending(pending.eventId);
  const identity = await getPublishedSigningIdentity(id);
  if (!identity) throw new Error('err_recovered_identity');
  return identity;
}

// Sign a payload under a domain tag with THIS device's private key. Throws if no key is installed.
export async function sign(payload: unknown, domainTag: string, uid?: string): Promise<string> {
  const id = currentUid(uid);
  const record = await idbGet(id);
  if (!record) throw new Error('err_no_device_key');
  const identity = await getPublishedSigningIdentity(id);
  if (!identity || identity.publicKeyB64 !== record.publicKeyB64) {
    throw new SigningKeyNeedsRestoreError(identity ? 'stale_device' : 'needs_restore');
  }
  if (identity.state === 'frozen') throw new SigningKeyFrozenError();
  return signPayload(record.privateKey, payload, domainTag);
}

export class SigningKeyFrozenError extends Error {
  readonly code = 'signing-key-frozen' as const;
  constructor() {
    super('This signing key is frozen. It cannot make new seals; recovery needs witnessed authority.');
    this.name = 'SigningKeyFrozenError';
  }
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
