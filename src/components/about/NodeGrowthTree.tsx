import { useEffect, useMemo, useState } from 'react';
import type { Community, Lifetree, LinkRel } from '../../types';
import { firestoreStore } from '../../adapters/firestore';

// The Node Growth Tree — a living diagram of the node's model *instance*, generated on the fly from
// the data: each lifetree is a branch radiating from the community seed, sized by its weight. The
// weight distribution is the point — heavy nodes (long chains), heavy links (role edges) and pulses
// (chain height) read at a glance. A community running on the node's domain drives this growth.

// Role edges live in the `links` collection (the LIN) — the legacy per-role arrays are gone.
const CIRCLE_RELS: LinkRel[] = ['guardian', 'co_owner', 'steward', 'observer'];
interface TreeEdges { links: number; guardians: number }

// A tree's weight: its chain growth (blockHeight = pulses) + its links (weighted) + a validated
// bonus. This is what sizes the node and the branch that carries it.
const treeWeight = (t: Lifetree, links: number) => (t.blockHeight || 0) + links * 2 + (t.validated ? 3 : 0) + 1;

const kindColor = (t: Lifetree) => (t.validated ? '#fcd34d' : t.isNature ? '#38bdf8' : '#94a3b8');

interface NodeGrowthTreeProps {
  community: Community;
  trees: Lifetree[];
  onViewTree?: (tree: Lifetree) => void;
}

