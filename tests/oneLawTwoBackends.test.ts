import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { NON_FEED_PULSE_TYPES, isFeedPulseType, isReachType } from '../src/domain/pulse';
import { REL_ENDPOINTS, SKIP_RELS, walkEndsOf } from '../src/domain/subgraph';
import { NEWSLETTER_DIGEST_SIZE } from '../src/domain/newsletter';
import { wateringPatchOf } from '../src/domain/watering';

// ONE LAW, TWO BACKENDS (2026-11-14). What both service layers (services/firebase,
// services/independent) need to know alike lives once in the domain. These were twin copies in
// the two backends; a copy that drifts makes the two nodes disagree about the same being.

describe('what the open feed never carries', () => {
  it('names the five rooms that are not the feed', () => {
    expect([...NON_FEED_PULSE_TYPES].sort()).toEqual(['decision', 'event', 'reach', 'stay', 'tree_chat']);
  });
  it('a growth, an observation and a typeless pulse are feed; a reach and an event are not', () => {
    expect(isFeedPulseType('tree_growth')).toBe(true);
    expect(isFeedPulseType('observation')).toBe(true);
    expect(isFeedPulseType(undefined)).toBe(true);
    expect(isFeedPulseType('reach')).toBe(false);
    expect(isFeedPulseType('event')).toBe(false);
  });
  it('a reach is a reach under its legacy name too, and nothing else is', () => {
    expect(isReachType('reach')).toBe(true);
    expect(isReachType('tree_chat')).toBe(true);
    expect(isReachType('event')).toBe(false);
    expect(isReachType(undefined)).toBe(false);
  });
});

describe('what a relation joins (the walk’s map of the LIN)', () => {
  it('gives the kinds at both ends of a weaving rel', () => {
    expect(walkEndsOf('guardian')).toEqual({ from: 'person', to: 'tree' });
    expect(walkEndsOf('shelters')).toEqual({ from: 'lightHouse', to: 'community' });
    expect(walkEndsOf('collaborates_with')).toEqual({ from: 'community', to: 'community' });
  });
  it('a knock or a transient weaves nothing', () => {
    for (const rel of SKIP_RELS) expect(walkEndsOf(rel)).toBeNull();
  });
  it('an unknown rel weaves nothing, and an inherited name is not a rel', () => {
    expect(walkEndsOf('no_such_rel')).toBeNull();
    expect(walkEndsOf('toString')).toBeNull();
    expect(walkEndsOf('constructor')).toBeNull();
  });
  it('no rel is both walked and skipped', () => {
    for (const rel of Object.keys(REL_ENDPOINTS)) expect(SKIP_RELS.has(rel)).toBe(false);
  });
});

describe('the digest and the watering patch', () => {
  it('the digest names at most eight of each kind', () => {
    expect(NEWSLETTER_DIGEST_SIZE).toBe(8);
  });
  it('folds a dotted update into the nested watering, keeping what was not touched', () => {
    const tree = { watering: { mode: 'scheduled', intervalDays: 3, overdue: true } } as never;
    expect(wateringPatchOf(tree, { 'watering.overdue': false, 'watering.lastWateredBy': 'u1', lastCaredAt: 5 }))
      .toEqual({ watering: { mode: 'scheduled', intervalDays: 3, overdue: false, lastWateredBy: 'u1' } });
  });
  it('a tree with no watering yet gains one; the tree itself is not changed', () => {
    const tree = {} as never;
    expect(wateringPatchOf(tree, { 'watering.overdue': false })).toEqual({ watering: { overdue: false } });
    expect(tree).toEqual({});
  });
});

// THE RATCHET: neither backend defines these again. A new shared fact goes to the domain.
describe('neither backend keeps its own copy', () => {
  const root = resolve(__dirname, '..');
  const SHARED = ['NON_FEED_PULSE_TYPES', 'REL_ENDPOINTS', 'SKIP_RELS', 'NEWSLETTER_DIGEST_SIZE', 'wateringPatchOf'];
  for (const backend of ['firebase', 'independent']) {
    it(`services/${backend} imports them, never declares them`, () => {
      const dir = resolve(root, 'src/services', backend);
      const declared: string[] = [];
      for (const file of readdirSync(dir).filter(f => f.endsWith('.ts'))) {
        const source = readFileSync(resolve(dir, file), 'utf8');
        for (const name of SHARED) {
          if (new RegExp(`^\\s*(export\\s+)?(const|function|let)\\s+${name}\\b`, 'm').test(source)) declared.push(`${file}:${name}`);
        }
      }
      expect(declared).toEqual([]);
    });
  }
  it('the independent services share one newestFirst', () => {
    const dir = resolve(root, 'src/services/independent');
    const declaring = readdirSync(dir).filter(f => f.endsWith('.ts'))
      .filter(f => /^\s*(export\s+)?const\s+newestFirst\b/m.test(readFileSync(resolve(dir, f), 'utf8')));
    expect(declaring).toEqual(['core.ts']);
  });
});

// WHO WEARS A HOST (2026-11-15): both backends ask the one law (chooseCradle); the superseded
// chooseDomainClaimant ordering, where a bare claim beat a granted alias, answers in neither.
describe('both backends resolve a host by chooseCradle', () => {
  const root = resolve(__dirname, '..');
  for (const backend of ['firebase', 'independent']) {
    it(`services/${backend}/spaces.ts`, () => {
      const source = readFileSync(resolve(root, 'src/services', backend, 'spaces.ts'), 'utf8');
      expect(source).toMatch(/\bchooseCradle\(/);
      expect(source).not.toMatch(/\bchooseDomainClaimant\b/);
    });
  }
  it('the independent node refuses a bare claim (the twin of seed.wears_host)', () => {
    const source = readFileSync(resolve(root, 'src/services/independent/spaces.ts'), 'utf8');
    expect(source).toMatch(/claimsAnswer:\s*false/);
  });
});
