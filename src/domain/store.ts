import type { Link, LinkRel } from './link';

// The persistence PORT — the backend-agnostic contract the core depends on. The core never
// imports Firestore; an adapter (src/adapters/firestore.ts) implements this. Swapping the
// adapter swaps the backend. Kept minimal; it grows as views adopt it (linksFrom, getEntity…).
export interface Store {
  // Read: edges pointing INTO an entity — e.g. a tree's circle members → the tree.
  linksTo(toId: string, rel?: LinkRel): Promise<Link[]>;
  // Read: edges pointing OUT of an actor — e.g. the trees a user guards.
  linksFrom(from: string, rel?: LinkRel): Promise<Link[]>;
  // Read: every edge of a relation across the network — e.g. all 'guardian' edges (for counts).
  linksByRel(rel: LinkRel): Promise<Link[]>;
  // Write: create / remove an edge. The adapter persists it into the `links` collection
  // (the LIN as data) — swap the adapter and the call sites never change. `extra` carries
  // the edge's optional provenance (inviteId) or energy (weight).
  link(from: string, rel: LinkRel, to: string, extra?: Pick<Link, 'inviteId' | 'weight'>): Promise<void>;
  unlink(from: string, rel: LinkRel, to: string): Promise<void>;
}
