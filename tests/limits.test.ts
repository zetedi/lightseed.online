import { describe, it, expect } from 'vitest';
import {
  treePlantingGate, normalizeNodeLimits, nodeCapacityGate,
  DEFAULT_MAX_LIFETREES, DEFAULT_MAX_GUARDED_TREES, DEFAULT_NODE_LIMITS, UN_MEMBER_STATES,
} from '../src/domain/limits';
import { speak } from '../src/utils/translations';

const lifetrees = (n: number) => Array.from({ length: n }, () => ({ treeType: 'LIFETREE' }));
const guarded = (n: number) => Array.from({ length: n }, () => ({ treeType: 'GUARDED' }));

describe('treePlantingGate — quality, not quantity', () => {
  it('the personal cap is the UN roll (one citizenship-tree per country); guarding stays 132', () => {
    expect(UN_MEMBER_STATES).toBe(193);
    expect(DEFAULT_MAX_LIFETREES).toBe(UN_MEMBER_STATES);
    expect(DEFAULT_MAX_GUARDED_TREES).toBe(132);
  });

  it('allows planting below the caps', () => {
    expect(treePlantingGate(lifetrees(DEFAULT_MAX_LIFETREES - 1), 'LIFETREE')).toBeNull();
    expect(treePlantingGate(guarded(DEFAULT_MAX_GUARDED_TREES - 1), 'GUARDED')).toBeNull();
  });

  it('refuses the lifetree beyond the last country with the quality-not-quantity message', () => {
    const refusal = treePlantingGate(lifetrees(DEFAULT_MAX_LIFETREES), 'LIFETREE');
    expect(speak(refusal!)).toMatch(/quality, not quantity/);
  });

  it('refuses the 133rd guarded tree with the quality-not-quantity message', () => {
    const refusal = treePlantingGate(guarded(DEFAULT_MAX_GUARDED_TREES), 'GUARDED');
    expect(speak(refusal!)).toMatch(/quality, not quantity/);
  });

  it('counts each kind independently — a full grove does not block a lifetree', () => {
    expect(treePlantingGate(guarded(DEFAULT_MAX_GUARDED_TREES), 'LIFETREE')).toBeNull();
    expect(treePlantingGate(lifetrees(DEFAULT_MAX_LIFETREES), 'GUARDED')).toBeNull();
  });

  it('treats legacy nature trees (no treeType, isNature) as guarded', () => {
    const legacy = Array.from({ length: DEFAULT_MAX_GUARDED_TREES }, () => ({ isNature: true }));
    expect(speak(treePlantingGate(legacy, 'GUARDED')!)).toMatch(/quality, not quantity/);
    expect(treePlantingGate(legacy, 'LIFETREE')).toBeNull();
  });

  it('honours node-level caps from config and quotes them in the refusal', () => {
    const caps = { ...DEFAULT_NODE_LIMITS, maxLifetrees: 3, maxGuardedTrees: 5 };
    expect(treePlantingGate(lifetrees(2), 'LIFETREE', caps)).toBeNull();
    expect(speak(treePlantingGate(lifetrees(3), 'LIFETREE', caps)!)).toMatch(/3 lifetrees/);
    expect(speak(treePlantingGate(guarded(5), 'GUARDED', caps)!)).toMatch(/5 trees/);
  });
});

describe('normalizeNodeLimits — the config doc can hold anything', () => {
  it('falls back to defaults for missing/invalid values', () => {
    expect(normalizeNodeLimits(undefined)).toEqual(DEFAULT_NODE_LIMITS);
    expect(normalizeNodeLimits({ maxLifetrees: 'many', maxGuardedTrees: -4 })).toEqual(DEFAULT_NODE_LIMITS);
  });

  it('floors and keeps valid values', () => {
    expect(normalizeNodeLimits({ maxLifetrees: 7.9, maxGuardedTrees: 21 })).toEqual({ ...DEFAULT_NODE_LIMITS, maxLifetrees: 7, maxGuardedTrees: 21 });
  });
});

describe('nodeCapacityGate — fullness is the reproductive trigger (ring 2026-08-17)', () => {
  it('a node below 144 welcomes; at 144 it says it is time to seed', () => {
    expect(nodeCapacityGate({ hostedCount: 143, faceCount: 3 }, 'community')).toBeNull();
    expect(nodeCapacityGate({ hostedCount: 144, faceCount: 3 }, 'community')).toContain('node_full_seed');
  });
  it('twelve faces kiss the center; the thirteenth belongs to a new node', () => {
    expect(nodeCapacityGate({ hostedCount: 50, faceCount: 11 }, 'face')).toBeNull();
    expect(nodeCapacityGate({ hostedCount: 50, faceCount: 12 }, 'face')).toContain('node_faces_full');
  });
  it('a face is hosted too — the 144 binds faces as well', () => {
    expect(nodeCapacityGate({ hostedCount: 144, faceCount: 5 }, 'face')).toContain('node_full_seed');
  });
  it('the dials come from config, defaults from law', () => {
    const dialed = normalizeNodeLimits({ maxNodeCommunities: 21 });
    expect(dialed.maxNodeCommunities).toBe(21);
    expect(dialed.maxNodeFaces).toBe(DEFAULT_NODE_LIMITS.maxNodeFaces);
    expect(nodeCapacityGate({ hostedCount: 21, faceCount: 0 }, 'community', dialed)).toContain('node_full_seed');
  });
});
