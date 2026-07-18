import {
  doc, setDoc, getDoc, getDocs, query, where, collection, serverTimestamp,
  runTransaction, writeBatch, type DocumentData,
} from 'firebase/firestore';
import { db, covenantsCollection, alignmentsCollection, auth, toMillis } from './core';
import { createBlock } from '../../utils/crypto';
import { uuidv7 } from '../../utils/id';
import { linkId } from '../../domain/link';
import {
  COVENANT_DOMAIN, covenantIdentity, covenantSealed, alignmentCovenantId,
  covenantSignaturePayload, verifiedCovenantSigners, signatureFromDoc,
  type Covenant, type CovenantKind, type CovenantParty,
} from '../../domain/covenant';
import { ensureSigningKey, publishSigningKey, isKeyInLineage, getPublishedSigningKey, sign as signWithKey, verify as verifyWithKey } from '../keys';

// THE COVENANT SERVICE — the two-sided cryptographic mint (phase 2). A covenant is a Being with its
// OWN chain: PROPOSED with a frozen identity + a `party` link per party, each party SIGNS its own slot
// in the covenants/{id}/signatures subcollection (Ed25519, over the canonical identity), and it SEALS
// only when a quorum of signatures ALL verify. Un-forgeability is the SIGNATURES — verifyCovenant lets
// any reader re-check a seal from the raw data. Breaking marks a block + status 'broken', never a
// delete. The pure identity/quorum logic lives in domain/covenant.ts; the crypto in services/keys.ts.

// A per-party signature doc: the base64 Ed25519 signature over the covenant identity, plus the
// signer's public key AT SIGNING TIME (base64 SPKI) — so verification never needs to trust that the
// person's currently-published key is the one that signed, and a later key rotation can't unseal.
export interface CovenantSignature {
  uid: string;       // == the signatures doc id (each party writes only their own)
  sig: string;       // base64 Ed25519 signature
  pubkey: string;    // base64 SPKI public key used to sign
  signedAt?: unknown;
}

const requireUid = (): string => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in to take part in a covenant.');
  return uid;
};

const signaturesCol = (covenantId: string) => collection(db, 'covenants', covenantId, 'signatures');

// A being's PUBLISHED identity key — persons/{uid}.publicKeyPem, read through the ONE canonical
// reader (services/keys.getPublishedSigningKey). The covenant seal binds to this key first (the fast
// path); a rotated-away key still binds through the append-only lineage (isKeyInLineage). An absent
// key reads as '' (a party who has not set up signing yet cannot contribute a counting signature).
const getPublishedKey = getPublishedSigningKey;

// ── Propose (the shared mint) ─────────────────────────────────────────────────────────────────────
// Seal the genesis, write the covenant doc (identity frozen from birth), then mint one `party` link
// per party. The covenant doc is written FIRST and awaited before the links: the links rule get()s the
// covenant to check proposedBy, and a batched write's rules can't see the batch's own not-yet-committed
// covenant doc. proposedBy is always the WRITER (the rule enforces it) — for a 2-party alignment that
// is simply whoever first mints it; quorum still requires BOTH to sign.
interface MintCovenantArgs {
  kind: CovenantKind;
  title: string;
  body: string;
  parties: CovenantParty[];
  quorum: number;
  proposedBy: string;
  id?: string;            // a CHOSEN deterministic id (the alignment twin) — create-if-absent; else auto-id
  alignmentId?: string;   // set only for the alignment retrofit — the shadow link back to the alignment
  bornAtMs?: number;      // the genesis birth-time (an alignment's own createdAt on retrofit)
}

