import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from '../components/ui/Icons';
import { SectionHeader } from '../components/ui/SectionHeader';
import { VisionCard } from '../components/VisionCard';
import { ResonancePanel } from '../components/ResonancePanel';
import { ResonanceScan } from '../components/ui/ResonanceScan';
import { canViewVision } from '../src/domain/views/forest';
import type { Lightseed, Vision, VisionSynergy } from '../types';

// The Visions feed: the resonance panel + a visibility-gated grid of vision cards. Extracted from
// App so the shell just supplies data + callbacks. (The sparkle before "Living Intelligence
// Resonance" lives inside ResonancePanel — intentionally left for now.)
interface VisionsPageProps {
  visions: Vision[];
  synergies: VisionSynergy[];
  favoriteResonanceIds: Set<string>;
  onToggleFavorite: (s: VisionSynergy) => void;
  onReach: (treeId: string, treeName: string) => void;
  isAnalyzingSynergy: boolean;
  onAnalyze: () => void;
  canAnalyze: boolean;
  lightseed: Lightseed | null;
  onCreateVision: () => void;
  onSelectVision: (v: Vision) => void;
  loadingMore: boolean;
  viewer: { uid?: string; isStaff?: boolean };
  searchBox?: React.ReactNode;
}

export const VisionsPage = ({
  visions, synergies, favoriteResonanceIds, onToggleFavorite, onReach, isAnalyzingSynergy,
  onAnalyze, canAnalyze, lightseed, onCreateVision, onSelectVision, loadingMore, viewer, searchBox,
}: VisionsPageProps) => {
  const { t } = useLanguage();
  // Respect vision visibility (protect fragile/early visions). Rules enforce it server-side.
  const visibleVisions = visions.filter(v => canViewVision(v, viewer));
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <SectionHeader
        icon={<Icons.Eye />}
        title={t('visions')}
        subtitle={t('visions_sub')}
        footer={searchBox}
        action={
          <div className="flex items-center gap-2">
            {lightseed && (
              <button
                onClick={onCreateVision}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-full font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap"
              >
                <Icons.Plus className="text-yellow-300" /> <span>{t('create_vision')}</span>
              </button>
            )}
            <button
              onClick={onAnalyze}
              disabled={isAnalyzingSynergy || !canAnalyze}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-full font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 border border-amber-400/30 active:scale-95 disabled:opacity-50 whitespace-nowrap"
            >
              {isAnalyzingSynergy
                ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                : <Icons.Venn />}
              <span className="hidden sm:inline">{isAnalyzingSynergy ? t('analyzing') : t('analyze')}</span>
            </button>
          </div>
        }
      >
        <ResonancePanel synergies={synergies} className="mb-6" favorites={favoriteResonanceIds} onToggleFavorite={onToggleFavorite} onReach={onReach} />

        <ResonanceScan active={isAnalyzingSynergy}>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {visibleVisions.length === 0 && !loadingMore ? (
              <p className="col-span-full text-center text-slate-400 py-10">{t('no_visions_found')}</p>
            ) : (
              visibleVisions.map(item => (
                <div key={item.id} onClick={() => onSelectVision(item)} className="cursor-pointer">
                  <VisionCard vision={item} />
                </div>
              ))
            )}
          </div>
        </ResonanceScan>
      </SectionHeader>
    </div>
  );
};
