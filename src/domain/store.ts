import type { Link, LinkRel } from './link';

// The persistence PORT — the backend-agnostic contract the core depends on. The core never
// imports Firestore; an adapter (src/adapters/firestore.ts) implements this. Swapping the
// adapter swaps the backend. Kept minimal; it grows as views adopt it (linksFrom, getEntity…).
export interface Store {
  // Read: edges pointing INTO an entity — e.g. a tree's circle members → the tree.
  linksTo(toId: string, rel?: LinkRel): Promise<Link[]>;
  // Write: create / remove an edge. The adapter persists it (today onto the legacy arrays;
  // after the data migration, into a links collection — the call sites never change).
  link(from: string, rel: LinkRel, to: string): Promise<void>;
  unlink(from: string, rel: LinkRel, to: string): Promise<void>;
}
