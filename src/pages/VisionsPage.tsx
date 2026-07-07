import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from '../components/ui/Icons';
import { SectionHeader } from '../components/ui/SectionHeader';
import { VisionCard } from '../components/VisionCard';
import { ResonancePanel } from '../components/ResonancePanel';
import { ResonanceScan } from '../components/ui/ResonanceScan';
import { Loading } from '../components/ui/Loading';
import { ViewDensityToggle } from '../components/ui/ViewDensityToggle';
import { CloudBox } from '../components/ui/CloudBox';
import { SubTabs } from '../components/ui/SubTabs';
import { useListDensity, densityGridClass } from '../hooks/useListDensity';
import { canViewVision } from '../domain/views/forest';
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
  tone: string; // the active menu item's colour — band and pill are one surface
}

export const VisionsPage = ({
  visions, synergies, favoriteResonanceIds, onToggleFavorite, onReach, isAnalyzingSynergy,
  onAnalyze, canAnalyze, lightseed, onCreateVision, onSelectVision, loadingMore, viewer, searchBox, tone,
}: VisionsPageProps) => {
  const { t } = useLanguage();
  const [density, setDensity] = useListDensity('visions');
  // Two entity lists under one menu item — Visions and Alignments (the resonance field) — so a
  // long visions list doesn't bury the alignments in scroll.
  const [subTab, setSubTab] = React.useState<'visions' | 'alignments'>('visions');
  // Respect vision visibility (protect fragile/early visions). Rules enforce it server-side.
  const visibleVisions = visions.filter(v => canViewVision(v, viewer));
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <SectionHeader
        title={t('visions')}
        tone={tone}
        footer={searchBox}
        toggle={<ViewDensityToggle value={density} onChange={setDensity} />}
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
        <SubTabs
          tone={tone}
          active={subTab}
          onChange={(k) => setSubTab(k as 'visions' | 'alignments')}
          tabs={[
            { key: 'visions', label: t('visions'), icon: <Icons.Eye />, count: visibleVisions.length },
            { key: 'alignments', label: t('alignments'), icon: <Icons.Venn />, count: synergies.length },
          ]}
        />

        {subTab === 'alignments' ? (
          <CloudBox>
            <ResonancePanel synergies={synergies} favorites={favoriteResonanceIds} onToggleFavorite={onToggleFavorite} onReach={onReach} />
            {synergies.length === 0 && <p className="py-10 text-center text-slate-400">{t('no_resonances_yet')}</p>}
          </CloudBox>
        ) : (
          <ResonanceScan active={isAnalyzingSynergy}>
            <CloudBox>
              <div className={densityGridClass(density)}>
                {visibleVisions.length === 0 && !loadingMore ? (
                  <p className="col-span-full text-center text-slate-400 py-10">{t('no_visions_found')}</p>
                ) : (
                  visibleVisions.map(item => (
                    <div key={item.id} onClick={() => onSelectVision(item)} className="cursor-pointer">
                      <VisionCard vision={item} density={density} />
                    </div>
                  ))
                )}
              </div>
              {loadingMore && <div className="mt-6 flex justify-center"><Loading /></div>}
            </CloudBox>
          </ResonanceScan>
        )}
      </SectionHeader>
    </div>
  );
};
