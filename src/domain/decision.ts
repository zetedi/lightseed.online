import type { Timestamp } from 'firebase/firestore';

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

export interface Decision {
  id: string;
  lid?: string; // Lightseed ID — the decision's portable, time-ordered true name (UUIDv7).
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
  createdAt: Timestamp;
  passedAt?: Timestamp;
  withdrawnAt?: Timestamp;
  rejectedAt?: Timestamp;
  expiresAt?: Timestamp;
}
