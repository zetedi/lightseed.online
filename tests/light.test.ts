import { describe, it, expect } from 'vitest';
import {
  RAY_UNITS, KINDLE_UNITS_PER_WITNESSED_CARE,
  kindles, canKindleAgain, prismSplit, validBranching, splitEvenly, idleFade, visibleToSource,
  WITNESS_SHARE_DENOMINATOR, witnessShareUnits, kindleRays,
} from '../src/domain/light';
import { DAY_MS } from '../src/domain/watering';

// The law of light: conservation at every prism, the sun as the only origin, the walked
// story as the golden case, and every fade feeding the glow. Nothing is ever lost.

describe('the sun: only witnessed care for the living kindles', () => {
  it('confirmed care of a living tree kindles; anything less warms the world but mints nothing', () => {
    expect(kindles({ confirmed: true, treeAlive: true })).toBe(true);
    expect(kindles({ confirmed: false, treeAlive: true })).toBe(false);
    expect(kindles({ confirmed: true, treeAlive: false })).toBe(false);
  });

  it('one kindling per tree per day — the tree\'s rhythm bounds the supply', () => {
    const now = 1_800_000_000_000;
    expect(canKindleAgain(null, now)).toBe(true);
    expect(canKindleAgain(now - DAY_MS, now)).toBe(true);
    expect(canKindleAgain(now - DAY_MS + 1, now)).toBe(false);
  });

  it('one witnessed daily care kindles one ray, spoken as a hundred', () => {
    expect(KINDLE_UNITS_PER_WITNESSED_CARE).toBe(RAY_UNITS);
    expect(RAY_UNITS).toBe(100);
  });
});

describe('the prism: light is conserved, the glow is the tax', () => {
  it('a week\'s bed passed onward (7 rays, not the kindle moment): 700 units, 1/7 glows (100), 300 + 300 to two providers', () => {
    // Kindling is FREE (one care, one whole ray); the splitting happens only when light is
    // SPENT. A night is 1 ray; the walked story\'s "7" is a week, so 700 units flow here.
    const { glow, spendable } = prismSplit(7 * RAY_UNITS, 7);
    expect(glow).toBe(RAY_UNITS);        // one ray dissolves into the commons
    expect(spendable).toBe(6 * RAY_UNITS);
    expect(validBranching(7 * RAY_UNITS, [3 * RAY_UNITS, 3 * RAY_UNITS], 7)).toBe(true);
  });

  it('conservation to the last unit, remainder riding on with the spendable', () => {
    for (const [units, dial] of [[100, 7], [99, 7], [1, 7], [700, 8], [341, 3]] as const) {
      const { glow, spendable } = prismSplit(units, dial);
      expect(glow + spendable).toBe(units);
      expect(glow).toBe(Math.floor(units / dial));
    }
  });

  it('a branching that loses or invents light is refused; so is an empty branch', () => {
    expect(validBranching(700, [300, 200], 7)).toBe(false);  // 100 units vanished
    expect(validBranching(700, [300, 400], 7)).toBe(false);  // 100 units invented
    expect(validBranching(700, [600, 0], 7)).toBe(false);    // a station without light
    expect(validBranching(700, [600], 7)).toBe(true);
  });

  it('splitEvenly is remainder-exact and deterministic', () => {
    expect(splitEvenly(600, 2)).toEqual([300, 300]);
    expect(splitEvenly(100, 3)).toEqual([34, 33, 33]);
    expect(splitEvenly(100, 3).reduce((a, b) => a + b, 0)).toBe(100);
    expect(splitEvenly(2, 5)).toEqual([1, 1]); // no empty branches minted
    expect(splitEvenly(0, 3)).toEqual([]);
  });
});

describe('fading: hoarded light dims into the same glow', () => {
  it('remaining + toGlow always equals what was held', () => {
    const f = idleFade(500, 3 * 7 * DAY_MS, 10);
    expect(f.toGlow).toBe(30);
    expect(f.remaining + f.toGlow).toBe(500);
  });
  it('never dims below zero, and partial weeks do not dim', () => {
    expect(idleFade(15, 100 * 7 * DAY_MS, 10)).toEqual({ remaining: 0, toGlow: 15 });
    expect(idleFade(500, 6 * DAY_MS, 10)).toEqual({ remaining: 500, toGlow: 0 });
  });
});

describe('attention: the sovereign dial', () => {
  it('a branch notifies its source only at or above the floor ("one ray" = 100 units)', () => {
    expect(visibleToSource(300, RAY_UNITS)).toBe(true);
    expect(visibleToSource(100, RAY_UNITS)).toBe(true);
    expect(visibleToSource(99, RAY_UNITS)).toBe(false);
    expect(visibleToSource(1, 0)).toBe(true); // the right itself reaches to the last unit
  });
});

describe('the witness of care: the eye that vouches earns a seventh', () => {
  it('a seventh of a ray, floored to a unit', () => {
    expect(WITNESS_SHARE_DENOMINATOR).toBe(7);
    expect(witnessShareUnits()).toBe(14);        // floor(100 / 7)
    expect(witnessShareUnits(700)).toBe(100);    // one whole ray of a week's care
  });

  it('AI-confirmed care: the carer keeps their whole ray, no witness holds light', () => {
    const rays = kindleRays({ confirmed: true, treeAlive: true, carerUid: 'alice' });
    expect(rays).toEqual([{ holderUid: 'alice', role: 'carer', units: RAY_UNITS }]);
  });

  it('a human witness earns a seventh, ADDITIONAL — the carer\'s ray is untouched', () => {
    const rays = kindleRays({ confirmed: true, treeAlive: true, carerUid: 'alice', witnessUid: 'bob' });
    expect(rays).toEqual([
      { holderUid: 'alice', role: 'carer', units: RAY_UNITS },
      { holderUid: 'bob', role: 'witness', units: witnessShareUnits() },
    ]);
    // The carer still receives a whole ray — the seventh is new light, not a fee.
    expect(rays.find(r => r.role === 'carer')!.units).toBe(RAY_UNITS);
  });

  it('no one witnesses their own care: a carer confirming themself adds no witness ray', () => {
    const rays = kindleRays({ confirmed: true, treeAlive: true, carerUid: 'alice', witnessUid: 'alice' });
    expect(rays).toEqual([{ holderUid: 'alice', role: 'carer', units: RAY_UNITS }]);
  });

  it('the sun still gates: unconfirmed or lifeless care kindles nothing, witness or not', () => {
    expect(kindleRays({ confirmed: false, treeAlive: true, carerUid: 'alice', witnessUid: 'bob' })).toEqual([]);
    expect(kindleRays({ confirmed: true, treeAlive: false, carerUid: 'alice', witnessUid: 'bob' })).toEqual([]);
  });
});
