import { doc, getDoc } from 'firebase/firestore';
import { db } from './core';
import { graphStore } from '../../services/store';
import { walkEndsOf, type SubgraphEdge, type SubgraphNode, type WalkKind } from '../../domain/subgraph';

// THE GRAPH LOADER (ring 2026-08-25) — gathers the neighborhood the longitudinal walk
// (domain/subgraph) then measures. The RELS THEMSELVES name what stands at each end, so
// an edge's endpoints resolve without guessing collections. Beings this viewer may not
// read simply fail to resolve — and an unresolved being is OPAQUE to the walk: the rules'
// refusals become the walk's walls with no extra law here.
type BeingKind = WalkKind;

const COLLECTION: Record<BeingKind, string> = {
  person: 'persons', tree: 'lifetrees', community: 'communities',
  vision: 'visions', lightHouse: 'lightHouses', pulse: 'pulses',
};

export interface LoadedBeing extends SubgraphNode {
  name: string;
  lid?: string;
}

const resolveBeing = async (kind: BeingKind, id: string): Promise<LoadedBeing | null> => {
  const read = async (k: BeingKind) => {
    const snap = await getDoc(doc(db, COLLECTION[k], id));
    if (!snap.exists()) return null;
    const d = snap.data() as Record<string, unknown>;
    const anchorUid = k === 'person' ? id
      : (d.anchorUid as string) || (d.authorId as string) || null;
    const name = (d.name as string) || (d.title as string) || (d.displayName as string) || '';
    return { id, kind: k, anchorUid, name, lid: d.lid as string | undefined };
  };
  try {
    const first = await read(kind);
    if (first) return first;
    // participant's target may be an EVENT pulse rather than a vision.
    if (kind === 'vision') return await read('pulse');
    // a keeper's target may be a community rather than a tree.
    if (kind === 'tree') return await read('community');
    return null;
  } catch { return null; } // the rules refused — opaque, a wall by law
};

// Expand `rounds` link-hops around the start (a superset of any person-depth the walk
// will measure), capped so a dense commons cannot balloon a single page's reads.
export const loadSubgraphAround = async (
  start: LoadedBeing,
  opts?: { rounds?: number; cap?: number },
): Promise<{ nodes: SubgraphNode[]; edges: SubgraphEdge[]; display: Map<string, LoadedBeing> }> => {
  const rounds = opts?.rounds ?? 4;
  const cap = opts?.cap ?? 150;
  const display = new Map<string, LoadedBeing>([[start.id, start]]);
  const edges = new Map<string, SubgraphEdge>();
  let frontier = [start.id];
  const expanded = new Set<string>();

  for (let r = 0; r < rounds && frontier.length && display.size < cap; r++) {
    const next = new Set<string>();
    await Promise.all(frontier.map(async (id) => {
      if (expanded.has(id)) return;
      expanded.add(id);
      const [out, into] = await Promise.all([
        graphStore.linksFrom(id).catch(() => []),
        graphStore.linksTo(id).catch(() => []),
      ]);
      for (const l of [...out, ...into]) {
        const shape = walkEndsOf(l.rel);
        if (!shape) continue;
        edges.set(`${l.from}__${l.rel}__${l.to}`, { from: l.from, rel: l.rel, to: l.to });
        for (const [endId, endKind] of [[l.from, shape.from], [l.to, shape.to]] as const) {
          if (display.has(endId) || display.size >= cap) continue;
          const being = await resolveBeing(endKind, endId);
          if (being) { display.set(endId, being); next.add(endId); }
        }
      }
    }));
    frontier = [...next];
  }
  return { nodes: [...display.values()], edges: [...edges.values()], display };
};
