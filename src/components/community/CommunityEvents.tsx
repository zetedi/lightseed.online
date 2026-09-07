import React, { useCallback } from 'react';
import { Community, Pulse } from '../../types';
import { createCommunityEvent, getCommunityEvents, fetchEventPulses } from '../../services/firebase';
import { domainWideLevels, mergeAuthored } from '../../domain/pulseVisibility';
import { tabTone } from '../../utils/tabTheme';
import type { PulseVisibility } from '../../domain/pulse';
import { EventsSection, type EventDraft } from '../sections/EventsSection';

interface CommunityEventsProps {
  community: Community;
  canEdit: boolean;
  currentUserId?: string;
  // Author identity stamped onto newly created events.
  currentUserName?: string | null;
  currentUserPhoto?: string | null;
  // The visibility levels this viewer may query at community scope.
  communityLevels: PulseVisibility[];
  // This community IS the place the viewer stands in (the host of its domain): its Events tab
  // shows the domain's happenings too (ring 2026-09-07, domain/pulseVisibility).
  isHost?: boolean;
  onViewEvent?: (event: Pulse) => void;
}

// Events tab — a thin community binding over the entity-generic EventsSection: it supplies
// the community-scoped fetch/create, upload folder and theme accent; everything else is shared.
export const CommunityEvents: React.FC<CommunityEventsProps> = ({
  community,
  canEdit,
  currentUserId,
  currentUserName,
  currentUserPhoto,
  communityLevels,
  isHost = false,
  onViewEvent,
}) => {
  // Both bindings are memoized — EventsSection's refresh effect keys on loadEvents.
  // The host's tab folds in the first page of its domain's events (the door's node-level
  // happenings), deduplicated against the community's own, newest first.
  const loadEvents = useCallback(async () => {
    const own = await getCommunityEvents(community.id, communityLevels);
    if (!isHost || !community.domain) return own;
    const place = await fetchEventPulses(undefined, community.domain, domainWideLevels(communityLevels)).then(r => r.items).catch(() => [] as Pulse[]);
    return mergeAuthored(own, place, p => p.createdAt?.toMillis?.() || 0);
  }, [community.id, community.domain, communityLevels, isHost]);
  const handleCreate = useCallback(
    (draft: EventDraft) => createCommunityEvent(community, draft),
    [community],
  );

  return (
    <EventsSection
      scope="community"
      canEdit={canEdit}
      scopeOwnerId={community.ownerId}
      currentUserId={currentUserId}
      currentUserName={currentUserName}
      currentUserPhoto={currentUserPhoto}
      onViewEvent={onViewEvent}
      loadEvents={loadEvents}
      onCreate={handleCreate}
      uploadPathPrefix={`communities/${community.id}/events`}
      fallbackAuthorName="Community Admin"
      placeholderColor={community.theme?.primary || tabTone('communities')}
    />
  );
};
