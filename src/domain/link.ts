import type { Being } from './being';

// A relationship is itself an Being: a directed edge between two LIDs. The network (LIN) is
// the living graph these links form, persisted in the `links` collection — the single source
// of truth for relations (see src/adapters/firestore.ts and memory/lid-lin-entity).
// 'participant' is the one edge whose `from` is a LIFETREE (not a uid): a tree the owner has
// enlisted in an event or vision. Every other rel points a person at a target.
// 'join_request' is a person asking to become a community member — the owner or a steward
// accepting it replaces the edge with a 'member' link (see domain/communityDoor for the door).
// 'rooted': a SANCTUARY rooted in a lifetree — the tree that holds it becomes a MOTHER
// TREE. A sanctuary is never built before a tree is planted.
// 'shelters': a SANCTUARY shelters a community — belonging as an edge, never an array.
// 'invited_by': provenance — HOW someone arrived into a community (newcomer → community; the
// inviter is the carried invitation's createdBy, via inviteId). Per-community, so arriving in
// two places leaves two marks. Append-only (the rules refuse even its subject's delete) and
// grants nothing (no rule reads it); admitted only with a real keeper-minted invitation. It is
// deliberately NOT guardianship: power over a being flows from that being's keeper's later
// choice, never from the door itself (guardians hold veto standing).
export type LinkRel = 'guardian' | 'co_owner' | 'steward' | 'observer' | 'member' | 'joined' | 'participant' | 'join_request' | 'rooted' | 'shelters' | 'invited_by';

export interface Link extends Being {
  type: 'link';
  rel: LinkRel;
  from: string;    // the actor's id (uid) — or, for 'participant', the lifetree's id
  to: string;      // the target entity's id (lifetree / community / vision / event)
  weight?: number; // attention / heat — the energy carried on the edge
  // The invitation that carried this edge through the door ('member' minted via an invite,
  // and every 'invited_by' mark) — the rules get() this doc to verify the claim.
  inviteId?: string;
}

// Deterministic id so rules can exists()-check an edge without a query, and writes are idempotent.
export const linkId = (from: string, rel: LinkRel, to: string) => `${from}__${rel}__${to}`;
