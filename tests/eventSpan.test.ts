import { describe, expect, it } from 'vitest';
import {
  countdownOf, eventEndMs, eventLastIso, eventLastMs, eventPhase, eventSpanDays, eventStartMs, spanProblem,
} from '../src/domain/eventSpan';

// THE SPAN OF A GATHERING (ring 2026-10-18): a beginning and an optional end on one record. The
// clock is injected — local-time arithmetic, deterministic under any zone the runner stands in.

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const iso = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
const NOON = at(2026, 10, 18); // the ring's own day, noon

describe('the end counts only when it stands', () => {
  const start = iso(2026, 11, 6, 18);
  it('reads a readable end after the beginning, and nothing else', () => {
    expect(eventEndMs({ eventDate: start, eventEndDate: iso(2026, 11, 8, 12) })).toBe(at(2026, 11, 8));
    expect(eventEndMs({ eventDate: start, eventEndDate: iso(2026, 11, 6, 17) })).toBeNull(); // before
    expect(eventEndMs({ eventDate: start, eventEndDate: start })).toBeNull();                // at
    expect(eventEndMs({ eventDate: start, eventEndDate: 'not a date' })).toBeNull();
    expect(eventEndMs({ eventDate: start, eventEndDate: '' })).toBeNull();
    expect(eventEndMs({ eventDate: start })).toBeNull();
    expect(eventEndMs({ eventEndDate: iso(2026, 11, 8) })).toBeNull();                       // no beginning
    expect(eventStartMs({ eventDate: '' })).toBeNull();
  });
  it('the last moment is the end when it stands, else the beginning — as ms and as the string', () => {
    expect(eventLastMs({ eventDate: start, eventEndDate: iso(2026, 11, 8) })).toBe(at(2026, 11, 8));
    expect(eventLastMs({ eventDate: start, eventEndDate: iso(2026, 11, 1) })).toBe(at(2026, 11, 6, 18));
    expect(eventLastIso({ eventDate: start, eventEndDate: iso(2026, 11, 8) })).toBe(iso(2026, 11, 8));
    expect(eventLastIso({ eventDate: start, eventEndDate: 'bad' })).toBe(start);
    expect(eventLastIso({ eventDate: '', eventEndDate: iso(2026, 11, 8) })).toBeUndefined();
    expect(eventLastMs({})).toBeNull();
  });
  it('counts the calendar days a span touches, inclusive, where the reader stands', () => {
    expect(eventSpanDays({ eventDate: iso(2026, 11, 6, 18), eventEndDate: iso(2026, 11, 8, 9) })).toBe(3);
    expect(eventSpanDays({ eventDate: iso(2026, 11, 6, 9), eventEndDate: iso(2026, 11, 6, 21) })).toBe(1);
    expect(eventSpanDays({ eventDate: iso(2026, 10, 24, 20), eventEndDate: iso(2026, 10, 26, 10) })).toBe(3); // across an EU clock change
    expect(eventSpanDays({ eventDate: iso(2026, 11, 6) })).toBeNull();
  });
});

describe('the phase of a gathering — day-granular, like isPastEvent', () => {
  it('a single moment: upcoming tomorrow, ongoing today (even earlier today), past yesterday', () => {
    expect(eventPhase({ eventDate: iso(2026, 10, 19, 9) }, NOON)).toBe('upcoming');
    expect(eventPhase({ eventDate: iso(2026, 10, 18, 8) }, NOON)).toBe('ongoing');
    expect(eventPhase({ eventDate: iso(2026, 10, 18, 23, 59) }, NOON)).toBe('ongoing');
    expect(eventPhase({ eventDate: iso(2026, 10, 17, 23, 59) }, NOON)).toBe('past');
    expect(eventPhase({}, NOON)).toBe('undated');
    expect(eventPhase({ eventDate: 'not a date' }, NOON)).toBe('undated');
  });
  it('a retreat that began on an earlier day is ongoing until its last day ends', () => {
    const retreat = { eventDate: iso(2026, 10, 16, 18), eventEndDate: iso(2026, 10, 20, 12) };
    expect(eventPhase(retreat, NOON)).toBe('ongoing');
    expect(eventPhase(retreat, at(2026, 10, 20, 23))).toBe('ongoing');
    expect(eventPhase(retreat, at(2026, 10, 21, 0, 1))).toBe('past');
    expect(eventPhase(retreat, at(2026, 10, 15))).toBe('upcoming');
  });
  it('a bad end never ages a gathering early nor keeps it alive', () => {
    expect(eventPhase({ eventDate: iso(2026, 10, 18, 9), eventEndDate: iso(2026, 10, 1) }, NOON)).toBe('ongoing');
    expect(eventPhase({ eventDate: iso(2026, 10, 10), eventEndDate: 'bad' }, NOON)).toBe('past');
  });
});

describe('the countdown a card wears', () => {
  it('in N days, today, now — and nothing past or undated', () => {
    expect(countdownOf({ eventDate: iso(2026, 10, 21, 7) }, NOON)).toEqual({ kind: 'in', days: 3 });
    expect(countdownOf({ eventDate: iso(2026, 10, 19, 0, 1) }, NOON)).toEqual({ kind: 'in', days: 1 });
    expect(countdownOf({ eventDate: iso(2026, 10, 18, 18) }, NOON)).toEqual({ kind: 'today' });
    expect(countdownOf({ eventDate: iso(2026, 10, 18, 8) }, NOON)).toEqual({ kind: 'today' });
    expect(countdownOf({ eventDate: iso(2026, 10, 16), eventEndDate: iso(2026, 10, 20) }, NOON)).toEqual({ kind: 'now' });
    expect(countdownOf({ eventDate: iso(2026, 10, 18, 8), eventEndDate: iso(2026, 10, 20) }, NOON)).toEqual({ kind: 'today' });
    expect(countdownOf({ eventDate: iso(2026, 10, 17, 20) }, NOON)).toBeNull();
    expect(countdownOf({}, NOON)).toBeNull();
  });
  it('counts calendar days, not 24-hour rounds, across a clock change', () => {
    // 2026-10-25 is the EU autumn change: the 24th at 23:00 to the 26th at 01:00 is 1 day + 26 h.
    expect(countdownOf({ eventDate: iso(2026, 10, 26, 1) }, at(2026, 10, 24, 23))).toEqual({ kind: 'in', days: 2 });
  });
});

describe('what the form refuses', () => {
  it('an end needs a beginning, and must come after it', () => {
    expect(spanProblem('2026-11-06T18:00', '2026-11-08T12:00')).toBeNull();
    expect(spanProblem('2026-11-06T18:00', '')).toBeNull();
    expect(spanProblem('', '')).toBeNull();
    expect(spanProblem('', '2026-11-08T12:00')).toBe('event_end_without_start');
    expect(spanProblem('2026-11-06T18:00', '2026-11-06T18:00')).toBe('event_end_before_start');
    expect(spanProblem('2026-11-06T18:00', '2026-11-05T12:00')).toBe('event_end_before_start');
    expect(spanProblem('2026-11-06T18:00', 'nope')).toBe('event_end_before_start');
  });
});
