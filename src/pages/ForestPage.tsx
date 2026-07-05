import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from '../components/ui/Icons';
import { ForestMap } from '../components/ForestMap';
import { LifetreeCard } from '../components/LifetreeCard';
import type { Lifetree } from '../types';
import type { ReachAudience } from '../domain/reach';

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
  const toggleCls = "flex cursor-pointer items-center gap-2 text-sm font-medium text-emerald-900 dark:text-emerald-100";
  // One emerald card holding the three filters. On the map it's a top-left overlay (z-20, BELOW the
  // sticky nav's z-30) so it scrolls up under the header with the map; on the grid it sits in flow.
  const filters = (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 px-3.5 py-2.5 shadow-sm backdrop-blur-sm dark:border-emerald-800/60 dark:bg-emerald-950/60">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-x-5 sm:gap-y-2">
        <label className={toggleCls}>
          <input type="checkbox" checked={showNatureTrees} onChange={(e) => setShowNatureTrees(e.target.checked)} className="h-4 w-4 rounded accent-emerald-600" />
          <span className="flex items-center gap-1"><Icons.Nature /> {t('nature')}</span>
        </label>
        <label className={toggleCls}>
          <input type="checkbox" checked={showUserTrees} onChange={(e) => setShowUserTrees(e.target.checked)} className="h-4 w-4 rounded accent-emerald-600" />
          <span className="flex items-center gap-1"><Icons.Tree /> {t('lifetrees')}</span>
        </label>
        <label className={toggleCls}>
          <input type="checkbox" checked={showValidatedTrees} onChange={(e) => setShowValidatedTrees(e.target.checked)} className="h-4 w-4 rounded accent-emerald-600" />
          <span className="flex items-center gap-1"><Icons.ShieldCheck /> {t('validated_trees')}</span>
        </label>
      </div>
    </div>
  );
  return (
    <>
      {viewMode === 'map' ? (
        <div className="relative">
          <ForestMap trees={filteredData} onView={onView} onReach={onReach} loading={loadingMore && filteredData.length === 0} onRefresh={onRefresh} primaryTree={activeTree} refreshKey={mapRefreshKey} />
          <div className="absolute left-3 top-3 z-20 max-w-[calc(100%-1.5rem)]">{filters}</div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex justify-center">{filters}</div>
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
