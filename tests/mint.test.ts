import { describe, it, expect } from 'vitest';
import { RAY_UNITS, WITNESS_SHARE_DENOMINATOR, witnessShareUnits, kindleRays, prismSplit } from '../src/domain/light';
import {
  RAY_UNITS as MINT_RAY_UNITS,
  WITNESS_SHARE_DENOMINATOR as MINT_WITNESS_SHARE_DENOMINATOR,
  witnessShareUnits as mintWitnessShareUnits,
  prismSplit as mintPrismSplit,
  releaseRay, DEFAULT_GLOW_SHARE_DENOMINATOR, NODE_GLOW_HOME,
  kindleDayKeyFromMs, uuidv7, judgeWitness, type WitnessFacts,
} from '../functions/src/mint';
import { timeOf } from '../src/utils/id';

// THE MIRROR TEST: functions/src/mint.ts is the server's copy of the light law (functions is a
// separate TS project and cannot import src/domain). This suite imports BOTH and compares, so
// the mirror can never drift from the domain silently — and it walks every branch of the
// witnessing judgment, the load-bearing logic of the mint (Lumo's second review, 2026-07-21).

// A watering that SHOULD kindle; each case below breaks exactly one fact.
const sound = (): WitnessFacts => ({
  witnessUid: 'bob',
  pulse: {
    exists: true,
    care: 'watering',
    wateringConfirmedBy: 'ai', // an AI hint does not block the human witness
    carerUid: 'alice',
    treeId: 'nur',
    createdAtMs: Date.UTC(2026, 6, 21, 9, 30), // 2026-07-21 09:30 UTC
  },
  guardianSinceMs: Date.UTC(2026, 6, 1),
  tree: { exists: true, treeType: 'LIGHTTREE', diedAtMs: null },
  carerRayExists: false,
  witnessRayExists: false,
});

describe('the mirror: the server mint speaks the domain law exactly', () => {
  it('the constants are one law', () => {
    expect(MINT_RAY_UNITS).toBe(RAY_UNITS);
    expect(MINT_WITNESS_SHARE_DENOMINATOR).toBe(WITNESS_SHARE_DENOMINATOR);
    expect(mintWitnessShareUnits()).toBe(witnessShareUnits());
  });

  it('a sound witnessing allocates exactly what kindleRays allocates', () => {
    const j = judgeWitness(sound());
    if (j.outcome !== 'kindle') throw new Error(`expected kindle, got ${j.outcome}`);
    const expected = kindleRays({ treeAlive: true, carerUid: 'alice', witnessUid: 'bob' });
    expect([j.carerRay, j.witnessRay]).toEqual(expected.map(r => ({ holderUid: r.holderUid, role: r.role, units: r.units })));
    expect(j.dayKey).toBe('2026-07-21');
  });
});

describe('the judgment: every gate of the witnessing law', () => {
  const rejectsWith = (mutate: (f: WitnessFacts) => void, code: string) => {
    const f = sound();
    mutate(f);
    const j = judgeWitness(f);
    if (j.outcome !== 'reject') throw new Error(`expected reject, got ${j.outcome}`);
    expect(j.code).toBe(code);
  };

  it('a vanished pulse cannot be witnessed', () => rejectsWith(f => { f.pulse.exists = false; }, 'not-found'));
  it('only a watering can be witnessed', () => rejectsWith(f => { f.pulse.care = 'note'; }, 'failed-precondition'));
  it('a malformed watering (no carer or no tree id) is refused', () => {
    rejectsWith(f => { f.pulse.carerUid = ''; }, 'failed-precondition');
    rejectsWith(f => { f.pulse.treeId = ''; }, 'failed-precondition');
  });
  it('a watering without a server birth time cannot mint (no client picks the day)', () =>
    rejectsWith(f => { f.pulse.createdAtMs = null; }, 'failed-precondition'));
  it('no one witnesses their own care', () => rejectsWith(f => { f.witnessUid = 'alice'; }, 'failed-precondition'));
  it('only a guardian of the tree may witness', () => rejectsWith(f => { f.guardianSinceMs = null; }, 'permission-denied'));
  it('guardianship must PREDATE the watering (tenure; a sock minted for the occasion has no voice)', () =>
    rejectsWith(f => { f.guardianSinceMs = f.pulse.createdAtMs! + 1; }, 'failed-precondition'));
  it('guardianship born in the same instant still counts (tenure is not-after, not strictly-before)', () => {
    const f = sound();
    f.guardianSinceMs = f.pulse.createdAtMs!;
    expect(judgeWitness(f).outcome).toBe('kindle');
  });
  it('a vanished tree kindles nothing', () => rejectsWith(f => { f.tree.exists = false; }, 'not-found'));
  it('a bed is not tended for light', () => rejectsWith(f => { f.tree.treeType = 'BED'; }, 'failed-precondition'));
  it('a tree that has died kindles memory, not light (the living gate has one home: diedAt)', () =>
    rejectsWith(f => { f.tree.diedAtMs = Date.UTC(2026, 6, 20); }, 'failed-precondition'));

  it('a guardian-witnessed watering is already settled: witnessing again changes nothing', () => {
    const f = sound();
    f.pulse.wateringConfirmedBy = 'guardian';
    expect(judgeWitness(f).outcome).toBe('already');
  });
});

