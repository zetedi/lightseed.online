import { describe, it, expect } from 'vitest';
import {
  CARER_SHARE_EUR, COMMUNITY_SHARE_EUR, FULL_GROVE, MIN_TREE_SPACING_M, NODE_SHARE_EUR,
  YEARLY_TREE_SUPPORT_EUR, canReceiveSupport, carerYearlyEur, distanceM, spacingOk, splitSupport,
} from '../src/domain/support';

describe('the 21 → 15/3/3 split', () => {
  it('the canonical year of support splits exactly', () => {
    expect(splitSupport()).toEqual({ carer: 15, community: 3, node: 3 });
    expect(CARER_SHARE_EUR + COMMUNITY_SHARE_EUR + NODE_SHARE_EUR).toBe(YEARLY_TREE_SUPPORT_EUR);
  });
  it('never loses a cent on odd amounts — the carer absorbs the remainder', () => {
    for (const eur of [21, 10, 7.77, 100, 0.03]) {
      const s = splitSupport(eur);
      expect(Math.round((s.carer + s.community + s.node) * 100)).toBe(Math.round(eur * 100));
      expect(s.carer).toBeGreaterThanOrEqual(s.community + s.node - 0.02);
    }
  });
});

describe('the carer wage', () => {
  it('a full grove earns 144 × €15', () => {
    expect(carerYearlyEur(FULL_GROVE)).toBe(2160);
  });
  it('caps at the grove and floors at zero', () => {
    expect(carerYearlyEur(FULL_GROVE + 50)).toBe(2160);
    expect(carerYearlyEur(-3)).toBe(0);
    expect(carerYearlyEur(12)).toBe(180);
  });
});

describe('who can receive support', () => {
  it('validated trees only — initiated is the validated status', () => {
    expect(canReceiveSupport({ validated: true })).toBe(true);
    expect(canReceiveSupport({ validated: false })).toBe(false);
    expect(canReceiveSupport({})).toBe(false);
  });
});

describe('grove spacing — a walk, not a warehouse', () => {
  const perAuset = { lat: 47.4979, lng: 19.0402 };
  // ~0.005° of longitude at this latitude ≈ 375 m.
  const nearby = { lat: 47.4979, lng: 19.0452 };
  const acrossTown = { lat: 47.52, lng: 19.06 };

  it('haversine gives sane city-scale distances', () => {
    const d = distanceM(perAuset, nearby);
    expect(d).toBeGreaterThan(300);
    expect(d).toBeLessThan(450);
    expect(distanceM(perAuset, perAuset)).toBe(0);
  });
  it('accepts a spaced grove and rejects a crowded one', () => {
    expect(spacingOk(acrossTown, [perAuset, nearby])).toBe(true);
    expect(spacingOk({ lat: 47.4979, lng: 19.0412 }, [perAuset])).toBe(false); // ~75 m — too close
    expect(spacingOk(perAuset, [])).toBe(true); // the first tree of a grove
    expect(MIN_TREE_SPACING_M).toBeGreaterThanOrEqual(300);
  });
});
