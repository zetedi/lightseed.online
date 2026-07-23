import { describe, it, expect } from 'vitest';
import { offeringProblem, formatLightPrice, type OfferingDraft } from '../src/domain/offering';
import { RAY_UNITS } from '../src/domain/light';

const ok = (over: Partial<OfferingDraft> = {}): OfferingDraft => ({
  kind: 'service', title: 'A quiet corner', description: 'rest here', priceLight: RAY_UNITS, ...over,
});

describe('offeringProblem: what a valid offering is', () => {
  it('a sound draft has no problem', () => {
    expect(offeringProblem(ok())).toBeNull();
    expect(offeringProblem(ok({ kind: 'bed' }))).toBeNull();
  });
  it('refuses a bad kind, an empty title, a non-positive or fractional price', () => {
    expect(offeringProblem(ok({ kind: 'x' as any }))).toMatch(/what you are offering/i);
    expect(offeringProblem(ok({ title: '   ' }))).toMatch(/name your offering/i);
    expect(offeringProblem(ok({ priceLight: 0 }))).toMatch(/price in light/i);
    expect(offeringProblem(ok({ priceLight: -5 }))).toMatch(/price in light/i);
    expect(offeringProblem(ok({ priceLight: 10.5 }))).toMatch(/whole units/i);
  });
});

describe('formatLightPrice: light spoken for humans', () => {
  it('whole rays where it divides, units otherwise', () => {
    expect(formatLightPrice(RAY_UNITS)).toBe('1 ray');
    expect(formatLightPrice(3 * RAY_UNITS)).toBe('3 rays');
    expect(formatLightPrice(RAY_UNITS + 5)).toBe(`${RAY_UNITS + 5} light`);
    expect(formatLightPrice(0)).toBe('0 light');
    expect(formatLightPrice(-1)).toBe('0 light');
  });
});
