import { suspendGift } from './gift';
import { DEFAULT_GLOW_SHARE_DENOMINATOR } from './light';
import type { DomainKey } from './words';

// SPENDING IS A GATE, NOT A NUMBER (the season of roots, item 2; ring 2026-09-30).
//
// Light moves in exactly two ways beyond its kindling, and both are judged here, pure:
//
//   APPRECIATION — a being who RECEIVED an offering moves their own light to it. The offerer is
//   never paid (the suspended gift, ring 2026-08-05): the light arrives at the offering, the
//   place the light is circulating through takes its glow share, and the rest waits at the
//   offering for whoever comes next. The receipt that earns the right to appreciate is the
//   ACCEPTANCE the server minted: the hand that answered an offering of care is the hand that
//   received it. Once per receipt.
//
//   THE SPEND — a community's glow moves to an offering by a COUNCIL DECISION of nature
//   'purchase' whose quorum of VERIFIED signatures stands, executed once, by a hand that stands
//   for the circle (a keeper, or the proposer). The commons is spent only by the circle, never by
//   a holder (the tax ring, 2026-07-19). Glow arriving at an offering passes the same prism as a
//   gift: one law for every arrival.
//
//   THE COIN GATE, at the moment of movement (not merely attested): a ray is named by the place
//   it was kindled in (its coin); an offering stands in a place. Light may arrive only where its
//   coin is accepted — the same place, or a place whose keeper minted an `accepts_coin_of` link to
//   the ray's place. The node's own Light (a ray with no place) is the common tongue, accepted
//   everywhere on the node; an offering with no place stands at the node and accepts every coin.
//
// Plain contract — GUARANTEED by this law (mirrored in functions/src/spend.ts, held by
// tests/spend.test.ts; applied only by the server callables, since no client may write light):
// nothing moves unless a receipt or a signed decision stands; every unit that leaves a ray or a
// glow lands, to the last unit, as an offering's suspended light plus a glow share
// (suspendGift's conservation); rays are spent oldest first and only from coins the offering's
// place accepts; a receipt appreciates once and a decision spends once. NOT GUARANTEED: that the
// suspended light is ever CLAIMED by a next receiver (the witnessed receipt of a standing
// listing is not built; the pot waits, conserved and visible); that a consensus decision's
// discernment is honoured beyond its unite-signatures (spending counts verified signatures in
// either mode); that the amount was inside the signed identity (the decision's `spend` is
// frozen by the rules at birth, not yet by the signature).

export interface SpendIntent { offeringId: string; units: number }

// A purchase decision must name what it spends before anyone signs it.
export const spendIntentProblem = (d: { offeringId?: string | null; units?: unknown } | null | undefined): DomainKey | null => {
  if (!d || typeof d.offeringId !== 'string' || !d.offeringId.trim()) return 'spend_no_offering';
  const u = d.units;
  if (typeof u !== 'number' || !Number.isFinite(u) || u <= 0) return 'spend_nothing';
  if (!Number.isInteger(u)) return 'gift_whole_units';
  return null;
};

// The coin gate. `acceptsPlaces` = the place ids the offering's place accepts (its accepts_coin_of
// links, read at the moment of movement).
export const coinAccepted = (
  rayPlace: string | null | undefined,
  offeringPlace: string | null | undefined,
  acceptsPlaces: readonly string[],
): boolean => {
  if (!rayPlace) return true;                 // the node's Light: the common tongue
  if (!offeringPlace) return true;            // an offering at the node accepts every coin
  if (rayPlace === offeringPlace) return true;
  return acceptsPlaces.includes(rayPlace);
};

// ── Appreciation ──────────────────────────────────────────────────────────────────────────
export interface HeldRayFact { id: string; units: number; place: string | null; dayKey: string }

export interface AppreciationFacts {
  giverUid: string;
  units: number;
  offering: {
    exists: boolean;
    type?: unknown;            // must be 'offering'
    status?: unknown;          // must be 'accepted' — the receipt the server minted
    active?: unknown;          // false = resting; its light would wait for no one
    authorId: string;
    answeredBy?: unknown;      // the hand that received it (acceptOffering's caller)
    place: string | null;      // the community the offering stands in (its coin's place)
    acceptsPlaces: readonly string[];
  };
  rays: readonly HeldRayFact[]; // every ray the giver holds
  alreadyGiven: boolean;        // gifts/{offeringId}__{giverUid} exists
  glowShareDenominator?: number;
}

export interface RayTake { id: string; units: number }

export type AppreciationJudgment =
  | { outcome: 'reject'; refusal: DomainKey }
  | { outcome: 'give'; take: RayTake[]; glow: number; suspended: number; glowHome: string | null };

