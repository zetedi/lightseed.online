import { describe, it, expect } from 'vitest';
import {
  coinAccepted, pickRays, judgeAppreciation, judgeSpend, spendIntentProblem,
  type AppreciationFacts, type SpendFacts, type HeldRayFact,
} from '../src/domain/spend';
import { RAY_UNITS, DEFAULT_GLOW_SHARE_DENOMINATOR } from '../src/domain/light';
import { suspendGift } from '../src/domain/gift';
import {
  coinAccepted as serverCoinAccepted, pickRays as serverPickRays, judgeAppreciation as serverJudgeAppreciation,
  judgeSpend as serverJudgeSpend, spendIntentProblem as serverSpendIntentProblem, suspendGift as serverSuspendGift,
} from '../functions/src/spend';
import { DOMAIN_KEYS } from '../src/domain/words';
import { speak } from '../src/utils/translations';

// SPENDING IS A GATE, NOT A NUMBER (ring 2026-09-30). Light moves only through a receipt or a
// signed decision; every unit that leaves lands as suspended light plus a glow share; the coin
// is checked at the moment of movement. Every branch below breaks exactly one fact.

const PA = 'com-perauset';
const LS = 'com-lightseed';

describe('the coin gate — checked at the moment of movement', () => {
  it('the same place, the node\'s Light, and an offering at the node always pass', () => {
    expect(coinAccepted(PA, PA, [])).toBe(true);
    expect(coinAccepted(null, PA, [])).toBe(true);
    expect(coinAccepted(PA, null, [])).toBe(true);
  });
  it('another place passes only through an accepts_coin_of link the offering\'s place minted', () => {
    expect(coinAccepted(LS, PA, [])).toBe(false);
    expect(coinAccepted(LS, PA, [LS])).toBe(true);
    expect(coinAccepted(LS, PA, ['com-other'])).toBe(false);
  });
});

const rays: HeldRayFact[] = [
  { id: 'r-new', units: RAY_UNITS, place: PA, dayKey: '2026-09-29' },
  { id: 'r-old', units: 15, place: PA, dayKey: '2026-09-01' },
  { id: 'r-ls', units: RAY_UNITS, place: LS, dayKey: '2026-08-01' },
  { id: 'r-node', units: 6, place: null, dayKey: '2026-07-01' },
  { id: 'r-empty', units: 0, place: PA, dayKey: '2026-06-01' },
];

describe('pickRays — oldest accepted light travels first', () => {
  it('takes from the oldest accepted rays, splitting the last one', () => {
    const { take, taken } = pickRays(rays, 20, PA, []);
    expect(take).toEqual([{ id: 'r-node', units: 6 }, { id: 'r-old', units: 14 }]);
    expect(taken).toBe(20);
  });
  it('a coin the place does not accept stays home; an empty ray is never a source', () => {
    const { take, taken } = pickRays(rays, 300, PA, []);
    expect(take.map(t => t.id)).toEqual(['r-node', 'r-old', 'r-new']);
    expect(taken).toBe(6 + 15 + RAY_UNITS);            // short: 129 of 300
    expect(pickRays(rays, 300, PA, [LS]).taken).toBe(6 + 15 + RAY_UNITS + RAY_UNITS);
  });
});

const sound = (over: Partial<AppreciationFacts> = {}): AppreciationFacts => ({
  giverUid: 'ana',
  units: 21,
  offering: { exists: true, type: 'offering', status: 'accepted', active: true, authorId: 'bo', answeredBy: 'ana', place: PA, acceptsPlaces: [] },
  rays,
  alreadyGiven: false,
  ...over,
});
// Ask both laws, insist they agree, hand back the domain's answer (the mirror pattern of tests/birth.test.ts).
const judgeA = (f: AppreciationFacts) => { const mine = judgeAppreciation(f); expect(serverJudgeAppreciation(f)).toEqual(mine); return mine; };
const refusalOf = (f: AppreciationFacts) => { const j = judgeA(f); return j.outcome === 'reject' ? j.refusal : null; };

