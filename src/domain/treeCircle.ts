import type { Stamp } from './time';

// Tree Circle — communities form when people share the keeping of a Lifetree.
// The tree is the living anchor; the circle (community) grows around shared care.

// A tree is KEPT, not owned (ring 2026-09-29): its keepers are equal — the hand that planted it
// (anchorUid, the anchor in the data, named only by the history) and every keeper link since.
export type TreeRelationRole = 'keeper' | 'guardian' | 'observer' | 'steward';
export type TreeRelationStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

// Every role is invited — keeping included (a keeper offers keeping; the invitee confirms).
export type InvitableRole = TreeRelationRole;

export interface TreeKeepingInvite {
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
  // THE OPEN DOOR (ring 2026-10-01; domain/treeInvite): born with no invitee, claimed once by the
  // first signed-in hand to arrive through its link; `open` turns false and `claimedAt` is stamped.
  open?: boolean;
  claimedAt?: Stamp;
  expiresAt?: Stamp | null;
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
// circle (anchorUid + keeper links), or a keeper of the ROOT TREE — the caring layer that
// formed the circle in the first place. Forming chooses a name, stamps provenance
// (bornOn = the garden where the root tree stands, formedAt/formedBy by the server's hand
// alone — the rules freeze both), and never mints a domain: an address is claimed later,
// through the Vision tab's own law. Forming grants no keepership — the circle's anchor
// stays who it was; a keeper who forms still tends, not owns.
// The UI's one question: is this community still the pre-community stage? A circle wears
// its own mark (never the domain line it does not have) until the forming stamp lands.
export const isTreeCircle = (c: { formation?: string; formedAt?: unknown }): boolean =>
  c.formation === 'tree_keeping' && !c.formedAt;

export type FormCircleRefusal = 'not_circle' | 'already_formed' | 'not_hand';

export const formCircleRefusal = (facts: {
  formation?: string;
  formedAtMs: number | null;
  isCircleKeeper: boolean;
  isTreeKeeper: boolean;
}): FormCircleRefusal | null =>
  facts.formation !== 'tree_keeping' ? 'not_circle'
    : facts.formedAtMs !== null ? 'already_formed'
      : facts.isCircleKeeper || facts.isTreeKeeper ? null : 'not_hand';

// The trees a being TENDS through the circle's caring layer: its keeper/steward links,
// one role per tree (keeper outranks steward when both stand). Guardianship is the
// witnessing layer and stays its own prism; the anchor keeper needs no link at all —
// which is why an accepted invitation must surface HERE, not in the planted list.
export type TendingRole = 'keeper' | 'steward';

export const tendedTreeRoles = (
  links: readonly { from: string; rel: string; to: string }[],
  uid: string,
): Map<string, TendingRole> => {
  const roles = new Map<string, TendingRole>();
  for (const l of links) {
    if (l.from !== uid) continue;
    if (l.rel !== 'keeper' && l.rel !== 'steward') continue;
    if (l.rel === 'keeper' || !roles.has(l.to)) roles.set(l.to, l.rel);
  }
  return roles;
};
