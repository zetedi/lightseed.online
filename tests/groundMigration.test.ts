import { describe, it, expect } from 'vitest';
import { planGroundMigration, groundMigrationActs, migratedGroundFields, type MigrationTree, type MigrationVision } from '../src/domain/groundMigration';

// THE OLD TIE BECOMES A GROUND (step 4, the plan): what would be written, and what would not, and why.
const tree = (over: Partial<MigrationTree> = {}): MigrationTree => ({ id: 't1', anchorUid: 'u-anchor', treeType: 'LIFETREE', visibility: 'public', diedAtMs: null, carerUids: [], ...over });
const vision = (over: Partial<MigrationVision> = {}): MigrationVision => ({ id: 'v1', authorId: 'u-anchor', title: 'A clearing', visibility: 'public', lifetreeId: 't1', createdAtMs: 100, ...over });
const one = (v: MigrationVision, t: MigrationTree | null, standing: { visionId: string; treeId: string }[] = []) =>
  planGroundMigration([v], t ? [t] : [], standing).rows[0];

describe('one vision, one old field', () => {
  it('the author who cares for the tree stands on both sides: a ground, marked self', () => {
    expect(one(vision(), tree())).toEqual({ visionId: 'v1', treeId: 't1', verdict: 'ground', self: true, birth: false });
    expect(one(vision({ authorId: 'u-keeper' }), tree({ carerUids: ['u-keeper'] })).verdict).toBe('ground');
  });
  it('an author who is no carer of the tree has no one\'s yes: nothing is written', () => {
    expect(one(vision({ authorId: 'u-stranger' }), tree())).toMatchObject({ verdict: 'needs_yes', self: false, birth: false });
    expect(one(vision({ authorId: '' }), tree()).verdict).toBe('needs_yes');
  });
  it('what the law forbids today keeps its old field, and the plan says why', () => {
    expect(one(vision({ visibility: 'private' }), tree())).toMatchObject({ verdict: 'refused', refusal: 'ground_vision_hidden' });
    expect(one(vision(), tree({ visibility: 'private' }))).toMatchObject({ verdict: 'refused', refusal: 'ground_tree_hidden' });
    expect(one(vision(), tree({ visibility: 'node' }))).toMatchObject({ verdict: 'refused', refusal: 'ground_tree_hidden' });
    expect(one(vision(), tree({ treeType: 'SECRET' }))).toMatchObject({ verdict: 'refused', refusal: 'ground_secret_tree' });
    expect(one(vision(), tree({ treeType: 'BED' }))).toMatchObject({ verdict: 'refused', refusal: 'ground_bed' });
    expect(one(vision(), tree({ diedAtMs: 5 }))).toMatchObject({ verdict: 'refused', refusal: 'ground_tree_gone' });
  });
  it('a field naming no living record, and a ground that already stands', () => {
    expect(one(vision(), null).verdict).toBe('tree_gone');
    expect(one(vision(), tree(), [{ visionId: 'v1', treeId: 't1' }]).verdict).toBe('already');
  });
  it('a vision with no field is counted and left alone', () => {
    const plan = planGroundMigration([vision({ lifetreeId: '' }), vision({ id: 'v2', lifetreeId: null })], [tree()], []);
    expect(plan.rows).toEqual([]);
    expect(plan.counts).toMatchObject({ visions: 2, withoutField: 2, ground: 0 });
  });
});

describe('the Root Vision is the eldest one its anchor titled so', () => {
  it('one birth to a tree, whatever the reading order', () => {
    const visions = [
      vision({ id: 'v-later-root', title: 'Root Vision', createdAtMs: 300 }),
      vision({ id: 'v-root', title: 'root vision ', createdAtMs: 100 }),
      vision({ id: 'v-other', title: 'Water', createdAtMs: 200 }),
    ];
    for (const order of [visions, [...visions].reverse()]) {
      const plan = planGroundMigration(order, [tree()], []);
      expect(plan.rows.filter(r => r.birth).map(r => r.visionId)).toEqual(['v-root']);
      expect(plan.counts).toMatchObject({ ground: 3, births: 1 });
    }
  });
  it('a "Root Vision" voiced by someone other than the anchor is no birth', () => {
    const row = one(vision({ title: 'Root Vision', authorId: 'u-keeper' }), tree({ carerUids: ['u-keeper'] }));
    expect(row).toMatchObject({ verdict: 'ground', self: true, birth: false });
  });
});

describe('the caps and the count', () => {
  it('a tree grounds twelve; later visions wait, and standing grounds count', () => {
    const visions = Array.from({ length: 14 }, (_, n) => vision({ id: `v${String(n).padStart(2, '0')}`, createdAtMs: n }));
    const plan = planGroundMigration(visions, [tree()], [{ visionId: 'elsewhere', treeId: 't1' }]);
    expect(plan.counts).toMatchObject({ ground: 11, tree_full: 3 });
    expect(plan.rows.filter(r => r.verdict === 'tree_full').map(r => r.visionId)).toEqual(['v11', 'v12', 'v13']);
  });
  it('the reasons for refusal are tallied by the law\'s own keys', () => {
    const plan = planGroundMigration(
      [vision({ id: 'a', visibility: 'private' }), vision({ id: 'b', visibility: 'private' }), vision({ id: 'c', lifetreeId: 't2' })],
      [tree(), tree({ id: 't2', treeType: 'SECRET' })], []);
    expect(plan.refusals).toEqual({ ground_vision_hidden: 2, ground_secret_tree: 1 });
    expect(plan.counts.refused).toBe(3);
  });
  it('the plan changes nothing it was given', () => {
    const visions = [vision()], trees = [tree()];
    const before = JSON.stringify([visions, trees]);
    planGroundMigration(visions, trees, []);
    expect(JSON.stringify([visions, trees])).toBe(before);
  });
});

describe('the apply writes two kinds of act and nothing else (keeper, 2026-11-18)', () => {
  it('a ground for each vision its own author can ground, the field cleared where the tree is gone', () => {
    const plan = planGroundMigration([
      vision({ id: 'v-root', title: 'Root Vision', createdAtMs: 1 }),
      vision({ id: 'v-own', createdAtMs: 2 }),
      vision({ id: 'v-orphan', lifetreeId: 't-gone', createdAtMs: 3 }),
      vision({ id: 'v-stranger', authorId: 'u-stranger', createdAtMs: 4 }),
      vision({ id: 'v-hidden', visibility: 'private', createdAtMs: 5 }),
      vision({ id: 'v-stands', createdAtMs: 6 }),
      vision({ id: 'v-free', lifetreeId: null, createdAtMs: 7 }),
    ], [tree()], [{ visionId: 'v-stands', treeId: 't1' }]);
    expect(groundMigrationActs(plan)).toEqual({
      grounds: [{ visionId: 'v-root', treeId: 't1', birth: true }, { visionId: 'v-own', treeId: 't1', birth: false }],
      cleared: [{ visionId: 'v-orphan', treeId: 't-gone' }],
    });
  });
  it('a migrated ground says it was carried across, and names no blocks', () => {
    expect(migratedGroundFields('u-anchor', true)).toEqual({ self: true, birth: true, requestedBy: 'u-anchor', acceptedBy: 'u-anchor', migrated: true });
    expect(migratedGroundFields('u-anchor', false)).not.toHaveProperty('groundedPulseIds');
  });
});
