import type { Entity } from './entity';

// A relationship is itself an Entity: a directed edge between two LIDs. The network (LIN) is
// the living graph these links form. Scaffolding only — the `links` collection + service is
// the deferred Phase 2 (see memory/lid-lin-entity); nothing reads/writes links yet.
// 'participant' is the one edge whose `from` is a LIFETREE (not a uid): a tree the owner has
// enlisted in an event or vision. Every other rel points a person at a target.
export type LinkRel = 'guardian' | 'co_owner' | 'steward' | 'observer' | 'member' | 'joined' | 'participant';

export interface Link extends Entity {
  type: 'link';
  rel: LinkRel;
  from: string;    // the actor's id (uid) — or, for 'participant', the lifetree's id
  to: string;      // the target entity's id (lifetree / community / vision / event)
  weight?: number; // attention / heat — the energy carried on the edge
}

// Deterministic id so rules can exists()-check an edge without a query, and writes are idempotent.
export const linkId = (from: string, rel: LinkRel, to: string) => `${from}__${rel}__${to}`;
