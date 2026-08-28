import { useEffect, useMemo, useState } from 'react';
import type { Lifetree, Pulse } from '../types';
import { orderEvents } from '../domain/eventOrder';
import { distanceM } from '../domain/support';
import { treeCoordinates } from '../domain/views/forest';
import { geocode } from '../services/weather';

// THE EVENT FEED FROM MY GROUND (domain/eventOrder): my domain first, then nearness to my
// default tree, then soonness. Events carry only a free-text place, so nearness is read by
// geocoding that text — best-effort, cached for the session, capped per pass; an event whose
// place never resolves simply sits past the farthest band. Ordering itself is the pure law.
const geoCache = new Map<string, { lat: number; lng: number } | null>();
const GEOCODE_CAP_PER_PASS = 40;

const placeKey = (location: string): string => location.trim().toLowerCase();

export const useOrderedEvents = (
  events: Pulse[],
  homeTree: Lifetree | null,
  myDomain?: string,
): Pulse[] => {
  const [geoVersion, setGeoVersion] = useState(0);
  const origin = homeTree ? treeCoordinates(homeTree) : null;
  const originLat = origin?.lat;
  const originLng = origin?.lng;

  useEffect(() => {
    // Without a rooted origin, distance never orders — skip the network entirely.
    if (originLat === undefined || originLng === undefined) return;
    const missing = events
      .filter(e => e.eventLocation && !geoCache.has(placeKey(e.eventLocation)))
      .slice(0, GEOCODE_CAP_PER_PASS);
    if (!missing.length) return;
    let alive = true;
    (async () => {
      for (const e of missing) {
        const key = placeKey(e.eventLocation!);
        if (geoCache.has(key)) continue;
        const hit = await geocode(e.eventLocation!).catch(() => null);
        geoCache.set(key, hit ? { lat: hit.latitude, lng: hit.longitude } : null);
        if (!alive) return;
      }
      if (alive) setGeoVersion(v => v + 1);
    })();
    return () => { alive = false; };
  }, [events, originLat, originLng]);

  return useMemo(() => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0); // today's morning events still count as upcoming
    const home = (myDomain || '').replace(/^www\./, '');
    const from = originLat !== undefined && originLng !== undefined
      ? { lat: originLat, lng: originLng }
      : null;
    return orderEvents(events, (e) => {
      const coord = e.eventLocation ? geoCache.get(placeKey(e.eventLocation)) || null : null;
      return {
        inMyDomain: !!home && (e.domain || '') === home,
        distanceMeters: from && coord ? distanceM(from, coord) : null,
        eventDateMs: e.eventDate && Number.isFinite(Date.parse(e.eventDate)) ? Date.parse(e.eventDate) : null,
      };
    }, dayStart.getTime());
  // eslint-disable-next-line react-hooks/exhaustive-deps -- geoVersion carries the cache's growth
  }, [events, originLat, originLng, myDomain, geoVersion]);
};
