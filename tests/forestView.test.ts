import { describe, it, expect } from 'vitest';
import {
  treeCoordinates, canViewTree, canViewVision, passesForestFilter, forestMarkers,
  type ForestFilter,
} from '../src/domain/views/forest';
import type { Lifetree } from '../src/domain/lifetree';

// The forest's spatial prism: which trees are placeable, who may see them, and what
// facts a map marker wears. Pure functions — the map renders on top of these rules.

const tree = (over: Partial<Lifetree> & Record<string, unknown> = {}): Lifetree =>
  ({ id: 't1', name: 'Oak', ownerId: 'u1', latitude: 47.5, longitude: 19.0, ...over }) as Lifetree;

describe('treeCoordinates', () => {
  it('reads latitude/longitude', () => {
    expect(treeCoordinates(tree())).toEqual({ lat: 47.5, lng: 19.0 });
  });

  it('reads the legacy lat/lng spelling still carried by old documents', () => {
    expect(treeCoordinates(tree({ latitude: undefined, longitude: undefined, lat: -33.9, lng: 18.4 })))
      .toEqual({ lat: -33.9, lng: 18.4 });
  });

  it('rejects the unplaceable: missing, non-numeric, NaN', () => {
    expect(treeCoordinates(tree({ latitude: undefined, longitude: undefined }))).toBeNull();
    expect(treeCoordinates(tree({ latitude: 'x' as unknown as number }))).toBeNull();
    expect(treeCoordinates(tree({ latitude: NaN }))).toBeNull();
  });

  it('keeps the equator and prime meridian (0 is a place, not a falsy)', () => {
    expect(treeCoordinates(tree({ latitude: 0, longitude: 0 }))).toEqual({ lat: 0, lng: 0 });
  });
});

describe('canViewTree', () => {
  const viewerless = {};
  it('public trees greet everyone', () => {
    expect(canViewTree(tree(), viewerless)).toBe(true);
  });
  it('node trees need a signed-in viewer', () => {
    const t = tree({ visibility: 'node' });
    expect(canViewTree(t, viewerless)).toBe(false);
    expect(canViewTree(t, { uid: 'stranger' })).toBe(true);
  });
  it('private trees open only to owner and staff — NOT guardians (a no-privilege follow)', () => {
    const t = tree({ visibility: 'private' });
    expect(canViewTree(t, { uid: 'stranger' })).toBe(false);
    expect(canViewTree(t, { uid: 'u1' })).toBe(true);
    // A guardian gets NOTHING for a private tree — matches the rule (firestore.rules /lifetrees,
    // which grants private only to owner or staff; guardian is a bare follow).
    expect(canViewTree(t, { uid: 'g1', guardedIds: new Set(['t1']) })).toBe(false);
    expect(canViewTree(t, { uid: 's1', isStaff: true })).toBe(true);
  });

  // Parity table: the client gate MUST equal the rule intent across every tier × viewer.
  // Rule (firestore.rules:219-223): absent/public = everyone; node = any signed-in; private =
  // owner or staff only. Each row is [visibility, viewer, ruleAllows] — canViewTree must agree.
  describe('parity with the read rule across tiers', () => {
    const owner = { uid: 'u1' };
    const signedIn = { uid: 'stranger' };
    const signedOut = {};
    const staff = { uid: 's1', isStaff: true };
    const guardian = { uid: 'g1', guardedIds: new Set(['t1']) }; // guards t1 but does not own it
    const rows: Array<[string, Parameters<typeof canViewTree>[1], boolean]> = [
      // public — the rule allows everyone (missing field reads as public too).
      ['public', signedOut, true], ['public', signedIn, true], ['public', guardian, true], ['public', staff, true],
      // node — the rule allows ANY signed-in reader; the signed-out are denied.
      ['node', signedOut, false], ['node', signedIn, true], ['node', guardian, true], ['node', owner, true], ['node', staff, true],
      // private — the rule allows ONLY owner or staff; a stranger AND a guardian are denied.
      ['private', signedOut, false], ['private', signedIn, false], ['private', guardian, false],
      ['private', owner, true], ['private', staff, true],
    ];
    it.each(rows)('visibility=%s → the gate matches the rule', (visibility, viewer, ruleAllows) => {
      expect(canViewTree(tree({ visibility: visibility as Lifetree['visibility'] }), viewer)).toBe(ruleAllows);
    });
    it('absent visibility reads as public (legacy-safe), matching the rule', () => {
      expect(canViewTree(tree({ visibility: undefined }), signedOut)).toBe(true);
    });
  });
});

describe('canViewVision', () => {
  it('mirrors the tree rule with the author as owner', () => {
    expect(canViewVision({ visibility: 'public' }, {})).toBe(true);
    expect(canViewVision({ visibility: 'node' }, {})).toBe(false);
    expect(canViewVision({ visibility: 'node' }, { uid: 'x' })).toBe(true);
    expect(canViewVision({ authorId: 'a1', visibility: 'private' }, { uid: 'a1' })).toBe(true);
    expect(canViewVision({ authorId: 'a1', visibility: 'private' }, { uid: 'x' })).toBe(false);
    expect(canViewVision({ authorId: 'a1', visibility: 'private' }, { uid: 'x', isStaff: true })).toBe(true);
  });
});

describe('passesForestFilter', () => {
  const all: ForestFilter = { showNature: true, showUser: true, showValidated: false };
  const validated = (t: { validated?: boolean }) => !!t.validated;

  it('nature and user toggles hide their kinds', () => {
    expect(passesForestFilter(tree({ isNature: true }), { ...all, showNature: false }, validated)).toBe(false);
    expect(passesForestFilter(tree(), { ...all, showUser: false }, validated)).toBe(false);
    expect(passesForestFilter(tree(), all, validated)).toBe(true);
  });

  it('the validated toggle keeps only the validated', () => {
    const onlyValidated = { ...all, showValidated: true };
    expect(passesForestFilter(tree(), onlyValidated, validated)).toBe(false);
    expect(passesForestFilter(tree({ validated: true } as Partial<Lifetree>), onlyValidated, validated)).toBe(true);
  });
});

describe('forestMarkers', () => {
  it('drops unplaceable trees and carries guardian edge-counts', () => {
    const trees = [
      tree(),
      tree({ id: 't2', latitude: undefined, longitude: undefined }),
      tree({ id: 't3', isNature: true, latestGrowthUrl: 'https://x/growth.webp' }),
    ];
    const markers = forestMarkers(trees, new Map([['t3', 4]]));
    expect(markers.map(m => m.id)).toEqual(['t1', 't3']);
    expect(markers[0]).toMatchObject({ kind: 'tree', guardianCount: 0 });
    expect(markers[1]).toMatchObject({ kind: 'nature', guardianCount: 4, growthUrl: 'https://x/growth.webp' });
  });

  it('stays usable without guardian counts (they default to zero)', () => {
    expect(forestMarkers([tree()])[0].guardianCount).toBe(0);
  });
});
