import { describe, it, expect } from 'vitest';
import { bedsFreeFor, MAX_STAY_NIGHTS, nightsBetween, stayRequestProblem, staysOverlap } from '../src/domain/stay';

// Beds in lightHouses — the stay arithmetic, testable without any backend.

const NOW = Date.parse('2026-07-14T12:00:00Z');

describe('nightsBetween', () => {
  it('counts nights, not days', () => {
    expect(nightsBetween('2026-08-01', '2026-08-03')).toBe(2);
    expect(nightsBetween('2026-08-01', '2026-08-01')).toBe(0);
    expect(nightsBetween('bad', '2026-08-01')).toBe(0);
  });
});

describe('stayRequestProblem', () => {
  it('accepts a sane future stay', () => {
    expect(stayRequestProblem('2026-08-01', '2026-08-05', NOW)).toBeNull();
  });
  it('refuses reversed, endless, past, and empty ranges', () => {
    expect(stayRequestProblem('2026-08-05', '2026-08-01', NOW)).toContain('after arrival');
    expect(stayRequestProblem('2026-08-01', '2026-12-01', NOW)).toContain(`${MAX_STAY_NIGHTS}`);
    expect(stayRequestProblem('2026-07-01', '2026-07-05', NOW)).toContain('past');
    expect(stayRequestProblem('', '2026-08-01', NOW)).toContain('Choose');
  });
});

describe('staysOverlap — departure day is free', () => {
  it('shares a night → overlap; back-to-back → none', () => {
    expect(staysOverlap({ fromDate: '2026-08-01', toDate: '2026-08-05' }, { fromDate: '2026-08-04', toDate: '2026-08-08' })).toBe(true);
    expect(staysOverlap({ fromDate: '2026-08-01', toDate: '2026-08-05' }, { fromDate: '2026-08-05', toDate: '2026-08-08' })).toBe(false);
  });
});

describe('bedsFreeFor', () => {
  const accepted = [
    { fromDate: '2026-08-01', toDate: '2026-08-10' },
    { fromDate: '2026-08-05', toDate: '2026-08-07' },
  ];
  it('subtracts overlapping accepted stays and floors at zero', () => {
    expect(bedsFreeFor(3, accepted, '2026-08-06', '2026-08-08')).toBe(1);
    expect(bedsFreeFor(2, accepted, '2026-08-06', '2026-08-08')).toBe(0);
    expect(bedsFreeFor(1, accepted, '2026-08-20', '2026-08-22')).toBe(1);
    expect(bedsFreeFor(0, [], '2026-08-20', '2026-08-22')).toBe(0);
  });
});
