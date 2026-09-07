import { describe, it, expect } from 'vitest';
import { normalizeHex } from '../src/domain/color';

// The palette's second mouth (ring 2026-09-07): a hex code typed by hand settles into the one
// form the picker carries, or is refused — never a half-typed colour in the theme.
describe('normalizeHex — the one spelling of a colour', () => {
  it('settles six digits, any case, with or without #, whitespace forgiven', () => {
    expect(normalizeHex('#0a0f1e')).toBe('#0a0f1e');
    expect(normalizeHex('0A0F1E')).toBe('#0a0f1e');
    expect(normalizeHex('  #FFFFFF ')).toBe('#ffffff');
  });
  it('expands the short form', () => {
    expect(normalizeHex('#abc')).toBe('#aabbcc');
    expect(normalizeHex('ABC')).toBe('#aabbcc');
  });
  it('is idempotent on its own answer', () => {
    for (const s of ['#abc', 'ABCDEF', ' 123 ']) expect(normalizeHex(normalizeHex(s))).toBe(normalizeHex(s));
  });
  it('refuses what is not a colour yet, or not one at all', () => {
    for (const s of ['', '#', '#ab', '#abcd', '#abcde', '#abcdef0', '#ggg', 'red', 'rgb(0,0,0)', '#abcdefff', null, undefined]) {
      expect(normalizeHex(s), String(s)).toBeNull();
    }
  });
});
