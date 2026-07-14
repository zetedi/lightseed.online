import { describe, it, expect } from 'vitest';
import {
  canVeto, eligibleGuardians, isVetoed, validVetoes, vetoProgress, VETO_WINDOW_MS,
  type VetoInput,
} from '../src/domain/guardianVeto';

const NOW = 1783382400000;

// A fresh watering mint by the owner, guarded by three others — the base case each test bends.
const OLD = NOW - 1000000; // guardians who stood long before the mint
const g = (uid: string, sinceMs: number = OLD) => ({ uid, sinceMs });
const mint = (over: Partial<VetoInput> = {}): VetoInput => ({
  pulseType: 'tree_growth',
  pulseAuthorId: 'owner',
  pulseCreatedAtMs: NOW - 1000,
  guardians: [g('g1'), g('g2'), g('g3')],
  vetoUids: [],
  nowMs: NOW,
  ...over,
});

describe('eligibleGuardians', () => {
  it('excludes the author — no one weighs their own mint', () => {
    expect(eligibleGuardians(mint({ guardians: [g('g1'), g('owner'), g('g2')] }))).toEqual(['g1', 'g2']);
  });
  it('deduplicates double edges', () => {
    expect(eligibleGuardians(mint({ guardians: [g('g1'), g('g1'), g('g2')] }))).toEqual(['g1', 'g2']);
  });
  it('tenure: a guardian minted AFTER the pulse has no voice over it', () => {
    const sock = g('sock', NOW - 10); // arrived after the mint (mint at NOW-1000)
    expect(eligibleGuardians(mint({ guardians: [g('g1'), sock] }))).toEqual(['g1']);
    // the sock-account attack: a guardianless tree + a fresh follower is NOT a consensus
    expect(isVetoed(mint({ guardians: [sock], vetoUids: ['sock'] }))).toBe(false);
  });
  it('legacy edges without a birth time still count', () => {
    expect(eligibleGuardians(mint({ guardians: [{ uid: 'old' }] }))).toEqual(['old']);
  });
});

describe('canVeto', () => {
  it('a guardian may veto a fresh mint once', () => {
    expect(canVeto(mint(), 'g1')).toBe(true);
    expect(canVeto(mint({ vetoUids: ['g1'] }), 'g1')).toBe(false); // already spoken
  });
  it('non-guardians, the author, and the signed-out cannot', () => {
    expect(canVeto(mint(), 'stranger')).toBe(false);
    expect(canVeto(mint(), 'owner')).toBe(false);
    expect(canVeto(mint(), undefined)).toBe(false);
  });
  it('only growth mints are vetoable, and only within the window', () => {
    const elders = [g('g1', 0), g('g2', 0), g('g3', 0)]; // stood since the beginning
    expect(canVeto(mint({ pulseType: 'observation' }), 'g1')).toBe(false);
    expect(canVeto(mint({ pulseCreatedAtMs: NOW - VETO_WINDOW_MS - 1, guardians: elders }), 'g1')).toBe(false);
    expect(canVeto(mint({ pulseCreatedAtMs: NOW - VETO_WINDOW_MS, guardians: elders }), 'g1')).toBe(true); // the last moment
  });
});

describe('isVetoed — consensus means every eligible guardian', () => {
  it('partial agreement does not veto', () => {
    expect(isVetoed(mint({ vetoUids: ['g1', 'g2'] }))).toBe(false);
  });
  it('unanimity vetoes', () => {
    expect(isVetoed(mint({ vetoUids: ['g1', 'g2', 'g3'] }))).toBe(true);
  });
  it('a guardianless tree can never be vetoed (no empty consensus)', () => {
    expect(isVetoed(mint({ guardians: [], vetoUids: [] }))).toBe(false);
    expect(isVetoed(mint({ guardians: [g('owner')], vetoUids: [] }))).toBe(false); // author-only
  });
  it('stray vetoes from non-guardians are ignored', () => {
    expect(isVetoed(mint({ vetoUids: ['g1', 'g2', 'stranger'] }))).toBe(false);
    expect(validVetoes(mint({ vetoUids: ['stranger', 'g1'] }))).toEqual(['g1']);
  });
});

describe('vetoProgress', () => {
  it('reports cast over needed', () => {
    expect(vetoProgress(mint({ vetoUids: ['g2'] }))).toEqual({ cast: 1, needed: 3 });
  });
});
