import { describe, it, expect } from 'vitest';
import { roleLabelKey, roleDescKey, type TreeRelationRole } from '../src/domain/treeCircle';
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
