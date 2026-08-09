import React, { useCallback } from 'react';
import { Pulse } from '../../types';
import { createEvent, getMyEvents } from '../../services/firebase';
import { EventsSection, type EventDraft } from '../sections/EventsSection';

interface ProfileEventsProps {
  uid: string;
  // Author identity stamped onto events created here.
  name?: string | null;
  photo?: string | null;
  onViewEvent?: (event: Pulse) => void;
}

// My Events tab: every event this being has planted — at every visibility, on every domain, and
// whether or not a community formed around it. The feeds can only ever ask for the levels a
// VIEWER may query, so this is the one surface where an author's own node- or private-visibility
// event is certain to be. A thin personal binding over the entity-generic EventsSection, exactly
// as CommunityEvents is its community twin; creation goes through createEvent (standalone), so an
// event planted here belongs to no community until one gathers around it.
export const ProfileEvents: React.FC<ProfileEventsProps> = ({ uid, name, photo, onViewEvent }) => {
  // Both bindings are memoized — EventsSection's refresh effect keys on loadEvents.
  const loadEvents = useCallback(() => getMyEvents(uid), [uid]);
  const handleCreate = useCallback((draft: EventDraft) => createEvent(draft), []);

  return (
    <EventsSection
      scope="personal"
      canEdit
      scopeOwnerId={uid}
      currentUserId={uid}
      currentUserName={name}
      currentUserPhoto={photo}
      onViewEvent={onViewEvent}
      loadEvents={loadEvents}
      onCreate={handleCreate}
      // users/{uid}/** is the one folder storage rules let a being write to (storage.rules).
      uploadPathPrefix={`users/${uid}/events`}
      fallbackAuthorName="Soul"
    />
  );
};
