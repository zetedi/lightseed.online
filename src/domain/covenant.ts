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
export const COVENANT_DOMAIN = 'lifeseed.covenant.v1';

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

// The seal binds to the being's PUBLISHED IDENTITY KEY, not merely "a key in the slot". A signature
// counts toward the quorum ONLY IF the pubkey it recorded at signing time EQUALS the party's currently
// published key at persons/{uid}.publicKeyPem (base64 SPKI). The recorded pubkey is still kept on the
// signature doc for OFFLINE/portable verification (it is pinned at signing); this predicate is the
// additional gate that makes the seal NON-REPUDIABLE: a malicious self-signer can no longer sign with a
// throwaway key (recorded in their own signature) and later disown it as "not my key" — a throwaway
// key never equals the published identity key, so it never counts. A party who has published NO key
// (empty) simply cannot contribute a counting signature until they set their signing key up.
export function signatureBindsToIdentity(recordedPubkey: string, publishedPubkey: string): boolean {
  return publishedPubkey !== '' && recordedPubkey === publishedPubkey;
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
