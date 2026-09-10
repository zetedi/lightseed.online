import { describe, it, expect } from 'vitest';
import { standingAlertId, wateringAlertedToday, shouldAlertForWatering } from '../src/domain/watering';

// ONE STANDING ASK (ring 2026-09-11): a thirsty tree asks once, and the ask keeps saying today's count.
describe('standingAlertId — which ask is rewritten, and which is left as said', () => {
  const tree = (w: Record<string, unknown>) => ({ watering: w }) as never;

  it('is null before any ask has been raised', () => {
    expect(standingAlertId(tree({ intervalDays: 3 }))).toBeNull();
    expect(standingAlertId(tree({ alertPulseId: 'p1' }))).toBeNull();   // raised when?
    expect(standingAlertId(tree({ lastAlertAt: 1000 }))).toBeNull();    // which message?
  });

  it('answers the standing ask while it stands', () => {
    expect(standingAlertId(tree({ alertPulseId: 'p1', lastAlertAt: 5000 }))).toBe('p1');
    // watered BEFORE the ask was raised — the ask still stands, so it is rewritten
    expect(standingAlertId(tree({ alertPulseId: 'p1', lastAlertAt: 5000, lastWateredAt: 4000 }))).toBe('p1');
  });

  it('a watering after the ask answers it — the next thirst speaks anew', () => {
    expect(standingAlertId(tree({ alertPulseId: 'p1', lastAlertAt: 5000, lastWateredAt: 6000 }))).toBeNull();
  });
});

// The daily gate the standing ask rides on: at most one ping a day, client and server alike.
describe('the daily gate still holds', () => {
  const now = Date.UTC(2026, 8, 11, 12, 0, 0);
  it('an ask raised today closes the gate; yesterday leaves it open', () => {
    expect(wateringAlertedToday({ watering: { lastAlertAt: now - 3600_000 } } as never, now)).toBe(true);
    expect(wateringAlertedToday({ watering: { lastAlertAt: now - 30 * 3600_000 } } as never, now)).toBe(false);
    expect(wateringAlertedToday({ watering: {} } as never, now)).toBe(false);
  });
  it('an overdue tree not yet asked today asks', () => {
    const overdue = { watering: { mode: 'scheduled', intervalDays: 1, lastWateredAt: now - 5 * 24 * 3600_000 } } as never;
    expect(shouldAlertForWatering(overdue, now)).toBe(true);
  });
});
