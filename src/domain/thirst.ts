// THE THIRST (ring 2026-11-03): what the morning sweep decides for one scheduled tree — the law of
// the origin's checkWateringSchedules (functions/light.ts), pure, standing on the shared watering
// law (./watering) that the client's own check and the daily sweep both obey. A tree past its due
// moment is marked overdue; if its circle has not been asked today and someone other than its
// anchor would hear, the tree asks ONCE — rewriting its standing ask while it stands (standingAlertId)
// so a week of thirst is one line that keeps count, else raising a new one in the guardians' thread,
// spoken through its principal with the tree's own face.
//
// Plain contract — guaranteed: judgeThirst reads only the facts it is given and the moment; the
// words are the origin's, the thread the client's (grp__<tree>__guardians__<anchor>), the record
// the origin's reach field for field (the soil adds the true name, the moment and the outbox row).
// Enforced by tests/thirst.test.ts and, end to end, tests/seed/clock.postgres-test.ts. Not
// guaranteed: delivery — the courier carries the ask only where the mail organ is grown.
import type { Stamp } from './time';
import { daysOverdue, isWateringOverdue, wateringAlertedToday, standingAlertId, type WateringSchedule, type TreeStage } from './watering';

// A stored moment as any soil writes it: the independent node's ISO text, milliseconds, a Stamp,
// or Firestore's {seconds} shape. Absent or unreadable: 0.
export const momentMsOf = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') { const ms = Date.parse(value); return Number.isFinite(ms) ? ms : 0; }
  if (value && typeof value === 'object') {
    const v = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
    if (typeof v.toMillis === 'function') return v.toMillis();
    const s = typeof v.seconds === 'number' ? v.seconds : typeof v._seconds === 'number' ? v._seconds : null;
    if (s !== null) return s * 1000;
  }
  return 0;
};
const stampOf = (ms: number): Stamp | undefined => (ms ? { toMillis: () => ms, toDate: () => new Date(ms) } : undefined);
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export interface ThirstFacts {
  id: string; name?: unknown; imageUrl?: unknown; domain?: unknown; anchorUid?: unknown; createdAt?: unknown;
  watering?: Record<string, unknown> | null; circleUids?: unknown;
}

// The tree's voice, stage-aware: a potted seed speaks as a seed (the origin's waterMeText).
export const waterMeText = (treeName: string, daysOver: number, stage?: string): string => {
  const who = treeName || 'This tree';
  const self = stage === 'potted' ? "I'm a seed in my pot 🌱" : "I'm thirsty 💧";
  if (daysOver <= 0) return `${stage === 'potted' ? "I'm a seed in my pot 🌱 and" : "I'm"} ready for watering 💧 — could a guardian care me today?`;
  if (daysOver === 1) return `${stage === 'potted' ? "I'm a seed in my pot 🌱 getting thirsty" : "I'm getting thirsty 💧"} — it's been a day past my watering. Could a guardian care me?`;
  return `${self} — it's been ${daysOver} days past my watering. Could a guardian care me? — ${who}`;
};

export const guardiansThreadIdOf = (treeId: string, anchorUid: string): string => ['grp', treeId, 'guardians', anchorUid].join('__');

export interface ThirstAsk {
  text: string;
  threadId: string;
  participantUids: string[];
  standingPulseId: string | null;          // the ask to rewrite while it stands; null when a new one is raised
  content: Record<string, unknown>;        // the new ask's record, should the standing one be gone
}
export interface ThirstJudgment { overdue: boolean; patch: Record<string, unknown>; ask: ThirstAsk | null }

// What the sweep writes for this tree at this moment — or null when nothing changes.
export const judgeThirst = (facts: ThirstFacts, nowMs: number): ThirstJudgment | null => {
  const w = facts.watering && typeof facts.watering === 'object' ? facts.watering : null;
  if (!w || w.mode !== 'scheduled' || typeof w.intervalDays !== 'number' || !(w.intervalDays > 0)) return null;
  const watering: WateringSchedule = {
    mode: 'scheduled', stage: text(w.stage) as TreeStage || undefined, intervalDays: w.intervalDays,
    lastWateredAt: stampOf(momentMsOf(w.lastWateredAt)), nextDueAt: stampOf(momentMsOf(w.nextDueAt)), lastAlertAt: stampOf(momentMsOf(w.lastAlertAt)),
    overdue: w.overdue === true, alertPulseId: text(w.alertPulseId) || undefined,
  };
  const tree = { watering, createdAt: stampOf(momentMsOf(facts.createdAt)) } as unknown as Parameters<typeof isWateringOverdue>[0];
  if (!isWateringOverdue(tree, nowMs)) return watering.overdue ? { overdue: false, patch: { 'watering.overdue': false }, ask: null } : null;
  const patch: Record<string, unknown> = { 'watering.overdue': true };
  if (wateringAlertedToday(tree, nowMs)) return { overdue: true, patch, ask: null };
  const anchorUid = text(facts.anchorUid);
  const circle = Array.isArray(facts.circleUids) ? facts.circleUids.filter((u): u is string => typeof u === 'string' && !!u) : [];
  const participantUids = Array.from(new Set([anchorUid, ...circle].filter(Boolean)));
  if (!anchorUid || participantUids.filter(u => u !== anchorUid).length === 0) return { overdue: true, patch, ask: null };
  const name = text(facts.name);
  const threadId = guardiansThreadIdOf(facts.id, anchorUid);
  const words = waterMeText(name, daysOverdue(tree, nowMs), watering.stage);
  patch['watering.lastAlertAt'] = new Date(nowMs).toISOString();
  patch['watering.alertThreadId'] = threadId;
  const content: Record<string, unknown> = {
    lifetreeId: facts.id, type: 'reach', visibility: 'private', careAlert: 'watering',
    title: `Reach: ${name} -> ${name} (Guardians)`, body: words, content: words,
    reachTreeId: facts.id, reachTreeName: name, recipientName: name, recipientUid: null,
    participantUids, threadId, threadName: `${name} · Guardians`, audience: 'guardians', isGroup: true, seenBy: [],
    authorId: anchorUid, authorName: name, authorPhoto: text(facts.imageUrl) || null, domain: text(facts.domain),
    loveCount: 0, commentCount: 0, previousHash: 'WATER_ALERT',
  };
  return { overdue: true, patch, ask: { text: words, threadId, participantUids, standingPulseId: standingAlertId(tree), content } };
};
