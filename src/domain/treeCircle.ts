import type { Stamp } from './time';

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
  createdAt: Stamp;
  updatedAt?: Stamp;
  acceptedAt?: Stamp;
  declinedAt?: Stamp;
  revokedAt?: Stamp;
}

// Relations live in the `links` collection (the LIN) — the single source of truth. The legacy
// per-role arrays (coOwnerIds/guardians/…) are no longer written or read, so the old
// role→array map has been removed.

// The circle's WORDS live in one home — src/utils/translations.ts (`role_*` keys, every
// language; the descriptions state exactly what the rules grant: carers care, the guardian
// witnesses and vetoes, the observer sees quietly). The domain holds only the REFERENCES:
// typed key builders, so a role added here without words there fails COMPILATION — the type
// system is the mirror test, and there is no copy anywhere to drift.
export const roleLabelKey = (role: TreeRelationRole) => `role_${role}` as const;
export const roleDescKey = (role: TreeRelationRole) => `role_${role}_desc` as const;

// A CIRCLE GRADUATES into a standing community by the hands that carry it: the keeper
// circle (ownerId + keeper links), or a co-owner of the ROOT TREE — the caring layer that
// formed the circle in the first place. Forming chooses a name, stamps provenance
// (bornOn = the garden where the root tree stands, formedAt/formedBy by the server's hand
// alone — the rules freeze both), and never mints a domain: an address is claimed later,
// through the Vision tab's own law. Forming grants no keepership — the circle's anchor
// stays who it was; a co-owner who forms still tends, not owns.
// The UI's one question: is this community still the pre-community stage? A circle wears
// its own mark (never the domain line it does not have) until the forming stamp lands.
export const isTreeCircle = (c: { formation?: string; formedAt?: unknown }): boolean =>
  c.formation === 'tree_co_ownership' && !c.formedAt;

export type FormCircleRefusal = 'not_circle' | 'already_formed' | 'not_hand';

export const formCircleRefusal = (facts: {
  formation?: string;
  formedAtMs: number | null;
  isCircleKeeper: boolean;
  isTreeCoOwner: boolean;
}): FormCircleRefusal | null =>
  facts.formation !== 'tree_co_ownership' ? 'not_circle'
    : facts.formedAtMs !== null ? 'already_formed'
      : facts.isCircleKeeper || facts.isTreeCoOwner ? null : 'not_hand';

// The trees a being TENDS through the circle's caring layer: its co_owner/steward links,
// one role per tree (co_owner outranks steward when both stand). Guardianship is the
// witnessing layer and stays its own prism; the founding owner needs no link at all —
// which is why an accepted invitation must surface HERE, not in the owned list.
export type TendingRole = 'co_owner' | 'steward';

export const tendedTreeRoles = (
  links: readonly { from: string; rel: string; to: string }[],
  uid: string,
): Map<string, TendingRole> => {
  const roles = new Map<string, TendingRole>();
  for (const l of links) {
    if (l.from !== uid) continue;
    if (l.rel !== 'co_owner' && l.rel !== 'steward') continue;
    if (l.rel === 'co_owner' || !roles.has(l.to)) roles.set(l.to, l.rel);
  }
  return roles;
};
