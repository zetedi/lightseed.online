import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TRAVEL_PLAN, collectionSignature } from '../src/domain/bundle';
import { SEED_BUNDLE_TABLES, bundleSignature, bundleReadSql, bundleDocOf, bundleInsertOf, portableSegment } from '../src/domain/seedBundle.mjs';

// THE CROSSING'S MAP MIRRORS THE PLAN (ring 2026-11-02): every collection the travel plan says
// travels has a row in the seed's soil and a place in the map; every excluded collection has
// neither; witness collections are read, never landed. The map is closed: table names are its
// own, ids and documents ride as parameters.
const sql = readdirSync(join(__dirname, '..', 'seed', 'schema')).sort()
  .map(f => readFileSync(join(__dirname, '..', 'seed', 'schema', f), 'utf8')).join('\n');
const DOC_LEVEL = new Set(['config/dataAuthority', 'config/emulatorSeed']);
const lid = '019a0000-0000-7000-8000-000000000001';

describe('the crossing map mirrors the travel plan', () => {
  it('every travelling collection is mapped to a table that exists; the beings index alone is computed', () => {
    for (const rule of TRAVEL_PLAN) {
      if (rule.mode === 'excluded' || DOC_LEVEL.has(rule.path)) continue;
      if (rule.path === 'beings') { expect(SEED_BUNDLE_TABLES).not.toHaveProperty('beings'); continue; }
      const law = (SEED_BUNDLE_TABLES as Record<string, { table: string; witness?: boolean }>)[rule.path];
      expect(law, `${rule.path} travels but the crossing map has no row for it`).toBeDefined();
      expect(new RegExp(`create table if not exists ${law.table}\\b`).test(sql), `${law.table} is not in seed/schema`).toBe(true);
      expect(!!law.witness).toBe(rule.mode === 'witness');
    }
  });
  it('no excluded collection and nothing outside the plan is in the map', () => {
    const travelling = new Set(TRAVEL_PLAN.filter(r => r.mode !== 'excluded').map(r => r.path));
    for (const signature of Object.keys(SEED_BUNDLE_TABLES)) expect(travelling.has(signature), `${signature} is mapped but does not travel`).toBe(true);
  });
  it('speaks the same collection signature as the bundle law', () => {
    for (const path of ['users/u1', 'lifetrees/t1/loves/u1', 'persons/u1/keyRecoveries/r1/witnesses/u2__e1', 'links/a__keeper__t1', 'pulses/p1/signatures/u1']) {
      expect(bundleSignature(path)).toBe(collectionSignature(path));
    }
  });
});

describe('rows become documents and documents become rows', () => {
  it('plain, parented, loves and graph rows take their path from their columns', () => {
    expect(bundleDocOf('users', { id: 'u1', doc: { displayName: 'A' } })).toEqual({ path: 'users/u1', data: { displayName: 'A' } });
    expect(bundleDocOf('persons/*/keyRecoveries/*/witnesses', { p1: 'u1', p2: 'r1', id: 'u2__e1', doc: { sig: 's' } })).toEqual({ path: 'persons/u1/keyRecoveries/r1/witnesses/u2__e1', data: { sig: 's' } });
    expect(bundleDocOf('pulses/*/loves', { p1: 'p1', id: 'u1', doc: { uid: 'u1' } })).toEqual({ path: 'pulses/p1/loves/u1', data: { uid: 'u1' } });
    const created = new Date('2026-06-01T00:00:00.000Z');
    expect(bundleDocOf('links', { id: 'u1__keeper__t1', from_id: 'u1', rel: 'keeper', to_id: 't1', lid, doc: { note: 1 }, created_at: created }))
      .toEqual({ path: 'links/u1__keeper__t1', data: { note: 1, from: 'u1', rel: 'keeper', to: 't1', lid, createdAt: '2026-06-01T00:00:00.000Z' } });
    expect(bundleReadSql('lifetrees/*/loves')).toContain("parent_kind='lifetrees'");
    expect(bundleReadSql('nowhere')).toBeNull();
  });
  it('an id that cannot travel as a path stops at the door', () => {
    expect(portableSegment('a/b')).toBe(false); expect(portableSegment('..')).toBe(false); expect(portableSegment('')).toBe(false); expect(portableSegment('ok_1-2')).toBe(true);
    expect(bundleDocOf('users', { id: 'a/b', doc: {} })).toBeNull();
    expect(bundleDocOf('persons/*/keys', { p1: 'x\u0000', id: 'fp', doc: {} })).toBeNull();
  });
  it('a document lands by its signature; the link id law and the witness fence refuse what does not fit', () => {
    expect(bundleInsertOf({ path: 'lifetrees/t1', data: { lid } })).toEqual({ text: 'INSERT INTO public.lifetrees(id, doc) VALUES ($1, $2::jsonb)', values: ['t1', JSON.stringify({ lid })] });
    expect(bundleInsertOf({ path: 'pulses/p1/signatures/u1', data: { sig: 's' } })).toEqual({ text: 'INSERT INTO public.pulse_signatures(pulse_id, id, doc) VALUES ($1, $2, $3::jsonb)', values: ['p1', 'u1', JSON.stringify({ sig: 's' })] });
    expect(bundleInsertOf({ path: 'visions/v1/loves/u1', data: { uid: 'u1' } })!.values).toEqual(['visions', 'v1', 'u1', JSON.stringify({ uid: 'u1' })]);
    const link = { path: 'links/u1__keeper__t1', data: { from: 'u1', rel: 'keeper', to: 't1', lid, createdAt: '2026-06-01T00:00:00.000Z', note: 1 } };
    expect(bundleInsertOf(link)).toEqual({ text: 'INSERT INTO public.links(from_id, rel, to_id, lid, doc, created_at) VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz)', values: ['u1', 'keeper', 't1', lid, JSON.stringify({ note: 1 }), '2026-06-01T00:00:00.000Z'] });
    expect(bundleInsertOf({ ...link, path: 'links/u1__keeper__t2' })).toBeNull();          // the fields do not spell the id
    expect(bundleInsertOf({ ...link, data: { ...link.data, lid: 'nope' } })).toBeNull();     // a link without a true name
    expect(bundleInsertOf({ path: 'initiates/i1', data: {} })).toBeNull();                  // witnesses are rebuilt, never landed
    expect(bundleInsertOf({ path: 'beings/' + lid, data: {} })).toBeNull();
    expect(bundleInsertOf({ path: 'mail/m1', data: {} })).toBeNull();                       // excluded by the plan: no table, no row
    expect(bundleInsertOf({ path: 'users/u1/odd', data: {} })).toBeNull();
  });
});
