import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from '../components/ui/Icons';
import { ForestMap } from '../components/ForestMap';
import { LifetreeCard } from '../components/LifetreeCard';
import { Loading } from '../components/ui/Loading';
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
  isInitiate?: boolean;
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
  showNatureTrees, setShowNatureTrees, showUserTrees, setShowUserTrees,
  showValidatedTrees, setShowValidatedTrees, viewMode, filteredData, loadingMore, activeTree,
  mapRefreshKey, isAdmin, isSuperAdmin, isInitiate, currentUserId, guardedTreeIds, sentinelRef,
  onView, onReach, onPlayGrowth, onQuickSnap, onValidate, onRefresh,
}: ForestPageProps) => {
  const { t } = useLanguage();
  const toggleCls = "flex cursor-pointer items-center gap-2 text-sm font-medium text-emerald-900 dark:text-emerald-100";
  // One emerald card holding the three filters. On the map it's a top-left overlay (z-20, BELOW the
  // sticky nav's z-30) stacked vertically on mobile; on the grid it sits in flow as ONE horizontal
  // line, so the cards below stay visible.
  const filters = (horizontal: boolean) => (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 px-3.5 py-2.5 shadow-sm backdrop-blur-sm dark:border-emerald-800/60 dark:bg-emerald-950/60">
      <div className={horizontal
        ? 'flex flex-row flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-5'
        : 'flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-x-5 sm:gap-y-2'}>
        {/* The horizontal (list-view) line hides the icons on MOBILE only, so all three fit one
            row there; from sm up the icons return, matching the map overlay. */}
        <label className={toggleCls}>
          <input type="checkbox" checked={showNatureTrees} onChange={(e) => setShowNatureTrees(e.target.checked)} className="h-4 w-4 rounded accent-emerald-600" />
          <span className="flex items-center gap-1"><span className={horizontal ? 'hidden sm:inline-flex' : 'inline-flex'}><Icons.Nature /></span> {t('nature')}</span>
        </label>
        <label className={toggleCls}>
          <input type="checkbox" checked={showUserTrees} onChange={(e) => setShowUserTrees(e.target.checked)} className="h-4 w-4 rounded accent-emerald-600" />
          <span className="flex items-center gap-1"><span className={horizontal ? 'hidden sm:inline-flex' : 'inline-flex'}><Icons.Tree /></span> {t('lifetrees')}</span>
        </label>
        <label className={toggleCls}>
          <input type="checkbox" checked={showValidatedTrees} onChange={(e) => setShowValidatedTrees(e.target.checked)} className="h-4 w-4 rounded accent-emerald-600" />
          <span className="flex items-center gap-1"><span className={horizontal ? 'hidden sm:inline-flex' : 'inline-flex'}><Icons.ShieldCheck /></span> {t('validated_trees')}</span>
        </label>
      </div>
    </div>
  );
  return (
    <>
      {viewMode === 'map' ? (
        <div className="relative">
          <ForestMap trees={filteredData} onView={onView} onReach={onReach} loading={loadingMore && filteredData.length === 0} onRefresh={onRefresh} primaryTree={activeTree} refreshKey={mapRefreshKey} />
          <div className="absolute left-3 top-3 z-20 max-w-[calc(100%-1.5rem)]">{filters(false)}</div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex justify-center">{filters(true)}</div>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredData.length === 0 && !loadingMore ? (
              /* No trees yet: Mahameru remains — the sea of creation, Orion over still water. */
              <div className="col-span-full relative overflow-hidden rounded-3xl border border-slate-800/40 shadow-xl">
                <img src="/mahameru.svg" alt="Mahameru — the sea of creation" className="h-80 w-full object-cover sm:h-96" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-center">
                  <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/90">Mahameru</p>
                  <p className="mt-1 text-xs text-slate-300">The sea of creation — no trees planted here yet. The field awaits the first seed.</p>
                </div>
              </div>
            ) : (
              filteredData.map((item: Lifetree) => (
                <React.Fragment key={item.id}>
                  <LifetreeCard
                    tree={item}
                    myActiveTree={activeTree}
                    isAdmin={isAdmin}
                    isSuperAdmin={isSuperAdmin}
                    isInitiate={isInitiate}
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
          {loadingMore && filteredData.length > 0 && <div className="mt-6 flex justify-center"><Loading /></div>}
          <div ref={sentinelRef} className="h-1" />
        </>
      )}
    </>
  );
};
