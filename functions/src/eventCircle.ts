// THE EVENT CIRCLE, server side — the pure half, with no Firestore in reach. MIRRORS
// src/domain/eventCircle.ts (held equal by tests/eventCircle.test.ts). circles.ts owns the
// plumbing: read the event, its participants and the hand's standing; let this law judge;
// write the circle, its members and its trees in one transaction.

export type EventCircleRefusal = 'event_circle_not_event' | 'event_circle_not_hand' | 'event_circle_already' | 'event_circle_no_participants';

export interface EventCircleFacts {
    isEvent: boolean;
    isHand: boolean;
    circleCommunityId?: unknown;
    participantTreeCount: number;
}

export const formEventCircleRefusal = (f: EventCircleFacts): EventCircleRefusal | null =>
    !f.isEvent ? 'event_circle_not_event'
    : !f.isHand ? 'event_circle_not_hand'
    : (typeof f.circleCommunityId === 'string' && f.circleCommunityId !== '') ? 'event_circle_already'
    : f.participantTreeCount < 1 ? 'event_circle_no_participants'
    : null;

export const eventCircleName = (chosen: string | null | undefined, eventTitle: unknown): string => {
    const c = String(chosen || '').trim().slice(0, 120);
    if (c) return c;
    const t = String(eventTitle || '').trim();
    return t ? `${t} Circle` : 'Circle';
};

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

export const eventCircleMemberUids = (formerUid: string, treeOwnerUids: readonly (string | null | undefined)[]): string[] =>
    Array.from(new Set([formerUid, ...treeOwnerUids.filter((u): u is string => typeof u === 'string' && u !== '')]));
