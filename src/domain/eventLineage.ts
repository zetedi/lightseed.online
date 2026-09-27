// THE LINEAGE OF A GATHERING (ring 2026-09-27). Zoltán: "The chain of the event would be its
// duplication / repetition, so the event would grow in refinement, lineage, reach maybe." A
// gathering's story is not a hash chain — an event is a living record its host keeps editing,
// and a seal over a parent would break at the parent's first edit — but a TREE of `descends_from`
// links, each copy naming the occurrence it was copied from: one root, many stems (the Pando
// shape), forks welcome. Everything a lineage says is DERIVED from those edges, never stored:
// lineage (the path back to the root, its length the generation), refinement (what this host
// changed against the parent), reach (how wide the tree grew, how many places and hosts).
//
// Plain contract — GUARANTEED: the edge is minted only by functions/duplicateEvent (the rules
// refuse it to every client hand, staff included) and never deleted; the cached fields on a copy
// (descendsFromId, lineageRootId, generation) are the server's reading of the edge at birth.
// NOT GUARANTEED: that a lineage is one gathering "in spirit" — a host may copy anything they
// may edit; the lineage records the act of copying, and the reader judges the kinship.

export interface LineageNode {
  id: string;
  descendsFromId?: string | null;
  lineageRootId?: string | null;
  generation?: number | null;
  domain?: string | null;
  authorId?: string | null;
}

// The root of a node's lineage: what its cache names, else itself (a root, or a pre-lineage event).
export const lineageRootOf = (n: Pick<LineageNode, 'id' | 'lineageRootId'>): string =>
  typeof n.lineageRootId === 'string' && n.lineageRootId ? n.lineageRootId : n.id;

// The cached reading a copy is born with, from its parent's.
export const lineageOfCopy = (parent: Pick<LineageNode, 'id' | 'lineageRootId' | 'generation'>): { descendsFromId: string; lineageRootId: string; generation: number } => ({
  descendsFromId: parent.id,
  lineageRootId: lineageRootOf(parent),
  generation: (Number(parent.generation) || 0) + 1,
});

// The fields a host refines between occurrences (the event's own words and frame).
export const REFINABLE_EVENT_FIELDS = ['title', 'body', 'content', 'imageUrl', 'imageUrls', 'eventDate', 'eventLocation', 'eventMaxParticipants', 'visibility'] as const;

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// What this occurrence changed against its parent — the refinement, as field names.
export const refinementOf = (parent: Record<string, unknown>, child: Record<string, unknown>): string[] =>
  REFINABLE_EVENT_FIELDS.filter(f => !same(parent[f], child[f]));

export interface LineageReach {
  occurrences: number;   // every node of the tree, the root included
  depth: number;         // the longest path from the root, in hands
  branches: number;      // the widest fork: the most copies any one occurrence has
  places: number;        // distinct domains the gatherings stood on
  hosts: number;         // distinct hands that hosted an occurrence
}

// The reach of a lineage, from its nodes alone (children counted by descendsFromId).
export function lineageReach(nodes: readonly LineageNode[]): LineageReach {
  const children = new Map<string, number>();
  for (const n of nodes) if (n.descendsFromId) children.set(n.descendsFromId, (children.get(n.descendsFromId) || 0) + 1);
  return {
    occurrences: nodes.length,
    depth: nodes.reduce((m, n) => Math.max(m, Number(n.generation) || 0), 0),
    branches: Math.max(0, ...children.values()),
    places: new Set(nodes.map(n => (n.domain || '').trim().toLowerCase()).filter(Boolean)).size,
    hosts: new Set(nodes.map(n => n.authorId || '').filter(Boolean)).size,
  };
}
