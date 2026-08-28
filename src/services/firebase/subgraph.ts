import { doc, getDoc } from 'firebase/firestore';
import { db } from './core';
import { firestoreStore } from '../../adapters/firestore';
import type { SubgraphEdge, SubgraphNode } from '../../domain/subgraph';

// THE GRAPH LOADER (ring 2026-08-25) — gathers the neighborhood the longitudinal walk
// (domain/subgraph) then measures. The RELS THEMSELVES name what stands at each end, so
// an edge's endpoints resolve without guessing collections. Beings this viewer may not
// read simply fail to resolve — and an unresolved being is OPAQUE to the walk: the rules'
// refusals become the walk's walls with no extra law here.
type BeingKind = 'person' | 'tree' | 'community' | 'vision' | 'lightHouse' | 'pulse';

const REL_ENDPOINTS: Record<string, { from: BeingKind; to: BeingKind }> = {
  guardian: { from: 'person', to: 'tree' },
  co_owner: { from: 'person', to: 'tree' },
  steward: { from: 'person', to: 'tree' },
  observer: { from: 'person', to: 'tree' },
  member: { from: 'person', to: 'community' },
  keeper: { from: 'person', to: 'community' },
  joined: { from: 'person', to: 'vision' },
  participant: { from: 'tree', to: 'vision' },   // (events too — the vision miss falls to pulse below)
  rooted: { from: 'lightHouse', to: 'tree' },
  shelters: { from: 'lightHouse', to: 'community' },
  grows_in: { from: 'tree', to: 'community' },
  collaborates_with: { from: 'community', to: 'community' },
  recognises: { from: 'community', to: 'community' },
  shares_resources_with: { from: 'community', to: 'community' },
  welcomed_by: { from: 'person', to: 'person' },
  invited_by: { from: 'person', to: 'community' },
};
// Knocks and transients weave no meaning: they are pending questions, not connections.
const SKIP_RELS = new Set(['join_request', 'keeper_request', 'party']);

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
    const ownerUid = k === 'person' ? id
      : (d.ownerId as string) || (d.authorId as string) || null;
    const name = (d.name as string) || (d.title as string) || (d.displayName as string) || '';
    return { id, kind: k, ownerUid, name, lid: d.lid as string | undefined };
  };
  try {
    const first = await read(kind);
    if (first) return first;
    // participant's target may be an EVENT pulse rather than a vision.
    if (kind === 'vision') return await read('pulse');
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
        firestoreStore.linksFrom(id).catch(() => []),
        firestoreStore.linksTo(id).catch(() => []),
      ]);
      for (const l of [...out, ...into]) {
        const shape = REL_ENDPOINTS[l.rel];
        if (!shape || SKIP_RELS.has(l.rel)) continue;
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
