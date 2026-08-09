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

// The circle's WORDS live in one home — src/utils/translations.ts (`role_*` keys, every
// language; the descriptions state exactly what the rules grant: tenders tend, the guardian
// witnesses and vetoes, the observer sees quietly). The domain holds only the REFERENCES:
// typed key builders, so a role added here without words there fails COMPILATION — the type
// system is the mirror test, and there is no copy anywhere to drift.
export const roleLabelKey = (role: TreeRelationRole) => `role_${role}` as const;
export const roleDescKey = (role: TreeRelationRole) => `role_${role}_desc` as const;
