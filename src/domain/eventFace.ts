// THE FACE AN EVENT WEARS (ring 2026-09-16). A card shows the host's face — the community
// the event belongs to — never the community whose door the viewer stands at. An event names
// its place by `communityId` when it was born inside a community, else by the `domain` it was
// stamped with; a community given as a hint is the face only when it IS that place. Pure: the
// lookup of another place is the hook's (hooks/useEventCommunity).
//
// Plain contract — guaranteed: eventsOwnPlace is true only when the ids match, or, with no id
// on the event, when the domains match (case-insensitive); an event with neither id nor
// domain wears the hint (it has no other place to be). Not guaranteed: that the place exists.

export interface EventPlace { communityId?: string | null; domain?: string | null }
export interface PlaceLike { id: string; domain?: string | null }

const norm = (d?: string | null): string => (d || '').trim().toLowerCase().replace(/^www\./, '');

export const eventsOwnPlace = (event: EventPlace, place: PlaceLike | null | undefined): boolean => {
  if (!place) return false;
  if (event.communityId) return event.communityId === place.id;
  if (norm(event.domain)) return norm(event.domain) === norm(place.domain);
  return true;
};
