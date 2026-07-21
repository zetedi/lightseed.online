import { describe, it, expect } from 'vitest';
import { toBase62, fromBase62, isBase62Lid, LID62_LENGTH } from '../src/domain/lid62';
import { uuidv7, timeOf } from '../src/utils/id';

// The compact lid — a pure bijection at the URL/QR boundary. The stored name stays canonical;
// these tests hold the codec to losslessness, fixed length, and time-order preservation.

const LID = '018f6b2a-7c3e-7d90-b1aa-3e5f8c2d4e6f';

describe('the bijection: nothing lost either way', () => {
  it('round-trips a fixed lid exactly', () => {
    expect(fromBase62(toBase62(LID))).toBe(LID);
  });

  it('round-trips freshly minted lids, preserving the readable birth time', () => {
    for (let i = 0; i < 20; i++) {
      const lid = uuidv7();
      const back = fromBase62(toBase62(lid));
      expect(back).toBe(lid);
      expect(timeOf(back)).toBe(timeOf(lid));
    }
  });

  it('accepts a canonical lid in any letter case, emitting lowercase back', () => {
    expect(fromBase62(toBase62(LID.toUpperCase()))).toBe(LID);
  });
});

describe('the shape: 22 characters, always', () => {
  it('pads the smallest name and holds the largest', () => {
    expect(toBase62('00000000-0000-0000-0000-000000000000')).toBe('0'.repeat(LID62_LENGTH));
    expect(toBase62('ffffffff-ffff-ffff-ffff-ffffffffffff')).toHaveLength(LID62_LENGTH);
    expect(fromBase62(toBase62('ffffffff-ffff-ffff-ffff-ffffffffffff'))).toBe('ffffffff-ffff-ffff-ffff-ffffffffffff');
  });

  it('every encoding is exactly 22 characters', () => {
    for (let i = 0; i < 10; i++) expect(toBase62(uuidv7())).toHaveLength(LID62_LENGTH);
  });
});

describe('the order: UUIDv7 time-ordering survives the compression', () => {
  it('later birth encodes lexicographically later', () => {
    const t0 = Date.UTC(2026, 6, 21, 9, 0, 0);
    let prevLid = uuidv7(t0);
    let prev = toBase62(prevLid);
    for (let i = 1; i <= 10; i++) {
      const lid = uuidv7(t0 + i * 60_000);
      const enc = toBase62(lid);
      expect(enc > prev).toBe(true);
      prev = enc; prevLid = lid;
    }
    expect(timeOf(prevLid)).toBe(t0 + 10 * 60_000);
  });
});

describe('the gate: what is not a compact lid is refused', () => {
  it('rejects wrong lengths and foreign characters', () => {
    expect(() => fromBase62('short')).toThrow();
    expect(() => fromBase62('x'.repeat(23))).toThrow();
    expect(() => fromBase62('!'.repeat(LID62_LENGTH))).toThrow();
    expect(() => toBase62('not-a-lid')).toThrow();
  });

  it('rejects the top of the range: 62^22 exceeds 128 bits', () => {
    expect(() => fromBase62('z'.repeat(LID62_LENGTH))).toThrow();
    expect(isBase62Lid('z'.repeat(LID62_LENGTH))).toBe(false);
  });

  it('isBase62Lid answers without throwing', () => {
    expect(isBase62Lid(toBase62(LID))).toBe(true);
    expect(isBase62Lid(LID)).toBe(false);          // canonical form is 36 chars, not compact
    expect(isBase62Lid('0'.repeat(LID62_LENGTH))).toBe(true);
  });
});
