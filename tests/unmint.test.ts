import { describe, it, expect } from 'vitest';
import { unmintRefusal, STAFF_OVERRIDABLE_REFUSALS, touchMemoryOf, touchRestoreOf, TOUCH_FIELDS } from '../src/domain/unmint';

// The unmint law (ring 2026-08-15): only the author, only a tree mint, only the HEAD block,
// never a witnessed watering. Applied by functions/unmintBlock since ring 2026-09-23 (the
// server's mirror is held equal in tests/birth.test.ts) — these refusals and that hand must
// change together.

const mint = (over: Record<string, unknown> = {}) => ({
  authorId: 'ana', type: 'tree_growth', lifetreeId: 't1', hash: 'h9', ...over,
});

describe('unmintRefusal', () => {
  it('the author may take back the head mint', () => {
    expect(unmintRefusal(mint(), { latestHash: 'h9' }, 'ana')).toBeNull();
  });
  it('another hand may not', () => {
    expect(unmintRefusal(mint(), { latestHash: 'h9' }, 'bakr')).toBe('unmint_not_author');
    expect(unmintRefusal(mint(), { latestHash: 'h9' }, undefined)).toBe('unmint_not_author');
  });
  it('any chain block at the head qualifies — growth, tree-sent reach, alignment', () => {
    expect(unmintRefusal(mint({ type: 'reach' }), { latestHash: 'h9' }, 'ana')).toBeNull();
    expect(unmintRefusal(mint({ type: 'standard' }), { latestHash: 'h9' }, 'ana')).toBeNull();
  });
  it('only a block on a tree chain — and never a decision', () => {
    expect(unmintRefusal(mint({ lifetreeId: undefined }), { latestHash: 'h9' }, 'ana')).toBe('unmint_not_mint');
    expect(unmintRefusal(mint({ hash: undefined }), { latestHash: 'h9' }, 'ana')).toBe('unmint_not_mint');
    expect(unmintRefusal(mint({ type: 'decision' }), { latestHash: 'h9' }, 'ana')).toBe('unmint_not_mint');
  });
  it('below the head, the chain is sealed', () => {
    expect(unmintRefusal(mint(), { latestHash: 'h10' }, 'ana')).toBe('unmint_not_last');
  });
  it('a witnessed watering stands forever — the refusal outranks head position', () => {
    expect(unmintRefusal(mint({ wateringConfirmedBy: 'guardian' }), { latestHash: 'h9' }, 'ana')).toBe('unmint_witnessed');
  });
  it('nothing co-held can be unsaid: seen, loved, vetoed, or alignment-paired', () => {
    expect(unmintRefusal(mint({ seenBy: ['ana', 'bakr'] }), { latestHash: 'h9' }, 'ana')).toBe('unmint_coheld');
    expect(unmintRefusal(mint({ loveCount: 1 }), { latestHash: 'h9' }, 'ana')).toBe('unmint_coheld');
    expect(unmintRefusal(mint({ vetoes: ['lumo'] }), { latestHash: 'h9' }, 'ana')).toBe('unmint_coheld');
    expect(unmintRefusal(mint({ matchId: 'align1' }), { latestHash: 'h9' }, 'ana')).toBe('unmint_coheld');
    expect(unmintRefusal(mint({ offeringId: 'off1' }), { latestHash: 'h9' }, 'ana')).toBe('unmint_coheld');
  });
  it('the staff hand may pass the social guards only — never the structural ones', () => {
    expect(STAFF_OVERRIDABLE_REFUSALS.has('unmint_coheld')).toBe(true);
    expect(STAFF_OVERRIDABLE_REFUSALS.has('unmint_not_author')).toBe(true);
    expect(STAFF_OVERRIDABLE_REFUSALS.has('unmint_not_last')).toBe(false);   // below the head severs
    expect(STAFF_OVERRIDABLE_REFUSALS.has('unmint_witnessed')).toBe(false);  // the light is minted
    expect(STAFF_OVERRIDABLE_REFUSALS.has('unmint_not_mint')).toBe(false);
  });
  it("the author's own read receipt does not co-hold their word", () => {
    expect(unmintRefusal(mint({ seenBy: ['ana'] }), { latestHash: 'h9' }, 'ana')).toBeNull();
    expect(unmintRefusal(mint({ seenBy: [] }), { latestHash: 'h9' }, 'ana')).toBeNull();
  });
});