// Oldest light first: the rays that would dim first are the ones that travel. Only rays whose
// coin the offering's place accepts may be taken. Pure: answers what to take and whether it is enough.
export const pickRays = (
  rays: readonly HeldRayFact[],
  units: number,
  offeringPlace: string | null,
  acceptsPlaces: readonly string[],
): { take: RayTake[]; taken: number } => {
  const usable = rays
    .filter(r => Number.isInteger(r.units) && r.units > 0 && coinAccepted(r.place, offeringPlace, acceptsPlaces))
    .slice()
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey) || a.id.localeCompare(b.id));
  const take: RayTake[] = [];
  let left = units;
  for (const r of usable) {
    if (left <= 0) break;
    const u = Math.min(r.units, left);
    take.push({ id: r.id, units: u });
    left -= u;
  }
  return { take, taken: units - left };
};

export const judgeAppreciation = (f: AppreciationFacts): AppreciationJudgment => {
  const reject = (refusal: DomainKey): AppreciationJudgment => ({ outcome: 'reject', refusal });
  if (!f.offering.exists || f.offering.type !== 'offering') return reject('appreciate_offering_gone');
  if (!Number.isFinite(f.units) || f.units <= 0) return reject('gift_nothing');
  if (!Number.isInteger(f.units)) return reject('gift_whole_units');
  if (!f.giverUid || !f.offering.authorId) return reject('gift_needs_both');
  if (f.giverUid === f.offering.authorId) return reject('gift_own_offering');
  if (f.offering.status !== 'accepted' || f.offering.answeredBy !== f.giverUid) return reject('appreciate_not_received');
  if (f.offering.active === false) return reject('gift_resting');
  if (f.alreadyGiven) return reject('appreciate_already');
  const holding = f.rays.reduce((s, r) => s + (Number.isInteger(r.units) && r.units > 0 ? r.units : 0), 0);
  if (holding < f.units) return reject('gift_hold_less');
  const { take, taken } = pickRays(f.rays, f.units, f.offering.place, f.offering.acceptsPlaces);
  if (taken < f.units) return reject('appreciate_coin_refused');
  const { glow, suspended } = suspendGift(f.units, f.glowShareDenominator ?? DEFAULT_GLOW_SHARE_DENOMINATOR);
  return { outcome: 'give', take, glow, suspended, glowHome: f.offering.place };
};

// ── The spend ─────────────────────────────────────────────────────────────────────────────
export interface SpendFacts {
  callerUid: string;
  callerStands: boolean;       // a keeper of the community, or the decision's proposer
  decision: {
    exists: boolean;
    type?: unknown;            // 'decision'
    nature?: unknown;          // 'purchase'
    status?: unknown;          // 'passed'
    listening?: unknown;       // a standing concern pauses it
    communityId: string;
    votesRequired: number;
    verifiedSigners: number;   // signatures verified against the frozen identity, by the server
    spend?: unknown;           // SpendIntent, frozen at birth by the rules
    alreadySpent: boolean;     // spends/{decisionId} exists
  };
  offering: {
    exists: boolean;
    type?: unknown;
    active?: unknown;
    place: string | null;
    acceptsPlaces: readonly string[];
  };
  glowUnits: number;           // glow/{communityId}.units
  glowShareDenominator?: number;
}

export type SpendJudgment =
  | { outcome: 'reject'; refusal: DomainKey }
  | { outcome: 'spend'; units: number; glow: number; suspended: number; glowHome: string | null };

const isSpendIntent = (v: unknown): v is SpendIntent =>
  !!v && typeof v === 'object' && spendIntentProblem(v as SpendIntent) === null;

export const judgeSpend = (f: SpendFacts): SpendJudgment => {
  const reject = (refusal: DomainKey): SpendJudgment => ({ outcome: 'reject', refusal });
  if (!f.decision.exists || f.decision.type !== 'decision') return reject('spend_no_decision');
  if (f.decision.nature !== 'purchase') return reject('spend_not_purchase');
  if (!isSpendIntent(f.decision.spend)) return reject(spendIntentProblem(f.decision.spend as SpendIntent | null) ?? 'spend_no_offering');
  if (!f.callerUid || !f.callerStands) return reject('spend_no_standing');
  if (f.decision.status !== 'passed') return reject('spend_not_passed');
  if (f.decision.listening === true) return reject('spend_listening');
  if (!(f.decision.votesRequired > 0) || f.decision.verifiedSigners < f.decision.votesRequired) return reject('spend_unsigned');
  if (f.decision.alreadySpent) return reject('spend_already');
  if (!f.offering.exists || f.offering.type !== 'offering') return reject('spend_no_offering');
  if (f.offering.active === false) return reject('gift_resting');
  if (!coinAccepted(f.decision.communityId, f.offering.place, f.offering.acceptsPlaces)) return reject('spend_coin_refused');
  const units = f.decision.spend.units;
  if (!Number.isInteger(f.glowUnits) || f.glowUnits < units) return reject('spend_glow_short');
  const { glow, suspended } = suspendGift(units, f.glowShareDenominator ?? DEFAULT_GLOW_SHARE_DENOMINATOR);
  return { outcome: 'spend', units, glow, suspended, glowHome: f.offering.place };
};
