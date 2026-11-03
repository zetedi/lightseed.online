// THE CLOCK'S LAW (ring 2026-11-03): WHEN the independent node's scheduled hands run — pure. The
// origin node runs them as Cloud Scheduler jobs (functions/light.ts checkWateringSchedules every
// day 08:00 Europe/Brussels; functions/lifetrees.ts mintStayLeaves every day 03:00); here the API
// process keeps a ledger (seed.clock) and, after every run, asks this law for the next due moment
// in the installation's own zone (SEED_CLOCK_TIMEZONE, the origin's zone by default).
//
// Plain contract — guaranteed: nextClockDueMs answers the first instant strictly after `afterMs`
// at which the wall clock of `timeZone` reads `hour`:00:00, across daylight-saving changes (a
// repeated hour yields one of its two instants, a skipped hour the first real instant after it);
// localDateOf is the calendar date in that zone. No function here reads a clock. Enforced by
// tests/clock.test.ts and, end to end, tests/seed/clock.postgres-test.ts. Not guaranteed: that
// the process is awake at that instant — a job the node slept through runs at the next tick, once.

export type ClockJob = 'thirst' | 'leaves' | 'sweep';
// The jobs and their hours (the origin's): the thirst check in the morning, the stay leaves at night,
// and the node's own sweep of orphaned picture files after the leaves (ring 2026-11-03, migration 060).
export const CLOCK_JOBS: Record<ClockJob, { hour: number }> = { thirst: { hour: 8 }, leaves: { hour: 3 }, sweep: { hour: 4 } };
export const CLOCK_JOB_NAMES: readonly ClockJob[] = ['thirst', 'leaves', 'sweep'];
export const CLOCK_DEFAULT_TIME_ZONE = 'Europe/Brussels';
// How long one run may hold a job before another process may take it over.
export const CLOCK_LEASE_MS = 10 * 60 * 1000;

export const isTimeZone = (zone: unknown): zone is string => {
  if (typeof zone !== 'string' || !zone || zone.length > 64) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return true; } catch { return false; }
};

interface Wall { year: number; month: number; day: number; hour: number; minute: number; second: number }
const wallOf = (ms: number, timeZone: string): Wall => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms));
  const read = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  return { year: read('year'), month: read('month'), day: read('day'), hour: read('hour') % 24, minute: read('minute'), second: read('second') };
};
const wallMs = (w: Wall): number => Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);

export const localDateOf = (ms: number, timeZone: string): string => {
  const w = wallOf(ms, timeZone);
  return `${w.year}-${String(w.month).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`;
};

// The instant at which the zone's wall clock reads the given date at `hour`:00:00. The offset is
// read at the guess and the guess corrected until it rests; a skipped hour never rests, so the
// later candidate (the first real instant after the gap) is taken.
const zonedInstant = (year: number, month: number, day: number, hour: number, timeZone: string): number => {
  const target = Date.UTC(year, month - 1, day, hour);
  let guess = target, next = target;
  for (let i = 0; i < 4; i++) {
    next = target - (wallMs(wallOf(guess, timeZone)) - guess);
    if (next === guess) return guess;
    guess = next;
  }
  return Math.max(guess, next);
};

export const nextClockDueMs = (hour: number, timeZone: string, afterMs: number): number => {
  const today = wallOf(afterMs, timeZone);
  const candidate = zonedInstant(today.year, today.month, today.day, hour, timeZone);
  if (candidate > afterMs) return candidate;
  const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  return zonedInstant(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), hour, timeZone);
};