export const NodeGrowthTree = ({ community, trees, onViewTree }: NodeGrowthTreeProps) => {
  const accent = community.theme?.primary || '#10b981';
  const CX = 400, CY = 400;

  // Role-edge counts per tree, read from the LIN ('guardian'/'co_owner'/'steward'/'observer'
  // links pointing INTO each tree) — the single source of truth for the circle.
  const [edges, setEdges] = useState<Map<string, TreeEdges>>(new Map());
  useEffect(() => {
    let alive = true;
    Promise.all(CIRCLE_RELS.map(rel => firestoreStore.linksByRel(rel))).then(perRel => {
      if (!alive) return;
      const counts = new Map<string, TreeEdges>();
      perRel.forEach((links, i) => {
        for (const l of links) {
          const e = counts.get(l.to) || { links: 0, guardians: 0 };
          e.links++;
          if (CIRCLE_RELS[i] === 'guardian') e.guardians++;
          counts.set(l.to, e);
        }
      });
      setEdges(counts);
    }).catch(() => {});
    return () => { alive = false; };
  }, [trees]);

  const model = useMemo(() => {
    const list = trees.filter(Boolean);
    const n = list.length;
    const weights = list.map(t => treeWeight(t, edges.get(t.id)?.links || 0));
    const maxW = Math.max(1, ...weights);
    const maxP = Math.max(1, ...list.map(t => t.blockHeight || 0));

    const nodes = list.map((t, i) => {
      const pulses = t.blockHeight || 0;
      const w = weights[i];
      const links = edges.get(t.id)?.links || 0;
      // Even radial fan from the top, so the community sits at the seed and trees crystallise outward.
      const angle = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
      const len = 130 + 210 * (pulses / maxP);
      const r = 9 + 26 * (w / maxW);
      const sw = 2 + 9 * (w / maxW);
      const x = CX + Math.cos(angle) * len;
      const y = CY + Math.sin(angle) * len;
      // A gentle organic curve — control point pushed perpendicular to the branch.
      const bend = len * 0.14 * (i % 2 === 0 ? 1 : -1);
      const mx = CX + Math.cos(angle) * len * 0.5 + Math.cos(angle + Math.PI / 2) * bend;
      const my = CY + Math.sin(angle) * len * 0.5 + Math.sin(angle + Math.PI / 2) * bend;
      // Leaf-dots along the branch encode the tree's links.
      const leaves = Array.from({ length: Math.min(links, 6) }, (_, k) => {
        const f = 0.5 + 0.42 * ((k + 1) / (Math.min(links, 6) + 1));
        return { lx: CX + (x - CX) * f + Math.cos(angle + Math.PI / 2) * bend * (1 - f) * 2, ly: CY + (y - CY) * f + Math.sin(angle + Math.PI / 2) * bend * (1 - f) * 2 };
      });
      return { t, x, y, mx, my, r, sw, links, w, angle, color: kindColor(t), lit: !!t.validated, leaves };
    });

    const totalPulses = list.reduce((a, t) => a + (t.blockHeight || 0), 0);
    const totalLinks = list.reduce((a, t) => a + (edges.get(t.id)?.links || 0), 0);
    const totalGuardians = list.reduce((a, t) => a + (edges.get(t.id)?.guardians || 0), 0);
    const validated = list.filter(t => t.validated).length;
    const seedR = 28 + Math.min(46, Math.sqrt(weights.reduce((a, b) => a + b, 0)));
    return { nodes, n, totalPulses, totalLinks, totalGuardians, validated, seedR };
  }, [trees, edges]);

  const stats: { label: string; value: number; tint: string }[] = [
    { label: 'Trees', value: model.n, tint: 'text-emerald-300' },
    { label: 'Pulses', value: model.totalPulses, tint: 'text-sky-300' },
    { label: 'Links', value: model.totalLinks, tint: 'text-amber-300' },
    { label: 'Validated', value: model.validated, tint: 'text-yellow-200' },
    { label: 'Guardians', value: model.totalGuardians, tint: 'text-emerald-200' },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 shadow-xl" style={{ background: 'radial-gradient(120% 120% at 50% 35%, #0c1a16 0%, #070d0b 60%, #05080a 100%)' }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/5 px-5 py-3">
        <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">The Model</h3>
        <p className="text-xs text-slate-400">How {community.name} is crystallising — each branch a tree, its weight its growth.</p>
      </div>

      {model.n === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-20 text-center">
          <div className="h-16 w-16 rounded-full" style={{ background: `radial-gradient(circle at 40% 35%, ${accent}, transparent 70%)` }} />
          <p className="text-sm text-slate-300">The seed is set, but no trees have sprouted on this node yet.</p>
          <p className="text-xs text-slate-500">Plant a lifetree on this domain and the model begins to grow.</p>
        </div>
      ) : (
        <>
          <svg viewBox="0 0 800 800" className="h-auto w-full" role="img" aria-label={`${community.name} model growth diagram`}>
            <defs>
              <filter id="ngt-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="7" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <radialGradient id="ngt-seed" cx="40%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="35%" stopColor={accent} />
                <stop offset="100%" stopColor={accent} stopOpacity="0.15" />
              </radialGradient>
            </defs>

            {/* Growth rings — faint concentric orbits hinting at the accumulated pulses. */}
            {[0.34, 0.55, 0.78, 1].map((f, i) => (
              <circle key={i} cx={CX} cy={CY} r={90 + f * 250} fill="none" stroke={accent} strokeOpacity={0.06} strokeWidth={1} />
            ))}

            {/* Branches — tapered lines from the seed to each tree, thickness ∝ weight. */}
            {model.nodes.map((nd, i) => (
              <path key={`b${i}`} d={`M ${CX} ${CY} Q ${nd.mx} ${nd.my} ${nd.x} ${nd.y}`} fill="none"
                stroke={nd.color} strokeOpacity={nd.lit ? 0.75 : 0.4} strokeWidth={nd.sw} strokeLinecap="round" />
            ))}

            {/* Leaf-dots along each branch encode the tree's links. */}
            {model.nodes.map((nd, i) => nd.leaves.map((lf, k) => (
              <circle key={`l${i}-${k}`} cx={lf.lx} cy={lf.ly} r={2.4} fill={nd.color} fillOpacity={0.7} />
            )))}

            {/* Tree nodes — sized by weight, glowing when validation is lit. Clickable. */}
            {model.nodes.map((nd, i) => (
              <g key={`n${i}`} onClick={() => onViewTree?.(nd.t)} className={onViewTree ? 'cursor-pointer' : ''}>
                <title>{nd.t.name} — {nd.t.blockHeight || 0} blocks, {nd.links} links{nd.lit ? ', validated' : ''}</title>
                <circle cx={nd.x} cy={nd.y} r={nd.r} fill={nd.color} filter={nd.lit ? 'url(#ngt-glow)' : undefined} fillOpacity={nd.lit ? 1 : 0.85} stroke="#ffffff" strokeOpacity={0.25} strokeWidth={1} />
                {nd.r > 13 && (
                  <text x={nd.x + (Math.cos(nd.angle) >= 0 ? nd.r + 6 : -(nd.r + 6))} y={nd.y + 4}
                    textAnchor={Math.cos(nd.angle) >= 0 ? 'start' : 'end'} fontSize="15" fill="#e2e8f0" fillOpacity={0.85} style={{ pointerEvents: 'none' }}>
                    {nd.t.name.length > 16 ? nd.t.name.slice(0, 15) + '…' : nd.t.name}
                  </text>
                )}
              </g>
            ))}

            {/* The seed — the community at the centre, sized by the whole model's weight. */}
            <circle cx={CX} cy={CY} r={model.seedR + 12} fill={accent} fillOpacity={0.12} className="ngt-breathe" />
            <circle cx={CX} cy={CY} r={model.seedR} fill="url(#ngt-seed)" filter="url(#ngt-glow)" />
            <text x={CX} y={CY + 5} textAnchor="middle" fontSize="16" fontWeight={700} fill="#04120c" style={{ pointerEvents: 'none' }}>
              {model.totalPulses}
            </text>
            <style>{`@keyframes ngtBreathe{0%,100%{opacity:.12;transform:scale(1)}50%{opacity:.22;transform:scale(1.06)}}.ngt-breathe{transform-box:fill-box;transform-origin:center;animation:ngtBreathe 5s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.ngt-breathe{animation:none}}`}</style>
          </svg>

          {/* The weight distribution, in numbers. */}
          <div className="grid grid-cols-5 gap-px border-t border-white/5 bg-white/5">
            {stats.map(s => (
              <div key={s.label} className="flex flex-col items-center gap-0.5 px-2 py-3" style={{ background: 'rgba(0,0,0,0.25)' }}>
                <span className={`font-mono text-lg font-bold tabular-nums ${s.tint}`}>{s.value}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-5 py-2.5 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#fcd34d]" /> validated</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#38bdf8]" /> nature</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#94a3b8]" /> lifetree</span>
            <span className="text-slate-600">· node size = weight · branch = chain growth · dots = links</span>
          </div>
        </>
      )}
    </div>
  );
};
