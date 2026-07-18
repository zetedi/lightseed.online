import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from '../components/ui/Icons';
import { ForestMap } from '../components/ForestMap';
import type { LightHouse } from '../domain/lightHouse';
import { LightHouseCard } from '../components/LightHouseCard';
import { useVisibleLightHouses } from '../hooks/useVisibleLightHouses';
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
  // LightHouse map scope: a community's domain shows its own, null (the hub) shows all.
  lightHouseDomain?: string | null;
  onViewLightHouse?: (s: LightHouse) => void;
}

export const ForestPage = ({
  showNatureTrees, setShowNatureTrees, showUserTrees, setShowUserTrees,
  showValidatedTrees, setShowValidatedTrees, viewMode, filteredData, loadingMore, activeTree,
  mapRefreshKey, isAdmin, isSuperAdmin, isInitiate, currentUserId, guardedTreeIds, sentinelRef,
  onView, onReach, onPlayGrowth, onQuickSnap, onValidate, onRefresh,
  lightHouseDomain = null, onViewLightHouse,
}: ForestPageProps) => {
  const { t } = useLanguage();
  // LightHouses are a layer of their own — the lighthouses. On by default, in both views.
  const [showLightHouses, setShowLightHouses] = useState(true);
  const lightHouses = useVisibleLightHouses(lightHouseDomain, mapRefreshKey);
  // LightHouses of one community gather as a DECK of cards: one stacked pile with a count,
  // opening into its cards on a tap. Loners stand alone.
  const [openDecks, setOpenDecks] = useState<Set<string>>(new Set());
  const lightHouseDecks = React.useMemo(() => {
    const groups = new Map<string, LightHouse[]>();
    for (const s of lightHouses) {
      const key = s.communityId || s.domain || s.id;
      groups.set(key, [...(groups.get(key) || []), s]);
    }
    return [...groups.entries()];
  }, [lightHouses]);
  const toggleDeck = (key: string) => setOpenDecks(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
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
        <label className={toggleCls}>
          <input type="checkbox" checked={showLightHouses} onChange={(e) => setShowLightHouses(e.target.checked)} className="h-4 w-4 rounded accent-amber-500" />
          <span className="flex items-center gap-1"><span className={horizontal ? 'hidden sm:inline-flex' : 'inline-flex'}><Icons.Sun /></span> Light Houses</span>
        </label>
      </div>
    </div>
  );
  return (
    <>
      {viewMode === 'map' ? (
        <ForestMap trees={filteredData} onView={onView} onReach={onReach} loading={loadingMore && filteredData.length === 0} onRefresh={onRefresh} primaryTree={activeTree} refreshKey={mapRefreshKey} lightHouseDomain={lightHouseDomain} showLightHouses={showLightHouses} onViewLightHouse={onViewLightHouse} filtersOverlay={filters(false)} />
      ) : (
        <>
          <div className="mb-4 flex justify-center">{filters(true)}</div>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {showLightHouses && lightHouseDecks.map(([deckId, group]) => {
              if (group.length === 1) {
                return <LightHouseCard key={`lightHouse-${group[0].id}`} lightHouse={group[0]} onOpen={onViewLightHouse} className="h-56" />;
              }
              if (!openDecks.has(deckId)) {
                return (
                  <div
                    key={`deck-${deckId}`}
                    onClick={() => toggleDeck(deckId)}
                    role="button"
                    aria-label={`${group.length} Light Houses of one community; open the deck`}
                    className="relative h-56 cursor-pointer transition-transform hover:-translate-y-1"
                  >
                    <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 rotate-[2.5deg] rounded-2xl bg-amber-200/60 ring-1 ring-amber-300/50" />
                    <div className="absolute inset-0 translate-x-1 translate-y-1 rotate-[1deg] rounded-2xl bg-amber-100/80 ring-1 ring-amber-200/60" />
                    <LightHouseCard lightHouse={group[0]} className="absolute inset-0 h-full" />
                    <span className="absolute -right-1.5 -top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-xs font-black text-white shadow">{group.length}</span>
                  </div>
                );
              }
              return group.map((s, i) => (
                <div key={`lightHouse-${s.id}`} className="relative">
                  <LightHouseCard lightHouse={s} onOpen={onViewLightHouse} className="h-56" />
                  {i === 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleDeck(deckId); }}
                      className="absolute bottom-3 left-3 z-10 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur transition-colors hover:bg-black/70"
                      aria-label="Gather the deck"
                    >
                      ⧉ stack
                    </button>
                  )}
                </div>
              ));
            })}
            {filteredData.length === 0 && !loadingMore && !(showLightHouses && lightHouses.length > 0) ? (
              /* No trees yet: Mahameru remains — the sea of creation, Orion over still water. */
              <div className="col-span-full relative overflow-hidden rounded-3xl border border-slate-800/40 shadow-xl">
                <img src="/mahameru.svg" alt="Mahameru, the sea of creation" className="h-80 w-full object-cover sm:h-96" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-center">
                  <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/90">Mahameru</p>
                  <p className="mt-1 text-xs text-slate-300">The sea of creation: no trees planted here yet. The field awaits the first seed.</p>
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
