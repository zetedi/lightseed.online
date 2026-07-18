import type { Timestamp } from 'firebase/firestore';
import type { Being } from './being';

// THE COVENANT — the two-sided cryptographic mint (Covenant, phase 2), standing on the signing
// crystal (domain/signing.ts + services/keys.ts). A covenant is a BEING with its OWN chain: it is
// PROPOSED with a frozen identity, its named parties each SIGN in their own hand (Ed25519), and it
// SEALS only when a quorum of signatures all verify against that frozen identity. Un-forgeability is
// the SIGNATURES, not the flag — a forged `status: 'sealed'` with no valid signatures fails
// verifyCovenant. Breaking it is a marked block + `status: 'broken'`, never a delete (the append-only,
// guardian-veto ethic — the chain stays honest even when the promise doesn't hold).
//
// This module is PURE: the covenant type, the canonical-identity builder, the signing domain tag,
// and the quorum logic. No crypto, no Firestore. The crypto lives in services/keys.ts; the mint,
// the seal, and the verification wiring in services/firebase/covenants.ts.

// The domain tag that sits INSIDE every covenant signature's preimage (signingPreimage). Versioned
// and domain-separated exactly like SIGNING_VERSION: a signature minted for a covenant can never be
// replayed as a Council decision (phase 3) or any other signed artifact — the purpose is signed.
// v2 — SIGNER-BOUND: the signed payload is covenantSignaturePayload (the identity PLUS the signer's
// uid), so a valid signature is non-transferable between slots. v1 signed the bare identity, which
// made a world-readable signature copyable into another signer's slot (quorum inflation); no legacy
// v1 verification path exists — prod held only unsigned covenants at the cutover.
export const COVENANT_DOMAIN = 'lifeseed.covenant.v2';

// 'alignment' — the 2-party form (the resonance handshake, quorum 2). 'covenant' — the general
// N-party pledge (a charter, a shared vow). Same machinery; the kind is inside the signed identity.
export type CovenantKind = 'alignment' | 'covenant';

// proposed → sealed (the quorum signed) — or → broken (a party marked it broken; never deleted).
export type CovenantStatus = 'proposed' | 'sealed' | 'broken';

// WHO a party is — carried as a `party` LINK (links-over-arrays): partyUid __party__ covenantId,
// data { role? }. The role is a free label ('initiator', 'target', 'witness', …) inside the signed
// identity, so a party signs not only THAT they are a party but WHAT role they hold.
export interface CovenantParty {
  uid: string;
  role?: string;
}

// The covenant Being as stored in the `covenants` collection. Its identity fields (kind/title/body/
// quorum/genesisHash + its parties) are FROZEN after propose — what a party signs can never change
// under them. Only the chain head (latestHash/blockHeight), status, and sealedAt advance.
export interface Covenant extends Being {
  id: string;
  lid: string;
  genesisHash: string;
  latestHash: string;
  blockHeight: number;
  kind: CovenantKind;
  title: string;
  body: string;
  quorum: number;         // signatures needed to seal
  proposedBy: string;     // uid of the being who minted it (may itself be a party)
  status: CovenantStatus;
  createdAt?: Timestamp;
  sealedAt?: Timestamp;
}

// The CANONICAL COVENANT IDENTITY — the exact value every party signs (under COVENANT_DOMAIN). It is
// the frozen essence of the covenant: its true name, its kind, its words, its quorum, its chain root,
// and its parties SORTED BY UID (so the same set of parties always yields the same bytes, regardless
// of the order they were minted). Each party is normalised to { uid, role } with an absent role as ''
// — deterministic, and matching how canonicalize() drops nothing and encodes strings by type. Because
// this is what the signature covers, freezing these fields in the doc (the rules) means a signed
// covenant can never be altered under a signer.
export interface CovenantIdentity {
  lid: string;
  kind: CovenantKind;
  title: string;
  body: string;
  quorum: number;
  genesisHash: string;
  parties: { uid: string; role: string }[];
}

