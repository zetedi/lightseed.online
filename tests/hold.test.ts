import { describe, it, expect } from 'vitest';
import { HOLD_TTL_MS, holdBlocks, holdIsActive, type Hold } from '../src/domain/hold';

const NOW = 1_000_000;
const mk = (holderUid: string, expiresAt: number): Hold => ({ bedId: 'bedA', holderUid, expiresAt });

describe('holdIsActive', () => {
  it('is active only before expiry', () => {
    expect(holdIsActive(mk('alice', NOW + 1000), NOW)).toBe(true);
    expect(holdIsActive(mk('alice', NOW - 1000), NOW)).toBe(false);
    expect(holdIsActive(null, NOW)).toBe(false);
  });
});

describe('holdBlocks — your own hold never blocks you', () => {
  it('blocks only an active hold held by another', () => {
    expect(holdBlocks(mk('bob', NOW + HOLD_TTL_MS), 'alice', NOW)).toBe(true);
    expect(holdBlocks(mk('alice', NOW + HOLD_TTL_MS), 'alice', NOW)).toBe(false); // mine
    expect(holdBlocks(mk('bob', NOW - 1), 'alice', NOW)).toBe(false); // expired
    expect(holdBlocks(null, 'alice', NOW)).toBe(false);
  });
});