describe('appreciation — the receipt earns the right, the prism takes its share', () => {
  it('a sound appreciation gives: oldest light first, conserved to the last unit', () => {
    const j = judgeA(sound());
    expect(j.outcome).toBe('give');
    if (j.outcome !== 'give') return;
    expect(j.take).toEqual([{ id: 'r-node', units: 6 }, { id: 'r-old', units: 15 }]);
    expect(j.glow + j.suspended).toBe(21);
    expect(j.glow).toBe(Math.floor(21 / DEFAULT_GLOW_SHARE_DENOMINATOR));
    expect(j.glowHome).toBe(PA);
  });
  it('an offering at the node sheds its share into the node\'s glow (home null)', () => {
    const j = judgeA(sound({ offering: { ...sound().offering, place: null } }));
    expect(j.outcome === 'give' && j.glowHome).toBeNull();
  });
  it('refuses, one fact at a time', () => {
    expect(refusalOf(sound({ offering: { ...sound().offering, exists: false } }))).toBe('appreciate_offering_gone');
    expect(refusalOf(sound({ offering: { ...sound().offering, type: 'event' } }))).toBe('appreciate_offering_gone');
    expect(refusalOf(sound({ units: 0 }))).toBe('gift_nothing');
    expect(refusalOf(sound({ units: 1.5 }))).toBe('gift_whole_units');
    expect(refusalOf(sound({ giverUid: 'bo' }))).toBe('gift_own_offering');
    expect(refusalOf(sound({ offering: { ...sound().offering, status: 'open' } }))).toBe('appreciate_not_received');
    expect(refusalOf(sound({ offering: { ...sound().offering, answeredBy: 'cy' } }))).toBe('appreciate_not_received');
    expect(refusalOf(sound({ offering: { ...sound().offering, active: false } }))).toBe('gift_resting');
    expect(refusalOf(sound({ alreadyGiven: true }))).toBe('appreciate_already');
    expect(refusalOf(sound({ units: 1000 }))).toBe('gift_hold_less');
    // Enough light in all, but not in a coin this place accepts.
    expect(refusalOf(sound({ units: 200 }))).toBe('appreciate_coin_refused');
    expect(refusalOf(sound({ units: 200, offering: { ...sound().offering, acceptsPlaces: [LS] } }))).toBeNull();
  });
});

const passed = (over: Partial<SpendFacts> = {}): SpendFacts => ({
  callerUid: 'ana',
  callerStands: true,
  decision: { exists: true, type: 'decision', nature: 'purchase', status: 'passed', listening: false, communityId: PA, votesRequired: 2, verifiedSigners: 2, spend: { offeringId: 'off-1', units: 108 }, alreadySpent: false },
  offering: { exists: true, type: 'offering', active: true, place: PA, acceptsPlaces: [] },
  glowUnits: 500,
  ...over,
});
const judgeS = (f: SpendFacts) => { const mine = judgeSpend(f); expect(serverJudgeSpend(f)).toEqual(mine); return mine; };
const spendRefusal = (f: SpendFacts) => { const j = judgeS(f); return j.outcome === 'reject' ? j.refusal : null; };

