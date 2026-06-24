import type { Lifetree } from '../types';
import type { ReachAudience } from '../src/domain/reach';
import { isExplicitlyValidatedTree } from './validation';

// Minimal shape of the owner's user profile we care about for contact privacy.
// There is no central UserProfile type yet, so we keep this partial and local.
export interface ReachTargetProfile {
  onlyValidatedCanReach?: boolean;
}

export const buildThreadId = (treeIdA: string, treeIdB: string) =>
  [treeIdA, treeIdB].sort().join('__');

export const reachAudienceLabels: Record<ReachAudience, string> = {
  owners: 'Owners',
  guardians: 'Guardians',
  everyone: 'Everyone',
};

// The set of user ids a group reach reaches, by audience. Audiences nest: 'guardians'
// includes the owners; 'everyone' includes the guardians. The owner is always part of
// every audience, so a tree's principal is never blind to messages about their own tree.
export const getCircleUids = (tree: Lifetree, audience: ReachAudience): string[] => {
  const owner = tree.ownerId ? [tree.ownerId] : [];
  const coOwners = tree.coOwnerIds || [];
  const guardians = tree.guardians || [];
  const stewards = tree.stewardIds || [];
  const observers = tree.observerIds || [];
  const ids =
    audience === 'owners' ? [...owner, ...coOwners]
    : audience === 'guardians' ? [...owner, ...coOwners, ...guardians]
    : [...owner, ...coOwners, ...guardians, ...stewards, ...observers];
  return Array.from(new Set(ids.filter(Boolean)));
};

// Deterministic id for a group reach thread. A member messaging the same audience of the
// same tree always lands in the same shared thread; it is per-initiator, so two different
// members each get their own private thread with that circle (no stranger cross-talk).
export const buildGroupThreadId = (treeId: string, audience: ReachAudience, initiatorUid: string) =>
  ['grp', treeId, audience, initiatorUid].join('__');

// Whether the current user may send a direct message (reach) to `targetTree`.
//
// A target tree is "protected" when its owner has onlyValidatedCanReach === true.
// - Unprotected targets are always reachable (the send flow still asks the sender
//   to pick an active tree if they have none).
// - Protected targets only accept reaches from a sender who is contacting
//   themselves, is an admin/super admin, or has an explicitly validated active tree.
export const canReachTree = ({
  targetTree,
  targetUserProfile,
  myActiveTree,
  currentUserId,
  isAdmin,
  isSuperAdmin,
}: {
  targetTree: Lifetree;
  targetUserProfile?: ReachTargetProfile | null;
  myActiveTree: Lifetree | null;
  currentUserId?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}): boolean => {
  const protectedTarget = targetUserProfile?.onlyValidatedCanReach === true;
  if (!protectedTarget) return true;

  if (!currentUserId) return false;
  // Contacting yourself is always allowed.
  if (targetTree?.ownerId && targetTree.ownerId === currentUserId) return true;
  if (isAdmin || isSuperAdmin) return true;

  return Boolean(myActiveTree && isExplicitlyValidatedTree(myActiveTree));
};
