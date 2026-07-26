import { describe, it, expect } from 'vitest';
import { offeringProblem, type OfferingDraft } from '../src/domain/offering';
import { formatLight, RAY_UNITS } from '../src/domain/light';

const ok = (over: Partial<OfferingDraft> = {}): OfferingDraft => ({
  kind: 'service', title: 'A quiet corner', description: 'rest here', suggestedAppreciationLight: RAY_UNITS, ...over,
});

describe('offeringProblem: what a valid offering is', () => {
  it('a sound draft has no problem', () => {
    expect(offeringProblem(ok())).toBeNull();
    expect(offeringProblem(ok({ kind: 'bed' }))).toBeNull();
  });
  it('refuses a bad kind, an empty title, or non-positive/fractional appreciation', () => {
    expect(offeringProblem(ok({ kind: 'x' as any }))).toMatch(/what you are offering/i);
    expect(offeringProblem(ok({ title: '   ' }))).toMatch(/name your offering/i);
    expect(offeringProblem(ok({ suggestedAppreciationLight: 0 }))).toMatch(/appreciation in light/i);
    expect(offeringProblem(ok({ suggestedAppreciationLight: -5 }))).toMatch(/appreciation in light/i);
    expect(offeringProblem(ok({ suggestedAppreciationLight: 10.5 }))).toMatch(/whole light units/i);
  });

  it('accepts a well-formed optional detail link and refuses a malformed one', () => {
    expect(offeringProblem(ok({ url: 'https://perauset.com/stay' }))).toBeNull();
    expect(offeringProblem(ok({ url: '   ' }))).toBeNull();          // blank = absent
    expect(offeringProblem(ok({ url: 'javascript:alert(1)' }))).toMatch(/http\(s\)/i);
    expect(offeringProblem(ok({ url: 'perauset.com' }))).toMatch(/http\(s\)/i);
    expect(offeringProblem(ok({ url: `https://x.dev/${'a'.repeat(300)}` }))).toMatch(/too long/i);
  });
});

describe('formatLight: light spoken for humans without making it a price', () => {
  it('whole rays where it divides, units otherwise', () => {
    expect(formatLight(RAY_UNITS)).toBe('1 ray');
    expect(formatLight(3 * RAY_UNITS)).toBe('3 rays');
    expect(formatLight(RAY_UNITS + 5)).toBe(`${RAY_UNITS + 5} light`);
    expect(formatLight(0)).toBe('0 light');
    expect(formatLight(-1)).toBe('0 light');
  });
});