describe('the cap: one kindle per tree per day, idempotent to the last ray', () => {
  it('a second witnessing the same day mints NO rays (the confirmation may still land)', () => {
    const f = sound();
    f.carerRayExists = true;
    f.witnessRayExists = true;
    const j = judgeWitness(f);
    if (j.outcome !== 'kindle') throw new Error(`expected kindle, got ${j.outcome}`);
    expect(j.carerRay).toBeNull();
    expect(j.witnessRay).toBeNull();
  });

  it('the witness\'s seventh rides ONLY on a fresh carer kindle', () => {
    const f = sound();
    f.carerRayExists = true; // the tree was already lit today
    const j = judgeWitness(f);
    if (j.outcome !== 'kindle') throw new Error(`expected kindle, got ${j.outcome}`);
    expect(j.carerRay).toBeNull();
    expect(j.witnessRay).toBeNull();
  });

  it('a lingering witness ray alone never blocks the carer\'s ray', () => {
    const f = sound();
    f.witnessRayExists = true;
    const j = judgeWitness(f);
    if (j.outcome !== 'kindle') throw new Error(`expected kindle, got ${j.outcome}`);
    expect(j.carerRay).toEqual({ holderUid: 'alice', role: 'carer', units: RAY_UNITS });
    expect(j.witnessRay).toBeNull();
  });

  it('two waterings of one tree on one UTC day share one day key (deterministic ray ids collide)', () => {
    expect(kindleDayKeyFromMs(Date.UTC(2026, 6, 21, 0, 0, 1))).toBe('2026-07-21');
    expect(kindleDayKeyFromMs(Date.UTC(2026, 6, 21, 23, 59, 59))).toBe('2026-07-21');
    expect(kindleDayKeyFromMs(Date.UTC(2026, 6, 22, 0, 0, 0))).toBe('2026-07-22');
  });
});

describe('the last spend: where light goes when its holder leaves (ring 2026-07-21)', () => {
  it('the prism mirror speaks the domain law exactly', () => {
    for (const [units, dial] of [[0, 7], [1, 7], [99, 7], [100, 7], [114, 7], [700, 8], [341, 3], [100, 1]] as const) {
      expect(mintPrismSplit(units, dial)).toEqual(prismSplit(units, dial));
    }
  });

  it('no heir: the whole ray dissolves into its provenance community\'s glow', () => {
    expect(releaseRay({ units: 100, communityId: 'c1' }, false)).toEqual({ toHeir: 0, glow: 100, glowHome: 'c1' });
  });

  it('no heir, no community: the node commons receives it (the home of last resort)', () => {
    expect(releaseRay({ units: 14, communityId: null }, false)).toEqual({ toHeir: 0, glow: 14, glowHome: NODE_GLOW_HOME });
  });

  it('a chosen heir receives through the prism: the glow keeps the default seventh', () => {
    const r = releaseRay({ units: 100, communityId: 'c1' }, true);
    expect(r).toEqual({ toHeir: 86, glow: 14, glowHome: 'c1' });
    expect(r.glow).toBe(Math.floor(100 / DEFAULT_GLOW_SHARE_DENOMINATOR));
  });

  it('conservation to the last unit, heir or none', () => {
    for (const units of [0, 1, 6, 7, 14, 99, 100, 114, 700]) {
      for (const hasHeir of [true, false]) {
        const r = releaseRay({ units, communityId: 'c1' }, hasHeir);
        expect(r.toHeir + r.glow).toBe(units);
      }
    }
  });

  it('a malformed ray releases nothing (no light invented at the door)', () => {
    expect(releaseRay({ units: -5, communityId: null }, true)).toEqual({ toHeir: 0, glow: 0, glowHome: NODE_GLOW_HOME });
    expect(releaseRay({ units: 2.5 as number, communityId: null }, false)).toEqual({ toHeir: 0, glow: 0, glowHome: NODE_GLOW_HOME });
  });
});

describe('the lid: server-minted rays are UUIDv7 beings (the LIN invariant)', () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  it('carries version 7, the RFC variant, and its own birth time', () => {
    const at = Date.UTC(2026, 6, 21, 12, 0, 0);
    const lid = uuidv7(at, bytes);
    expect(lid[14]).toBe('7');                       // version nibble
    expect(['8', '9', 'a', 'b']).toContain(lid[19]); // RFC 4122 variant
    expect(timeOf(lid)).toBe(at);                    // birth readable back out (src/utils/id.ts)
  });

  it('is deterministic given the same time and bytes (pure), and refuses starved randomness', () => {
    const at = Date.UTC(2026, 0, 1);
    expect(uuidv7(at, bytes)).toBe(uuidv7(at, bytes));
    expect(() => uuidv7(at, new Uint8Array(4))).toThrow();
  });
});
