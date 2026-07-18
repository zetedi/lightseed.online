import { describe, it, expect } from 'vitest';
import { uuidv7, timeOf } from '../src/utils/id';

describe('uuidv7 — the LID, an object\'s true name', () => {
  it('is a well-formed v7 UUID (version nibble 7, RFC 4122 variant)', () => {
    const lid = uuidv7();
    expect(lid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('carries its birth-time in the first 48 bits, readable back via timeOf', () => {
    const at = 1783382400000; // 2026-07-07 — a good day to be born
    expect(timeOf(uuidv7(at))).toBe(at);
  });

  it('sorts by birth', () => {
    const early = uuidv7(1000);
    const late = uuidv7(2000);
    expect(early < late).toBe(true);
  });

  it('timeOf tolerates junk', () => {
    expect(timeOf('not-a-uuid')).toBe(null);
    expect(timeOf(undefined)).toBe(null);
  });
});
