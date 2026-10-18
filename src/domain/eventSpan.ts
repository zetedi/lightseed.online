// THE SPAN OF A GATHERING (ring 2026-10-18). An event has always had one moment, `eventDate`;
// a retreat has a first day and a last. The span is two fields on the same record — `eventDate`
// (the beginning) and `eventEndDate` (the end, optional) — both in the datetime-local form the
// seed's event forms write ('2026-10-20T18:00', the wall clock where the reader stands, or any
// Date.parse-able string). An older event has no end: it is a span of one moment, and nothing
// changes for it.
//
// Plain contract — GUARANTEED: an end COUNTS only when it is readable and comes after the
// beginning; anything else (absent, unreadable, at or before the start) reads as "no end", so a
// record written badly never hides a gathering nor ages it out early. The LAST MOMENT of a span
// (its end when it stands, else its beginning) is what "past" is judged by — day-granular, in
// the reader's local time, like domain/calendar isPastEvent. A gathering is UPCOMING until its
// first day begins, ONGOING through its last day, PAST once that day has fully ended. The form's
// refusals (spanProblem) are stricter than the reader: an end at or before the start, or an end
// without a start, is refused at the hand — tolerance is for records, not for new writes.
// NOT GUARANTEED: the rules hold the end's KEY, not its value or its order (the same trust
// eventDate has); a wall-clock string is read where the reader stands, never in the gathering's
// own zone. Enforced by tests/eventSpan.test.ts.

export interface EventSpan {
  eventDate?: string | null;
  eventEndDate?: string | null;
}

export type SpanProblem = 'event_end_before_start' | 'event_end_without_start';

const DAY_MS = 86400000;

const parse = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

// Midnight that begins the local day a moment falls in; `shiftDays` walks whole days through
// the Date constructor, so a DST hour never shortens or lengthens a day.
const dayStart = (ms: number, shiftDays = 0): number => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + shiftDays).getTime();
};

export const eventStartMs = (span: EventSpan): number | null => parse(span.eventDate);

// The end, only when it stands: readable, and after the beginning.
export const eventEndMs = (span: EventSpan): number | null => {
  const start = eventStartMs(span);
  const end = parse(span.eventEndDate);
  return start === null || end === null || end <= start ? null : end;
};

// The last moment of the gathering: its end when it stands, else its beginning.
export const eventLastMs = (span: EventSpan): number | null => eventEndMs(span) ?? eventStartMs(span);

// The same last moment as the string that carries it — what isPastEvent reads.
export const eventLastIso = (span: EventSpan): string | undefined =>
  eventEndMs(span) !== null ? span.eventEndDate! : span.eventDate || undefined;

// How many calendar days the gathering touches, inclusive, where the reader stands: 1 for a
// span within one day, null without a standing end (a single moment claims no days).
export const eventSpanDays = (span: EventSpan): number | null => {
  const start = eventStartMs(span);
  const end = eventEndMs(span);
  if (start === null || end === null) return null;
  return Math.round((dayStart(end) - dayStart(start)) / DAY_MS) + 1;
};

export type EventPhase = 'undated' | 'upcoming' | 'ongoing' | 'past';

export const eventPhase = (span: EventSpan, nowMs: number): EventPhase => {
  const start = eventStartMs(span);
  if (start === null) return 'undated';
  const today = dayStart(nowMs);
  if (eventLastMs(span)! < today) return 'past';
  return start >= dayStart(nowMs, 1) ? 'upcoming' : 'ongoing';
};

// The countdown a card wears: `in` so many calendar days until the first day; `today` when the
// first day is this one; `now` once a gathering that began on an earlier day is still running;
// nothing once its last day has ended, and nothing without a date.
export type Countdown = { kind: 'now' } | { kind: 'today' } | { kind: 'in'; days: number };

export const countdownOf = (span: EventSpan, nowMs: number): Countdown | null => {
  const phase = eventPhase(span, nowMs);
  if (phase === 'undated' || phase === 'past') return null;
  const days = Math.round((dayStart(eventStartMs(span)!) - dayStart(nowMs)) / DAY_MS);
  if (days > 0) return { kind: 'in', days };
  return days === 0 ? { kind: 'today' } : { kind: 'now' };
};

// What a form refuses before it writes: an end needs a beginning, and must come after it.
export const spanProblem = (start: string, end: string): SpanProblem | null => {
  if (!end.trim()) return null;
  if (!start.trim()) return 'event_end_without_start';
  const s = parse(start);
  const e = parse(end);
  return s === null || e === null || e <= s ? 'event_end_before_start' : null;
};
