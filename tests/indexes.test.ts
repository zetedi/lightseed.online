import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// THE INDEX MIRROR (ring 2026-09-03): the feeds order on the server, scoped or not, and a
// scoped ordered query needs its composite in firestore.indexes.json — or Firestore refuses
// it and the service falls back to an unordered page (the old id-ordered sample). This holds
// the index file to the shapes the services query, so a new feed shape cannot ship without
// its index: services/firebase/pulses fetchPulsesRaw, trees fetchLifetrees, spaces fetchVisions.

type Field = { fieldPath: string; order?: 'ASCENDING' | 'DESCENDING'; arrayConfig?: string };
type Index = { collectionGroup: string; queryScope: string; fields: Field[] };

const file = JSON.parse(readFileSync(join(__dirname, '..', 'firestore.indexes.json'), 'utf-8')) as { indexes: Index[] };
const shape = (i: Index) => `${i.collectionGroup}:${i.fields.map(f => `${f.fieldPath}${f.order === 'DESCENDING' ? '↓' : f.arrayConfig ? '[]' : '↑'}`).join(',')}`;
const shapes = new Set(file.indexes.map(shape));

// Every ordered feed query, as (collection, equality/in fields in query order, then the sort).
const REQUIRED = [
  // pulses — the general / reach feeds (domain, visibility in, createdAt) and the typed
  // events / offerings feeds (domain, type, visibility in, createdAt); unscoped twins.
  'pulses:domain↑,visibility↑,createdAt↓',
  'pulses:domain↑,type↑,visibility↑,createdAt↓',
  'pulses:visibility↑,createdAt↓',
  'pulses:type↑,visibility↑,createdAt↓',
  // lifetrees — the forest, scoped with levels, scoped for staff (no levels), unscoped.
  'lifetrees:domain↑,visibility↑,createdAt↓',
  'lifetrees:domain↑,createdAt↓',
  'lifetrees:visibility↑,createdAt↓',
  // visions — the same three shapes.
  'visions:domain↑,visibility↑,createdAt↓',
  'visions:domain↑,createdAt↓',
  'visions:visibility↑,createdAt↓',
];

describe('firestore.indexes.json — every ordered feed query has its composite', () => {
  it.each(REQUIRED)('%s', (required) => {
    expect(shapes.has(required)).toBe(true);
  });

  it('every index is a well-formed COLLECTION composite', () => {
    for (const i of file.indexes) {
      expect(i.queryScope).toBe('COLLECTION');
      expect(i.fields.length).toBeGreaterThanOrEqual(2);
      for (const f of i.fields) expect(!!f.order !== !!f.arrayConfig).toBe(true);
    }
  });

  it('no composite is declared twice', () => {
    expect(new Set(file.indexes.map(shape)).size).toBe(file.indexes.length);
  });
});
