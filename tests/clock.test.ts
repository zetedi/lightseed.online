import { describe, expect, it } from 'vitest';
import { CLOCK_JOBS, CLOCK_DEFAULT_TIME_ZONE, isTimeZone, localDateOf, nextClockDueMs } from '../src/domain/clock';

const BRUSSELS = 'Europe/Brussels';
const iso = (ms: number) => new Date(ms).toISOString();

describe('the clock', () => {
  it('keeps the origin\'s hours and zone', () => {
    expect(CLOCK_JOBS).toEqual({ thirst: { hour: 8 }, leaves: { hour: 3 } });
    expect(CLOCK_DEFAULT_TIME_ZONE).toBe(BRUSSELS);
    expect(isTimeZone('Europe/Brussels')).toBe(true);
    expect(isTimeZone('UTC')).toBe(true);
    expect(isTimeZone('Mars/Olympus')).toBe(false);
    expect(isTimeZone('')).toBe(false);
    expect(isTimeZone(null)).toBe(false);
  });
  it('reads the calendar date in the zone, not in UTC', () => {
    expect(localDateOf(Date.UTC(2026, 10, 2, 23, 30), BRUSSELS)).toBe('2026-11-03');
    expect(localDateOf(Date.UTC(2026, 10, 2, 23, 30), 'UTC')).toBe('2026-11-02');
    expect(localDateOf(Date.UTC(2026, 6, 1, 22, 30), BRUSSELS)).toBe('2026-07-02');
  });
  it('answers the next 08:00 in winter and in summer', () => {
    // Winter (CET, UTC+1): 08:00 Brussels is 07:00Z.
    expect(iso(nextClockDueMs(8, BRUSSELS, Date.UTC(2026, 0, 10, 6, 59)))).toBe('2026-01-10T07:00:00.000Z');
    expect(iso(nextClockDueMs(8, BRUSSELS, Date.UTC(2026, 0, 10, 7, 0)))).toBe('2026-01-11T07:00:00.000Z');
    // Summer (CEST, UTC+2): 08:00 Brussels is 06:00Z.
    expect(iso(nextClockDueMs(8, BRUSSELS, Date.UTC(2026, 6, 10, 12, 0)))).toBe('2026-07-11T06:00:00.000Z');
    expect(iso(nextClockDueMs(3, 'UTC', Date.UTC(2026, 6, 10, 3, 0)))).toBe('2026-07-11T03:00:00.000Z');
  });
  it('crosses the daylight-saving changes without losing or doubling a run', () => {
    // 2026-03-29: at 02:00 CET the clocks jump to 03:00 CEST. 03:00 that morning is 01:00Z, once.
    expect(iso(nextClockDueMs(3, BRUSSELS, Date.UTC(2026, 2, 28, 2, 0)))).toBe('2026-03-29T01:00:00.000Z');
    expect(iso(nextClockDueMs(3, BRUSSELS, Date.UTC(2026, 2, 29, 1, 0)))).toBe('2026-03-30T01:00:00.000Z');
    // A skipped hour (02:00 does not exist that morning) yields the first real instant after it.
    expect(iso(nextClockDueMs(2, BRUSSELS, Date.UTC(2026, 2, 28, 2, 0)))).toBe('2026-03-29T01:00:00.000Z');
    // 2026-10-25: at 03:00 CEST the clocks fall back to 02:00 CET. 03:00 CET is 02:00Z, once.
    expect(iso(nextClockDueMs(3, BRUSSELS, Date.UTC(2026, 9, 24, 12, 0)))).toBe('2026-10-25T02:00:00.000Z');
    expect(iso(nextClockDueMs(3, BRUSSELS, Date.UTC(2026, 9, 25, 2, 0)))).toBe('2026-10-26T02:00:00.000Z');
    // The repeated hour (02:00 happens twice) yields one instant, and the day after it only one more.
    const doubled = nextClockDueMs(2, BRUSSELS, Date.UTC(2026, 9, 24, 12, 0));
    expect(['2026-10-25T00:00:00.000Z', '2026-10-25T01:00:00.000Z']).toContain(iso(doubled));
    expect(iso(nextClockDueMs(2, BRUSSELS, doubled))).toBe('2026-10-26T01:00:00.000Z');
  });
  it('is strictly after the moment given, so a run never schedules itself again at once', () => {
    const at = nextClockDueMs(8, BRUSSELS, Date.UTC(2026, 4, 1, 0, 0));
    expect(nextClockDueMs(8, BRUSSELS, at)).toBe(at + 24 * 3600 * 1000);
  });
});
