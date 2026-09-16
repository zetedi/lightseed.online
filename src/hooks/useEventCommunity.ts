import { useEffect, useState } from 'react';
import type { Community, Pulse } from '../types';
import { eventsOwnPlace } from '../domain/eventFace';
import { getCommunityById, getCommunityByDomain } from '../services/firebase';

// THE FACE AN EVENT WEARS, resolved (ring 2026-09-16; law: domain/eventFace). The hint is the
// community the caller already holds (the host, the place being viewed); it is the face only
// when the event belongs to it. Otherwise the event's own place is read once — by id, else by
// its domain stamp — and remembered for every card that asks again.
const remembered = new Map<string, Promise<Community | null>>();
const readPlace = (event: Pick<Pulse, 'communityId' | 'domain'>): Promise<Community | null> | null => {
  const key = event.communityId ? `id:${event.communityId}` : event.domain ? `domain:${event.domain.toLowerCase()}` : null;
  if (!key) return null;
  let p = remembered.get(key);
  if (!p) {
    p = (event.communityId ? getCommunityById(event.communityId) : getCommunityByDomain(event.domain!)).catch(() => null);
    remembered.set(key, p);
  }
  return p;
};

export function useEventCommunity(event: Pick<Pulse, 'communityId' | 'domain'>, hint?: Community | null): Community | null {
  const { communityId, domain } = event;
  const own = eventsOwnPlace({ communityId, domain }, hint) ? (hint ?? null) : null;
  const [read, setRead] = useState<Community | null>(null);
  useEffect(() => {
    if (own) return;
    const p = readPlace({ communityId, domain });
    if (!p) return;
    let alive = true;
    p.then((c) => { if (alive) setRead(c); });
    return () => { alive = false; };
  }, [own, communityId, domain]);
  return own ?? read;
}
