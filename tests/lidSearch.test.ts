import { describe, it, expect } from 'vitest';
import { searchAfterIndex, SEARCHED_COLLECTIONS, isSearchedCollection } from '../src/domain/beingIndex';

// AFTER THE INDEX HAS SPOKEN (ring 2026-11-01). The /b/ door reads the index once, then
// searches only as far as that answer leaves open. The law here is what kept a refused door
// from running eight queries that could not succeed — five seconds of loader before the
// "not public" word.

describe('what the door still asks once the index has spoken', () => {
  it('a being the index opened needs no search', () => {
    expect(searchAfterIndex({ word: 'found' })).toEqual([]);
  });

  it('a kind /b/ does not open (a person; a Light House the client gate refused) is not searched for', () => {
    expect(searchAfterIndex({ word: 'unseen' })).toEqual([]);
  });

  it('a refused read narrows the search to ONE bare ask of the named collection', () => {
    expect(searchAfterIndex({ word: 'refused', collection: 'lifetrees' })).toEqual([{ collection: 'lifetrees', pinned: false }]);
    expect(searchAfterIndex({ word: 'refused', collection: 'pulses' })).toEqual([{ collection: 'pulses', pinned: false }]);
    expect(searchAfterIndex({ word: 'refused', collection: 'lightHouses' })).toEqual([{ collection: 'lightHouses', pinned: false }]);
  });

  it('a refusal in a collection the search does not know asks nothing', () => {
    expect(searchAfterIndex({ word: 'refused', collection: 'users' })).toEqual([]);
    expect(searchAfterIndex({ word: 'refused', collection: 'links' })).toEqual([]);
    expect(searchAfterIndex({ word: 'refused', collection: '' })).toEqual([]);
  });

  it('a silent index means the full search: bare then pinned per collection, communities never pinned', () => {
    const asks = searchAfterIndex({ word: 'silent' });
    expect(asks.map(a => a.collection)).toEqual([
      'lifetrees', 'lifetrees', 'lightHouses', 'lightHouses', 'visions', 'visions', 'pulses', 'pulses', 'communities',
    ]);
    expect(asks.filter(a => a.collection === 'communities')).toEqual([{ collection: 'communities', pinned: false }]);
    // The bare ask comes first in every collection: staff and permissive rules answer it at once.
    for (const c of SEARCHED_COLLECTIONS) {
      const own = asks.filter(a => a.collection === c);
      expect(own[0].pinned).toBe(false);
    }
  });

  it('persons are never searched: /b/ does not open a person', () => {
    expect(SEARCHED_COLLECTIONS).not.toContain('users');
    expect(isSearchedCollection('users')).toBe(false);
    expect(isSearchedCollection('communities')).toBe(true);
  });
});
