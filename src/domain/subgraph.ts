// THE LONGITUDINAL WALK (ring 2026-08-25) — knowing a being by walking its edges.
// A being's meaning is not in its document but in the subgraph around it: the visions it
// points toward, the gardens it stands in, the people those touch. The walk is RECURSIVE
// and BOUNDED — and the bound is Zoltán's sharp insight: depth counts PERSON-CROSSINGS,
// not records. Your own cluster — every tree, vision, offering of one owner — is distance
// 0, however many beings it holds; stepping onto ANOTHER person's being costs 1. "Not the
// same person's trees, but the tree of his next person." Depth becomes social distance.
//
// Mechanically this is 0-1 BFS over beings: same-owner edges cost 0, crossing edges cost
// 1; a deque keeps the frontier ordered so every being is reached at its MINIMUM person
// distance. Acyclic by a visited set; cycles terminate; two routes to one being keep the
// nearer person-distance.
//
// VISIBILITY IS A WALL, NOT A WINDOW: the injected canSee filter makes an unseen being
// OPAQUE — neither visited nor traversed THROUGH. Otherwise depth would become a privacy
// leak wearing philosophy: a private being quietly bridging two strangers' worlds.
//
// Plain contract — guaranteed: pure (data in, data out; no Firestore, no fetch), distances
// are minimal person-crossing counts, unseen beings block the path entirely, ownerless
// beings are conservative (each its own person — crossing to one always costs 1). Not
// guaranteed: WHO may run a walk and what a distance ENTITLES anyone to (reach-through-
// connections is a later rung with its own consent law). Enforced by: tests/subgraph.test.ts.

export interface SubgraphNode {
  id: string;              // the being's id (any kind: tree, vision, community, offering…)
  kind: string;            // 'tree' | 'vision' | 'community' | 'pulse' | 'lightHouse' | …
  ownerUid?: string | null; // the person it belongs to; null/absent = ownerless (see contract)
}

export interface SubgraphEdge {
  from: string;
  rel: string;
  to: string;
}

export interface WalkedBeing extends SubgraphNode {
  distance: number;        // person-crossings from the start being's owner (0 = same owner)
  // The step that first reached this being at its minimal distance — parent pointers, so
  // a path (the reach-through-connections provenance of a later rung) can be rebuilt.
  via?: { beingId: string; rel: string };
}

export interface SubgraphWalk {
  beings: WalkedBeing[];   // every being reached within the budget, nearest first
  edges: SubgraphEdge[];   // every edge walked between included beings
}

// Walk outward from `startId` through `edges`, including beings up to `personDepth`
// person-crossings away. Nodes absent from `nodes` are unknown and opaque (never walked).
export function subgraphOf(
  startId: string,
  graph: { nodes: SubgraphNode[]; edges: SubgraphEdge[] },
  opts: { personDepth: number; canSee?: (node: SubgraphNode) => boolean },
): SubgraphWalk {
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const start = byId.get(startId);
  const canSee = opts.canSee || (() => true);
  if (!start || !canSee(start)) return { beings: [], edges: [] };

  // Adjacency, both directions — "what is this connected to" has no arrow.
  const adj = new Map<string, { other: string; rel: string }[]>();
  for (const e of graph.edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from)!.push({ other: e.to, rel: e.rel });
    adj.get(e.to)!.push({ other: e.from, rel: e.rel });
  }

  // Crossing cost: 0 inside one person's cluster; 1 onto another person's being.
  // An ownerless being is ALWAYS a crossing (conservative — see the contract).
  const crossCost = (a: SubgraphNode, b: SubgraphNode): 0 | 1 =>
    (a.ownerUid && b.ownerUid && a.ownerUid === b.ownerUid) ? 0 : 1;

  // 0-1 BFS: a deque where cost-0 steps go to the front, cost-1 to the back — every being
  // settles at its minimal person distance without a full priority queue.
  const dist = new Map<string, number>();
  const via = new Map<string, { beingId: string; rel: string }>();
  const settledEdges: SubgraphEdge[] = [];
  const deque: string[] = [startId];
  dist.set(startId, 0);

  while (deque.length) {
    const id = deque.shift()!;
    const node = byId.get(id)!;
    const d = dist.get(id)!;
    for (const { other, rel } of adj.get(id) || []) {
      const next = byId.get(other);
      if (!next || !canSee(next)) continue; // opaque: neither visited nor traversed through
      const nd = d + crossCost(node, next);
      if (nd > opts.personDepth) continue;
      const known = dist.get(other);
      if (known !== undefined && known <= nd) continue;
      dist.set(other, nd);
      via.set(other, { beingId: id, rel });
      if (nd === d) deque.unshift(other); else deque.push(other);
    }
  }

  const included = new Set(dist.keys());
  for (const e of graph.edges) {
    if (included.has(e.from) && included.has(e.to)) settledEdges.push(e);
  }
  const beings = [...dist.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([id, d]) => ({ ...byId.get(id)!, distance: d, ...(via.has(id) ? { via: via.get(id)! } : {}) }));
  return { beings, edges: settledEdges };
}

// Rebuild the path from the start to one walked being — the provenance a reach-through-
// connections knock will one day carry ("I found you through the Water Vision ← your olive").
export function pathTo(walk: SubgraphWalk, beingId: string): { beingId: string; rel?: string }[] {
  const byId = new Map(walk.beings.map(b => [b.id, b]));
  const path: { beingId: string; rel?: string }[] = [];
  let cur = byId.get(beingId);
  while (cur) {
    path.unshift({ beingId: cur.id, ...(cur.via ? { rel: cur.via.rel } : {}) });
    cur = cur.via ? byId.get(cur.via.beingId) : undefined;
  }
  return path;
}