describe('the spend — the commons moves only by a signed purchase decision', () => {
  it('a passed, signed, unspent purchase spends: through the prism, conserved', () => {
    const j = judgeS(passed());
    expect(j.outcome).toBe('spend');
    if (j.outcome !== 'spend') return;
    expect(j.units).toBe(108);
    expect(j.glow + j.suspended).toBe(108);
    expect(j.glow).toBe(Math.floor(108 / DEFAULT_GLOW_SHARE_DENOMINATOR));
    expect(j.glowHome).toBe(PA);
  });
  it('refuses, one fact at a time', () => {
    const d = passed().decision;
    expect(spendRefusal(passed({ decision: { ...d, exists: false } }))).toBe('spend_no_decision');
    expect(spendRefusal(passed({ decision: { ...d, nature: 'intention' } }))).toBe('spend_not_purchase');
    expect(spendRefusal(passed({ decision: { ...d, spend: undefined } }))).toBe('spend_no_offering');
    expect(spendRefusal(passed({ decision: { ...d, spend: { offeringId: 'off-1', units: 0 } } }))).toBe('spend_nothing');
    expect(spendRefusal(passed({ decision: { ...d, spend: { offeringId: 'off-1', units: 1.5 } } }))).toBe('gift_whole_units');
    expect(spendRefusal(passed({ callerStands: false }))).toBe('spend_no_standing');
    expect(spendRefusal(passed({ decision: { ...d, status: 'open' } }))).toBe('spend_not_passed');
    expect(spendRefusal(passed({ decision: { ...d, listening: true } }))).toBe('spend_listening');
    expect(spendRefusal(passed({ decision: { ...d, verifiedSigners: 1 } }))).toBe('spend_unsigned');
    expect(spendRefusal(passed({ decision: { ...d, votesRequired: 0, verifiedSigners: 0 } }))).toBe('spend_unsigned');
    expect(spendRefusal(passed({ decision: { ...d, alreadySpent: true } }))).toBe('spend_already');
    expect(spendRefusal(passed({ offering: { ...passed().offering, exists: false } }))).toBe('spend_no_offering');
    expect(spendRefusal(passed({ offering: { ...passed().offering, active: false } }))).toBe('gift_resting');
    expect(spendRefusal(passed({ offering: { ...passed().offering, place: LS } }))).toBe('spend_coin_refused');
    expect(spendRefusal(passed({ offering: { ...passed().offering, place: LS, acceptsPlaces: [PA] } }))).toBeNull();
    expect(spendRefusal(passed({ glowUnits: 107 }))).toBe('spend_glow_short');
  });
  it('a purchase names what it spends before anyone signs', () => {
    expect(spendIntentProblem(null)).toBe('spend_no_offering');
    expect(spendIntentProblem({ offeringId: ' ', units: 5 })).toBe('spend_no_offering');
    expect(spendIntentProblem({ offeringId: 'o', units: 0 })).toBe('spend_nothing');
    expect(spendIntentProblem({ offeringId: 'o', units: 2.5 })).toBe('gift_whole_units');
    expect(spendIntentProblem({ offeringId: 'o', units: 7 })).toBeNull();
  });
  it('every refusal the law can speak is a word the dictionary carries', () => {
    for (const k of ['appreciate_offering_gone', 'appreciate_not_received', 'appreciate_already', 'appreciate_coin_refused',
      'spend_no_decision', 'spend_not_purchase', 'spend_no_offering', 'spend_nothing', 'spend_no_standing', 'spend_not_passed',
      'spend_listening', 'spend_unsigned', 'spend_already', 'spend_coin_refused', 'spend_glow_short']) {
      expect(DOMAIN_KEYS as readonly string[]).toContain(k);
      expect(speak(k as never)).not.toBe(k);
    }
  });
});

describe('the functions mirror of the spend law stays true', () => {
  it('the coin gate, the picking and the prism answer identically', () => {
    for (const [a, b, c] of [[PA, PA, []], [null, PA, []], [PA, null, []], [LS, PA, []], [LS, PA, [LS]]] as const) {
      expect(serverCoinAccepted(a, b, c)).toBe(coinAccepted(a, b, c));
    }
    for (const n of [1, 20, 129, 300]) expect(serverPickRays(rays, n, PA, [LS])).toEqual(pickRays(rays, n, PA, [LS]));
    for (const n of [0, 1, 6, 7, 21, 108, 756]) expect(serverSuspendGift(n)).toEqual(suspendGift(n));
    for (const d of [null, { offeringId: '', units: 1 }, { offeringId: 'o', units: 0 }, { offeringId: 'o', units: 1.5 }, { offeringId: 'o', units: 3 }]) {
      expect(serverSpendIntentProblem(d)).toBe(spendIntentProblem(d));
    }
  });
});
