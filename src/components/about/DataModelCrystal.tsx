import { useMemo, useState } from 'react';
import { BEING_NOTE, DATA_MODEL, DATA_RELATIONS, type ModelEntity } from '../../domain/dataModel';
import { buildDrawioFile, buildDrawioXml } from '../../utils/drawioExport';
import { Icons } from '../ui/Icons';

// The data model as a crystal — the entities and how they link, drawn from the same definition
// that generates the draw.io XML. It's the schema (the shape of the seed), not any instance.

const WIDTH = 250, HEADER = 46, ROW = 22, PAD = 8;
const boxH = (e: ModelEntity) => HEADER + e.fields.length * ROW + PAD;

type Box = { e: ModelEntity; x: number; y: number; w: number; h: number; cx: number; cy: number };

// The point on a box's border along the ray from its centre toward (fx, fy).
const border = (b: Box, fx: number, fy: number) => {
  const dx = fx - b.cx, dy = fy - b.cy;
  const hw = b.w / 2, hh = b.h / 2;
  const s = 1 / Math.max(Math.abs(dx) / hw || 1e-6, Math.abs(dy) / hh || 1e-6);
  return { x: b.cx + dx * s, y: b.cy + dy * s };
};

export const DataModelCrystal = () => {
  const [copied, setCopied] = useState(false);

  const boxes = useMemo<Record<string, Box>>(() => {
    const map: Record<string, Box> = {};
    for (const e of DATA_MODEL) {
      const h = boxH(e);
      map[e.key] = { e, x: e.x, y: e.y, w: WIDTH, h, cx: e.x + WIDTH / 2, cy: e.y + h / 2 };
    }
    return map;
  }, []);

  const boxList = Object.values(boxes) as Box[];

  const bounds = useMemo(() => {
    let maxX = 0, maxY = 0;
    boxList.forEach(b => { maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); });
    return { w: maxX + 40, h: maxY + 40 };
  }, [boxes]);

  const download = () => {
    const blob = new Blob([buildDrawioFile()], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'lifeseed-data-model.drawio'; a.click();
    URL.revokeObjectURL(url);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(buildDrawioXml()); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* no clipboard */ }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 shadow-xl" style={{ background: 'radial-gradient(120% 120% at 50% 30%, #0c1a16 0%, #070d0b 60%, #05080a 100%)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">The Model · Crystal</h3>
          <p className="text-xs text-slate-400">The data model's shape — {DATA_MODEL.length} entities, {DATA_RELATIONS.length} links. Editable in draw.io.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 transition-colors hover:bg-white/10">
            <Icons.Copy size={14} /> {copied ? 'Copied' : 'Copy XML'}
          </button>
          <button onClick={download} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700">
            <Icons.ArrowRight size={14} /> Download .drawio
          </button>
        </div>
      </div>

      <div className="overflow-auto max-h-[78vh]">
        <svg viewBox={`0 0 ${bounds.w} ${bounds.h}`} width={bounds.w} className="h-auto max-w-none" style={{ minWidth: '760px' }} role="img" aria-label="lifeseed data model diagram">
          <defs>
            <marker id="dm-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L8,3 L0,6 Z" fill="#38bdf8" />
            </marker>
            <marker id="dm-arrow-lin" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L8,3 L0,6" fill="none" stroke="#f59e0b" strokeWidth="1" />
            </marker>
          </defs>

          {/* Relationships (drawn first; boxes sit on top so edges connect border-to-border). */}
          {DATA_RELATIONS.map((r, i) => {
            const a = boxes[r.from], b = boxes[r.to];
            if (!a || !b) return null;
            if (r.from === r.to) {
              // Self-reference (validatorId) — a loop off the right edge.
              const x = a.x + a.w, y = a.cy - 14;
              return (
                <g key={`r${i}`}>
                  <path d={`M ${x} ${y} C ${x + 54} ${y - 26}, ${x + 54} ${y + 42}, ${x} ${y + 28}`} fill="none" stroke="#38bdf8" strokeOpacity={0.7} strokeWidth={1.4} markerEnd="url(#dm-arrow)" />
                  <text x={x + 46} y={y + 12} fontSize="10" fill="#7dd3fc" textAnchor="middle">{r.label}</text>
                </g>
              );
            }
            const p1 = border(a, b.cx, b.cy);
            const p2 = border(b, a.cx, a.cy);
            const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
            return (
              <g key={`r${i}`}>
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke={r.lin ? '#f59e0b' : '#38bdf8'} strokeOpacity={r.lin ? 0.6 : 0.5} strokeWidth={1.3}
                  strokeDasharray={r.lin ? '5 4' : undefined} markerEnd={r.lin ? 'url(#dm-arrow-lin)' : 'url(#dm-arrow)'} />
                <text x={mx} y={my - 3} fontSize="10" fill={r.lin ? '#fbbf24' : '#7dd3fc'} textAnchor="middle" style={{ pointerEvents: 'none' }}>
                  {r.label}{r.many ? ' []' : ''}
                </text>
              </g>
            );
          })}

          {/* Entities. */}
          {boxList.map(({ e, x, y, w, h }) => (
            <g key={e.key}>
              <clipPath id={`dm-clip-${e.key}`}><rect x={x} y={y} width={w} height={h} rx={9} /></clipPath>
              <g clipPath={`url(#dm-clip-${e.key})`}>
                <rect x={x} y={y} width={w} height={h} fill="#0f172a" />
                <rect x={x} y={y} width={w} height={HEADER} fill="#064e3b" />
              </g>
              <rect x={x} y={y} width={w} height={h} rx={9} fill="none" stroke="#10b981" strokeOpacity={0.7} strokeWidth={1.2} />
              <text x={x + 12} y={y + 20} fontSize="14" fontWeight={700} fill="#ecfdf5">{e.label}</text>
              <text x={x + 12} y={y + 35} fontSize="10" fill="#6ee7b7">{e.collection}</text>
              {e.note && <text x={x + w - 10} y={y + 20} fontSize="9" fill="#94a3b8" textAnchor="end" style={{ pointerEvents: 'none' }}>{e.note.length > 34 ? e.note.slice(0, 33) + '…' : e.note}</text>}
              {e.fields.map((f, fi) => {
                const fy = y + HEADER + fi * ROW + 15;
                return (
                  <text key={f.name} x={x + 12} y={fy} fontSize="12" fill="#e2e8f0" style={{ pointerEvents: 'none' }}>
                    <tspan fontWeight={f.pk ? 700 : 400} fill={f.pk ? '#fcd34d' : '#e2e8f0'}>{f.name}</tspan>
                    <tspan fill="#64748b"> : {f.ref ? f.type : f.type}</tspan>
                    {f.ref && <tspan fill="#7dd3fc"> → {f.ref}</tspan>}
                  </text>
                );
              })}
            </g>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-white/5 px-5 py-2.5 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded bg-[#38bdf8]" /> reference</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded" style={{ background: 'repeating-linear-gradient(90deg,#f59e0b 0 4px,transparent 4px 7px)' }} /> LIN edge</span>
        <span className="flex items-center gap-1.5"><span className="font-mono font-bold text-[#fcd34d]">bold</span> = document id</span>
        <span className="basis-full text-center italic text-emerald-200/60">{BEING_NOTE}</span>
      </div>
    </div>
  );
};
