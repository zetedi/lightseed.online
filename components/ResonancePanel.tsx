import React from 'react';
import { Icons } from './ui/Icons';
import { useLanguage } from '../contexts/LanguageContext';
import type { VisionSynergy } from '../types';

// Resonance read as a heat: the hotter the bond, the more radiant. High glows rose,
// middling is amber, gentle kinship is emerald.
export const resonanceTier = (score: number): { labelKey: 'tier_radiant' | 'tier_resonant' | 'tier_kindred'; badge: string } => {
  if (score >= 80) return { labelKey: 'tier_radiant', badge: 'bg-rose-100 text-rose-700 ring-1 ring-rose-300/60 shadow-[0_0_10px_rgba(244,63,94,0.35)]' };
  if (score >= 55) return { labelKey: 'tier_resonant', badge: 'bg-amber-100 text-amber-700' };
  return { labelKey: 'tier_kindred', badge: 'bg-emerald-100 text-emerald-700' };
};

// A stable, order-insensitive id for a resonance pair (used to track favourites).
export const resonanceId = (s: VisionSynergy) =>
  [s.vision1Title, s.vision2Title].map(x => (x || '').trim().toLowerCase()).sort().join(' :: ');

/** A single resonance pair card — shared by the Visions panel and the Observatory. */
export const ResonanceCard = ({ s, isFavorite, onToggleFavorite, onReach }: { s: VisionSynergy; isFavorite?: boolean; onToggleFavorite?: () => void; onReach?: (treeId: string, treeName: string) => void; key?: React.Key }) => {
  const { t } = useLanguage();
  const tier = resonanceTier(s.score || 0);
  const reachable = onReach && (s.tree1Id || s.tree2Id);
  return (
    <div className="rounded-xl border border-amber-100 bg-white/90 p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="text-sm font-bold text-slate-800">{s.vision1Title} + {s.vision2Title}</div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tier.badge}`}>{t(tier.labelKey)} · {s.score}%</span>
          {onToggleFavorite && (
            <button
              type="button"
              onClick={onToggleFavorite}
              title={isFavorite ? t('saved') : t('save')}
              aria-pressed={isFavorite}
              className={`leading-none transition-transform hover:scale-110 ${isFavorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
            >
              <span className="text-base">{isFavorite ? '★' : '☆'}</span>
            </button>
          )}
        </div>
      </div>

      {/* The two trees whose visions resonate — below the resonance level, above the reasoning. */}
      {(s.tree1Id || s.tree2Id) && (
        <div className="mb-2 flex items-center gap-2">
          {s.tree1Id && (
            <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1">
              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(s.tree1Id.slice(0, 2))}&background=059669&color=fff`} className="h-6 w-6 shrink-0 rounded-full" alt="" />
              <span className="truncate text-[11px] font-medium text-slate-700">{s.vision1Title}</span>
            </div>
          )}
          <span className="shrink-0 text-xs font-bold text-slate-300">+</span>
          {s.tree2Id && (
            <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1">
              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(s.tree2Id.slice(0, 2))}&background=059669&color=fff`} className="h-6 w-6 shrink-0 rounded-full" alt="" />
              <span className="truncate text-[11px] font-medium text-slate-700">{s.vision2Title}</span>
            </div>
          )}
        </div>
      )}

      <p className="text-xs italic text-slate-600">"{s.reasoning}"</p>

      {reachable && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-amber-100 pt-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('start_conversation')}</span>
          {s.tree1Id && (
            <button type="button" onClick={() => onReach!(s.tree1Id!, s.vision1Title)} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100">
              <span className="[&>svg]:h-3 [&>svg]:w-3"><Icons.Chat /></span> {s.vision1Title}
            </button>
          )}
          {s.tree2Id && (
            <button type="button" onClick={() => onReach!(s.tree2Id!, s.vision2Title)} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100">
              <span className="[&>svg]:h-3 [&>svg]:w-3"><Icons.Chat /></span> {s.vision2Title}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/** The amber "Living Intelligence Resonance" card — the vision-pair matches the AI surfaced. */
export const ResonancePanel = ({
  synergies,
  className = '',
  favorites,
  onToggleFavorite,
  onReach,
}: {
  synergies: VisionSynergy[];
  className?: string;
  favorites?: Set<string>;
  onToggleFavorite?: (s: VisionSynergy) => void;
  onReach?: (treeId: string, treeName: string) => void;
}) => {
  const { t } = useLanguage();
  if (!synergies || synergies.length === 0) return null;
  const ranked = [...synergies].sort((a, b) => (b.score || 0) - (a.score || 0));
  return (
    <div className={`bg-amber-50/90 backdrop-blur-md p-6 rounded-2xl border-2 border-amber-200 shadow-lg animate-in zoom-in-95 duration-500 ${className}`}>
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-amber-500 text-white p-2 rounded-xl shadow-lg"><Icons.SparkleFill size={24} /></div>
        <h3 className="text-2xl font-light text-amber-900 italic">{t('living_resonance')}</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {ranked.map((s, i) => (
          <ResonanceCard
            key={i}
            s={s}
            isFavorite={favorites?.has(resonanceId(s))}
            onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(s) : undefined}
            onReach={onReach}
          />
        ))}
      </div>
    </div>
  );
};
