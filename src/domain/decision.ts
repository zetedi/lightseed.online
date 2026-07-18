import type { Timestamp } from 'firebase/firestore';
import type { Being } from './being';
import { signatureBindsToIdentityOrLineage, type SignatureVerifier, type LineageCheck } from './covenant';

// Governance as an event: an event IS a decision, and its NATURE sets how many voices it
// needs. Light intentions need one voice; weightier acts need a circle. The numbers nod to
// sacred geometry — a charter change asks the full circle of seven (odd, so it can decide).
//
// These are contracts of USE and CARE, not ownership: ownership stays fluid; what a decision
// settles is how a thing is used and tended — newer, freer agreements, from the heart.
export type DecisionNature = 'intention' | 'purchase' | 'use_grant' | 'admission' | 'stewardship' | 'charter';

export const DECISION_NATURES: { id: DecisionNature; votes: number }[] = [
  { id: 'intention', votes: 1 },    // a shared note / intention — one voice carries it
  { id: 'purchase', votes: 2 },     // spending from the commons — needs two
  { id: 'use_grant', votes: 2 },    // granting the USE of an item (ownership stays fluid)
  { id: 'admission', votes: 3 },    // welcoming a new member
  { id: 'stewardship', votes: 3 },  // appointing or changing a steward
  { id: 'charter', votes: 7 },      // changing the charter — the full circle (odd, decidable)
];

export const votesRequired = (nature: DecisionNature): number =>
  DECISION_NATURES.find(n => n.id === nature)?.votes ?? 1;

// A concern raised on an open proposal — a veto that opens reflection rather than just halting.
export interface Concern {
  by: string;       // uid who raised it
  note?: string;    // what the concern is
  at: Timestamp;
}

// Two ways a circle decides. `threshold` counts voices to a nature-set number (the default,
// above). `consensus` is the Quaker way — no counting: the meeting seeks unity, each voice may
// UNITE, STAND ASIDE (disagree but won't block), or BLOCK (a principled objection that halts it),
// and the clerk (proposer/steward) discerns the sense of the meeting.
export type DecisionMode = 'threshold' | 'consensus';

export type ConsensusStance = 'unite' | 'stand_aside' | 'block';

export const consensusStanceLabels: Record<ConsensusStance, string> = {
  unite: 'Unite',
  stand_aside: 'Stand aside',
  block: 'Block',
};

// A voice's position in a consensus meeting. One per person (a new one replaces the old).
export interface Position {
  by: string;              // uid
  stance: ConsensusStance;
  note?: string;           // why — especially load-bearing for a block
  at: Timestamp;
}

export type DecisionStatus = 'draft' | 'open' | 'passed' | 'rejected' | 'withdrawn' | 'expired';

export const decisionStatusLabels: Record<DecisionStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  passed: 'Passed',
  rejected: 'Not adopted',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
};

export interface Decision extends Being {
  id: string;
  // A stored decision always mints a true name (createDecision) — the frozen signed identity
  // (decisionIdentity) stands on it, so it is required here (narrowing Being's optional lid).
  lid: string;
  communityId: string;
  domain?: string;
  nature: DecisionNature;
  title: string;
  body?: string;        // the proposal — a contract of use & care, not ownership
  subject?: string;     // what it concerns (an item, a person, a use)
  proposedBy: string;   // uid — counts as the first voice / the clerk
  mode?: DecisionMode;  // absent = 'threshold' (legacy decisions)
  votes: string[];      // uids who have voiced yes (threshold mode)
  votesRequired: number;
  positions?: Position[]; // consensus mode: each voice's unite / stand-aside / block
  status: DecisionStatus;
  // Reflection: a veto doesn't just stop the count — it opens listening. While `listening`,
  // the proposal pauses (it can't pass) and the raised concerns are shown, until they're tended.
  listening?: boolean;
  concerns?: Concern[];
  // Immutable chain — a decision is an event on the ledger.
  previousHash: string;
  hash: string;
  enactedHash?: string; // the block written when the circle reaches the threshold
  withdrawnHash?: string; // the withdrawal mark — minted withdraws, chain-recorded (never erased)
  createdAt: Timestamp;
  passedAt?: Timestamp;
  withdrawnAt?: Timestamp;
  rejectedAt?: Timestamp;
  expiresAt?: Timestamp;
}

