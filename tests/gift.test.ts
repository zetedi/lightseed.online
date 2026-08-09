import { describe, it, expect } from 'vitest';
import {
  giftProblem, suspendGift, claimGift, giftsWaiting,
  conserves, conservationGap, type GiftDraft, type LightLedger,
} from '../src/domain/gift';
import { RAY_UNITS, DEFAULT_GLOW_SHARE_DENOMINATOR } from '../src/domain/light';
import { speak } from '../src/utils/translations';

// The suspended gift: appreciation that travels forward and never back. The tests walk the whole
// journey of one ray — kindled, given, suspended, claimed, given again — and hold the ledger to
// balance at every step. If light is ever created or destroyed here, the economy is a story.

// A gift that SHOULD stand; each case below breaks exactly one fact.
const sound = (): GiftDraft => ({
  units: RAY_UNITS,
  giverUid: 'alice',
  offererUid: 'bob',
  holdingUnits: RAY_UNITS,
  offeringActive: true,
});

describe('giving: what may be sent forward', () => {
  it('a whole gift from a being who holds it, to another being\'s standing offering', () => {
    expect(giftProblem(sound())).toBeNull();
  });

  it('nothing, a fraction, or more light than you hold cannot be given', () => {
    expect(speak(giftProblem({ ...sound(), units: 0 })!)).toBe('A gift is more than nothing.');
    expect(speak(giftProblem({ ...sound(), units: -5 })!)).toBe('A gift is more than nothing.');
    expect(speak(giftProblem({ ...sound(), units: 10.5 })!)).toBe('Light is given in whole units.');
    expect(speak(giftProblem({ ...sound(), units: NaN })!)).toBe('A gift is more than nothing.');
    expect(speak(giftProblem({ ...sound(), holdingUnits: RAY_UNITS - 1 })!)).toBe('You hold less light than that.');
  });

  it('you cannot appreciate your own offering — that is a circle calling itself circulation', () => {
    expect(speak(giftProblem({ ...sound(), giverUid: 'bob' })!)).toBe('You cannot appreciate your own offering.');
  });

  it('a resting offering takes no gift: its light would wait for no one', () => {
    expect(speak(giftProblem({ ...sound(), offeringActive: false })!)).toBe('This offering is resting; its light would wait for no one.');
  });

  it('giving exactly what you hold is allowed — light is not a balance to protect', () => {
    expect(giftProblem({ ...sound(), units: RAY_UNITS, holdingUnits: RAY_UNITS })).toBeNull();
  });
});

