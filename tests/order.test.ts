import { describe, it, expect } from 'vitest';
import { moveItem, canMoveEarlier, canMoveLater } from '../src/domain/order';

// REORDERING BY HAND (ring 2026-10-05): the pictures of an event or a gallery are moved one at a
// time; nothing is lost, nothing doubled, and a move that changes nothing changes nothing.

describe('moveItem', () => {
  const abcd = ['a', 'b', 'c', 'd'];
  it('lifts an item and sets it down later; everything between slides one step back', () => {
    expect(moveItem(abcd, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(abcd, 1, 3)).toEqual(['a', 'c', 'd', 'b']);
  });
  it('lifts an item and sets it down earlier; everything between slides one step forward', () => {
    expect(moveItem(abcd, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(abcd, 2, 1)).toEqual(['a', 'c', 'b', 'd']);
  });
  it('a move to the front changes the cover — the first item', () => {
    expect(moveItem(abcd, 2, 0)[0]).toBe('c');
  });
  it('never loses or doubles an item, and leaves the given list untouched', () => {
    const moved = moveItem(abcd, 0, 3);
    expect([...moved].sort()).toEqual(abcd);
    expect(abcd).toEqual(['a', 'b', 'c', 'd']);
  });
  it('an unchanged or out-of-range move returns the SAME array (no render)', () => {
    expect(moveItem(abcd, 1, 1)).toBe(abcd);
    expect(moveItem(abcd, -1, 0)).toBe(abcd);
    expect(moveItem(abcd, 0, 4)).toBe(abcd);
    expect(moveItem(abcd, 4, 0)).toBe(abcd);
    expect(moveItem([], 0, 0)).toEqual([]);
  });
});

describe('the arrows', () => {
  it('the first cannot move earlier, the last cannot move later, a lone item moves nowhere', () => {
    expect(canMoveEarlier(0)).toBe(false);
    expect(canMoveEarlier(1)).toBe(true);
    expect(canMoveLater(2, 3)).toBe(false);
    expect(canMoveLater(1, 3)).toBe(true);
    expect(canMoveEarlier(0) || canMoveLater(0, 1)).toBe(false);
  });
});
