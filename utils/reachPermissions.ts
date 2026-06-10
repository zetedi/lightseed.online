import type { Lifetree } from '../types';
import { isExplicitlyValidatedTree } from './validation';

// Minimal shape of the owner's user profile we care about for contact privacy.
// There is no central UserProfile type yet, so we keep this partial and local.
export interface ReachTargetProfile {
  onlyValidatedCanReach?: boolean;
}

export const buildThreadId = (treeIdA: string, treeIdB: string) =>
  [treeIdA, treeIdB].sort().join('__');

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
