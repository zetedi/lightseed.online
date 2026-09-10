import { describe, it, expect } from 'vitest';
import { pulseKinds, matchesKind, pulseKindLabelKey, PULSE_KIND_ORDER } from '../src/domain/pulseKinds';
import { translations } from '../src/utils/translations';

// The sieve a being holds over its own pulses (ring 2026-09-10).
describe('pulseKinds — only the kinds actually there, in one order', () => {
  it('answers the kinds present, canonical order, legacy casing normalised', () => {
    expect(pulseKinds(['event', 'GROWTH', 'offering'])).toEqual(['tree_growth', 'offering', 'event']);
    expect(pulseKinds(['growth'])).toEqual(['vision_growth']);   // the old lowercase is a VISION's growth
    expect(pulseKinds([])).toEqual([]);
  });
  it('says nothing twice, and keeps an unknown kind at the end', () => {
    expect(pulseKinds(['event', 'event'])).toEqual(['event']);
    expect(pulseKinds(['zebra', 'event'])).toEqual(['event', 'zebra']);
  });
  it('an absent pulse type reads as an observation, the quietest kind', () => {
    expect(pulseKinds([undefined])).toEqual(['observation']);
  });
});

describe('matchesKind — the sieve itself', () => {
  it('lets everything through when no kind is chosen', () => {
    expect(matchesKind('event', null)).toBe(true);
    expect(matchesKind(undefined, null)).toBe(true);
  });
  it('matches on the canonical kind, not the stored casing', () => {
    expect(matchesKind('GROWTH', 'tree_growth')).toBe(true);
    expect(matchesKind('growth', 'tree_growth')).toBe(false);
    expect(matchesKind('offering', 'event')).toBe(false);
  });
});

describe('every offered kind has words', () => {
  it('each kind in the order names a real key, in every tongue', () => {
    for (const kind of PULSE_KIND_ORDER) {
      const key = pulseKindLabelKey(kind);
      expect(translations.en[key], `en is missing ${key}`).toBeTruthy();
      expect(translations.ar[key], `ar is missing ${key}`).toBeTruthy();
      expect(translations.zh[key], `zh is missing ${key}`).toBeTruthy();
    }
  });
});
