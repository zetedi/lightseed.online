import { describe, it, expect } from 'vitest';
import { picturesOf, faceOf, picturesToStore } from '../src/domain/pictures';

// THE PICTURES A RECORD WEARS (ring 2026-10-05): many in order, the first the face; a record that
// knows only one picture still sees it.

describe('picturesOf / faceOf', () => {
  it('reads the list when there is one, in its order', () => {
    expect(picturesOf({ imageUrl: 'a', imageUrls: ['b', 'a'] })).toEqual(['b', 'a']);
    expect(faceOf({ imageUrl: 'a', imageUrls: ['b', 'a'] })).toBe('b');
  });
  it('falls back to the single picture, and to nothing', () => {
    expect(picturesOf({ imageUrl: 'a' })).toEqual(['a']);
    expect(picturesOf({ imageUrl: 'a', imageUrls: [] })).toEqual(['a']);
    expect(picturesOf({})).toEqual([]);
    expect(picturesOf(null)).toEqual([]);
    expect(faceOf(undefined)).toBe('');
  });
  it('drops empty entries a half-saved record may carry', () => {
    expect(picturesOf({ imageUrls: ['', 'x', ''] })).toEqual(['x']);
  });
});

describe('picturesToStore', () => {
  it('writes the list and the face beside it', () => {
    expect(picturesToStore(['b', 'a'])).toEqual({ imageUrl: 'b', imageUrls: ['b', 'a'] });
  });
  it('a record with no picture stores an empty face and an empty list — no lie', () => {
    expect(picturesToStore([])).toEqual({ imageUrl: '', imageUrls: [] });
    expect(picturesToStore([''])).toEqual({ imageUrl: '', imageUrls: [] });
  });
});
