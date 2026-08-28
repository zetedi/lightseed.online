import { describe, expect, it } from 'vitest';
import { compareEventFacts, distanceBand, orderEvents, type EventOrderFacts } from '../src/domain/eventOrder';

const NOW = 1783382400000;
const DAY = 24 * 60 * 60 * 1000;

const facts = (over: Partial<EventOrderFacts>): EventOrderFacts => ({
  inMyDomain: false, distanceMeters: null, eventDateMs: null, ...over,
});

describe('event order — my ground, then nearness, then soonness', () => {
  it('bands distance so time keeps meaning inside a band', () => {
    expect(distanceBand(0)).toBe(0);
    expect(distanceBand(5_000)).toBe(0);
    expect(distanceBand(5_001)).toBe(1);
    expect(distanceBand(25_000)).toBe(1);
    expect(distanceBand(100_000_0)).toBe(4);   // 1000 km: beyond the farthest band
    expect(distanceBand(null)).toBe(5);        // unresolvable place sits last
  });

  it('my domain outranks everything', () => {
    const mine = facts({ inMyDomain: true, distanceMeters: null, eventDateMs: NOW + 30 * DAY });
    const near = facts({ distanceMeters: 1000, eventDateMs: NOW });
    expect(compareEventFacts(mine, near, NOW)).toBeLessThan(0);
  });

  it('within a domain group, nearer band first; within a band, sooner first', () => {
    const nearLater = facts({ distanceMeters: 2000, eventDateMs: NOW + 10 * DAY });
    const farSooner = facts({ distanceMeters: 200_000, eventDateMs: NOW + DAY });
    expect(compareEventFacts(nearLater, farSooner, NOW)).toBeLessThan(0);
    const soon = facts({ distanceMeters: 1000, eventDateMs: NOW + DAY });
    const later = facts({ distanceMeters: 4000, eventDateMs: NOW + 2 * DAY });
    expect(compareEventFacts(soon, later, NOW)).toBeLessThan(0); // same band: time decides
  });

  it('upcoming < dateless < past, and past shows freshest first', () => {
    const upcoming = facts({ eventDateMs: NOW + DAY });
    const dateless = facts({});
    const pastOld = facts({ eventDateMs: NOW - 10 * DAY });
    const pastNew = facts({ eventDateMs: NOW - DAY });
    expect(compareEventFacts(upcoming, dateless, NOW)).toBeLessThan(0);
    expect(compareEventFacts(dateless, pastNew, NOW)).toBeLessThan(0);
    expect(compareEventFacts(pastNew, pastOld, NOW)).toBeLessThan(0);
  });

  it('sorts stably — ties keep the feed order', () => {
    const a = { id: 'a' }, b = { id: 'b' };
    const same = () => facts({ eventDateMs: NOW + DAY });
    expect(orderEvents([a, b], same, NOW)).toEqual([a, b]);
    expect(orderEvents([b, a], same, NOW)).toEqual([b, a]);
  });
});
