import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STAFF_HANDS, staffHandOn, staffHandById } from '../src/domain/staffHands';
import { DOMAIN_KEYS } from '../src/domain/words';

// The staff hands (ring 2026-09-09): recorded once, switchable where wired — and the rules
// and the record are held to name the same hands.
const rules = readFileSync(join(__dirname, '..', 'firestore.rules'), 'utf8');
const fns = readFileSync(join(__dirname, '..', 'functions', 'src', 'index.ts'), 'utf8');
const inRules = new Set([...rules.matchAll(/staffHand\('([a-z_]+)'\)/g)].map((m) => m[1]));
const inFunctions = new Set([...fns.matchAll(/staffHandOn\([^,]+,\s*"([a-z_]+)"/g)].map((m) => m[1]));

describe('the record of staff hands', () => {
  it('every hand has an id, a sentence in the manifest, and a place it is enforced', () => {
    const ids = new Set<string>();
    for (const h of STAFF_HANDS) {
      expect(h.id).toMatch(/^[a-z_]+$/);
      expect(ids.has(h.id)).toBe(false); ids.add(h.id);
      expect(DOMAIN_KEYS).toContain(h.key);
      expect(h.enforcedBy.length).toBeGreaterThan(0);
    }
  });
  it('every switchable hand is wired in firestore.rules, and every wired hand is recorded', () => {
    for (const h of STAFF_HANDS.filter((x) => x.switchable)) expect(h.enforcedIn === 'functions' ? inFunctions : inRules, `${h.id} is not wired`).toContain(h.id);
    for (const id of inRules) expect(staffHandById(id)?.switchable, `${id} is wired in rules but not recorded as switchable`).toBe(true);
    for (const id of inFunctions) expect(staffHandById(id)?.enforcedIn, `${id} is wired in functions but not recorded so`).toBe('functions');
  });
  it('a switch answers, else the default; an unknown hand is never on', () => {
    expect(staffHandOn(undefined, 'garden_stand')).toBe(true);
    expect(staffHandOn({ garden_stand: false }, 'garden_stand')).toBe(false);
    expect(staffHandOn({ garden_stand: true }, 'garden_stand')).toBe(true);
    expect(staffHandOn({}, 'no_such_hand')).toBe(false);
  });
});
