import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TRAVEL_PLAN } from '../src/domain/bundle';

// THE SEED MIRRORS THE PLAN — the same guard that keeps the travel plan mirroring the
// rules now keeps seed/schema mirroring the travel plan: every collection the plan says
// TRAVELS has a table in the seed's soil, and every collection the plan EXCLUDES has
// none. A collection added to either side without the other fails the gate here.

const SCHEMA_DIR = join(__dirname, '..', 'seed', 'schema');
const sql = readdirSync(SCHEMA_DIR).sort()
  .map(f => readFileSync(join(SCHEMA_DIR, f), 'utf8')).join('\n');

// Firestore path → the seed's table. Subcollections flatten to parent-prefixed tables;
// the five loves subcollections share ONE table (the own-slot law is its primary key).
const tableFor = (path: string): string | null => {
  if (path.endsWith('/loves')) return 'loves';
  const DOC_LEVEL = new Set(['config/dataAuthority', 'config/emulatorSeed']); // docs, not collections
  if (DOC_LEVEL.has(path)) return null;
  const named: Record<string, string> = {
    'persons/*/keys': 'person_keys',
    'persons/*/keyEvents': 'person_key_events',
    'persons/*/keyRecoveries': 'person_key_recoveries',
    'persons/*/keyRecoveries/*/witnesses': 'person_key_recovery_witnesses',
    'lifetrees/*/occupancy': 'lifetree_occupancy',
    'lifetrees/*/holds': 'lifetree_holds',
    'pulses/*/signatures': 'pulse_signatures',
    'pulses/*/witnesses': 'pulse_witnesses',
    'covenants/*/signatures': 'covenant_signatures',
  };
  if (named[path]) return named[path];
  // Top-level collection: camelCase → snake_case.
  return path.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
};

const hasTable = (name: string): boolean =>
  new RegExp(`create table if not exists ${name}\\b`).test(sql);

describe('the seed mirrors the travel plan — no collection silently forgotten', () => {
  it('every travelling collection has a table in the soil', () => {
    for (const rule of TRAVEL_PLAN) {
      if (rule.mode === 'excluded') continue;
      const table = tableFor(rule.path);
      if (!table) continue; // doc-level entries live inside their parent table
      expect(hasTable(table), `'${rule.path}' travels but seed/schema has no table '${table}'`).toBe(true);
    }
  });

  it('every excluded collection stays out of the soil by law', () => {
    for (const rule of TRAVEL_PLAN) {
      if (rule.mode !== 'excluded') continue;
      const table = tableFor(rule.path);
      if (!table) continue;
      expect(hasTable(table), `'${rule.path}' is excluded (${rule.reason}) but seed/schema carries '${table}'`).toBe(false);
    }
  });

  it('the LIN crosses as real columns with the id law as schema', () => {
    expect(sql).toMatch(/create table if not exists links\b/);
    expect(sql).toMatch(/generated always as \(from_id \|\| '__' \|\| rel \|\| '__' \|\| to_id\)/);
    expect(sql).toMatch(/primary key \(from_id, rel, to_id\)/);
    expect(sql).toMatch(/enable row level security/);
  });
});
