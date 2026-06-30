import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from '../components/ui/Icons';
import Logo from '../components/Logo';
import { ResonanceScan } from '../components/ui/ResonanceScan';
import { ResonanceCard, resonanceId } from '../components/ResonancePanel';
import type { Alignment, VisionSynergy } from '../types';

// The Observatory: pending alignments + the Living Intelligence Resonance field. Extracted from
// App.tsx into a page so it can be maintained on its own (the shell only passes data + callbacks).
interface ObservatoryPageProps {
  alignments: Alignment[];
  onAcceptAlignment: (id: string) => void;
  isAnalyzingSynergy: boolean;
  synergies: VisionSynergy[];
  lastSynergyAt: number | null;
  canRefreshResonance: boolean;
  synergyCooldownLeft: number;
  onRefreshResonance: () => void;
  favoriteResonanceIds: Set<string>;
  onToggleFavorite: (s: VisionSynergy) => void;
  onReach: (treeId: string, treeName: string) => void;
  observatoryQuote: string;
  quoteCopied: boolean;
  onCopyQuote: () => void;
}

export const ObservatoryPage = ({
  alignments, onAcceptAlignment, isAnalyzingSynergy, synergies, lastSynergyAt,
  canRefreshResonance, synergyCooldownLeft, onRefreshResonance, favoriteResonanceIds,
  onToggleFavorite, onReach, observatoryQuote, quoteCopied, onCopyQuote,
}: ObservatoryPageProps) => {
  const { t } = useLanguage();
  return (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-lg">
        {/* Lighthouse banner header */}
        <div className="relative h-36 sm:h-44 overflow-hidden">
          <img src="/lighthouse.webp" alt="Observatory" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/40 to-transparent"></div>
          {/* Desktop: quote top-right, larger. (Hidden on mobile to keep the header calm.) */}
          {observatoryQuote && (
            <div className="absolute right-4 top-3 z-10 hidden max-w-[55%] flex-col items-end gap-1 text-right md:flex">
              <p dir="auto" className="line-clamp-3 text-base italic text-white/95 drop-shadow">"{observatoryQuote}"</p>
              <button
                onClick={onCopyQuote}
                title="Copy quote" aria-label="Copy quote"
                className="inline-flex items-center rounded-full bg-white/15 p-1 text-white/80 backdrop-blur transition-colors hover:bg-white/25 hover:text-white"
              >
                {quoteCopied ? <span className="px-0.5 text-[10px] font-bold">✓</span> : <Icons.Copy size={13} />}
              </button>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 flex items-center gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur">
              <Icons.Exchange />
            </div>
            <div className="min-w-0">
              <h2 className="break-words text-2xl font-light tracking-wide text-white drop-shadow">{t('pending_alignments')}</h2>
              <p className="text-sm text-white/80 drop-shadow">{t('observatory_subtitle')}</p>
            </div>
          </div>
        </div>

        {/* The empty "field is calm" state only when there's truly nothing — no alignments AND
            no resonances. Otherwise the resonance section carries it. */}
        {(alignments.length > 0 || synergies.length === 0) && (
          <div className="p-6">
            {alignments.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-slate-50/60 p-12 text-center">
                <div className="mb-6 rounded-full bg-white p-4 shadow-sm">
                  <Logo width={100} height={100} className="text-slate-800" />
                </div>
                <h3 className="mb-2 text-xl font-light text-slate-800">{t('no_pending_resonance')}</h3>
                <p className="text-slate-500">{t('ether_quiet')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {alignments.map(a => (
                  <div key={a.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between">
                      <div><p className="font-bold">{t('alignment_request')}</p><p className="text-sm text-slate-500">{t('from_another_tree')}</p></div>
                      <div className="flex gap-2">
                        <button onClick={() => onAcceptAlignment(a.id)} className="rounded-full bg-sky-500 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-sky-600">{t('accept_sync')}</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Living Intelligence Resonance — inside the same box. */}
        <ResonanceScan active={isAnalyzingSynergy}>
          <div className="border-t border-amber-100">
            <div className="flex items-center justify-between gap-3 border-b border-amber-100 bg-amber-50/60 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white"><Icons.SparkleFill size={22} /></div>
                <div className="min-w-0">
                  {/* Title removed — the LIN alignments already carry the meaning; we keep the
                      last-read date + refresh. */}
                  <p className="text-sm text-slate-500">
                    {lastSynergyAt ? `${t('last_read')} ${new Date(lastSynergyAt).toLocaleDateString()}` : t('resonance_field_hint')}
                  </p>
                </div>
              </div>
              <button
                onClick={onRefreshResonance}
                disabled={isAnalyzingSynergy || !canRefreshResonance}
                title={!canRefreshResonance ? `Refreshes weekly — about ${Math.max(1, Math.ceil(synergyCooldownLeft / 86400000))} day(s) left` : 'Re-read the field'}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow transition-all hover:bg-amber-600 active:scale-95 disabled:opacity-50"
              >
                {isAnalyzingSynergy
                  ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  : <Icons.Refresh />}
                <span>{isAnalyzingSynergy ? t('reading') : canRefreshResonance ? t('refresh') : `~${Math.max(1, Math.ceil(synergyCooldownLeft / 86400000))}d`}</span>
              </button>
            </div>
            <div className="p-5">
              {synergies.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[...synergies].sort((a, b) => (b.score || 0) - (a.score || 0)).map((s, i) => (
                    <ResonanceCard key={i} s={s} isFavorite={favoriteResonanceIds.has(resonanceId(s))} onToggleFavorite={() => onToggleFavorite(s)} onReach={onReach} />
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-400">{t('no_resonances_yet')}</p>
              )}
            </div>
          </div>
        </ResonanceScan>
      </div>
    </div>
  );
};
