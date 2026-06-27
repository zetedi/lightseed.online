import type { Timestamp } from 'firebase/firestore';

// Tree Circle — communities form when people share care of a Lifetree.
// The tree is the living anchor; the circle (community) grows around shared care.

export type TreeRelationRole = 'owner' | 'co_owner' | 'guardian' | 'observer' | 'steward';
export type TreeRelationStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

// Roles that can be invited (everyone but the founding owner).
export type InvitableRole = Exclude<TreeRelationRole, 'owner'>;

export interface TreeOwnershipInvite {
  id: string;
  lifetreeId: string;
  lifetreeName?: string;        // denormalised so the invitee's inbox can read it
  invitedByUserId: string;
  invitedByName?: string;
  invitedUserId: string;
  role: InvitableRole;
  status: TreeRelationStatus;
  message?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  acceptedAt?: Timestamp;
  declinedAt?: Timestamp;
  revokedAt?: Timestamp;
}

// Relations live in the `links` collection (the LIN) — the single source of truth. The legacy
// per-role arrays (coOwnerIds/guardians/…) are no longer written or read, so the old
// role→array map has been removed.

export const treeRelationLabels: Record<TreeRelationRole, string> = {
  owner: 'Owner',
  co_owner: 'Co-guardian',
  guardian: 'Guardian',
  steward: 'Steward',
  observer: 'Observer',
};
