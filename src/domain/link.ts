import type { Being } from './being';

// A relationship is itself an Being: a directed edge between two LIDs. The network (LIN) is
// the living graph these links form, persisted in the `links` collection — the single source
// of truth for relations (see src/adapters/firestore.ts and memory/lid-lin-entity).
// 'participant' is the one edge whose `from` is a LIFETREE (not a uid): a tree the owner has
// enlisted in an event or vision. Every other rel points a person at a target.
export type LinkRel = 'guardian' | 'co_owner' | 'steward' | 'observer' | 'member' | 'joined' | 'participant';

export interface Link extends Being {
  type: 'link';
  rel: LinkRel;
  from: string;    // the actor's id (uid) — or, for 'participant', the lifetree's id
  to: string;      // the target entity's id (lifetree / community / vision / event)
  weight?: number; // attention / heat — the energy carried on the edge
}

// Deterministic id so rules can exists()-check an edge without a query, and writes are idempotent.
export const linkId = (from: string, rel: LinkRel, to: string) => `${from}__${rel}__${to}`;