export function covenantIdentity(
  c: Pick<Covenant, 'lid' | 'kind' | 'title' | 'body' | 'quorum' | 'genesisHash'>,
  parties: readonly CovenantParty[],
): CovenantIdentity {
  return {
    lid: c.lid,
    kind: c.kind,
    title: c.title,
    body: c.body,
    quorum: c.quorum,
    genesisHash: c.genesisHash,
    // Sort by uid (a stable total order) so party mint order never changes the signed bytes; an
    // absent role normalises to '' so a party's identity slot is deterministic.
    parties: [...parties]
      .map(p => ({ uid: p.uid, role: p.role ?? '' }))
      .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)),
  };
}

// The exact value a party signs under COVENANT_DOMAIN (v2): the covenant identity BOUND to the
// signer's own uid. Binding the signer INTO the signed bytes makes a signature NON-TRANSFERABLE: a
// copied signature, replayed into another slot, is verified against THAT slot's uid — and fails.
// This is the constitutional guard against quorum inflation (one hand occupying many slots), and it
// holds even if every outer guard (path authority, dedupe, rules field-locks) were to fail.
export interface CovenantSignaturePayload {
  covenant: CovenantIdentity;
  signer: string;
}

export function covenantSignaturePayload(identity: CovenantIdentity, signerUid: string): CovenantSignaturePayload {
  return { covenant: identity, signer: signerUid };
}

// PATH AUTHORITY — a signature's signer IS its doc id. The body fields spread FIRST and the
// path-derived uid lands LAST, so a malicious body `uid` field can never override the authenticated
// slot the rules bound the write to. Every signature reader maps through this.
export function signatureFromDoc<T extends object>(docId: string, data: T): T & { uid: string } {
  return { ...data, uid: docId };
}

// The FAST PATH of identity binding: the recorded pubkey EQUALS the being's currently-published key
// at persons/{uid}.publicKeyPem (base64 SPKI). The recorded pubkey is still kept on the signature
// doc for OFFLINE/portable verification (it is pinned at signing). This alone is no longer the ONLY
// gate — see signatureBindsToIdentityOrLineage below: a rotated-away key binds through the lineage.
// A party who has published NO key (empty) can never bind through this path.
export function signatureBindsToIdentity(recordedPubkey: string, publishedPubkey: string): boolean {
  return publishedPubkey !== '' && recordedPubkey === publishedPubkey;
}

// KEY CONTINUITY — the lineage fallback (verify-at-signing-time, first step). When a signature's
// recorded pubkey no longer equals the CURRENT published key, it may still bind to the signer's
// identity through their APPEND-ONLY key lineage (persons/{uid}/keys/{fingerprint}): a key the being
// itself published, under a record only the being could create, that no one — not even staff — can
// delete or rewrite. History thus SURVIVES rotation: restoring on a new device, starting fresh, or
// a staff-overwritten publicKeyPem no longer silently unbinds every seal a being ever made. A
// THROWAWAY key still never counts — it was never published to the lineage. Injected (like the
// verifier) so the counting rule stays pure; production wires services/keys.isKeyInLineage.
export type LineageCheck = (uid: string, pubkeyB64: string) => Promise<boolean>;

// THE ONE BINDING GATE both counting rules (covenant + decision) share: a signature binds to the
// signer's identity iff its recorded pubkey is the CURRENT published key (fast path) OR a key in
// the signer's append-only lineage. Non-repudiation stands on "a key the being itself published" —
// current or historical. Known, deliberate residual until the revocation ring: a key once published
// binds FOREVER (the lineage never deletes), so lineage membership cannot retire a compromised key;
// the perimeter against abuse is that a signature slot can only ever be WRITTEN by the
// authenticated being itself (rules: doc id == request.auth.uid).
export async function signatureBindsToIdentityOrLineage(
  uid: string,
  recordedPubkey: string,
  publishedPubkey: string,
  lineage?: LineageCheck,
): Promise<boolean> {
  if (signatureBindsToIdentity(recordedPubkey, publishedPubkey)) return true;
  return lineage ? lineage(uid, recordedPubkey) : false;
}

