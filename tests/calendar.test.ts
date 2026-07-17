import { describe, it, expect } from 'vitest';
import { addMonths, eachNight, isNightBooked, monthGrid, parseYmd, todayStr, ymd } from '../src/domain/calendar';

// The bed calendar's arithmetic — pure, deterministic, no live clock.

describe('ymd / parseYmd', () => {
  it('pads and round-trips', () => {
    expect(ymd(2026, 7, 5)).toBe('2026-07-05');
    expect(parseYmd('2026-07-05')).toEqual({ year: 2026, month: 7, day: 5 });
    expect(parseYmd('nope')).toBeNull();
  });
});

describe('todayStr', () => {
  it('reads the injected clock in local time', () => {
    const noon = new Date(2026, 6, 14, 12, 0, 0).getTime(); // month 6 = July, local
    expect(todayStr(noon)).toBe('2026-07-14');
  });
});

describe('addMonths', () => {
  it('wraps across year boundaries both ways', () => {
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths(2026, 3, -5)).toEqual({ year: 2025, month: 10 });
  });
});

describe('monthGrid', () => {
  it('draws whole Sunday-first weeks, 28 in-month days for Feb 2026 (Feb 1 = Sunday)', () => {
    const weeks = monthGrid(2026, 2);
    expect(weeks.every(w => w.length === 7)).toBe(true);
    expect(weeks.flat().length % 7).toBe(0);
    expect(weeks.flat()[0].dateStr).toBe('2026-02-01'); // no leading days: Feb 1 2026 is a Sunday
    expect(weeks.flat().filter(d => d.inMonth).length).toBe(28);
  });
  it('handles leap February', () => {
    const inMonth = monthGrid(2024, 2).flat().filter(d => d.inMonth);
    expect(inMonth.length).toBe(29);
    expect(inMonth[inMonth.length - 1].dateStr).toBe('2024-02-29');
  });
});

describe('eachNight — [from, to), the departure day is free', () => {
  it('lists the nights slept, not the departure morning', () => {
    expect(eachNight('2026-08-01', '2026-08-04')).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
    expect(eachNight('2026-08-01', '2026-08-01')).toEqual([]);
    expect(eachNight('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
    expect(eachNight('bad', '2026-08-04')).toEqual([]);
  });
});

describe('isNightBooked', () => {
  const ranges = [{ fromDate: '2026-08-01', toDate: '2026-08-04' }];
  it('marks slept nights and frees the departure day', () => {
    expect(isNightBooked('2026-08-01', ranges)).toBe(true);
    expect(isNightBooked('2026-08-03', ranges)).toBe(true);
    expect(isNightBooked('2026-08-04', ranges)).toBe(false); // departure morning
    expect(isNightBooked('2026-07-31', ranges)).toBe(false);
  });
});
