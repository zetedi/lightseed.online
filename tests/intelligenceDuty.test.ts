import { describe, it, expect } from 'vitest';
import { INTELLIGENCE_DUTIES, DUTY_LABEL_KEY, intelligenceForDuty, assignDuty, dutiesOf, isIntelligenceDuty } from '../src/domain/intelligenceDuty';
import { DOMAIN_KEYS } from '../src/domain/words';

// The duties (ring 2026-09-08): work of several kinds, each orderable to a different intelligence.
describe('intelligenceForDuty — ordered, else listening, else the node', () => {
  const byDuty = { watering: 'claude-1', translation: 'lumo' };
  it('answers the ordered one first', () => {
    expect(intelligenceForDuty(byDuty, 'watering', 'osiris', 'default')).toBe('claude-1');
    expect(intelligenceForDuty(byDuty, 'translation', undefined, 'default')).toBe('lumo');
  });
  it('falls to the listening one, then the fallback', () => {
    expect(intelligenceForDuty(byDuty, 'whisper', 'osiris', 'default')).toBe('osiris');
    expect(intelligenceForDuty(byDuty, 'whisper', undefined, 'default')).toBe('default');
    expect(intelligenceForDuty(undefined, undefined, undefined, 'default')).toBe('default');
    expect(intelligenceForDuty({}, 'insight', undefined)).toBeUndefined();
  });
  it('ignores an empty or malformed assignment', () => {
    expect(intelligenceForDuty({ watering: '' }, 'watering', 'osiris', 'default')).toBe('osiris');
  });
});

describe('assignDuty — a new map, the rest untouched', () => {
  it('orders and clears without touching other duties or admitting foreign keys', () => {
    const a = assignDuty({ watering: 'x', junk: 'y' } as never, 'whisper', 'z');
    expect(a).toEqual({ watering: 'x', whisper: 'z' });
    expect(assignDuty(a, 'watering', null)).toEqual({ whisper: 'z' });
    expect(dutiesOf({ watering: 'x', whisper: 'x', insight: 'y' }, 'x')).toEqual(['whisper', 'watering']);
  });
  it('every duty has a word in the manifest', () => {
    for (const d of INTELLIGENCE_DUTIES) expect(DOMAIN_KEYS).toContain(DUTY_LABEL_KEY[d]);
    expect(isIntelligenceDuty('watering')).toBe(true);
    expect(isIntelligenceDuty('gardening')).toBe(false);
  });
});
