import { describe, it, expect } from 'vitest';
import {
  COLLECTION_FOR_KIND, isBeingKind, beingEntryProblem, isBeingEntry,
  rebindVerdict, addressCollisions, indexIsSound, beingStoragePath,
  type BeingEntry,
} from '../src/domain/beingIndex';
import { uuidv7 } from '../src/utils/id';

// THE LID INDEX. A true name written down beside the local address that happens to hold it
// today. These tests hold the seam: the lid and the kind are frozen forever, the address is
// free to move, and a lid that could come to mean a different being would not be a name at all.

const LID = '019ea86e-0000-7000-8000-00000000bf17';
const OTHER_LID = '019ea86e-0000-7000-8000-00000000bf18';

const entry = (over: Partial<BeingEntry> = {}): BeingEntry => ({
  lid: LID, kind: 'tree', collection: 'lifetrees', docId: 'abc123', ...over,
});

describe('an entry the index may keep', () => {
  it('a well-formed being stands', () => {
    expect(beingEntryProblem(entry())).toBeNull();
    expect(isBeingEntry(entry())).toBe(true);
  });

  it('every kind knows its own home, and the map has no gaps', () => {
    for (const [kind, collection] of Object.entries(COLLECTION_FOR_KIND)) {
      expect(isBeingKind(kind)).toBe(true);
      expect(beingEntryProblem(entry({ kind: kind as never, collection }))).toBeNull();
    }
  });

  it('refuses a name that is not a true name', () => {
    expect(beingEntryProblem(entry({ lid: 'lifetree-42' }))).toMatch(/UUIDv7/);
    expect(beingEntryProblem(entry({ lid: '' }))).toMatch(/UUIDv7/);
    // A UUIDv4 is a fine identifier and still not a lid — birth-time is in a lid's first bits.
    expect(beingEntryProblem(entry({ lid: '019ea86e-0000-4000-8000-00000000bf17' }))).toMatch(/UUIDv7/);
  });

  it('refuses a kind it cannot address, and relations are not addressed here', () => {
    expect(beingEntryProblem(entry({ kind: 'link' as never }))).toMatch(/not a kind/);
    expect(beingEntryProblem(entry({ kind: 'covenant' as never }))).toMatch(/not a kind/);
    expect(isBeingKind('constructor')).toBe(false); // not a kind merely because Object has one
  });

  it('refuses a map that lies about where a kind lives', () => {
    expect(beingEntryProblem(entry({ kind: 'tree', collection: 'visions' }))).toMatch(/lifetrees/);
    expect(beingEntryProblem(entry({ collection: '' }))).toMatch(/lifetrees/);
  });

  it('refuses an address with no document, and nothing at all', () => {
    expect(beingEntryProblem(entry({ docId: '   ' }))).toMatch(/needs a document/);
    expect(beingEntryProblem(null)).toMatch(/not nothing/);
    expect(beingEntryProblem(undefined)).toMatch(/not nothing/);
  });

  it('accepts a freshly minted lid — the real generator, not a fixture', () => {
    expect(beingEntryProblem(entry({ lid: uuidv7() }))).toBeNull();
  });
});

describe('re-pointing: the portable name over the local address', () => {
  it('the same being at the same address is unchanged', () => {
    expect(rebindVerdict(entry(), entry())).toEqual({ verdict: 'unchanged' });
  });

  it('THE POINT: a being rehoused keeps its name and moves its address', () => {
    // An import from another node, a restore, a migration — the same tree, a new local id.
    const moved = rebindVerdict(entry(), entry({ docId: 'restored-99' }));
    expect(moved).toEqual({ verdict: 'moved', from: 'lifetrees/abc123', to: 'lifetrees/restored-99' });
  });

  it('a lid never comes to mean a different kind of being', () => {
    const v = rebindVerdict(entry(), entry({ kind: 'vision', collection: 'visions' }));
    expect(v.verdict).toBe('refused');
    if (v.verdict === 'refused') expect(v.reason).toMatch(/does not change what it names/);
  });

  it('another true name is another entry entirely', () => {
    const v = rebindVerdict(entry(), entry({ lid: OTHER_LID }));
    expect(v.verdict).toBe('refused');
    if (v.verdict === 'refused') expect(v.reason).toMatch(/different true name/);
  });

  it('a malformed rewrite is refused with the reason read aloud', () => {
    const v = rebindVerdict(entry(), entry({ docId: '' }));
    expect(v.verdict).toBe('refused');
    if (v.verdict === 'refused') expect(v.reason).toMatch(/needs a document/);
  });
});

describe('the audit: two names for one being', () => {
  it('a sound index has no collisions', () => {
    const entries = [entry(), entry({ lid: OTHER_LID, docId: 'def456' })];
    expect(addressCollisions(entries)).toEqual([]);
    expect(indexIsSound(entries)).toBe(true);
  });

  it('names the address two lids both claim — an identity quietly split', () => {
    const entries = [entry(), entry({ lid: OTHER_LID })];
    expect(addressCollisions(entries)).toEqual([{ address: 'lifetrees/abc123', lids: [LID, OTHER_LID] }]);
    expect(indexIsSound(entries)).toBe(false);
  });

  it('the same lid written twice is not a collision — that is one being, said twice', () => {
    expect(addressCollisions([entry(), entry()])).toEqual([]);
  });

  it('the same document id under different collections is two different beings', () => {
    const entries = [entry(), entry({ lid: OTHER_LID, kind: 'vision', collection: 'visions' })];
    expect(addressCollisions(entries)).toEqual([]);
  });

  it('an unsound entry fails the audit even with no collision', () => {
    expect(indexIsSound([entry({ lid: 'not-a-lid' })])).toBe(false);
    expect(indexIsSound([])).toBe(true);
  });
});

describe('naming things by the true name', () => {
  it('files media under the being, not under the auth account holding it today', () => {
    expect(beingStoragePath(LID, 'events')).toBe(`beings/${LID}/events`);
    expect(beingStoragePath(LID, '/events/')).toBe(`beings/${LID}/events`);
  });

  it('a name that is not a true name opens no storage prefix', () => {
    expect(beingStoragePath('../admin', 'events')).toBeNull();
    expect(beingStoragePath('', 'events')).toBeNull();
  });

  it('refuses a folder that tries to climb out of the being', () => {
    expect(beingStoragePath(LID, '../..')).toBeNull();
    expect(beingStoragePath(LID, 'events/../../other')).toBeNull();
    expect(beingStoragePath(LID, '   ')).toBeNull();
  });
});