const mintCovenant = async (args: MintCovenantArgs): Promise<{ id: string; lid: string }> => {
  const { kind, title, body, parties, quorum, proposedBy, id: chosenId, alignmentId, bornAtMs } = args;
  if (!parties.length) throw new Error('A covenant needs at least one party.');
  if (!Number.isInteger(quorum) || quorum < 1) throw new Error('A covenant needs a quorum of at least one signature.');
  if (quorum > parties.length) throw new Error('The quorum cannot exceed the number of parties.');

  // A chosen id (the alignment's deterministic twin) is created-if-absent so two simultaneous openers
  // converge on ONE doc; an auto-id (a general propose) is fresh and always created.
  const ref = chosenId ? doc(covenantsCollection, chosenId) : doc(covenantsCollection);
  const covenantId = ref.id;
  const lid = uuidv7();
  const genesisHash = await createBlock('0', { msg: 'Birth' }, bornAtMs || Date.now());

  // Create-if-absent in a transaction: if the doc already exists (a concurrent opener won the race),
  // we DON'T re-write it and DON'T re-mint its roster — both writers end up on the same covenant.
  const created = await runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (snap.exists()) return false;
    t.set(ref, {
      lid, genesisHash, latestHash: genesisHash, blockHeight: 0,
      kind, title, body, quorum, proposedBy,
      status: 'proposed',
      ...(alignmentId ? { alignmentId } : {}),
      createdAt: serverTimestamp(),
    });
    return true;
  });

  if (created) {
    // One `party` link per party — the immutable roster (WHO). Minted only by the proposer (the rule
    // reads the covenant's proposedBy). id == from__party__to so authority-by-path stays honest. The
    // covenant doc is committed (the transaction resolved) before the links, whose create rule get()s
    // it — a rule cannot see an uncommitted doc. Only the winner of the create mints the roster, so a
    // race-loser never attempts a forbidden re-write of an existing (immutable) party link.
    const batch = writeBatch(db);
    for (const p of parties) {
      batch.set(doc(db, 'links', linkId(p.uid, 'party', covenantId)), {
        lid: uuidv7(), type: 'link', rel: 'party',
        from: p.uid, to: covenantId,
        ...(p.role ? { role: p.role } : {}),
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return { id: covenantId, lid };
};

export interface ProposeCovenantInput {
  kind: CovenantKind;
  title: string;
  body: string;
  parties: CovenantParty[];
  quorum: number;
}

export const proposeCovenant = (input: ProposeCovenantInput): Promise<{ id: string; lid: string }> =>
  mintCovenant({ ...input, proposedBy: requireUid() });

// ── Read ─────────────────────────────────────────────────────────────────────────────────────────
export const getCovenant = async (id: string): Promise<Covenant | null> => {
  const snap = await getDoc(doc(covenantsCollection, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Covenant) : null;
};

// The party links → the roster (who + role). Sorting-by-uid happens inside covenantIdentity; here we
// return them in link order.
export const getCovenantParties = async (id: string): Promise<CovenantParty[]> => {
  const snap = await getDocs(query(collection(db, 'links'), where('to', '==', id), where('rel', '==', 'party')));
  return snap.docs.map(d => {
    const data = d.data() as DocumentData;
    return { uid: data.from as string, ...(data.role ? { role: data.role as string } : {}) };
  });
};

export const getCovenantSignatures = async (id: string): Promise<CovenantSignature[]> => {
  const snap = await getDocs(signaturesCol(id));
  // PATH-AUTHORITATIVE: the signer is the DOC ID (the slot the rules bound the write to). The body
  // spreads FIRST and the id lands LAST (signatureFromDoc), so a malicious body `uid` field can
  // never claim another signer's slot.
  return snap.docs.map(d => signatureFromDoc(d.id, d.data() as DocumentData) as CovenantSignature);
};

// Everything a Covenant profile needs, in one call: the doc, its parties, and its signatures.
export const getCovenantBundle = async (id: string): Promise<{
  covenant: Covenant | null; parties: CovenantParty[]; signatures: CovenantSignature[];
}> => {
  const [covenant, parties, signatures] = await Promise.all([
    getCovenant(id), getCovenantParties(id), getCovenantSignatures(id),
  ]);
  return { covenant, parties, signatures };
};

// ── Verify (any reader) ────────────────────────────────────────────────────────────────────────
// Re-derive the frozen identity, then count the signatures that (a) belong to a real party, (b) were
// signed with the party's IDENTITY KEY — the recorded pubkey must EQUAL the currently-published
// persons/{uid}.publicKeyPem, OR be a key in the party's append-only lineage at persons/{uid}/keys
// (KEY CONTINUITY: rotation/recovery no longer unbinds history) — and (c) cryptographically verify
// against that identity. The identity binding (b) is what makes the seal NON-REPUDIABLE: a throwaway
// key a signer records in their own signature doc was never published to their lineage, so it never
// counts. `sealed` is whether the crypto meets the quorum RIGHT NOW; `valid` is whether the
// covenant's CLAIMED status is honest — a doc flipped to 'sealed' with no counting signatures fails
// here. `verifiedSigners` (sorted) is the only list a seal block may record.
export const verifyCovenant = async (
  covenant: Pick<Covenant, 'lid' | 'kind' | 'title' | 'body' | 'quorum' | 'genesisHash' | 'status'>,
  parties: CovenantParty[],
  sigs: CovenantSignature[],
): Promise<{ valid: boolean; verifiedCount: number; sealed: boolean; verifiedSigners: string[] }> => {
  const identity = covenantIdentity(covenant, parties);
  const partyUids = new Set(parties.map(p => p.uid));
  // Each party's currently-published identity key (world-readable) — the fast path; the lineage
  // lookup runs lazily, only for a signature whose recorded pubkey no longer equals it.
  const published = new Map<string, string>();
  await Promise.all([...partyUids].map(async uid => published.set(uid, await getPublishedKey(uid))));
  // The counting rule is PURE (domain/covenant.ts) and shared with the adversarial tests: at most one
  // counted signature per uid (dedupe), party-gated, identity-bound (published key or lineage), and
  // each signature verified against the v2 payload bound to the RECORD'S OWN path-uid.
  const signers = await verifiedCovenantSigners(identity, sigs, partyUids, published, verifyWithKey, isKeyInLineage);
  const sealed = covenantSealed(signers.size, covenant.quorum);
  // If the doc claims 'sealed', the crypto must back it; otherwise nothing is being forged.
  const valid = covenant.status === 'sealed' ? sealed : true;
  return { valid, verifiedCount: signers.size, sealed, verifiedSigners: [...signers].sort() };
};

// ── Sign (and seal, if this signature lands the quorum) ───────────────────────────────────────────
// Ensure the caller has a device key (returning the recovery phrase ONCE if freshly created, for the
// UI to surface), confirm they are a party, sign the canonical identity, write their OWN signature
// slot. Then re-read + verify all signatures and, if the quorum is met, seal the chain in a
// transaction (the client that lands the quorum-th valid signature seals; the transaction re-checks
// status so a concurrent sealer can't double-advance the chain).
export interface SignCovenantResult {
  sealed: boolean;
  verifiedCount: number;
  // Present ONLY when the device key was created during this call — surface it for backup, then let
  // it go (it is never persisted and cannot be shown again).
  recoveryPhrase?: string[];
}

export const signCovenant = async (covenant: Pick<Covenant, 'id'>): Promise<SignCovenantResult> => {
  const uid = requireUid();
  const covenantId = covenant.id;

  // The freshest identity: re-read the doc + parties (the passed covenant can be stale).
  const [fresh, parties] = await Promise.all([getCovenant(covenantId), getCovenantParties(covenantId)]);
  if (!fresh) throw new Error('This covenant no longer exists.');
  if (!parties.some(p => p.uid === uid)) throw new Error('Only a party to this covenant may sign it.');

  const key = await ensureSigningKey(uid);   // idempotent — creates on first use, returns the phrase once

  // The seal binds to the PUBLISHED identity key (verifyCovenant): this signature only counts if its
  // pubkey equals persons/{uid}.publicKeyPem. ensureSigningKey already (re)publishes the device key, so
  // they are equal by construction — but assert + self-heal so a past failed publish can't make this
  // signature silently fail to count. If it still can't be published, refuse rather than write a seal
  // that will never verify.
  if ((await getPublishedKey(uid)) !== key.publicKeyB64) {
    await publishSigningKey(uid, key.publicKeyB64);
    if ((await getPublishedKey(uid)) !== key.publicKeyB64) {
      throw new Error('Your published signing key could not be set. Please try again in a moment.');
    }
  }

  // SIGNER-BOUND (v2): the signed bytes carry the covenant identity AND this signer's uid, so this
  // signature can only ever verify in this party's own slot — it is non-transferable by construction.
  const identity = covenantIdentity(fresh, parties);
  const sig = await signWithKey(covenantSignaturePayload(identity, uid), COVENANT_DOMAIN, uid);

  // Each party writes ONLY their own slot (doc id == uid); the rules enforce it and that the writer
  // is a party. The pubkey is frozen here so verification never depends on a later-rotated key.
  await setDoc(doc(signaturesCol(covenantId), uid), {
    sig, pubkey: key.publicKeyB64, signedAt: serverTimestamp(),
  });

  // Re-read every signature and verify against the frozen identity — the quorum is counted from
  // VERIFIED signatures, never a raw doc count, so the seal can never outrun the crypto.
  const sigs = await getCovenantSignatures(covenantId);
  const { verifiedCount, sealed, verifiedSigners } = await verifyCovenant(fresh, parties, sigs);

  if (sealed && fresh.status !== 'sealed') {
    // The seal block records ONLY the cryptographically verified signers (verifiedSigners) — an
    // invalid signature doc in a party's slot can never place that party's name in the seal.
    await runTransaction(db, async (t) => {
      const ref = doc(covenantsCollection, covenantId);
      const snap = await t.get(ref);
      if (!snap.exists()) throw new Error('Covenant vanished mid-seal.');
      const c = snap.data() as Covenant;
      if (c.status === 'sealed') return;   // another client already sealed — nothing to do
      const prev = c.latestHash || c.genesisHash || '0';
      const sealHash = await createBlock(prev, { sealed: true, signers: verifiedSigners }, Date.now());
      t.update(ref, {
        latestHash: sealHash,
        blockHeight: (c.blockHeight || 0) + 1,
        status: 'sealed',
        sealedAt: serverTimestamp(),
      });
    });
  }

  return { sealed, verifiedCount, ...(key.created && key.recoveryPhrase ? { recoveryPhrase: key.recoveryPhrase } : {}) };
};

// ── Break ────────────────────────────────────────────────────────────────────────────────────────
// Mark the covenant broken: append a break block to its chain and set status 'broken'. NEVER a delete
// — the chain stays honest even when the promise doesn't hold (the append-only, guardian-veto ethic).
// A party (or the proposer, or staff — per the rules) may break it; a sealed covenant keeps its seal
// block, the break simply follows it.
export const breakCovenant = async (id: string): Promise<void> => {
  const uid = requireUid();
  await runTransaction(db, async (t) => {
    const ref = doc(covenantsCollection, id);
    const snap = await t.get(ref);
    if (!snap.exists()) throw new Error('This covenant no longer exists.');
    const c = snap.data() as Covenant;
    if (c.status === 'broken') return;
    const prev = c.latestHash || c.genesisHash || '0';
    const breakHash = await createBlock(prev, { broken: true, by: uid }, Date.now());
    t.update(ref, {
      latestHash: breakHash,
      blockHeight: (c.blockHeight || 0) + 1,
      status: 'broken',
    });
  });
};

// ── Alignment retrofit (additive) ─────────────────────────────────────────────────────────────────
// The alignment IS the canonical 2-party covenant. These helpers wire covenant-signing onto the
// alignment WITHOUT touching the alignment doc: the covenant carries the shadow `alignmentId`, so we
// find (or lazily mint) it by query — the alignment keeps working exactly as before, and gains a
// cryptographic twin. The shape a caller supplies is the minimum an alignment already holds.
export interface AlignmentForCovenant {
  id: string;
  initiatorUid: string;
  targetUid: string;
  createdAt?: { toMillis?: () => number } | null;
}

// The covenant shadowing an alignment, if one exists yet. Read DIRECTLY by the deterministic twin id
// (alignmentCovenantId) — a single get, no index, and the same id the get-or-mint / migration converge
// on. (The `alignmentId` field is still stored on the doc for provenance and legacy queries.)
export const getCovenantForAlignment = async (alignmentId: string): Promise<Covenant | null> =>
  getCovenant(alignmentCovenantId(alignmentId));

// Get-or-mint the alignment's covenant (the 2-party form: initiator + target, quorum 2). Race-free and
// idempotent: the covenant's doc id is DETERMINISTIC from the alignmentId (alignmentCovenantId), so two
// parties opening the same alignment at once converge on ONE covenant doc (mintCovenant is create-if-
// absent) instead of minting two that split the signatures. The first opener mints it (proposedBy =
// themself, which the rule requires) and its roster; both must still sign to seal. Purely additive: the
// alignment doc is untouched.
export const ensureAlignmentCovenant = async (alignment: AlignmentForCovenant): Promise<Covenant> => {
  const uid = requireUid();
  const covenantId = alignmentCovenantId(alignment.id);
  const existing = await getCovenant(covenantId);
  if (existing) return existing;
  await mintCovenant({
    kind: 'alignment',
    title: 'Alignment',
    body: 'A resonance between two lifetrees, sealed on both chains.',
    parties: [
      { uid: alignment.initiatorUid, role: 'initiator' },
      { uid: alignment.targetUid, role: 'target' },
    ],
    quorum: 2,
    proposedBy: uid,
    id: covenantId,
    alignmentId: alignment.id,
    bornAtMs: toMillis(alignment.createdAt) || Date.now(),
  });
  const minted = await getCovenant(covenantId);
  if (!minted) throw new Error('Could not read the covenant just minted for this alignment.');
  return minted;
};

// Accepting (or opening) an alignment SIGNS its covenant: ensure the twin exists, then sign the
// caller's slot (which seals it once both parties have signed). This is the hook the accept flow calls.
export const signAlignmentCovenant = async (alignment: AlignmentForCovenant): Promise<SignCovenantResult & { covenantId: string }> => {
  const covenant = await ensureAlignmentCovenant(alignment);
  const res = await signCovenant({ id: covenant.id });
  return { ...res, covenantId: covenant.id };
};

// ── Migration (BUILT, NOT RUN) ────────────────────────────────────────────────────────────────────
// Walk existing alignments and mint each one's covenant + two party links — ADDITIVELY (the alignment
// docs are left untouched and keep working). Signatures are NOT forged (no server holds a private key),
// so a migrated covenant starts UNSEALED and is re-signed by each party in the app when they next open
// it. Idempotent: an alignment that already has a shadow covenant (found by alignmentId) is skipped.
// Staff-run from the superadmin console; NOT invoked anywhere. Runs as staff, so mintCovenant's writes
// pass under the rules' staff escape hatch (covenant create + link create both allow isStaff()).
export const migrateAlignmentsToCovenants = async (): Promise<{ created: number; skipped: number }> => {
  const snap = await getDocs(alignmentsCollection);
  let created = 0, skipped = 0;
  for (const d of snap.docs) {
    const a = d.data() as DocumentData;
    const initiatorUid = a.initiatorUid as string | undefined;
    const targetUid = a.targetUid as string | undefined;
    if (!initiatorUid || !targetUid) { skipped++; continue; }
    const covenantId = alignmentCovenantId(d.id);
    if (await getCovenant(covenantId)) { skipped++; continue; }   // already migrated (same deterministic id)
    await mintCovenant({
      kind: 'alignment',
      title: 'Alignment',
      body: 'A resonance between two lifetrees, sealed on both chains.',
      parties: [
        { uid: initiatorUid, role: 'initiator' },
        { uid: targetUid, role: 'target' },
      ],
      quorum: 2,
      // proposedBy = the initiator (the covenant's author); staff run the write, exempt by the rules.
      proposedBy: initiatorUid,
      id: covenantId,   // deterministic — converges with the live get-or-mint, so the migration is idempotent
      alignmentId: d.id,
      bornAtMs: toMillis(a.createdAt) || Date.now(),
    });
    created++;
  }
  return { created, skipped };
};
