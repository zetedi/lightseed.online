import { describe, it, expect } from 'vitest';
import { lineageRootOf, lineageOfCopy, refinementOf, lineageReach, REFINABLE_EVENT_FIELDS } from '../src/domain/eventLineage';
import { lineageRootOf as serverRootOf, lineageOfCopy as serverLineageOfCopy } from '../functions/src/eventCircle';

// THE LINEAGE OF A GATHERING (ring 2026-09-27): derived from descends_from edges, never stored
// — and the mirror of the two readings the server births a copy with.

describe('the root and the copy', () => {
  it('a root is its own root; a copy names the root its parent named', () => {
    expect(lineageRootOf({ id: 'e1' })).toBe('e1');
    expect(lineageRootOf({ id: 'e2', lineageRootId: 'e1' })).toBe('e1');
    expect(lineageRootOf({ id: 'e2', lineageRootId: '' })).toBe('e2');
    expect(lineageOfCopy({ id: 'e1' })).toEqual({ descendsFromId: 'e1', lineageRootId: 'e1', generation: 1 });
    expect(lineageOfCopy({ id: 'e2', lineageRootId: 'e1', generation: 1 })).toEqual({ descendsFromId: 'e2', lineageRootId: 'e1', generation: 2 });
    for (const n of [{ id: 'e1' }, { id: 'e2', lineageRootId: 'e1', generation: 1 }]) {
      expect(serverRootOf(n)).toBe(lineageRootOf(n));
      expect(serverLineageOfCopy(n)).toEqual(lineageOfCopy(n));
    }
  });
});

describe('refinement — what a host changed against the parent', () => {
  it('names the fields that differ, in the frame\'s order', () => {
    const parent = { title: 'Grove Gathering', body: 'under the hearth', eventDate: '2026-09-20T12:00', imageUrls: ['a'], eventMaxParticipants: null };
    expect(refinementOf(parent, { ...parent })).toEqual([]);
    expect(refinementOf(parent, { ...parent, eventDate: '2026-10-20T12:00', imageUrls: ['a', 'b'] })).toEqual(['imageUrls', 'eventDate']);
    expect(refinementOf(parent, { ...parent, eventMaxParticipants: undefined })).toEqual([]); // null and absent are one
    expect([...REFINABLE_EVENT_FIELDS]).toContain('visibility');
  });
});

describe('reach — how wide the tree grew', () => {
  it('counts occurrences, depth, the widest fork, places and hosts', () => {
    const nodes = [
      { id: 'r', domain: 'lightseed.online', authorId: 'bakr' },
      { id: 'a', descendsFromId: 'r', lineageRootId: 'r', generation: 1, domain: 'lightseed.online', authorId: 'bakr' },
      { id: 'b', descendsFromId: 'r', lineageRootId: 'r', generation: 1, domain: 'theohouse.org', authorId: 'ana' },
      { id: 'c', descendsFromId: 'b', lineageRootId: 'r', generation: 2, domain: 'THEOHOUSE.org', authorId: 'chen' },
    ];
    expect(lineageReach(nodes)).toEqual({ occurrences: 4, depth: 2, branches: 2, places: 2, hosts: 3 });
    expect(lineageReach([{ id: 'r' }])).toEqual({ occurrences: 1, depth: 0, branches: 0, places: 0, hosts: 0 });
  });
});
