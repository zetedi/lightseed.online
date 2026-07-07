import { describe, it, expect } from 'vitest';
import {
  isExplicitlyValidatedTree, isValidationLive, isValidationLapsed, isValidationFading,
  canValidateTree, canToggleValidation, VALIDATION_WINDOW_MS, VALIDATION_FADING_MS,
} from '../src/utils/validation';
import type { Lifetree } from '../src/types';

const NOW = 1783382400000; // 2026-07-07
const ts = (ms: number) => ({ toMillis: () => ms });
const tree = (over: Record<string, unknown> = {}): Lifetree => ({
  id: 't1', validated: true, validatorId: 'someone', isNature: false,
  lastTendedAt: ts(NOW - 1000), ...over,
} as any);

describe('validation as living care', () => {
  it('SYSTEM/GENESIS stamps are not explicit validation', () => {
    expect(isExplicitlyValidatedTree(tree({ validatorId: 'SYSTEM' }))).toBe(false);
    expect(isExplicitlyValidatedTree(tree({ validatorId: 'GENESIS' }))).toBe(false);
    expect(isExplicitlyValidatedTree(tree())).toBe(true);
  });

  it('a tended validated tree is live; an untended one lapses after the window', () => {
    expect(isValidationLive(tree(), NOW)).toBe(true);
    const quiet = tree({ lastTendedAt: ts(NOW - VALIDATION_WINDOW_MS - 1) });
    expect(isValidationLive(quiet, NOW)).toBe(false);
    expect(isValidationLapsed(quiet, NOW)).toBe(true);
  });

  it('fading kicks in during the last month only', () => {
    const fading = tree({ lastTendedAt: ts(NOW - VALIDATION_WINDOW_MS + VALIDATION_FADING_MS / 2) });
    expect(isValidationFading(fading, NOW)).toBe(true);
    expect(isValidationFading(tree(), NOW)).toBe(false);
  });
});

describe('who may validate', () => {
  const target = tree({ id: 'target', validated: false, validatorId: null });

  it('a live validated tree passes validation on — but never to itself', () => {
    expect(canValidateTree({ tree: target, myActiveTree: tree() })).toBe(true);
    expect(canValidateTree({ tree: tree(), myActiveTree: tree() })).toBe(false); // already validated
    expect(canValidateTree({ tree: target, myActiveTree: tree({ id: 'target' }) })).toBe(false); // self
  });

  it('a lapsed validator must tend before validating', () => {
    const lapsed = tree({ lastTendedAt: { toMillis: () => Date.now() - VALIDATION_WINDOW_MS - 1 } });
    expect(canValidateTree({ tree: target, myActiveTree: lapsed })).toBe(false);
  });

  it('an initiate (git ledger) validates with no tree of their own', () => {
    expect(canValidateTree({ tree: target, isInitiate: true })).toBe(true);
    expect(canToggleValidation({ tree: target, isInitiate: true })).toBe(true);
  });

  it('initiates only validate ON — un-validating stays staff-only', () => {
    expect(canToggleValidation({ tree: tree(), isInitiate: true })).toBe(false);
    expect(canToggleValidation({ tree: tree(), isAdmin: true })).toBe(true);
  });

  it('nature trees are never validated', () => {
    expect(canValidateTree({ tree: tree({ isNature: true, validated: false }), isInitiate: true })).toBe(false);
  });
});
