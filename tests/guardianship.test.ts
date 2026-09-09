import { describe, it, expect } from 'vitest';
import { guardianRequestRefusal, guardianAnswerOutcome, validationStanding, VALIDATION_WINDOW_MS, GUARDIANS_TO_VALIDATE_DEFAULT, stampMs } from '../src/domain/guardianship';
import { DOMAIN_KEYS } from '../src/domain/words';
import { DEFAULT_NODE_LIMITS, normalizeNodeLimits } from '../src/domain/limits';

// Guardians of light (ring 2026-09-09): validation as a relationship, light through a human hand.
const DAY = 24 * 3600 * 1000;
const tree = { id: 'oak', ownerId: 'ana', treeType: 'LIFETREE', diedAtMs: null, lastCaredAtMs: 0 };
const ask = (over: Partial<Parameters<typeof guardianRequestRefusal>[0]> = {}) => guardianRequestRefusal({
  askerUid: 'ana', tree, invitee: { uid: 'bo', ownsLivingLifetree: true }, alreadyGuardian: false, pendingRequest: false, ...over,
});

describe('guardianRequestRefusal — who may be asked, by whom', () => {
  it('the owner asks another being who owns a living lifetree', () => {
    expect(ask()).toBeNull();
  });
  it('names each refusal by a domain key', () => {
    expect(ask({ askerUid: 'mallory' })).toBe('guard_not_owner');
    expect(ask({ tree: { ...tree, treeType: 'BED' } })).toBe('guard_not_lifetree');
    expect(ask({ tree: { ...tree, isNature: true } })).toBe('guard_not_lifetree');
    expect(ask({ tree: { ...tree, diedAtMs: 1 } })).toBe('guard_tree_dead');
    expect(ask({ invitee: { uid: 'ana', ownsLivingLifetree: true } })).toBe('guard_self');
    expect(ask({ invitee: { uid: 'bo', ownsLivingLifetree: false } })).toBe('guard_no_living_tree');
    expect(ask({ alreadyGuardian: true })).toBe('guard_already');
    expect(ask({ pendingRequest: true })).toBe('guard_pending');
    for (const k of ['guard_not_owner', 'guard_not_lifetree', 'guard_tree_dead', 'guard_self', 'guard_no_living_tree', 'guard_already', 'guard_pending', 'guard_ask', 'guard_accept', 'guard_decline'] as const) expect(DOMAIN_KEYS).toContain(k);
  });
});

describe('guardianAnswerOutcome — a yes mints the link; the dial says when the tree stands validated', () => {
  it('one guardian validates by default; a larger circle waits for the dial', () => {
    expect(guardianAnswerOutcome('accept', 1, GUARDIANS_TO_VALIDATE_DEFAULT)).toEqual({ mintsGuardianLink: true, requestMark: 'accepted', validates: true });
    expect(guardianAnswerOutcome('accept', 1, 3)).toEqual({ mintsGuardianLink: true, requestMark: 'accepted', validates: false });
    expect(guardianAnswerOutcome('accept', 3, 3).validates).toBe(true);
    expect(guardianAnswerOutcome('accept', 2, 0).validates).toBe(true); // a broken dial reads as the default
  });
  it('a no mints nothing and is a mark', () => {
    expect(guardianAnswerOutcome('decline', 0, 1)).toEqual({ mintsGuardianLink: false, requestMark: 'declined', validates: false });
  });
});

describe('validationStanding — live while the guardians and the care stand', () => {
  const now = 1_800_000_000_000;
  const fresh = now - DAY; const old = now - VALIDATION_WINDOW_MS - DAY;
  it('live: enough guardians with living, cared-for trees, and the tree cared for', () => {
    expect(validationStanding({ diedAtMs: null, lastCaredAtMs: fresh }, [{ uid: 'bo', ownTreeAlive: true, ownTreeCaredAtMs: fresh }], 1, now)).toBe('live');
  });
  it('none: no guardian, a dead guardian tree, or a dead tree', () => {
    expect(validationStanding({ diedAtMs: null, lastCaredAtMs: fresh }, [], 1, now)).toBe('none');
    expect(validationStanding({ diedAtMs: null, lastCaredAtMs: fresh }, [{ uid: 'bo', ownTreeAlive: false, ownTreeCaredAtMs: fresh }], 1, now)).toBe('none');
    expect(validationStanding({ diedAtMs: 1, lastCaredAtMs: fresh }, [{ uid: 'bo', ownTreeAlive: true, ownTreeCaredAtMs: fresh }], 1, now)).toBe('none');
  });
  it('lapsed: the tree, or the guardians, gone a year without care — and relit by care', () => {
    expect(validationStanding({ diedAtMs: null, lastCaredAtMs: old }, [{ uid: 'bo', ownTreeAlive: true, ownTreeCaredAtMs: fresh }], 1, now)).toBe('lapsed');
    expect(validationStanding({ diedAtMs: null, lastCaredAtMs: fresh }, [{ uid: 'bo', ownTreeAlive: true, ownTreeCaredAtMs: old }], 1, now)).toBe('lapsed');
    expect(validationStanding({ diedAtMs: null, lastCaredAtMs: fresh }, [{ uid: 'bo', ownTreeAlive: true, ownTreeCaredAtMs: old }, { uid: 'cy', ownTreeAlive: true, ownTreeCaredAtMs: fresh }], 1, now)).toBe('live');
  });
  it('the dial is a node limit of the Light Path, one by default', () => {
    expect(DEFAULT_NODE_LIMITS.guardiansToValidate).toBe(1);
    expect(normalizeNodeLimits({ guardiansToValidate: 3 }).guardiansToValidate).toBe(3);
    expect(normalizeNodeLimits({ guardiansToValidate: 'x' }).guardiansToValidate).toBe(1);
  });
  it('reads a stamp or a number to millis, never a doc', () => {
    expect(stampMs(5)).toBe(5); expect(stampMs(null)).toBeNull(); expect(stampMs({ toMillis: () => 7 } as never)).toBe(7);
  });
});
