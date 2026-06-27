import type { Timestamp } from 'firebase/firestore';
import type { Lifetree } from './lifetree';

// --- Watering: scheduled tending of a (usually guarded) tree ---------------------------
// Watering is the most literal form of tending. A *confirmed* watering is a growth pulse
// (a real block on the tree's chain) that re-lights the tree's living validation; the
// *need* for watering is a flag on the tree + a reach to its guardians — a message, not a
// block, so the chain stays meaningful. This module is the pure law shared by the client
// and (mirrored, since functions/ is a separate TS project) the daily scheduled sweep.

export type WateringMode = 'scheduled' | 'self_sustaining';

export interface WateringSchedule {
  mode: WateringMode;
  intervalDays?: number;      // for 'scheduled' — how many days between waterings
  lastWateredAt?: Timestamp;  // last confirmed watering (or when the schedule was set)
  nextDueAt?: Timestamp;      // denormalised lastWateredAt + intervalDays (for display)
  overdue?: boolean;          // raised by the daily sweep / client check, cleared on watering
  lastAlertAt?: Timestamp;    // idempotency: when guardians were last pinged about it
  alertThreadId?: string;     // the guardians group thread the "water me" reach lives in
}

// The witness's reading of a watering photo — produced by the AI, or stood in for by a
// guardian. Confidence is 0-100; >= AI_CONFIRM_THRESHOLD auto-confirms.
export interface WateringAnalysis {
  watering: boolean;
  confidence: number;
  note: string;
  model?: string;
  provider?: string;
}

// At or above this AI confidence, a watering is auto-confirmed; below it, a guardian confirms.
export const AI_CONFIRM_THRESHOLD = 70;

export const DAY_MS = 24 * 60 * 60 * 1000;

// Robustly read milliseconds from a Firestore Timestamp, a JS Date, or a number.
const toMs = (t: any): number =>
  t?.toMillis ? t.toMillis() : (t instanceof Date ? t.getTime() : (typeof t === 'number' ? t : 0));

type TreeLike = Pick<Lifetree, 'watering' | 'createdAt'> | null | undefined;

export const wateringOf = (tree: TreeLike): WateringSchedule | undefined =>
  (tree as any)?.watering as WateringSchedule | undefined;

// A tree is on a watering schedule (vs. self-sustaining / no schedule) when it has a mode
// of 'scheduled' and a positive interval.
export const isOnWateringSchedule = (tree: TreeLike): boolean => {
  const w = wateringOf(tree);
  return !!w && w.mode === 'scheduled' && !!w.intervalDays && w.intervalDays > 0;
};

// When the tree was last watered — the confirmed watering, falling back to its birth so a
// freshly-scheduled tree isn't instantly overdue from epoch 0.
export const lastWateredMillis = (tree: TreeLike): number => {
  const w = wateringOf(tree);
  return toMs(w?.lastWateredAt) || toMs((tree as any)?.createdAt) || 0;
};

// Compute the next-due moment from a last-watered moment + interval (the single formula).
export const computeNextDueMillis = (lastWateredMs: number, intervalDays: number): number =>
  lastWateredMs + Math.max(1, intervalDays) * DAY_MS;

// The moment watering is next due. Prefers an explicit nextDueAt, else derives it.
export const nextDueMillis = (tree: TreeLike): number => {
  const w = wateringOf(tree);
  if (!w || w.mode !== 'scheduled' || !w.intervalDays) return 0;
  return toMs(w.nextDueAt) || computeNextDueMillis(lastWateredMillis(tree), w.intervalDays);
};

// Overdue = on a schedule and past the due moment. Self-sustaining trees are never overdue.
export const isWateringOverdue = (tree: TreeLike, now: number = Date.now()): boolean =>
  isOnWateringSchedule(tree) && now >= nextDueMillis(tree);

// Days until the next watering (negative once overdue). 0 when not scheduled.
export const daysUntilWatering = (tree: TreeLike, now: number = Date.now()): number => {
  if (!isOnWateringSchedule(tree)) return 0;
  return Math.ceil((nextDueMillis(tree) - now) / DAY_MS);
};

// Whole days a tree has been overdue (0 if not overdue).
export const daysOverdue = (tree: TreeLike, now: number = Date.now()): number =>
  isWateringOverdue(tree, now) ? Math.max(0, Math.floor((now - nextDueMillis(tree)) / DAY_MS)) : 0;

// Two instants fall on the same UTC day — used to ping guardians at most once per day.
const sameUtcDay = (a: number, b: number): boolean => {
  if (!a || !b) return false;
  const da = new Date(a), dbb = new Date(b);
  return da.getUTCFullYear() === dbb.getUTCFullYear()
    && da.getUTCMonth() === dbb.getUTCMonth()
    && da.getUTCDate() === dbb.getUTCDate();
};

// Have the tree's guardians already been alerted today? Keeps the daily routine + the
// client-side check from double-pinging the same circle.
export const wateringAlertedToday = (tree: TreeLike, now: number = Date.now()): boolean => {
  const w = wateringOf(tree);
  return !!w && sameUtcDay(toMs(w.lastAlertAt), now);
};

// Should we raise a fresh "water me" alert right now? Overdue and not yet alerted today.
export const shouldAlertForWatering = (tree: TreeLike, now: number = Date.now()): boolean =>
  isWateringOverdue(tree, now) && !wateringAlertedToday(tree, now);
