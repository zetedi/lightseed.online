import { describe, it, expect } from 'vitest';
import {
  treePlantingGate, normalizeNodeLimits,
  DEFAULT_MAX_LIFETREES, DEFAULT_MAX_GUARDED_TREES, DEFAULT_NODE_LIMITS,
} from '../src/domain/limits';

const lifetrees = (n: number) => Array.from({ length: n }, () => ({ treeType: 'LIFETREE' }));
const guarded = (n: number) => Array.from({ length: n }, () => ({ treeType: 'GUARDED' }));

describe('treePlantingGate — quality, not quantity', () => {
  it('the default caps sum to 144', () => {
    expect(DEFAULT_MAX_LIFETREES).toBe(12);
    expect(DEFAULT_MAX_GUARDED_TREES).toBe(132);
    expect(DEFAULT_MAX_LIFETREES + DEFAULT_MAX_GUARDED_TREES).toBe(144);
  });

  it('allows planting below the caps', () => {
    expect(treePlantingGate(lifetrees(DEFAULT_MAX_LIFETREES - 1), 'LIFETREE')).toBeNull();
    expect(treePlantingGate(guarded(DEFAULT_MAX_GUARDED_TREES - 1), 'GUARDED')).toBeNull();
  });

  it('refuses the 13th lifetree with the quality-not-quantity message', () => {
    const refusal = treePlantingGate(lifetrees(DEFAULT_MAX_LIFETREES), 'LIFETREE');
    expect(refusal).toMatch(/quality, not quantity/);
  });

  it('refuses the 133rd guarded tree with the quality-not-quantity message', () => {
    const refusal = treePlantingGate(guarded(DEFAULT_MAX_GUARDED_TREES), 'GUARDED');
    expect(refusal).toMatch(/quality, not quantity/);
  });

  it('counts each kind independently — a full grove does not block a lifetree', () => {
    expect(treePlantingGate(guarded(DEFAULT_MAX_GUARDED_TREES), 'LIFETREE')).toBeNull();
    expect(treePlantingGate(lifetrees(DEFAULT_MAX_LIFETREES), 'GUARDED')).toBeNull();
  });

  it('treats legacy nature trees (no treeType, isNature) as guarded', () => {
    const legacy = Array.from({ length: DEFAULT_MAX_GUARDED_TREES }, () => ({ isNature: true }));
    expect(treePlantingGate(legacy, 'GUARDED')).toMatch(/quality, not quantity/);
    expect(treePlantingGate(legacy, 'LIFETREE')).toBeNull();
  });

  it('honours node-level caps from config and quotes them in the refusal', () => {
    const caps = { maxLifetrees: 3, maxGuardedTrees: 5 };
    expect(treePlantingGate(lifetrees(2), 'LIFETREE', caps)).toBeNull();
    expect(treePlantingGate(lifetrees(3), 'LIFETREE', caps)).toMatch(/3 lifetrees/);
    expect(treePlantingGate(guarded(5), 'GUARDED', caps)).toMatch(/5 trees/);
  });
});

describe('normalizeNodeLimits — the config doc can hold anything', () => {
  it('falls back to defaults for missing/invalid values', () => {
    expect(normalizeNodeLimits(undefined)).toEqual(DEFAULT_NODE_LIMITS);
    expect(normalizeNodeLimits({ maxLifetrees: 'many', maxGuardedTrees: -4 })).toEqual(DEFAULT_NODE_LIMITS);
  });

  it('floors and keeps valid values', () => {
    expect(normalizeNodeLimits({ maxLifetrees: 7.9, maxGuardedTrees: 21 })).toEqual({ maxLifetrees: 7, maxGuardedTrees: 21 });
  });
});