// The DETERMINISTIC covenant id for an alignment's cryptographic twin. Derived purely from the
// alignmentId so that two parties opening the same alignment simultaneously converge on ONE covenant
// doc (create-if-absent), instead of racing to mint two docs that split the signatures so neither ever
// reaches quorum. Stable and idempotent: the same alignmentId always yields the same covenant id, so
// the migration and the live get-or-mint agree. Namespaced (`align_`) so it can never collide with an
// auto-id covenant minted by proposeCovenant.
export function alignmentCovenantId(alignmentId: string): string {
  return `align_${alignmentId}`;
}

// A recorded signature as read from the signatures subcollection — its uid is PATH-AUTHORITATIVE
// (the doc id via signatureFromDoc), never a body field.
export interface RecordedSignature {
  uid: string;
  sig: string;
  pubkey: string;
}

// An injected Ed25519 verifier (services/signingCrypto.verifyPayload in production) — kept OUT of
// this module so the counting rule stays pure and unit-testable without WebCrypto wiring.
export type SignatureVerifier = (
  publicKeyB64: string,
  signatureB64: string,
  payload: unknown,
  domainTag: string,
) => Promise<boolean>;

// The signatures that seal a covenant — the ONE counting rule verifyCovenant and the tests share.
// Returns the SET of verified signer uids (the seal block records exactly these — an invalid
// signature doc can never place a name in the seal's signer list). Four gates, in order:
//   (1) DEDUPE — at most ONE counted signature per signer uid; a second record claiming the same
//       hand can never inflate the quorum.
//   (2) PARTY — the signer must be on the frozen roster.
//   (3) IDENTITY-KEY BINDING — the recorded pubkey must equal the signer's published key, OR be a
//       key in the signer's append-only lineage (LineageCheck — history survives rotation).
//   (4) SIGNER-BOUND CRYPTO — the signature must verify the v2 payload bound to the RECORD'S OWN
//       uid, so a signature minted by one hand can never verify in another's slot.
export async function verifiedCovenantSigners(
  identity: CovenantIdentity,
  sigs: readonly RecordedSignature[],
  partyUids: ReadonlySet<string>,
  publishedKeys: ReadonlyMap<string, string>,
  verify: SignatureVerifier,
  lineage?: LineageCheck,
): Promise<Set<string>> {
  const counted = new Set<string>();
  for (const s of sigs) {
    if (counted.has(s.uid)) continue;                  // one hand, one signature — never two slots
    if (!partyUids.has(s.uid)) continue;               // a signature from a non-party never counts
    if (!(await signatureBindsToIdentityOrLineage(s.uid, s.pubkey, publishedKeys.get(s.uid) ?? '', lineage))) continue;
    if (await verify(s.pubkey, s.sig, covenantSignaturePayload(identity, s.uid), COVENANT_DOMAIN)) {
      counted.add(s.uid);
    }
  }
  return counted;
}

// The quorum count is the size of the verified-signers set — one rule, two readings.
export async function countVerifiedCovenantSignatures(
  identity: CovenantIdentity,
  sigs: readonly RecordedSignature[],
  partyUids: ReadonlySet<string>,
  publishedKeys: ReadonlyMap<string, string>,
  verify: SignatureVerifier,
  lineage?: LineageCheck,
): Promise<number> {
  return (await verifiedCovenantSigners(identity, sigs, partyUids, publishedKeys, verify, lineage)).size;
}

// The quorum is met when at least `quorum` valid signatures stand — and a quorum of 0 or less can
// never seal (a covenant with no required signatures is not a covenant). Pure; the SEAL decision in
// the service feeds it the VERIFIED count, never a raw doc count, so the flag can't outrun the crypto.
export function isQuorumMet(signedCount: number, quorum: number): boolean {
  return quorum > 0 && signedCount >= quorum;
}

// A covenant is (cryptographically) sealed when the number of signatures that VERIFY against the
// frozen identity meets the quorum. The name reads at the call site: covenantSealed(verifiedCount,
// quorum). Same rule as isQuorumMet, named for the seal decision it expresses.
export function covenantSealed(verifiedCount: number, quorum: number): boolean {
  return isQuorumMet(verifiedCount, quorum);
}
