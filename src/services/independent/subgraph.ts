// THE INDEPENDENT NODE'S HAND for the graph loader — the mirror of ../firebase/subgraph.ts (rings
// 2026-11-01/02). The rels name what stands at each end; a being this viewer may not read fails to
// resolve through the document door and stays opaque to the walk — the law's refusals are the
// walk's walls, with no extra law here.
import type * as F from '../firebase/subgraph';
import { docGet } from './docs';
import { graphStore } from './store';
import type { SubgraphEdge, SubgraphNode } from '../../domain/subgraph';
export type { LoadedBeing } from '../firebase/subgraph';

type BeingKind = 'person' | 'tree' | 'community' | 'vision' | 'lightHouse' | 'pulse';
const REL_ENDPOINTS: Record<string, { from: BeingKind; to: BeingKind }> = {
    guardian: { from: 'person', to: 'tree' }, keeper: { from: 'person', to: 'tree' }, steward: { from: 'person', to: 'tree' }, observer: { from: 'person', to: 'tree' },
    member: { from: 'person', to: 'community' }, joined: { from: 'person', to: 'vision' }, participant: { from: 'tree', to: 'vision' },
    rooted: { from: 'lightHouse', to: 'tree' }, shelters: { from: 'lightHouse', to: 'community' }, grows_in: { from: 'tree', to: 'community' },
    collaborates_with: { from: 'community', to: 'community' }, recognises: { from: 'community', to: 'community' }, shares_resources_with: { from: 'community', to: 'community' },
    welcomed_by: { from: 'person', to: 'person' }, invited_by: { from: 'person', to: 'community' },
};
const SKIP_RELS = new Set(['join_request', 'keeper_request', 'party']);
const COLLECTION = { person: 'persons', tree: 'lifetrees', community: 'communities', vision: 'visions', lightHouse: 'light_houses', pulse: 'pulses' } as const;

const resolveBeing = async (kind: BeingKind, id: string): Promise<F.LoadedBeing | null> => {
    const read = async (k: BeingKind) => {
        const d = await docGet<Record<string, unknown>>(COLLECTION[k], id);
        if (!d) return null;
        const anchorUid = k === 'person' ? id : (d.anchorUid as string) || (d.authorId as string) || null;
        return { id, kind: k, anchorUid, name: (d.name as string) || (d.title as string) || (d.displayName as string) || '', lid: d.lid as string | undefined };
    };
    try {
        const first = await read(kind);
        if (first) return first;
        if (kind === 'vision') return await read('pulse');
        if (kind === 'tree') return await read('community');
        return null;
    } catch { return null; }
};
export const loadSubgraphAround: typeof F.loadSubgraphAround = async (start, opts) => {
    const rounds = opts?.rounds ?? 4, cap = opts?.cap ?? 150;
    const display = new Map<string, F.LoadedBeing>([[start.id, start]]);
    const edges = new Map<string, SubgraphEdge>();
    let frontier = [start.id];
    const expanded = new Set<string>();
    for (let r = 0; r < rounds && frontier.length && display.size < cap; r++) {
        const next = new Set<string>();
        await Promise.all(frontier.map(async (id) => {
            if (expanded.has(id)) return;
            expanded.add(id);
            const [out, into] = await Promise.all([graphStore.linksFrom(id).catch(() => []), graphStore.linksTo(id).catch(() => [])]);
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
    return { nodes: [...display.values()] as SubgraphNode[], edges: [...edges.values()], display };
};