describe('the prism: arriving at the offering', () => {
  it('the community takes its share and the rest waits — nothing is lost', () => {
    const { glow, suspended } = suspendGift(RAY_UNITS);
    expect(glow).toBe(Math.floor(RAY_UNITS / DEFAULT_GLOW_SHARE_DENOMINATOR)); // 15
    expect(glow + suspended).toBe(RAY_UNITS);
  });

  it('conserves at every dial a community could choose', () => {
    for (const dial of [1, 2, 3, 7, 8, 13, 100]) {
      for (const units of [1, 7, 12, 108, 333, 1000]) {
        const { glow, suspended } = suspendGift(units, dial);
        expect(glow + suspended).toBe(units);
        expect(glow).toBeGreaterThanOrEqual(0);
        expect(suspended).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('the split happens ONCE per gift: the claim is the same light continuing, not a second hop', () => {
    const { suspended } = suspendGift(RAY_UNITS);
    const { claimed, remaining } = claimGift(suspended, RAY_UNITS);
    expect(claimed + remaining).toBe(suspended); // no further shedding on the way out
  });
});

describe('claiming: one coffee, one person', () => {
  it('the next person takes one appreciation\'s worth, and the rest waits for those after', () => {
    // Five coffees suspended at a suggestion of 108.
    const { claimed, remaining } = claimGift(5 * 108, 108);
    expect(claimed).toBe(108);
    expect(remaining).toBe(4 * 108);
  });

  it('a shortfall is handed over whole — light stranded at a station helps no one', () => {
    const { claimed, remaining } = claimGift(50, 108);
    expect(claimed).toBe(50);
    expect(remaining).toBe(0);
  });

  it('an empty offering gives nothing, and nothing goes missing', () => {
    expect(claimGift(0, 108)).toEqual({ claimed: 0, remaining: 0 });
    expect(claimGift(-5, 108)).toEqual({ claimed: 0, remaining: 0 });
    expect(claimGift(108, 0)).toEqual({ claimed: 0, remaining: 108 });
  });

  it('claimed + remaining is always exactly what was suspended', () => {
    for (const pot of [0, 1, 50, 107, 108, 109, 540, 1001]) {
      for (const one of [1, 7, 108, 500]) {
        const { claimed, remaining } = claimGift(pot, one);
        expect(claimed + remaining).toBe(Math.max(0, pot));
      }
    }
  });

  it('says plainly how many arrivals are still covered', () => {
    expect(giftsWaiting(5 * 108, 108)).toBe(5);
    expect(giftsWaiting(108, 108)).toBe(1);
    expect(giftsWaiting(50, 108)).toBe(1);   // a partial coffee still covers one person
    expect(giftsWaiting(109, 108)).toBe(2);
    expect(giftsWaiting(0, 108)).toBe(0);
    expect(giftsWaiting(108, 0)).toBe(0);
  });
});

describe('the ledger: every unit stands in exactly one place', () => {
  it('balances when held, suspended and glow account for all that was kindled', () => {
    const l: LightLedger = { kindled: 108, held: 93, suspended: 0, glow: 15 };
    expect(conserves(l)).toBe(true);
    expect(conservationGap(l)).toBe(0);
  });

  it('names light that went missing, and light that was conjured', () => {
    expect(conservationGap({ kindled: 108, held: 90, suspended: 0, glow: 15 })).toBe(3);
    expect(conservationGap({ kindled: 108, held: 100, suspended: 0, glow: 15 })).toBe(-7);
    expect(conserves({ kindled: 108, held: 100, suspended: 0, glow: 15 })).toBe(false);
  });

  it('THE WALKED STORY: one ray kindled, given, claimed and given again, balancing at every step', () => {
    // Alice tends her tree; Bob witnesses. The mint kindles one whole ray for the carer.
    // (The witness's seventh rides alongside; this story follows the carer's ray alone.)
    let ledger: LightLedger = { kindled: RAY_UNITS, held: RAY_UNITS, suspended: 0, glow: 0 };
    expect(conserves(ledger)).toBe(true);

    // Alice sleeps in Bob's offered bed. It costs nothing. She appreciates it forward.
    const first = suspendGift(RAY_UNITS);
    ledger = {
      kindled: ledger.kindled,
      held: ledger.held - RAY_UNITS,
      suspended: ledger.suspended + first.suspended,
      glow: ledger.glow + first.glow,
    };
    expect(conserves(ledger)).toBe(true);
    expect(ledger.held).toBe(0);          // Alice gave it all away
    expect(ledger.glow).toBe(15);         // the community it crossed is a little brighter

    // Carol arrives next. Bob is paid nothing, ever; Carol receives Alice's gift.
    const take = claimGift(ledger.suspended, RAY_UNITS);
    ledger = {
      ...ledger,
      held: ledger.held + take.claimed,
      suspended: take.remaining,
    };
    expect(conserves(ledger)).toBe(true);
    expect(take.claimed).toBe(93);        // 108 less the seventh that became glow
    expect(ledger.suspended).toBe(0);

    // Carol passes it on at another offering. The light dims again into that community.
    const second = suspendGift(take.claimed);
    ledger = {
      kindled: ledger.kindled,
      held: ledger.held - take.claimed,
      suspended: ledger.suspended + second.suspended,
      glow: ledger.glow + second.glow,
    };
    expect(conserves(ledger)).toBe(true);
    expect(ledger.glow).toBe(15 + 13);    // every crossing lights the commons

    // The journey's end, walked to exhaustion: a ray passed hand to hand becomes ENTIRELY glow.
    let carrying = second.suspended;
    let hops = 0;
    while (carrying > 0 && hops < 1000) {
      const s = suspendGift(carrying);
      ledger = { ...ledger, glow: ledger.glow + s.glow };
      const c = claimGift(s.suspended, RAY_UNITS);
      carrying = c.claimed;
      hops++;
      if (s.glow === 0) { // below the dial nothing more can be shed; the last unit rests
        ledger = { ...ledger, held: carrying, suspended: 0 };
        break;
      }
    }
    expect(hops).toBeLessThan(1000);      // it terminates; light does not circulate forever
    expect(ledger.glow).toBeGreaterThan(RAY_UNITS * 0.8); // nearly all of it became the commons
  });
});
