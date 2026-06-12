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

// Which Lifetree array a role maps to. 'guardian' reuses the existing `guardians`
// field so the new flow and the legacy guardianship stay in sync.
export const roleToTreeField: Record<InvitableRole, 'coOwnerIds' | 'guardians' | 'observerIds' | 'stewardIds'> = {
  co_owner: 'coOwnerIds',
  guardian: 'guardians',
  observer: 'observerIds',
  steward: 'stewardIds',
};

export const treeRelationLabels: Record<TreeRelationRole, string> = {
  owner: 'Owner',
  co_owner: 'Co-guardian',
  guardian: 'Guardian',
  steward: 'Steward',
  observer: 'Observer',
};
