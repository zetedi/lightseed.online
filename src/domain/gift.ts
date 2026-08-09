import { prismSplit, DEFAULT_GLOW_SHARE_DENOMINATOR } from './light';
import type { TranslationKey } from '../utils/translations';

// THE SUSPENDED GIFT — appreciation that travels FORWARD, never back.
//
// The caffè sospeso, in light. An offering is received through trust and costs nothing; the first
// person to arrive pays nothing because nothing is ever paid. If the receiver appreciates what
// they were given, their light does NOT return to the offerer. It waits AT THE OFFERING for
// whoever comes next, and covers their appreciation instead.
//
// The offering is the PRISM the root named a year before it had a body: "a station where a ray
// branches onward: watched and vetoable as far as its source cares to see" (LIN). Light arrives,
// sheds its share into the glow of the community it is circulating through, and waits to continue.
// So a ray's whole life is one forward journey: kindled by witnessed care of a living tree, passed
// from stranger to stranger through gifts, dimming into every community it crosses, until it has
// become entirely commons glow. Nothing accumulates, and nothing is lost.
//
// TWO DECISIONS THIS MODULE HOLDS (Zoltán, 2026-08-05):
//
//   1. The offerer is NEVER paid in light. Light DIRECTS care; the care economy PAYS people
//      (principle 8). The two rails never touch, so light can never be read as a wage, and an
//      offerer's standing becomes the light that has passed THROUGH them: unhoardable, unbuyable.
//   2. One gift covers ONE appreciation, one person at a time. A surplus waits at the offering
//      for the people after next; a shortfall is handed over whole rather than stranded. The
//      suspended coffee, because we are humans and a coffee is graspable.
//
// Pure and testable: nothing here touches a backend or a clock it wasn't handed. The server owns
// the mint (no client may ever write light), and mirrors this law the way functions/src/mint.ts
// mirrors the kindle.

// ── Giving: the light arrives at the station ──────────────────────────────────────────────
// Everything the judgment needs, as plain facts a caller already holds.
export interface GiftDraft {
  units: number;          // the light sent forward; whole units, the receiver's own choice
  giverUid: string;       // the being who received the offering and appreciated it
  offererUid: string;     // whose offering it is (they receive none of this light)
  holdingUnits: number;   // what the giver actually holds; light cannot be given from nothing
  offeringActive: boolean; // a paused offering has no next person, so light would strand there
}

// Why this gift cannot stand, or null when it may. The reasons are the law read aloud — as
// translation KEYS (the words live in translations.ts in every language; speak() says them),
// so the face can say them without inventing its own words, in the reader's own tongue.
export const giftProblem = (d: GiftDraft): TranslationKey | null => {
  if (!Number.isFinite(d.units) || d.units <= 0) return 'gift_nothing';
  if (!Number.isInteger(d.units)) return 'gift_whole_units';
  if (!d.giverUid || !d.offererUid) return 'gift_needs_both';
  // Appreciating your own offering would send light in a circle and call it circulation.
  if (d.giverUid === d.offererUid) return 'gift_own_offering';
  if (!d.offeringActive) return 'gift_resting';
  if (!Number.isInteger(d.holdingUnits) || d.holdingUnits < d.units) return 'gift_hold_less';
  return null;
};

// What a gift becomes the moment it reaches the offering: the community's share dissolves into
// its glow, and the rest is SUSPENDED, waiting for the next person. The split happens ONCE per
// gift, on arrival; the claim below is the same light continuing, not a second hop.
export interface SuspendedGift {
  glow: number;       // dissolved into the commons of the community the light circulates through
  suspended: number;  // waiting at the offering for whoever comes next
}

export const suspendGift = (
  units: number,
  glowShareDenominator: number = DEFAULT_GLOW_SHARE_DENOMINATOR,
): SuspendedGift => {
  const { glow, spendable } = prismSplit(units, glowShareDenominator);
  return { glow, suspended: spendable };
};

// ── Claiming: one coffee, one person ──────────────────────────────────────────────────────
// The next receiver takes ONE appreciation's worth. A larger suspension keeps its remainder for
// the people after them (five coffees stand for five arrivals); a smaller one is handed over
// whole, because light stranded at a station helps no one. Conservation is exact:
// claimed + remaining = suspended, always.
export interface ClaimedGift {
  claimed: number;    // what this receiver is given
  remaining: number;  // what stays suspended for the next arrival
}

export const claimGift = (suspendedUnits: number, suggestedAppreciation: number): ClaimedGift => {
  const pot = Number.isInteger(suspendedUnits) && suspendedUnits > 0 ? suspendedUnits : 0;
  const one = Number.isInteger(suggestedAppreciation) && suggestedAppreciation > 0 ? suggestedAppreciation : 0;
  const claimed = Math.min(pot, one);
  return { claimed, remaining: pot - claimed };
};

// How many arrivals a suspension still covers, for the face to say plainly ("three coffees are
// waiting"). A partial remainder still covers one person, so it counts.
export const giftsWaiting = (suspendedUnits: number, suggestedAppreciation: number): number => {
  const pot = Number.isInteger(suspendedUnits) && suspendedUnits > 0 ? suspendedUnits : 0;
  const one = Number.isInteger(suggestedAppreciation) && suggestedAppreciation > 0 ? suggestedAppreciation : 0;
  if (pot === 0 || one === 0) return 0;
  return Math.ceil(pot / one);
};

// ── Conservation: the ledger that must always balance ─────────────────────────────────────
// The light economy's verifyChain. Every unit ever kindled by witnessed care stands in exactly
// one of three places: held on a ray, suspended at an offering, or become the commons' glow.
// If this ever fails, light was created or destroyed and the whole economy is a story.
export interface LightLedger {
  kindled: number;    // every unit ever kindled, since the first witnessed care
  held: number;       // units resting on rays
  suspended: number;  // units waiting at offerings for the next person
  glow: number;       // units that have become the commons
}

// Positive = light went missing; negative = light was conjured. Zero is the only honest answer.
export const conservationGap = (l: LightLedger): number =>
  l.kindled - (l.held + l.suspended + l.glow);

export const conserves = (l: LightLedger): boolean => conservationGap(l) === 0;
