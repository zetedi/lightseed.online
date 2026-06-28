import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from '../components/ui/Icons';
import { ForestMap } from '../components/ForestMap';
import { LifetreeCard } from '../components/LifetreeCard';
import type { Lifetree } from '../types';
import type { ReachAudience } from '../src/domain/reach';

// Strangler step 1: the Forest view extracted from App.tsx into a page. This slice moves the
// VIEW only — it receives its data + handlers from the shell (props in). A later step lifts the
// data/pagination into a useForestData hook so the shell stops owning forest state. Behaviour is
// intentionally unchanged from the inline version.
interface ForestPageProps {
  effectiveIsDark: boolean;
  showNatureTrees: boolean; setShowNatureTrees: (b: boolean) => void;
  showUserTrees: boolean; setShowUserTrees: (b: boolean) => void;
  showValidatedTrees: boolean; setShowValidatedTrees: (b: boolean) => void;
  viewMode: 'grid' | 'map';
  filteredData: Lifetree[];
  loadingMore: boolean;
  activeTree: Lifetree | null;
  mapRefreshKey: number;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  currentUserId?: string;
  guardedTreeIds: Set<string>;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  onView: (tree: Lifetree) => void;
  onReach: (tree: Lifetree, audience?: ReachAudience) => void;
  onPlayGrowth: (id: string) => void;
  onQuickSnap: (id: string, file: File) => Promise<void>;
  onValidate: (id: string, nextValidated: boolean) => void;
  onRefresh: () => void;
}

export const ForestPage = ({
  effectiveIsDark, showNatureTrees, setShowNatureTrees, showUserTrees, setShowUserTrees,
  showValidatedTrees, setShowValidatedTrees, viewMode, filteredData, loadingMore, activeTree,
  mapRefreshKey, isAdmin, isSuperAdmin, currentUserId, guardedTreeIds, sentinelRef,
  onView, onReach, onPlayGrowth, onQuickSnap, onValidate, onRefresh,
}: ForestPageProps) => {
  const { t } = useLanguage();
  return (
    <>
      <div className="flex justify-center mb-6 gap-3">
        <label className={`flex items-center gap-2 cursor-pointer backdrop-blur-sm px-3 py-1.5 rounded-full border transition-colors shadow-sm ${effectiveIsDark ? 'bg-slate-900/70 border-white/10 hover:bg-slate-900' : 'bg-white/90 border-slate-200 hover:bg-slate-50'}`}>
          <input type="checkbox" checked={showNatureTrees} onChange={(e) => setShowNatureTrees(e.target.checked)} className="rounded text-sky-500 focus:ring-sky-500 bg-white/20 border-white/30" />
          <span className={`text-xs font-medium flex items-center ${effectiveIsDark ? 'text-white' : 'text-slate-700'}`}><span className="mr-1"><Icons.Nature /></span> {t('nature')}</span>
        </label>
        <label className={`flex items-center gap-2 cursor-pointer backdrop-blur-sm px-3 py-1.5 rounded-full border transition-colors shadow-sm ${effectiveIsDark ? 'bg-slate-900/70 border-white/10 hover:bg-slate-900' : 'bg-white/90 border-slate-200 hover:bg-slate-50'}`}>
          <input type="checkbox" checked={showUserTrees} onChange={(e) => setShowUserTrees(e.target.checked)} className="rounded text-emerald-400 focus:ring-emerald-400 bg-white/20 border-white/30" />
          <span className={`text-xs font-medium flex items-center ${effectiveIsDark ? 'text-white' : 'text-slate-700'}`}><span className="mr-1"><Icons.Tree /></span> {t('lifetrees')}</span>
        </label>
        <label className={`flex items-center gap-2 cursor-pointer backdrop-blur-sm px-3 py-1.5 rounded-full border transition-colors shadow-sm ${effectiveIsDark ? 'bg-slate-900/70 border-white/10 hover:bg-slate-900' : 'bg-white/90 border-slate-200 hover:bg-slate-50'}`}>
          <input type="checkbox" checked={showValidatedTrees} onChange={(e) => setShowValidatedTrees(e.target.checked)} className="rounded text-emerald-300 focus:ring-emerald-300 bg-white/20 border-white/30" />
          <span className={`text-xs font-medium flex items-center ${effectiveIsDark ? 'text-white' : 'text-slate-700'}`}><span className="mr-1"><Icons.ShieldCheck /></span> {t('validated_trees')}</span>
        </label>
      </div>

      {viewMode === 'map' ? (
        <ForestMap trees={filteredData} onView={onView} onReach={onReach} loading={loadingMore && filteredData.length === 0} onRefresh={onRefresh} primaryTree={activeTree} refreshKey={mapRefreshKey} />
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredData.length === 0 && !loadingMore ? (
              <p className="col-span-full text-center text-slate-400 py-10">{t('no_trees_found')}</p>
            ) : (
              filteredData.map((item: Lifetree) => (
                <React.Fragment key={item.id}>
                  <LifetreeCard
                    tree={item}
                    myActiveTree={activeTree}
                    isAdmin={isAdmin}
                    isSuperAdmin={isSuperAdmin}
                    currentUserId={currentUserId}
                    guardedTreeIds={guardedTreeIds}
                    targetUserProfile={{ onlyValidatedCanReach: item.onlyValidatedCanReach }}
                    onPlayGrowth={onPlayGrowth}
                    onReach={onReach}
                    onAlertGuardians={(tree: Lifetree) => onReach(tree, 'guardians')}
                    onQuickSnap={onQuickSnap}
                    onValidate={(id: string, nextValidated: boolean) => Promise.resolve(onValidate(id, nextValidated))}
                    onView={onView}
                  />
                </React.Fragment>
              ))
            )}
          </div>
          <div ref={sentinelRef} className="h-1" />
        </>
      )}
    </>
  );
};
