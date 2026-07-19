import { describe, it, expect } from 'vitest';
import { sustainingSeven, SUSTAINING_SEVEN, type GuardianEdge } from '../src/domain/sustainingSeven';
import { DAY_MS } from '../src/domain/watering';
import type { Lifetree } from '../src/domain/lifetree';

// The sustaining seven — the pure floor-reading: which of my planted trees stand
// witnessed and tended, and what each still lacks. Invited, never enforced.

const NOW = 1_800_000_000_000;
const ts = (ms: number) => ({ toMillis: () => ms }) as any;

const tree = (id: string, over: Partial<Lifetree> = {}): Lifetree => ({
  id,
  ownerId: 'alice',
  name: `Tree ${id}`,
  body: '',
  createdAt: ts(NOW - 100 * DAY_MS),
  ...over,
}) as unknown as Lifetree;

const overdueWatering = {
  mode: 'scheduled', stage: 'planted', intervalDays: 1, lastWateredAt: ts(NOW - 3 * DAY_MS),
} as any;
const freshWatering = {
  mode: 'scheduled', stage: 'planted', intervalDays: 7, lastWateredAt: ts(NOW - DAY_MS),
} as any;

const witnessedBy = (uid: string, ...treeIds: string[]): GuardianEdge[] =>
  treeIds.map(to => ({ from: uid, to }));

describe('sustainingSeven — the floor of seven planted, witnessed, tended trees', () => {
  it('counts only trees the being PLANTED: guarded, beds, and others\' trees stay out', () => {
    const trees = [
      tree('mine'),
      tree('guarded', { treeType: 'GUARDED' }),
      tree('legacy-nature', { treeType: undefined, isNature: true } as any),
      tree('bed', { treeType: 'BED' }),
      tree('bobs', { ownerId: 'bob' }),
    ];
    const p = sustainingSeven(trees, [], 'alice', NOW);
    expect(p.planted).toBe(1);
    expect(p.standings.map(s => s.treeId)).toEqual(['mine']);
  });

  it('a witness is a guardian BESIDES the planter — the planter\'s own vow does not witness', () => {
    const trees = [tree('a'), tree('b'), tree('c')];
    const edges = [
      ...witnessedBy('alice', 'a'),   // self-vow: not a witness
      ...witnessedBy('bob', 'b'),     // a witness
    ];
    const p = sustainingSeven(trees, edges, 'alice', NOW);
    const byId = Object.fromEntries(p.standings.map(s => [s.treeId, s]));
    expect(byId['a'].witnessed).toBe(false);
    expect(byId['b'].witnessed).toBe(true);
    expect(byId['c'].witnessed).toBe(false);
  });

  it('tended follows the tree\'s own rhythm: overdue fails, fresh and unscheduled stand', () => {
    const trees = [
      tree('thirsty', { watering: overdueWatering } as any),
      tree('fresh', { watering: freshWatering } as any),
      tree('unscheduled'),
    ];
    const p = sustainingSeven(trees, witnessedBy('bob', 'thirsty', 'fresh', 'unscheduled'), 'alice', NOW);
    const byId = Object.fromEntries(p.standings.map(s => [s.treeId, s]));
    expect(byId['thirsty'].tended).toBe(false);
    expect(byId['thirsty'].sustaining).toBe(false);
    expect(byId['fresh'].sustaining).toBe(true);
    expect(byId['unscheduled'].sustaining).toBe(true);
  });

  it('completes at seven sustaining trees — witnessed AND tended together', () => {
    const ids = ['t1', 't2', 't3', 't4', 't5', 't6', 't7'];
    const trees = ids.map(id => tree(id));
    const six = sustainingSeven(trees, witnessedBy('bob', ...ids.slice(0, 6)), 'alice', NOW);
    expect(six.sustaining).toBe(6);
    expect(six.complete).toBe(false);
    const seven = sustainingSeven(trees, witnessedBy('bob', ...ids), 'alice', NOW);
    expect(seven.sustaining).toBe(SUSTAINING_SEVEN);
    expect(seven.complete).toBe(true);
  });

  it('standings keep planting order (createdAt ascending)', () => {
    const trees = [
      tree('young', { createdAt: ts(NOW - DAY_MS) } as any),
      tree('elder', { createdAt: ts(NOW - 500 * DAY_MS) } as any),
      tree('middle', { createdAt: ts(NOW - 50 * DAY_MS) } as any),
    ];
    const p = sustainingSeven(trees, [], 'alice', NOW);
    expect(p.standings.map(s => s.treeId)).toEqual(['elder', 'middle', 'young']);
  });

  it('more than seven planted: the floor asks only that seven of them sustain', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `t${i}`);
    const trees = ids.map(id => tree(id));
    const p = sustainingSeven(trees, witnessedBy('bob', ...ids.slice(0, 7)), 'alice', NOW);
    expect(p.planted).toBe(10);
    expect(p.sustaining).toBe(7);
    expect(p.complete).toBe(true);
  });
});
