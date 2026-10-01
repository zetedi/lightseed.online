import type { DomainKey } from './words';

// THE OPEN DOOR TO A TREE'S CIRCLE (ring 2026-10-01). A tree-circle invitation was always a document
// addressed to an account that already exists; a friend who is not here yet could not be found, let
// alone invited. An OPEN invitation is the same document born with no invitee: an unguessable id
// (holding the link IS the key, as with a community invitation), a role, a tree, the inviter — and
// the FIRST signed-in hand to arrive through /i/<id> CLAIMS it, writing their own uid into the
// invitee seat, once. From there it is an ordinary invitation: accepted by the server's hand
// (acceptTreeInvite, which still asks a guardian to hold a living tree — the law of 2026-09-09 is
// untouched: the door brings the friend in and roots them; it does not hollow the guard).
//
// Plain contract — guaranteed: treeInviteClaimRefusal names why a hand may not claim (or null);
// the rules enforce the same shape at write time (one claim, by a signed-in hand that is not the
// inviter, on an open pending invitation); the url is /i/<id>, beside the community door, and the
// arrival tries the community ledger first, then this one. Not guaranteed: that the claimant will
// be allowed to ACCEPT (a guardian without a living tree is told to plant first — the invitation
// waits under their profile); that an open invitation is ever claimed (a keeper may revoke it).

export interface OpenTreeInviteFacts {
  exists: boolean;
  open?: unknown;            // true while unclaimed
  status?: unknown;          // 'pending' while it waits
  invitedUserId?: unknown;   // '' while open; the claimant's uid after
  invitedByUserId: string;
  revokedAtMs?: number | null;
  expiresAtMs?: number | null;
  claimantUid: string;
  nowMs: number;
}

export const treeInviteClaimRefusal = (f: OpenTreeInviteFacts): DomainKey | null => {
  if (!f.exists) return 'tree_invite_gone';
  if (f.revokedAtMs != null || f.status === 'revoked') return 'tree_invite_revoked';
  if (f.expiresAtMs != null && f.expiresAtMs <= f.nowMs) return 'tree_invite_expired';
  if (f.status !== 'pending') return 'tree_invite_settled';
  if (f.open !== true || (typeof f.invitedUserId === 'string' && f.invitedUserId !== '')) return 'tree_invite_taken';
  if (!f.claimantUid) return 'tree_invite_signin';
  if (f.claimantUid === f.invitedByUserId) return 'tree_invite_own';
  return null;
};

// The shareable door — the same /i/ prefix as a community invitation; the arrival resolves which.
export const treeInviteUrl = (origin: string, inviteId: string): string =>
  `${origin.replace(/\/+$/, '')}/i/${inviteId}`;
