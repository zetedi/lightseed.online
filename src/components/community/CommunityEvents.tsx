import React, { useCallback } from 'react';
import { Community, Pulse } from '../../types';
import { createCommunityEvent, getCommunityEvents } from '../../services/firebase';
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
  onViewEvent,
}) => {
  // Both bindings are memoized — EventsSection's refresh effect keys on loadEvents.
  const loadEvents = useCallback(
    () => getCommunityEvents(community.id, communityLevels),
    [community.id, communityLevels],
  );
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
