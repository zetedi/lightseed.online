// EVENT ORDER — the feed seen from a being's own ground: events on MY domain come first;
// within that, nearer to my default tree; within one nearness band, sooner in time.
// Distance is BANDED (5 / 25 / 100 / 500 km) so nearness never nullifies "closest in time
// first" — inside a band, time alone orders. An event without a resolvable place sits past
// the farthest band. Past events sink below upcoming (freshest past first) and dateless
// events stand between them; the caller chooses the upcoming/past cutoff (pass the start
// of today for day-granularity, matching domain/calendar.isPastEvent). A gathering that
// spans days (domain/eventSpan) is upcoming until its LAST moment passes the cutoff — a
// retreat under way stands with the upcoming, first among them, since it began soonest — and
// once past, the freshest ENDED gathering comes first.
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
  // The standing end of a span (domain/eventSpan eventEndMs), when the gathering has one.
  eventEndMs?: number | null;
}

const lastMomentOf = (f: EventOrderFacts): number | null => f.eventDateMs === null ? null : (f.eventEndMs ?? f.eventDateMs);

// upcoming (soonest first) < dateless < past (freshest first)
const timeRank = (f: EventOrderFacts, cutoffMs: number): number => {
  const last = lastMomentOf(f);
  return last === null ? 1 : last >= cutoffMs ? 0 : 2;
};

export const compareEventFacts = (a: EventOrderFacts, b: EventOrderFacts, cutoffMs: number): number => {
  if (a.inMyDomain !== b.inMyDomain) return a.inMyDomain ? -1 : 1;
  const bandA = distanceBand(a.distanceMeters);
  const bandB = distanceBand(b.distanceMeters);
  if (bandA !== bandB) return bandA - bandB;
  const rankA = timeRank(a, cutoffMs);
  const rankB = timeRank(b, cutoffMs);
  if (rankA !== rankB) return rankA - rankB;
  if (a.eventDateMs === null || b.eventDateMs === null) return 0;
  return rankA === 2 ? lastMomentOf(b)! - lastMomentOf(a)! : a.eventDateMs - b.eventDateMs;
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
