import { describe, it, expect } from 'vitest';
import { keepersOf, isKeeper, canResign, successorAmong, keeperRefusal } from '../src/domain/keeperCircle';

// The keeper circle's one invariant: a community is never keeperless. These laws are the
// shared source for the UI's affordances and the server's refusals (resignKeeper,
// acceptKeeperInvite, acceptKeeperRequest) — what they promise, the emulator tests prove.

const link = (from: string, createdAtMs: number) => ({ from, createdAtMs });

describe('keepersOf — the circle, anchor first, distinct', () => {
  it('the founding owner alone is a circle of one', () => {
    expect(keepersOf('zoltan', [])).toEqual(['zoltan']);
  });
  it('keeper links join the circle after the anchor', () => {
    expect(keepersOf('zoltan', [link('chris', 2), link('anna', 1)])).toEqual(['zoltan', 'chris', 'anna']);
  });
  it('a stray keeper link duplicating the anchor is counted once', () => {
    expect(keepersOf('zoltan', [link('zoltan', 1), link('anna', 2)])).toEqual(['zoltan', 'anna']);
  });
  it('isKeeper answers for the anchor, the linked, and the stranger', () => {
    const links = [link('anna', 1)];
    expect(isKeeper('zoltan', 'zoltan', links)).toBe(true);
    expect(isKeeper('anna', 'zoltan', links)).toBe(true);
    expect(isKeeper('mallory', 'zoltan', links)).toBe(false);
  });
});

describe('canResign — resignation needs company', () => {
  it('the last keeper may never leave', () => {
    expect(canResign('zoltan', 'zoltan', [])).toBe(false);
  });
  it('with a co-keeper, either may step down', () => {
    const links = [link('anna', 1)];
    expect(canResign('zoltan', 'zoltan', links)).toBe(true);
    expect(canResign('anna', 'zoltan', links)).toBe(true);
  });
  it('a non-keeper has nothing to resign from', () => {
    expect(canResign('mallory', 'zoltan', [link('anna', 1)])).toBe(false);
  });
  it('a duplicate anchor link does not fake company', () => {
    expect(canResign('zoltan', 'zoltan', [link('zoltan', 1)])).toBe(false);
  });
});

describe('successorAmong — the longest-standing keeper inherits, deterministically', () => {
  it('oldest link first', () => {
    expect(successorAmong([link('chris', 5), link('anna', 2)])).toBe('anna');
  });
  it('ties break by uid, so every replica names the same name', () => {
    expect(successorAmong([link('chris', 3), link('anna', 3)])).toBe('anna');
  });
  it('an unlanded clock (0) counts as oldest — they were first, the timestamp just lagged', () => {
    expect(successorAmong([link('anna', 7), link('chris', 0)])).toBe('chris');
  });
  it('no keepers, no successor', () => {
    expect(successorAmong([])).toBeNull();
  });
});

describe('keeperRefusal — a keeper is a rooted being', () => {
  it('a being with their own living tree may keep', () => {
    expect(keeperRefusal({ ownsLivingTree: true, alreadyKeeper: false })).toBeNull();
  });
  it('no tree, no keeping', () => {
    expect(keeperRefusal({ ownsLivingTree: false, alreadyKeeper: false })).toBe('no_tree');
  });
  it('a sitting keeper is not invited twice', () => {
    expect(keeperRefusal({ ownsLivingTree: true, alreadyKeeper: true })).toBe('already_keeper');
  });
});
