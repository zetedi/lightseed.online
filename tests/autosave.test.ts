import { describe, it, expect } from 'vitest';
import { patchOf, sameValue, canonical, reconcile, COMMUNITY_APPEARANCE_FIELDS, AUTOSAVE_DELAY_MS } from '../src/domain/autosave';

// Autosave (ring 2026-09-07): a write carries exactly what changed, and nothing else.
describe('patchOf — only what changed', () => {
  type T = { name: string; theme?: { a: string; b: string }; tags: string[]; on?: boolean };
  const keys = ['name', 'theme', 'tags', 'on'] as const;
  const saved: T = { name: 'The O House', theme: { a: '1', b: '2' }, tags: ['x'], on: false };

  it('an untouched draft is an empty patch — no write of nothing', () => {
    expect(patchOf(saved, { ...saved }, keys)).toEqual({});
    expect(patchOf(saved, { ...saved, theme: { b: '2', a: '1' } }, keys)).toEqual({});
  });
  it('carries each differing field with the draft value, and no other', () => {
    expect(patchOf(saved, { ...saved, name: 'Theo', on: true }, keys)).toEqual({ name: 'Theo', on: true });
    expect(patchOf(saved, { ...saved, tags: ['x', 'y'] }, keys)).toEqual({ tags: ['x', 'y'] });
    expect(patchOf(saved, { ...saved, theme: { a: '1', b: '3' } }, keys)).toEqual({ theme: { a: '1', b: '3' } });
  });
  it('treats a missing field and undefined as one', () => {
    const { on: _o, ...withoutOn } = saved;
    expect(patchOf(withoutOn as T, { ...withoutOn, on: undefined } as T, keys)).toEqual({});
  });
  it('looks only at the named keys', () => {
    expect(patchOf(saved, { ...saved, name: 'Theo' }, ['tags'] as const)).toEqual({});
  });
});

describe('reconcile — the store speaks anew, the hand keeps its word', () => {
  type T = { name: string; vision: string; on: boolean };
  const keys = ['name', 'vision', 'on'] as const;
  const adopted: T = { name: 'Th', vision: 'old', on: false };

  it('an untouched field follows the fresh value', () => {
    const fresh: T = { ...adopted, on: true };
    expect(reconcile(adopted, fresh, { ...adopted }, keys)).toEqual(fresh);
  });
  it('a field still under the hand keeps the draft — a save landing mid-word drops nothing', () => {
    const draft: T = { ...adopted, name: 'Theo' };
    const landed: T = { ...adopted, name: 'Th' };
    expect(reconcile(adopted, landed, draft, keys)).toEqual({ name: 'Theo', vision: 'old', on: false });
  });
  it('an unsaved draft on one tab survives a save from another', () => {
    const draft: T = { ...adopted, vision: 'being written' };
    const landed: T = { ...adopted, on: true };
    expect(reconcile(adopted, landed, draft, keys)).toEqual({ name: 'Th', vision: 'being written', on: true });
    // and the law then carries the draft's word forward, not the store's
    expect(patchOf(landed, reconcile(adopted, landed, draft, keys), keys)).toEqual({ vision: 'being written' });
  });
});

describe('the one spelling of a value', () => {
  it('sorts object keys at every depth, keeps array order', () => {
    expect(canonical({ b: { d: 1, c: 2 }, a: [2, 1] })).toBe('{"a":[2,1],"b":{"c":2,"d":1}}');
    expect(sameValue([1, 2], [2, 1])).toBe(false);
    expect(sameValue(undefined, undefined)).toBe(true);
    expect(sameValue(null, undefined)).toBe(false);
  });
});

describe('the appearance the tab edits', () => {
  it('names every field the community Appearance tab may change, and a breath under a second', () => {
    expect([...COMMUNITY_APPEARANCE_FIELDS]).toEqual(['name', 'theme', 'logoUrl', 'heroImageUrl', 'imageUrls', 'socialLinks', 'carouselQuotes', 'customLanding', 'showStats', 'landingPages']);
    expect(AUTOSAVE_DELAY_MS).toBeGreaterThan(0);
    expect(AUTOSAVE_DELAY_MS).toBeLessThan(1000);
  });
});
