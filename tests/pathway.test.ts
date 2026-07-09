import { describe, it, expect } from 'vitest';
import {
  derivePathway, PATHWAY_STAGES, PATHWAY_TEND_WINDOW_MS,
  type PathwayInput, type PathwayStage,
} from '../src/domain/pathway';

const NOW = 1783382400000; // 2026-07-07

// A being at a given point on the trail — defaults describe a fully sovereign one, so each
// test names ONLY the facts that pull the stage back. Complements the ladder reading of
// derivePathway: the first unmet milestone wins regardless of later ones.
const being = (over: Partial<PathwayInput> = {}): PathwayInput => ({
  signedIn: true,
  myTreesCount: 1,
  guardedCount: 0,
  lastTendedAtMs: NOW - 1000,
  wateringOverdue: false,
  connectionsCount: 1,
  isMember: true,
  followedVisionsCount: 1,
  circleSize: 2,
  ownsCommunity: true,
  communityHasCustomDomain: true,
  communityHasTheme: true,
  ...over,
});

describe('derivePathway — the ladder, stage by stage', () => {
  it('a signed-out visitor is invited to begin', () => {
    const p = derivePathway(being({ signedIn: false }), NOW);
    expect(p.stage).toBe('visitor');
    expect(p.next?.key).toBe('signUp');
    expect(p.stageIndex).toBe(0);
    expect(p.stageCount).toBe(PATHWAY_STAGES.length);
  });

  it('signed out trumps everything else — facts past the gate are ignored', () => {
    const p = derivePathway(being({ signedIn: false, myTreesCount: 5, ownsCommunity: true }), NOW);
    expect(p.stage).toBe('visitor');
  });

  it('signed in with no trees → plant', () => {
    const p = derivePathway(being({ myTreesCount: 0, guardedCount: 0 }), NOW);
    expect(p.stage).toBe('invited');
    expect(p.next?.key).toBe('plant');
  });

  it('a guarded (adopted) tree counts as rooting — no own tree needed', () => {
    const p = derivePathway(being({ myTreesCount: 0, guardedCount: 1 }), NOW);
    expect(p.stage).not.toBe('invited');
  });

  it('trees but never tended → rooted (planting alone is not tending)', () => {
    const p = derivePathway(being({ lastTendedAtMs: null }), NOW);
    expect(p.stage).toBe('rooted');
    expect(p.next?.key).toBe('tend');
  });

  it('tending is a practice: a tree gone quiet past the window pulls the path back', () => {
    expect(derivePathway(being({ lastTendedAtMs: NOW - PATHWAY_TEND_WINDOW_MS - 1 }), NOW).stage).toBe('rooted');
    expect(derivePathway(being({ lastTendedAtMs: NOW - PATHWAY_TEND_WINDOW_MS + 1 }), NOW).stage).not.toBe('rooted');
  });

  it('an overdue watering pulls the path back to care even when recently tended', () => {
    const p = derivePathway(being({ wateringOverdue: true }), NOW);
    expect(p.stage).toBe('rooted');
    expect(p.next?.key).toBe('tend');
  });

  it('tended but unconnected → connect', () => {
    const p = derivePathway(being({ guardedCount: 0, connectionsCount: 0, isMember: false }), NOW);
    expect(p.stage).toBe('tending');
    expect(p.next?.key).toBe('connect');
  });

  it('guarding a tree already IS a connection', () => {
    const p = derivePathway(being({ guardedCount: 1, connectionsCount: 0, isMember: false }), NOW);
    expect(p.stage).toBe('connected');
    expect(p.next?.key).toBe('join');
  });

  it('connected but standing with no community → become a member', () => {
    const p = derivePathway(being({ isMember: false }), NOW);
    expect(p.stage).toBe('connected');
    expect(p.next?.key).toBe('join');
  });

  it('a member without a vision → follow one', () => {
    const p = derivePathway(being({ followedVisionsCount: 0 }), NOW);
    expect(p.stage).toBe('member');
    expect(p.next?.key).toBe('followVision');
  });

  it('following a vision with no circle on the tree → form one', () => {
    const p = derivePathway(being({ circleSize: 0 }), NOW);
    expect(p.stage).toBe('visionary');
    expect(p.next?.key).toBe('formCircle');
  });

  it('the keystone: a circle without a community is asked to name itself', () => {
    const p = derivePathway(being({ ownsCommunity: false, communityHasCustomDomain: false, communityHasTheme: false }), NOW);
    expect(p.stage).toBe('circling');
    expect(p.next?.key).toBe('nameCommunity');
    expect(p.next?.label).toBe('Your circle is already a community. Name it?');
  });

  it('founding carries two steps: first the domain, then the appearance', () => {
    const noDomain = derivePathway(being({ communityHasCustomDomain: false, communityHasTheme: false }), NOW);
    expect(noDomain.stage).toBe('founding');
    expect(noDomain.next?.key).toBe('rootDomain');

    const noTheme = derivePathway(being({ communityHasTheme: false }), NOW);
    expect(noTheme.stage).toBe('founding');
    expect(noTheme.next?.key).toBe('tailorTheme');
  });

  it('sovereign: the path is walked — nothing left to prompt', () => {
    const p = derivePathway(being(), NOW);
    expect(p.stage).toBe('sovereign');
    expect(p.next).toBeNull();
    expect(p.stageIndex).toBe(PATHWAY_STAGES.length - 1);
  });
});

