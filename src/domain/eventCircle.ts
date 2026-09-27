import type { DomainKey } from './words';

// THE EVENT CIRCLE (ring 2026-09-27) — a community formed from the trees that stood around an
// event. The same door a tree circle walks (domain/treeCircle → formCommunityFromCircle), from a
// different root: a tree circle grows from shared CARE of one tree, an event circle from shared
// PRESENCE at one gathering. Both are pre-communities born by the server's hand with no
// address of their own (domain ''), their locus the being they grew from (rootLifetreeId /
// rootEventId), their members the beings whose trees stood there.
//
// Plain contract — GUARANTEED (functions/formCircleFromEvent, mirrored law, tests/eventCircle):
// only the event's own hand forms it (its author, its community's keeper, or staff); once per
// event (the event remembers its circle: circleCommunityId, a field no client may write — the
// event-edit rules name their keys); never from an empty gathering; every participating tree's
// owner and the former become members (member links, server-minted), and the trees themselves
// stand in the circle (participant links). NOT GUARANTEED: that the participants WANTED a
// circle — membership here is a gift the former makes, and the door stays 'invite' so no one
// else walks in unasked; a member may leave as from any community. The circle counts toward
// the node's 144 (it is founded, not auto-born like a tree circle).

export type EventCircleRefusal = Extract<DomainKey,
  'event_circle_not_event' | 'event_circle_not_hand' | 'event_circle_already' | 'event_circle_no_participants'>;

export interface EventCircleFacts {
  isEvent: boolean;
  isHand: boolean;            // author, keeper of the event's community, or staff
  circleCommunityId?: unknown; // already formed when a string stands here
  participantTreeCount: number;
}

// The whole law, in the order the server applies it.
export const formEventCircleRefusal = (f: EventCircleFacts): EventCircleRefusal | null =>
  !f.isEvent ? 'event_circle_not_event'
  : !f.isHand ? 'event_circle_not_hand'
  : (typeof f.circleCommunityId === 'string' && f.circleCommunityId !== '') ? 'event_circle_already'
  : f.participantTreeCount < 1 ? 'event_circle_no_participants'
  : null;

// The circle's name: the chosen one, else the event's title with the word Circle.
export const eventCircleName = (chosen: string | null | undefined, eventTitle: unknown): string => {
  const c = String(chosen || '').trim().slice(0, 120);
  if (c) return c;
  const t = String(eventTitle || '').trim();
  return t ? `${t} Circle` : 'Circle';
};

// The community record the server writes — the tree circle's shape, rooted in an event.
export interface EventCircleDraft {
  name: string;
  rootEventId: string;
  founderUserId: string;
  ownerId: string;
  formation: 'event';
  visibility: 'invited';
  domain: '';
  bornOn: string;
  papers: never[];
  imageUrls: string[];
}

export const eventCircleDraft = (p: {
  eventId: string; eventTitle: unknown; eventDomain: unknown; eventImageUrl?: unknown;
  formerUid: string; name?: string | null;
}): EventCircleDraft => ({
  name: eventCircleName(p.name, p.eventTitle),
  rootEventId: p.eventId,
  founderUserId: p.formerUid,
  ownerId: p.formerUid,
  formation: 'event',
  visibility: 'invited',
  domain: '',
  bornOn: String(p.eventDomain || '').trim().toLowerCase().replace(/^www\./, ''),
  papers: [],
  imageUrls: typeof p.eventImageUrl === 'string' && p.eventImageUrl ? [p.eventImageUrl] : [],
});

// Who becomes a member: the former, and the owner of every participating tree — each once.
export const eventCircleMemberUids = (formerUid: string, treeOwnerUids: readonly (string | null | undefined)[]): string[] =>
  Array.from(new Set([formerUid, ...treeOwnerUids.filter((u): u is string => typeof u === 'string' && u !== '')]));
