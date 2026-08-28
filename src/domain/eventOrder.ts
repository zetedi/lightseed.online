// EVENT ORDER — the feed seen from a being's own ground: events on MY domain come first;
// within that, nearer to my default tree; within one nearness band, sooner in time.
// Distance is BANDED (5 / 25 / 100 / 500 km) so nearness never nullifies "closest in time
// first" — inside a band, time alone orders. An event without a resolvable place sits past
// the farthest band. Past events sink below upcoming (freshest past first) and dateless
// events stand between them; the caller chooses the upcoming/past cutoff (pass the start
// of today for day-granularity, matching domain/calendar.isPastEvent).
export const DISTANCE_BAND_KM = [5, 25, 100, 500] as const;

export const distanceBand = (meters: number | null): number => {
  if (meters === null || !Number.isFinite(meters)) return DISTANCE_BAND_KM.length + 1;
  for (let i = 0; i < DISTANCE_BAND_KM.length; i++) {
    if (meters <= DISTANCE_BAND_KM[i] * 1000) return i;
  }
  return DISTANCE_BAND_KM.length;
};

export interface EventOrderFacts {
  inMyDomain: boolean;
  distanceMeters: number | null;
  eventDateMs: number | null;
}

// upcoming (soonest first) < dateless < past (freshest first)
const timeRank = (eventDateMs: number | null, cutoffMs: number): number =>
  eventDateMs === null ? 1 : eventDateMs >= cutoffMs ? 0 : 2;

export const compareEventFacts = (a: EventOrderFacts, b: EventOrderFacts, cutoffMs: number): number => {
  if (a.inMyDomain !== b.inMyDomain) return a.inMyDomain ? -1 : 1;
  const bandA = distanceBand(a.distanceMeters);
  const bandB = distanceBand(b.distanceMeters);
  if (bandA !== bandB) return bandA - bandB;
  const rankA = timeRank(a.eventDateMs, cutoffMs);
  const rankB = timeRank(b.eventDateMs, cutoffMs);
  if (rankA !== rankB) return rankA - rankB;
  if (a.eventDateMs === null || b.eventDateMs === null) return 0;
  return rankA === 2 ? b.eventDateMs - a.eventDateMs : a.eventDateMs - b.eventDateMs;
};

// A stable sort: ties keep the feed's own order (newest-created first).
export const orderEvents = <T>(
  events: readonly T[],
  facts: (event: T) => EventOrderFacts,
  cutoffMs: number,
): T[] =>
  events
    .map((event, i) => ({ event, i, f: facts(event) }))
    .sort((x, y) => compareEventFacts(x.f, y.f, cutoffMs) || x.i - y.i)
    .map(x => x.event);
