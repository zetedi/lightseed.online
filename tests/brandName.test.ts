import { describe, expect, it } from 'vitest';
import { brandLinesOf, BRAND_ONE_LINE_MAX } from '../src/domain/brandName';

// THE NAME IN THE HEADER (ring 2026-10-19): one line when it fits, two balanced lines when it does not.

describe('brandLinesOf', () => {
  it('keeps a short name on one line at full size', () => {
    expect(brandLinesOf('.seed')).toEqual({ lines: ['.seed'], small: false });
    expect(brandLinesOf('The O House')).toEqual({ lines: ['The O House'], small: false });
    expect(brandLinesOf('Per Auset')).toEqual({ lines: ['Per Auset'], small: false });
  });
  it('breaks a long name into two lines at a word boundary, smaller', () => {
    expect(brandLinesOf('Enlightened Nations')).toEqual({ lines: ['Enlightened', 'Nations'], small: true });
  });
  it('chooses the break that keeps the longer line shortest', () => {
    expect(brandLinesOf('Mama Way Community Garden').lines).toEqual(['Mama Way', 'Community Garden']);
    // A tie keeps the earlier break: the shorter line first, the longer beneath it.
    expect(brandLinesOf('A Very Long Place Name Indeed').lines).toEqual(['A Very Long', 'Place Name Indeed']);
  });
  it('a single long word only shrinks; the name itself is never altered', () => {
    expect(brandLinesOf('Enlightenednations')).toEqual({ lines: ['Enlightenednations'], small: true });
    expect(brandLinesOf('  Enlightened   Nations  ').lines.join(' ')).toBe('Enlightened Nations');
    expect(brandLinesOf('')).toEqual({ lines: [''], small: false });
  });
  it('honours the limit it is given', () => {
    expect(BRAND_ONE_LINE_MAX).toBe(12);
    expect(brandLinesOf('Enlightened Nations', 30).small).toBe(false);
  });
});
