// A month as a grid of weeks, and the night-arithmetic a bed calendar needs. Pure and
// deterministic — the clock enters only as an injected nowMs, never an argless new Date(), so
// the same inputs always draw the same month and the tests stay golden. Nights are half-open
// [arrival, departure): you sleep the arrival night and leave the departure morning, so a
// departure day is free for the next guest (mirrors staysOverlap in domain/stay.ts).

export interface CalendarDay {
  dateStr: string; // yyyy-mm-dd
  day: number; // 1..31
  inMonth: boolean; // false for the leading/trailing days that fill the grid's weeks
}

// month is 1..12 here (human), not the 0..11 of the Date constructor.
export const ymd = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const parseYmd = (s: string): { year: number; month: number; day: number } | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
};

export const todayStr = (nowMs: number): string => {
  const d = new Date(nowMs);
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
};

// Shift a (year, month) by delta months, keeping month 1..12.
export const addMonths = (year: number, month: number, delta: number): { year: number; month: number } => {
  const zeroBased = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
};

const daysInMonth = (year: number, month: number): number => new Date(year, month, 0).getDate();

// The grid for a month: whole weeks (Sunday-first), the leading/trailing days of the
// neighbouring months marked inMonth:false so they can be dimmed.
export const monthGrid = (year: number, month: number): CalendarDay[][] => {
  const startWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  const total = daysInMonth(year, month);
  const cells: CalendarDay[] = [];

  const prev = addMonths(year, month, -1);
  const prevDays = daysInMonth(prev.year, prev.month);
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = prevDays - i;
    cells.push({ dateStr: ymd(prev.year, prev.month, day), day, inMonth: false });
  }
  for (let day = 1; day <= total; day++) {
    cells.push({ dateStr: ymd(year, month, day), day, inMonth: true });
  }
  const next = addMonths(year, month, 1);
  for (let day = 1; cells.length % 7 !== 0; day++) {
    cells.push({ dateStr: ymd(next.year, next.month, day), day, inMonth: false });
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
};

// The nights a stay occupies — [from, to), so the departure day is not a night.
export const eachNight = (fromDate: string, toDate: string): string[] => {
  const a = parseYmd(fromDate);
  const b = parseYmd(toDate);
  if (!a || !b) return [];
  const out: string[] = [];
  const cur = new Date(a.year, a.month - 1, a.day);
  const end = new Date(b.year, b.month - 1, b.day);
  while (cur < end) {
    out.push(ymd(cur.getFullYear(), cur.getMonth() + 1, cur.getDate()));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

// Is this night held by any of the given ranges? [from, to) — the departure day stays free.
// yyyy-mm-dd strings compare correctly with < and >=, so no parsing is needed here.
export const isNightBooked = (dateStr: string, ranges: { fromDate: string; toDate: string }[]): boolean =>
  ranges.some(r => dateStr >= r.fromDate && dateStr < r.toDate);
