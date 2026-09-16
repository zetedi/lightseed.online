import { useState, useEffect, useRef } from 'react';
import type { Community, Lightseed, Pulse } from '../types';
import { fetchEventPulses } from '../services/firebase';
import { eventFeedScope, eventsOnView } from '../domain/pulseVisibility';
import { useRefreshSignal } from './useRefreshSignal';

// THE HERO'S EVENTS (ring 2026-09-16, lifted out of App.tsx unchanged). Events for the
// logged-in home carousel — visibility-scoped to this viewer + place. Re-fetches on the
// 'events' bus signal, so an edit/create/delete anywhere shows up in the banner too.
export function useHeroEvents(params: {
  hostCommunityResolved: boolean;
  authLoading: boolean;
  lightseed: Lightseed | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  activeCommunity: Community | null;
  activeDataDomain: string | undefined;
}): Pulse[] {
  const { hostCommunityResolved, authLoading, lightseed, isSuperAdmin, isAdmin, activeCommunity, activeDataDomain } = params;
  const [dashboardEvents, setDashboardEvents] = useState<Pulse[]>([]);
  const eventsRefresh = useRefreshSignal(['events']);
  const heroEventsSeq = useRef(0);
  useEffect(() => {
    // The hero events box shows THE SAME events as the events menu: one derivation
    // (domain/pulseVisibility eventFeedScope — the banner once leaked a lightseed event
    // onto Per Auset because it carried its own hand-copy of this law), one viewer cut
    // (eventsOnView: visitors see the node's own happenings; past days rest hidden), and
    // one ORDER (useOrderedEvents in the shell — the banner is the same list's first reach).
    // It waits for the ground it stands on: until the host community has answered, its
    // strictness is unknown and the creator-never-lost merge would fold the viewer's own
    // events from EVERY domain into a strict face's hero for a breath (Per Auset,
    // 2026-09-03) — and only the newest fetch may land.
    if (!hostCommunityResolved || authLoading) return;
    const seq = ++heroEventsSeq.current;
    const { levels, ownerUid } = eventFeedScope(
      { uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin },
      { reflectsPublic: activeCommunity?.reflectsPublic, strictScope: activeCommunity?.strictScope },
    );
    fetchEventPulses(undefined, activeDataDomain, levels, ownerUid)
      .then(r => { if (seq === heroEventsSeq.current) setDashboardEvents(eventsOnView(r.items, { signedIn: !!lightseed, showPast: false, nowMs: Date.now() })); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on uid + host scope + bus signal; the lightseed object changes identity without uid changing
  }, [lightseed?.uid, isSuperAdmin, isAdmin, eventsRefresh, activeDataDomain, activeCommunity?.reflectsPublic, activeCommunity?.strictScope, hostCommunityResolved, authLoading]);
  return dashboardEvents;
}