// ── The signed vote — a decision seven people sign (Covenant, phase 3) ─────────────────────────────
//
// A vote is no longer a bare authenticated uid append: it is an Ed25519 SIGNATURE over the decision's
// FROZEN canonical identity. This is the OPEN-membership analogue of the covenant (domain/covenant.ts):
// there is no fixed party roster — ANY community member may sign until the quorum of VERIFIED signatures
// is reached. The crystal is the same one the covenant stands on (domain/signing.ts + services/keys.ts);
// only the domain tag and the frozen identity differ. The service (services/firebase/governance.ts)
// writes the per-member signature to pulses/{decisionId}/signatures/{uid} and enacts by the VERIFIED
// count — the seal is the signatures, never the raw `votes` array or the `status` flag.

// The domain tag inside every decision signature's preimage (signingPreimage). Versioned + domain-
// separated exactly like COVENANT_DOMAIN: a signature minted for a decision can never be replayed as a
// covenant signature or any other signed artifact — the purpose is signed into the bytes.
// v2 — SIGNER-BOUND: the signed payload is decisionSignaturePayload (the identity PLUS the signer's
// uid), so a valid signature is non-transferable between slots. v1 signed the bare identity, which
// made a world-readable signature copyable into another member's slot (quorum inflation); no legacy
// v1 verification path exists — prod held zero signed decisions at the cutover.
export const DECISION_DOMAIN = 'lifeseed.decision.v2';

// The CANONICAL DECISION IDENTITY — the exact value every member signs (under DECISION_DOMAIN). It is
// the frozen essence of the PROPOSAL: its true name, the community it belongs to, its nature, its words,
// and the votes it requires. Every one of these fields is frozen by the pulses update rule (the
// governance overlay may only touch votes/positions/status/… — never lid/communityId/nature/title/
// body/votesRequired), so a signed proposal can never change under a signer. `body` normalises an
// absent value to '' — deterministic, and matching how a decision is stored (createDecision writes '').
export interface DecisionIdentity {
  lid: string;
  communityId: string;
  nature: DecisionNature;
  title: string;
  body: string;
  votesRequired: number;
}

export function decisionIdentity(
  d: Pick<Decision, 'lid' | 'communityId' | 'nature' | 'title' | 'votesRequired'> & { body?: string },
): DecisionIdentity {
  return {
    lid: d.lid,
    communityId: d.communityId,
    nature: d.nature,
    title: d.title,
    body: d.body ?? '',
    votesRequired: d.votesRequired,
  };
}

// The exact value a member signs under DECISION_DOMAIN (v2): the decision identity BOUND to the
// signer's own uid — the open-membership twin of covenantSignaturePayload. A copied signature,
// replayed into another member's slot, is verified against THAT slot's uid and fails: signatures are
// non-transferable, so one real hand can never fill a seven-member quorum.
export interface DecisionSignaturePayload {
  decision: DecisionIdentity;
  signer: string;
}

export function decisionSignaturePayload(identity: DecisionIdentity, signerUid: string): DecisionSignaturePayload {
  return { decision: identity, signer: signerUid };
}

// A recorded signature as read from pulses/{id}/signatures — its uid is PATH-AUTHORITATIVE (the doc
// id via covenant.signatureFromDoc), never a body field.
export interface RecordedDecisionSignature {
  uid: string;
  sig: string;
  pubkey: string;
  position?: ConsensusStance;
}