describe('derivePathway — shape and progression', () => {
  it('stageIndex always agrees with the ladder', () => {
    const cases: [PathwayInput, PathwayStage][] = [
      [being({ signedIn: false }), 'visitor'],
      [being({ myTreesCount: 0, guardedCount: 0 }), 'invited'],
      [being({ lastTendedAtMs: null }), 'rooted'],
      [being({ guardedCount: 0, connectionsCount: 0 }), 'tending'],
      [being({ isMember: false }), 'connected'],
      [being({ followedVisionsCount: 0 }), 'member'],
      [being({ circleSize: 0 }), 'visionary'],
      [being({ ownsCommunity: false }), 'circling'],
      [being({ communityHasCustomDomain: false }), 'founding'],
      [being(), 'sovereign'],
    ];
    for (const [input, stage] of cases) {
      const p = derivePathway(input, NOW);
      expect(p.stage).toBe(stage);
      expect(p.stageIndex).toBe(PATHWAY_STAGES.indexOf(stage));
    }
  });

  it('every stage before sovereign offers exactly one labelled, described step', () => {
    const inputs: PathwayInput[] = [
      being({ signedIn: false }),
      being({ myTreesCount: 0, guardedCount: 0 }),
      being({ lastTendedAtMs: null }),
      being({ guardedCount: 0, connectionsCount: 0 }),
      being({ isMember: false }),
      being({ followedVisionsCount: 0 }),
      being({ circleSize: 0 }),
      being({ ownsCommunity: false }),
      being({ communityHasCustomDomain: false }),
      being({ communityHasTheme: false }),
    ];
    for (const input of inputs) {
      const { next } = derivePathway(input, NOW);
      expect(next).not.toBeNull();
      expect(next!.label.length).toBeGreaterThan(0);
      expect(next!.description.length).toBeGreaterThan(0);
    }
  });

  it('walking the trail only ever moves the stage forward', () => {
    const walk: PathwayInput[] = [
      being({ signedIn: false }),
      being({ myTreesCount: 0, guardedCount: 0 }),
      being({ lastTendedAtMs: null, connectionsCount: 0, isMember: false, followedVisionsCount: 0, circleSize: 0, ownsCommunity: false, communityHasCustomDomain: false, communityHasTheme: false }),
      being({ connectionsCount: 0, isMember: false, followedVisionsCount: 0, circleSize: 0, ownsCommunity: false, communityHasCustomDomain: false, communityHasTheme: false }),
      being({ isMember: false, followedVisionsCount: 0, circleSize: 0, ownsCommunity: false, communityHasCustomDomain: false, communityHasTheme: false }),
      being({ followedVisionsCount: 0, circleSize: 0, ownsCommunity: false, communityHasCustomDomain: false, communityHasTheme: false }),
      being({ circleSize: 0, ownsCommunity: false, communityHasCustomDomain: false, communityHasTheme: false }),
      being({ ownsCommunity: false, communityHasCustomDomain: false, communityHasTheme: false }),
      being({ communityHasCustomDomain: false, communityHasTheme: false }),
      being({ communityHasTheme: false }),
      being(),
    ];
    let last = -1;
    for (const input of walk) {
      const { stageIndex } = derivePathway(input, NOW);
      expect(stageIndex).toBeGreaterThanOrEqual(last);
      last = stageIndex;
    }
  });
});
