import { describe, expect, it } from 'vitest';
import { guardiansThreadIdOf, judgeThirst, momentMsOf, waterMeText } from '../src/domain/thirst';

const DAY = 24 * 3600 * 1000;
const NOW = Date.UTC(2026, 10, 3, 7, 0); // 2026-11-03 08:00 Brussels
const iso = (ms: number) => new Date(ms).toISOString();
const tree = (watering: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  id: 't1', name: 'Nur', imageUrl: 'https://m/nur.webp', domain: 'node.example', anchorUid: 'alice', createdAt: iso(NOW - 30 * DAY),
  watering: { mode: 'scheduled', stage: 'planted', intervalDays: 3, ...watering }, circleUids: ['bob', 'alice'], ...over,
});

describe('the thirst', () => {
  it('reads a stored moment in any soil\'s shape', () => {
    expect(momentMsOf('2026-11-01T10:00:00.000000Z')).toBe(Date.UTC(2026, 10, 1, 10));
    expect(momentMsOf(1700000000000)).toBe(1700000000000);
    expect(momentMsOf({ toMillis: () => 5 })).toBe(5);
    expect(momentMsOf({ seconds: 7 })).toBe(7000);
    expect(momentMsOf({ _seconds: 7 })).toBe(7000);
    expect(momentMsOf('never')).toBe(0);
    expect(momentMsOf(null)).toBe(0);
  });
  it('speaks the origin\'s words, stage-aware', () => {
    expect(waterMeText('Nur', 0)).toBe("I'm ready for watering 💧 — could a guardian care me today?");
    expect(waterMeText('Nur', 0, 'potted')).toBe("I'm a seed in my pot 🌱 and ready for watering 💧 — could a guardian care me today?");
    expect(waterMeText('Nur', 1)).toBe("I'm getting thirsty 💧 — it's been a day past my watering. Could a guardian care me?");
    expect(waterMeText('Nur', 1, 'potted')).toBe("I'm a seed in my pot 🌱 getting thirsty — it's been a day past my watering. Could a guardian care me?");
    expect(waterMeText('Nur', 4)).toBe("I'm thirsty 💧 — it's been 4 days past my watering. Could a guardian care me? — Nur");
    expect(waterMeText('', 4, 'potted')).toBe("I'm a seed in my pot 🌱 — it's been 4 days past my watering. Could a guardian care me? — This tree");
    expect(guardiansThreadIdOf('t1', 'alice')).toBe('grp__t1__guardians__alice');
  });
  it('leaves a tree alone that is not scheduled, and clears the flag of one that is no longer overdue', () => {
    expect(judgeThirst(tree({ mode: 'self_sustaining', intervalDays: undefined }), NOW)).toBeNull();
    expect(judgeThirst({ id: 't', watering: null }, NOW)).toBeNull();
    expect(judgeThirst(tree({ lastWateredAt: iso(NOW - DAY) }), NOW)).toBeNull();
    expect(judgeThirst(tree({ lastWateredAt: iso(NOW - DAY), overdue: true }), NOW)).toEqual({ overdue: false, patch: { 'watering.overdue': false }, ask: null });
    // An explicit due moment is believed over the derived one.
    expect(judgeThirst(tree({ lastWateredAt: iso(NOW - 10 * DAY), nextDueAt: iso(NOW + DAY) }), NOW)).toBeNull();
    // A freshly scheduled tree with no watering yet counts from its birth, not from epoch 0.
    expect(judgeThirst(tree({}, { createdAt: iso(NOW - DAY) }), NOW)).toBeNull();
  });
  it('raises one ask in the guardians\' thread, through the principal with the tree\'s face, when the circle would hear', () => {
    const judged = judgeThirst(tree({ lastWateredAt: iso(NOW - 5 * DAY) }), NOW);
    expect(judged?.overdue).toBe(true);
    expect(judged?.patch).toEqual({ 'watering.overdue': true, 'watering.lastAlertAt': iso(NOW), 'watering.alertThreadId': 'grp__t1__guardians__alice' });
    expect(judged?.ask?.standingPulseId).toBeNull();
    expect(judged?.ask?.participantUids).toEqual(['alice', 'bob']);
    expect(judged?.ask?.content).toEqual({
      lifetreeId: 't1', type: 'reach', visibility: 'private', careAlert: 'watering',
      title: 'Reach: Nur -> Nur (Guardians)', body: "I'm thirsty 💧 — it's been 2 days past my watering. Could a guardian care me? — Nur", content: "I'm thirsty 💧 — it's been 2 days past my watering. Could a guardian care me? — Nur",
      reachTreeId: 't1', reachTreeName: 'Nur', recipientName: 'Nur', recipientUid: null,
      participantUids: ['alice', 'bob'], threadId: 'grp__t1__guardians__alice', threadName: 'Nur · Guardians', audience: 'guardians', isGroup: true, seenBy: [],
      authorId: 'alice', authorName: 'Nur', authorPhoto: 'https://m/nur.webp', domain: 'node.example', loveCount: 0, commentCount: 0, previousHash: 'WATER_ALERT',
    });
  });
  it('asks at most once a day, and not at all when only the anchor would hear', () => {
    expect(judgeThirst(tree({ lastWateredAt: iso(NOW - 5 * DAY), lastAlertAt: iso(NOW - 3600 * 1000) }), NOW)).toEqual({ overdue: true, patch: { 'watering.overdue': true }, ask: null });
    expect(judgeThirst(tree({ lastWateredAt: iso(NOW - 5 * DAY) }, { circleUids: ['alice'] }), NOW)).toEqual({ overdue: true, patch: { 'watering.overdue': true }, ask: null });
    expect(judgeThirst(tree({ lastWateredAt: iso(NOW - 5 * DAY) }, { circleUids: [], anchorUid: '' }), NOW)?.ask).toBeNull();
  });
  it('rewrites the standing ask while it stands, and speaks anew once a watering answered it', () => {
    const standing = judgeThirst(tree({ lastWateredAt: iso(NOW - 5 * DAY), lastAlertAt: iso(NOW - DAY), alertPulseId: 'p1' }), NOW);
    expect(standing?.ask?.standingPulseId).toBe('p1');
    expect(standing?.ask?.text).toContain('2 days');
    // Watered after the ask (yet overdue again): the old ask is answered, the next one is new.
    const anew = judgeThirst(tree({ lastWateredAt: iso(NOW - 4 * DAY), lastAlertAt: iso(NOW - 6 * DAY), alertPulseId: 'p1' }), NOW);
    expect(anew?.ask?.standingPulseId).toBeNull();
  });
});