// The signatures that enact a decision — the ONE counting rule verifyDecision and the tests share.
// Returns the SET of verified signer uids (the enactment block records exactly these — never the
// raw votes[] array, so an invalid signature doc can never place a name in the seal). Gates, in
// order: (1) DEDUPE — at most one counted signature per signer uid; (2) in consensus mode only
// 'unite' signatures are affirmatives; (3) IDENTITY-KEY BINDING — the recorded pubkey must equal
// the signer's published key, OR be a key in the signer's append-only lineage (LineageCheck —
// history survives rotation); (4) SIGNER-BOUND CRYPTO — the signature must verify the v2 payload
// bound to the RECORD'S OWN uid. Membership is enforced at write time by the rules.
export async function verifiedDecisionSigners(
  identity: DecisionIdentity,
  sigs: readonly RecordedDecisionSignature[],
  mode: DecisionMode,
  publishedKeys: ReadonlyMap<string, string>,
  verify: SignatureVerifier,
  lineage?: LineageCheck,
): Promise<Set<string>> {
  const counted = new Set<string>();
  for (const s of sigs) {
    if (counted.has(s.uid)) continue;                       // one hand, one signature — never two slots
    if (mode === 'consensus' && s.position !== 'unite') continue; // only uniting signatures count
    if (!(await signatureBindsToIdentityOrLineage(s.uid, s.pubkey, publishedKeys.get(s.uid) ?? '', lineage))) continue;
    if (await verify(s.pubkey, s.sig, decisionSignaturePayload(identity, s.uid), DECISION_DOMAIN)) {
      counted.add(s.uid);
    }
  }
  return counted;
}

// The quorum count is the size of the verified-signers set — one rule, two readings.
export async function countVerifiedDecisionSignatures(
  identity: DecisionIdentity,
  sigs: readonly RecordedDecisionSignature[],
  mode: DecisionMode,
  publishedKeys: ReadonlyMap<string, string>,
  verify: SignatureVerifier,
  lineage?: LineageCheck,
): Promise<number> {
  return (await verifiedDecisionSigners(identity, sigs, mode, publishedKeys, verify, lineage)).size;
}

// DRAFT VANISHES, MINTED WITHDRAWS — resolving the deletable-decision contradiction (deferred by
// the ring of 2026-07-18, landed here). This rule judges the OBJECT, not the actor (WHO may delete
// stays with the rules: author, keeper, staff): a decision may be HARD-DELETED only while it is
// still, in substance, an unsigned unshared draft — not enacted (status 'passed', the mint),
// bearing NO cryptographic signature, and carrying no other being's voice (no vote beyond the
// proposer's own, no recorded position). Anything more is shared history and may only be
// WITHDRAWN — marked, never erased (the guardian-veto ethic; chains are append-only). Concerns
// alone do not protect a draft: the ring names a listening decision as still deletable — a concern
// pauses it, it does not co-own it. The rules mirror the doc-visible half at rest (status +
// votes/positions — they cannot read the signatures subcollection); deleteDecision enforces the
// signature half; this ONE rule is what both mean.
export function decisionDeletable(
  d: Pick<Decision, 'status' | 'proposedBy'> & { votes?: string[]; positions?: Position[] },
  signatureCount: number,
): boolean {
  if (d.status === 'passed') return false;                          // minted — withdraw only
  if (signatureCount > 0) return false;                             // signed — withdraw only
  if ((d.votes ?? []).some(v => v !== d.proposedBy)) return false;  // another voice stands
  if ((d.positions ?? []).length > 0) return false;                 // a position stands
  return true;
}

// A decision ENACTS when at least `votesRequired` VERIFIED signatures stand — and a requirement of 0
// or less can never enact (a decision that needs no voice is not a decision). Pure; the enactment
// decision in the service feeds it the VERIFIED count, never a raw `votes.length`, so the flag can
// never outrun the crypto. Mirrors covenant.isQuorumMet, named for the enactment it expresses.
export function decisionEnacted(verifiedSignatures: number, votesRequired: number): boolean {
  return votesRequired > 0 && verifiedSignatures >= votesRequired;
}

// Is a decision's CLAIMED status honest? For a THRESHOLD decision, a 'passed' flag must be backed by a
// quorum of verified signatures — a doc flipped to 'passed' with fewer verified signatures than
// required is NOT authoritative (the seal is the signatures, not the flag). A CONSENSUS decision enacts
// by the clerk's discernment (discernDecision), not by counting signatures, so its 'passed' flag is not
// a signature-count claim — the unite-signatures are recorded for provenance, but the flag stays valid.
// Extracted pure so the service's verifyDecision and the tests read the same rule.
export function decisionAuthoritative(
  status: DecisionStatus,
  verifiedSignatures: number,
  votesRequired: number,
  mode: DecisionMode = 'threshold',
): boolean {
  if (mode === 'consensus') return true;
  return status === 'passed' ? decisionEnacted(verifiedSignatures, votesRequired) : true;
}
