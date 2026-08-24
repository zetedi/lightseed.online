import { useEffect, useMemo, useState } from 'react';
import type { Lifetree } from '../../types';
import { loadSubgraphAround, type LoadedBeing } from '../../services/firebase/subgraph';
import { subgraphOf, type SubgraphWalk } from '../../domain/subgraph';
import { beingPath } from '../../domain/beingLink';
import { useLanguage } from '../../contexts/LanguageContext';
import { Loading } from '../ui/Loading';
import { Icons } from '../ui/Icons';

// THE CONNECTIONS PANEL (ring 2026-08-25) — knowing a tree by walking its edges. Depth is
// SOCIAL DISTANCE (domain/subgraph): 0 = this tree's keeper's whole world, 1 = the beings
// of the people it touches, 2 = their next people. The walk sees only what THIS viewer may
// see — the rules' refusals are its walls.
const KIND_GLYPH: Record<string, string> = {
  tree: '🌳', vision: '☀️', community: '🌐', lightHouse: '🏛', person: '🧍', pulse: '⚡',
};

export const TreeConnections = ({ tree }: { tree: Lifetree }) => {
  const { t } = useLanguage();
  const [depth, setDepth] = useState(1);
  const [revealed, setRevealed] = useState(false); // lazy: no graph load until opened
  const [loaded, setLoaded] = useState<Awaited<ReturnType<typeof loadSubgraphAround>> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the walk is fetched only once the panel is opened (revealed); resets its veil per tree
    setLoading(true);
    loadSubgraphAround({ id: tree.id, kind: 'tree', ownerUid: tree.ownerId || null, name: tree.name, lid: tree.lid })
      .then(g => { if (alive) { setLoaded(g); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [revealed, tree.id, tree.ownerId, tree.name, tree.lid]);


  const walk: SubgraphWalk | null = useMemo(() => {
    if (!loaded) return null;
    return subgraphOf(tree.id, { nodes: loaded.nodes, edges: loaded.edges }, { personDepth: depth });
  }, [loaded, tree.id, depth]);

  const byDistance = useMemo(() => {
    const groups = new Map<number, LoadedBeing[]>();
    for (const b of walk?.beings || []) {
      if (b.id === tree.id) continue;
      const full = loaded?.display.get(b.id);
      if (!full) continue;
      if (!groups.has(b.distance)) groups.set(b.distance, []);
      groups.get(b.distance)!.push(full);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [walk, loaded, tree.id]);

  const depthLabels = [t('conn_depth_mine'), t('conn_depth_next'), t('conn_depth_theirs')];

  // Collapsed until asked — the walk can touch many docs, so it never runs on mere mount
  // (and it is superadmin-only for now; see LifetreeDetail).
  if (!revealed) {
    return (
      <button type="button" onClick={() => setRevealed(true)}
        className="flex w-full items-center gap-2 rounded-2xl border border-slate-100 bg-white px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 shadow-sm transition-colors hover:border-emerald-200 hover:text-emerald-600">
        <Icons.Globe /> {t('tree_connections')}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('tree_connections')}</p>
        <div className="flex gap-1.5">
          {depthLabels.map((label, d) => (
            <button key={d} type="button" onClick={() => setDepth(d)}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all ${depth === d ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {loading ? <div className="py-8"><Loading /></div> : byDistance.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">{t('conn_empty')}</p>
      ) : (
        byDistance.map(([d, beings]) => (
          <div key={d} className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{depthLabels[d] || `+${d}`}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {beings.map(b => {
                const chip = (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50">
                    <span aria-hidden>{KIND_GLYPH[b.kind] || '·'}</span>
                    <span className="max-w-[10rem] truncate">{b.name || b.id.slice(0, 8)}</span>
                  </span>
                );
                // Every being with a lid is a door (/b/) — persons stay plain chips for now.
                return b.lid && b.kind !== 'person'
                  ? <a key={b.id} href={beingPath(b.lid)}>{chip}</a>
                  : <span key={b.id}>{chip}</span>;
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
