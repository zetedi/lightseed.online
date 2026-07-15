// The DOOR — who may join a community, and how. Distinct from `visibility` (who may SEE):
// a community can be publicly visible with a closed door, or quietly visible with an open one.
//
//   open    — founding season: any signed-in being may step in (self-minted member link).
//   invite  — grown: knock (join_request, accepted by keeper or steward) or arrive with an
//             invitation link, which also leaves the append-only 'invited_by' provenance mark.
//   closed  — resting: the public door admits no one — no knocks, and even invitations wait.
//             (A keeper may still bring someone in by hand; closing rests the door, not the deed.)
//
// Three truths stay separate on purpose: the invitation records HOW YOU ARRIVED (provenance,
// grants nothing), guardianship is WHO CHOSE TO WATCH OVER YOU (chosen after arrival, never
// auto-granted through the door — guardians hold veto standing), and validation is ARE YOU
// ALIVE (earned only by a real tend). The door never substitutes for any of them.

export type CommunityDoor = 'open' | 'invite' | 'closed';

// Absent/unknown door = 'invite': exactly the behaviour every community had before the door
// existed (knock, and a keeper accepts). Legacy docs need no migration.
export const DEFAULT_DOOR: CommunityDoor = 'invite';

export const doorOf = (community?: { door?: string | null } | null): CommunityDoor =>
  community?.door === 'open' || community?.door === 'closed' ? community.door : DEFAULT_DOOR;

// What the UI offers a signed-in non-member standing at the door.
export type JoinAffordance = 'join' | 'request' | 'none';

export const joinAffordance = (door: CommunityDoor): JoinAffordance =>
  door === 'open' ? 'join' : door === 'invite' ? 'request' : 'none';

// A node's door also governs SIGN-UP on its domain: an open door means anyone may create an
// account here (identity open — delegated to the keeper who opened it), so a person can sign up
// and experience the community in one motion; any other state keeps sign-up invitation-gated
// (today's default). Only the HOST community (the one owning the current domain) gates sign-up;
// inner communities' doors govern joining only. Absent door = invite-gated, so nothing opens by
// accident. This is what turns two gates (superadmin invites + keeper memberships) into one — the
// keeper's door.
export const signupRequiresInvite = (community?: { door?: string | null } | null): boolean =>
  doorOf(community) !== 'open';

// An invitation as the domain sees it — times in ms so the module stays pure of Firestore.
export interface CommunityInviteCheck {
  communityId: string;
  createdBy: string;
  revokedAtMs?: number | null;
  expiresAtMs?: number | null;
}

export type InviteVerdict =
  | { usable: true }
  | { usable: false; reason: 'wrong_community' | 'revoked' | 'expired' | 'door_closed' };

// May this invitation open this community's door right now? Mirrors the security rules:
// the invitation must belong to the community, be unrevoked and unexpired — and even a
// valid invitation waits while the door is closed (closing the door closes ALL ways in).
export const checkInvite = (
  invite: CommunityInviteCheck,
  communityId: string,
  door: CommunityDoor,
  nowMs: number,
): InviteVerdict => {
  if (invite.communityId !== communityId) return { usable: false, reason: 'wrong_community' };
  if (invite.revokedAtMs != null) return { usable: false, reason: 'revoked' };
  if (invite.expiresAtMs != null && invite.expiresAtMs <= nowMs) return { usable: false, reason: 'expired' };
  if (door === 'closed') return { usable: false, reason: 'door_closed' };
  return { usable: true };
};

// A community invitation as persisted (`communityInvites` collection). The doc id is an
// unguessable Firestore auto-id (the networkInvites precedent): holding the link IS the key.
// Append-only in spirit: revocation is a mark (revokedAt), never a delete.
export interface CommunityInvite {
  id: string;
  communityId: string;
  createdBy: string;                                   // uid of the keeper/steward who minted it
  createdAt: import('firebase/firestore').Timestamp;
  expiresAt?: import('firebase/firestore').Timestamp | null;
  revokedAt?: import('firebase/firestore').Timestamp | null;
  label?: string;                                      // e.g. "market day poster", "Anna's batch"
}

// An invitation's standing at a glance — the same three states the rules enforce, as one pure
// function so the UI never re-derives them. Times in ms to keep the module free of Firestore.
export type InviteStatus = 'live' | 'revoked' | 'expired';

export const inviteStatus = (
  invite: { revokedAtMs?: number | null; expiresAtMs?: number | null },
  nowMs: number,
): InviteStatus => {
  if (invite.revokedAtMs != null) return 'revoked';
  if (invite.expiresAtMs != null && invite.expiresAtMs <= nowMs) return 'expired';
  return 'live';
};

// The shareable door link — /i/<id> beside the /b/<lid> being door. The id is an
// unguessable Firestore auto-id (the networkInvites precedent): holding the link IS the key.
export const communityInviteUrl = (origin: string, inviteId: string): string =>
  `${origin.replace(/\/+$/, '')}/i/${inviteId}`;

export const inviteIdFromPath = (pathname: string): string | null => {
  const m = /^\/i\/([A-Za-z0-9_-]{10,})\/?$/.exec(pathname);
  return m ? m[1] : null;
};