// THE MINT'S TOUCH (ring 2026-10-21): a growth block changes its tree in the same transaction —
// face, care stamp, a watering's clock. The block remembers what the tree wore before, and the
// unmint lifts the touch while the tree still wears it. functions/unmintBlock applies this law
// (mirror held equal in tests/birth.test.ts).
describe("the mint's touch — remembered on the block, lifted by the unmint", () => {
  // An opaque stamp, as the tree holds one: the law never reads inside it (a plain value, so
  // two stamps of the same moment compare equal — a function inside would not).
  const stamp = (ms: number) => ({ stampMs: ms });
  const DAY = 86_400_000;
  const bearer = {
    name: 'Oak', latestGrowthUrl: 'old.webp', lastCaredAt: stamp(100),
    watering: { mode: 'scheduled', intervalDays: 7, lastWateredAt: stamp(100), lastWateredBy: 'ana', lastWateredByName: 'Ana', overdue: true },
  };
  // What a watering mint writes on the tree (functions/mintBlock's bearerPatch, dotted keys).
  const wateringPatch = {
    latestGrowthUrl: 'new.webp', lastCaredAt: 'SERVER_TIME',
    'watering.lastWateredAt': stamp(500), 'watering.lastWateredBy': 'bakr', 'watering.lastWateredByName': 'Bakr',
    'watering.overdue': false, 'watering.nextDueAt': stamp(500 + 7 * DAY),
  };
  const worn = { mintedAtMs: 500, createdAtMs: 777, imageUrl: 'new.webp' };

  it('remembers exactly the fields the mint touches, nested as the tree nests them, null where the tree had none', () => {
    expect(touchMemoryOf(bearer, wateringPatch)).toEqual({
      latestGrowthUrl: 'old.webp', lastCaredAt: stamp(100),
      watering: { lastWateredAt: stamp(100), lastWateredBy: 'ana', lastWateredByName: 'Ana', overdue: true, nextDueAt: null },
    });
    expect(touchMemoryOf({}, { lastCaredAt: 'SERVER_TIME' })).toEqual({ lastCaredAt: null });
    expect(touchMemoryOf(bearer, {})).toBeNull();
  });

  it('lifts the touch while the tree still wears it: prior values return, fields the mint created clear', () => {
    const memory = touchMemoryOf(bearer, wateringPatch)!;
    expect(touchRestoreOf({ memory, block: worn, tree: { latestGrowthUrl: 'new.webp', lastCaredAtMs: 777, lastWateredAtMs: 500 } })).toEqual({
      set: {
        latestGrowthUrl: 'old.webp', lastCaredAt: stamp(100),
        'watering.lastWateredAt': stamp(100), 'watering.lastWateredBy': 'ana', 'watering.lastWateredByName': 'Ana', 'watering.overdue': true,
      },
      clear: ['watering.nextDueAt'],
    });
  });

  it("a never-watered tree's first watering clears everything it created", () => {
    const memory = touchMemoryOf({ name: 'Seed' }, wateringPatch)!;
    expect(touchRestoreOf({ memory, block: worn, tree: { latestGrowthUrl: 'new.webp', lastCaredAtMs: 777, lastWateredAtMs: 500 } })).toEqual({
      set: {},
      clear: ['latestGrowthUrl', 'lastCaredAt', 'watering.lastWateredAt', 'watering.lastWateredBy', 'watering.lastWateredByName', 'watering.overdue', 'watering.nextDueAt'],
    });
  });

  it("a later hand's word stands: an off-chain tick moved the clock and the stamp, so only the face is lifted", () => {
    const memory = touchMemoryOf(bearer, wateringPatch)!;
    expect(touchRestoreOf({ memory, block: worn, tree: { latestGrowthUrl: 'new.webp', lastCaredAtMs: 900, lastWateredAtMs: 900 } }))
      .toEqual({ set: { latestGrowthUrl: 'old.webp' }, clear: [] });
  });

  it('a face already replaced is not touched; a block without memory lifts nothing', () => {
    const memory = touchMemoryOf(bearer, { latestGrowthUrl: 'new.webp', lastCaredAt: 'SERVER_TIME' })!;
    expect(touchRestoreOf({ memory, block: worn, tree: { latestGrowthUrl: 'other.webp', lastCaredAtMs: 777 } }))
      .toEqual({ set: { lastCaredAt: stamp(100) }, clear: [] });
    expect(touchRestoreOf({ memory: null, block: worn, tree: { latestGrowthUrl: 'new.webp', lastCaredAtMs: 777, lastWateredAtMs: 500 } }))
      .toEqual({ set: {}, clear: [] });
    expect(touchRestoreOf({ block: worn, tree: {} })).toEqual({ set: {}, clear: [] });
  });

  it('a field the law does not know is left as it stands, and a block with no moment lifts no clock', () => {
    expect(touchRestoreOf({ memory: { blockHeight: 3, watering: { mode: 'scheduled' } }, block: worn, tree: { lastWateredAtMs: 500 } }))
      .toEqual({ set: {}, clear: [] });
    const memory = touchMemoryOf(bearer, wateringPatch)!;
    expect(touchRestoreOf({ memory, block: { imageUrl: 'new.webp' }, tree: { latestGrowthUrl: 'new.webp', lastCaredAtMs: 777, lastWateredAtMs: 500 } }))
      .toEqual({ set: { latestGrowthUrl: 'old.webp' }, clear: [] });
    expect(TOUCH_FIELDS).toEqual(['latestGrowthUrl', 'lastCaredAt', 'watering.lastWateredAt', 'watering.lastWateredBy', 'watering.lastWateredByName', 'watering.overdue', 'watering.nextDueAt']);
  });
});
