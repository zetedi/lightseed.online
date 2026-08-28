import { describe, it, expect } from 'vitest';
import { roleLabelKey, roleDescKey, tendedTreeRoles, formCircleRefusal, type TreeRelationRole } from '../src/domain/treeCircle';
import { treeCircle } from '../src/domain/views/circle';
import { translations } from '../src/utils/translations';
import type { Link } from '../src/domain/link';

// The circle's words and its shape. The words live in ONE home (translations.ts, role_* keys —
// ar/zh completeness is held by translations.test.ts); the domain holds only typed key
// references, so a role added without words fails COMPILATION — the type system is the mirror
// test, and there is no copy anywhere to drift. What these tests hold is the MEANING: a role
// offered next to "Invite into the circle" must say what the rules actually grant.

const ROLES: TreeRelationRole[] = ['owner', 'co_owner', 'guardian', 'steward', 'observer'];
const label = (r: TreeRelationRole) => translations.en[roleLabelKey(r)];
const desc = (r: TreeRelationRole) => translations.en[roleDescKey(r)];

describe('the roles say what they are', () => {
  it('every role carries a label and a description — nothing is offered unnamed', () => {
    for (const role of ROLES) {
      expect(label(role).trim().length).toBeGreaterThan(0);
      expect(desc(role).trim().length).toBeGreaterThan(20);
    }
  });

  it('no two roles share a description — a difference that cannot be told is not a difference', () => {
    const texts = ROLES.map(desc);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('the descriptions state the real split: carers care, the guardian witnesses, the observer holds no power', () => {
    // Mirrors firestore.rules isTreeCarer (owner/co_owner/steward) and functions/witnessWatering
    // (guardian-only). If the rules change, these words must change WITH them — that is the point.
    expect(desc('co_owner')).toMatch(/cares/i);
    expect(desc('steward')).toMatch(/cares/i);
    expect(desc('guardian')).toMatch(/witness/i);
    expect(desc('guardian')).toMatch(/veto/i);
    expect(desc('guardian')).toMatch(/no caring power/i);
    expect(desc('observer')).toMatch(/no power/i);
  });
});

describe('the circle view groups the graph', () => {
  const link = (from: string, rel: string, to: string): Link =>
    ({ id: `${from}__${rel}__${to}`, lid: 'x', type: 'link', rel, from, to } as unknown as Link);

  it('owner first, then each linked role; size counts distinct beings', () => {
    const { groups, size } = treeCircle('zoltan', [
      link('lumo', 'guardian', 't1'),
      link('aspen', 'co_owner', 't1'),
      link('lumo', 'observer', 't1'), // one being, two seats — counted once
    ]);
    expect(groups.map(g => g.role)).toEqual(['owner', 'co_owner', 'guardian', 'observer']);
    expect(size).toBe(3);
  });

  it('a relation the circle does not know is left alone, never mislabelled', () => {
    const { groups } = treeCircle('zoltan', [link('m', 'member', 'com1')]);
    expect(groups).toEqual([{ role: 'owner', members: ['zoltan'] }]);
  });
});

describe('tendedTreeRoles — the caring layer as a profile prism', () => {
  const edge = (from: string, rel: string, to: string) => ({ from, rel, to });

  it('collects co_owner and steward links, one role per tree', () => {
    const roles = tendedTreeRoles([
      edge('me', 'co_owner', 't1'),
      edge('me', 'steward', 't2'),
    ], 'me');
    expect(roles.get('t1')).toBe('co_owner');
    expect(roles.get('t2')).toBe('steward');
  });

  it('co_owner outranks steward when both stand, in either order', () => {
    expect(tendedTreeRoles([edge('me', 'steward', 't'), edge('me', 'co_owner', 't')], 'me').get('t')).toBe('co_owner');
    expect(tendedTreeRoles([edge('me', 'co_owner', 't'), edge('me', 'steward', 't')], 'me').get('t')).toBe('co_owner');
  });

  it('ignores other rels and other hands', () => {
    const roles = tendedTreeRoles([
      edge('me', 'guardian', 't1'),
      edge('me', 'observer', 't2'),
      edge('someone', 'co_owner', 't3'),
    ], 'me');
    expect(roles.size).toBe(0);
  });
});

describe('formCircleRefusal — a circle graduates by the hands that carry it', () => {
  const facts = (over: Partial<Parameters<typeof formCircleRefusal>[0]>) => ({
    formation: 'tree_co_ownership', formedAtMs: null,
    isCircleKeeper: false, isTreeCoOwner: false, ...over,
  });

  it('a circle keeper or a root-tree co-owner may form', () => {
    expect(formCircleRefusal(facts({ isCircleKeeper: true }))).toBeNull();
    expect(formCircleRefusal(facts({ isTreeCoOwner: true }))).toBeNull();
  });

  it('any other hand is refused', () => {
    expect(formCircleRefusal(facts({}))).toBe('not_hand');
  });

  it('only a circle can graduate, and only once', () => {
    expect(formCircleRefusal(facts({ formation: 'manual', isCircleKeeper: true }))).toBe('not_circle');
    expect(formCircleRefusal(facts({ formation: undefined, isCircleKeeper: true }))).toBe('not_circle');
    expect(formCircleRefusal(facts({ formedAtMs: 123, isCircleKeeper: true }))).toBe('already_formed');
  });
});
