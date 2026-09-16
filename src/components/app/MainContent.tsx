import React, { lazy } from 'react';
import type { Alignment, Lifetree, Pulse, ReachAudience, Vision } from '../../types';
import type { BeingOverlays } from '../../hooks/useBeingOverlays';
import type { ModalDoors } from '../../hooks/useModalDoors';
import type { HostNode } from '../../hooks/useHostNode';
import type { useSiteTheme } from '../../hooks/useSiteTheme';
import type { useConfig } from '../../hooks/useConfig';
import type { useForestFeed } from '../../hooks/useForestFeed';
import type { useForestFilters } from '../../hooks/useForestFilters';
import type { useResonance } from '../../hooks/useResonance';
import type { useObservatoryQuote } from '../../hooks/useObservatoryQuote';
import type { useAlignmentCards } from '../../hooks/useAlignmentCards';
import type { useDashboardStats } from '../../hooks/useDashboardStats';
import type { ViewMode } from '../../hooks/useAppRouting';
import { useSession } from '../../contexts/SessionContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { validateLifetree, unvalidateLifetree, claimSuperAdmin, grantAdmin, revokeAdmin } from '../../services/firebase';
import { placeOfRecordDomain } from '../../domain/pulseVisibility';
import { tabTone, tabFg, CTA_GLOW } from '../../utils/tabTheme';
import { Icons } from '../ui/Icons';
import { Loading } from '../ui/Loading';
import { SectionHeader } from '../ui/SectionHeader';
import { FullWidthTabs } from '../ui/FullWidthTabs';
import { EventCard } from '../EventCard';
import { notify } from '../ui/Toast';
import { speak } from '../../utils/translations';
import { SearchBox } from './SearchBox';

// Route pages are code-split: each becomes its own chunk that loads only when first shown.
const Dashboard = lazy(() => import('../Dashboard').then(m => ({ default: m.Dashboard })));
const LightseedProfile = lazy(() => import('../LightseedProfile').then(m => ({ default: m.LightseedProfile })));
const NewsletterAdmin = lazy(() => import('../NewsletterAdmin').then(m => ({ default: m.NewsletterAdmin })));
const CommunityList = lazy(() => import('../CommunityList').then(m => ({ default: m.CommunityList })));
const CommunityProfile = lazy(() => import('../CommunityProfile').then(m => ({ default: m.CommunityProfile })));
const CollabsPage = lazy(() => import('../../pages/CollabsPage').then(m => ({ default: m.CollabsPage })));
const ObservatoryPage = lazy(() => import('../../pages/ObservatoryPage').then(m => ({ default: m.ObservatoryPage })));
const ForestPage = lazy(() => import('../../pages/ForestPage').then(m => ({ default: m.ForestPage })));
const BedsBrowsePage = lazy(() => import('../../pages/BedsBrowsePage').then(m => ({ default: m.BedsBrowsePage })));
const VisionsPage = lazy(() => import('../../pages/VisionsPage').then(m => ({ default: m.VisionsPage })));
const PulseFeedPage = lazy(() => import('../../pages/PulseFeedPage').then(m => ({ default: m.PulseFeedPage })));

type EffectiveTheme = ReturnType<typeof useSiteTheme>['effectiveTheme'];

export type OfferingsSub = 'offerings' | 'beds';

// THE TAB'S PAGE (ring 2026-09-16, lifted out of App.tsx unchanged): what the main area
// shows for the active tab — the home, the profile, the crown page, the communities, the
// collabs, the observatory, the forest, the visions, the events, the offerings (with its
// beds sub-tab), and the plain pulse feed. Every handler routes into a flow the shell
// already owns; the page invents none.
export const MainContent: React.FC<{
  tab: string;
  setTab: (tab: string) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  beings: BeingOverlays;
  doors: ModalDoors;
  host: HostNode;
  config: ReturnType<typeof useConfig>;
  theme: EffectiveTheme;
  isDark: boolean;
  stats: ReturnType<typeof useDashboardStats>;
  feed: Pick<ReturnType<typeof useForestFeed>, 'data' | 'loadContent' | 'loadingMore' | 'forestSentinelRef'>;
  filteredData: ReturnType<typeof useForestFeed>['data'];
  filters: ReturnType<typeof useForestFilters>;
  resonance: ReturnType<typeof useResonance>;
  observatory: ReturnType<typeof useObservatoryQuote>;
  alignmentCards: ReturnType<typeof useAlignmentCards>;
  onAcceptAlignment: (id: string) => Promise<void>;
  onRejectAlignment: (id: string) => Promise<void>;
  search: { term: string; setTerm: (term: string) => void; suggestions: string[] };
  events: { ordered: Pulse[]; orderedDashboard: Pulse[]; showPast: boolean; togglePast: () => void };
  offeringsSub: OfferingsSub;
  setOfferingsSub: (sub: OfferingsSub) => void;
  guardedTreeIds: Set<string>;
  handleDeleteTree: (treeId: string) => Promise<void>;
  handleQuickSnap: (treeId: string, file: File) => Promise<void>;
  openReach: (tree: Lifetree | null, audience?: ReachAudience) => void;
  openTreeFromReaches: (id: string, opts?: { closeReachModal?: boolean }) => void;
  openCareFromReaches: (id: string) => void;
}> = ({
  tab, setTab, viewMode, setViewMode, beings, doors, host, config, theme, isDark, stats, feed, filteredData, filters,
  resonance, observatory, alignmentCards, onAcceptAlignment, onRejectAlignment, search, events, offeringsSub, setOfferingsSub,
  guardedTreeIds, handleDeleteTree, handleQuickSnap, openReach, openTreeFromReaches, openCareFromReaches,
}) => {
  const { t } = useLanguage();
  const { lightseed, myTrees, guardedTrees, activeTree, defaultTreeId, setDefaultTree, isAdmin, isSuperAdmin, isInitiate } = useSession();
  const { setSelectedTree, setSelectedVision, setSelectedAlignment, setSelectedCommunity, setSelectedPulse, setViewingLightHouse, onViewPulseOrAlignment, onViewAlignmentTree, mapRefreshKey } = beings;
  const { hostCommunity, setHostCommunity, impersonatedCommunity, setImpersonatedCommunity, defaultCommunity, setDefaultCommunity, activeCommunity, activeDataDomain } = host;
  const { data, loadContent, loadingMore, forestSentinelRef } = feed;
  const place = impersonatedCommunity || hostCommunity;

  if (tab === 'dashboard') {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Dashboard
          stats={{
            trees: myTrees.length,
            pulses: stats.pulses,
            visions: stats.visions,
            alignments: stats.alignments,
            danger: guardedTrees.filter(tr => tr.status === 'DANGER').length
          }}
          hostCommunity={place || defaultCommunity}
          theme={theme}
          isDark={isDark}
          events={events.orderedDashboard}
          onViewEvent={(p: Pulse) => { void onViewPulseOrAlignment(p); }}
          onViewCommunity={setSelectedCommunity}
          onSetTab={setTab}
          onPlant={() => doors.openPlant()}
          onLogin={() => doors.setShowAuthModal(true)}
        />
      </div>
    );
  }

  if (tab === 'profile' && lightseed) {
    return (
      <LightseedProfile
        placeDomain={placeOfRecordDomain(place, window.location.hostname)}
        placeName={place?.name}
        onViewTree={(tree: Lifetree, section?: string) => beings.openTreeSection(tree, section || null)}
        onDeleteTree={handleDeleteTree}
        defaultTreeId={defaultTreeId}
        onSetDefaultTree={setDefaultTree}
        onViewVision={(v: Vision) => setSelectedVision(v)}
        onViewPulse={(p: Pulse) => { void onViewPulseOrAlignment(p); }}
        onViewAlignment={(a: Alignment) => setSelectedAlignment(a)}
        onPlant={() => doors.openPlant()}
        onCreateVision={() => doors.setShowVisionModal(true)}
        onEmitPulse={() => doors.openPulseModal()}
        onClaimSuperAdmin={async () => {
          const ok = await claimSuperAdmin(lightseed.uid);
          if (ok) window.location.reload();
          else notify(speak('superadmin_claimed'));
        }}
        onGrantAdmin={async (uid: string) => { await grantAdmin(uid); }}
        onRevokeAdmin={async (uid: string) => { await revokeAdmin(uid); }}
        onOpenNewsletterAdmin={() => setTab('newsletter')}
        onReachTree={(tree: Lifetree) => openReach(tree)}
        onOpenTreeById={openTreeFromReaches}
        onOpenCareById={openCareFromReaches}
        nodeTheme={config.theme}
      />
    );
  }

  if (tab === 'newsletter' && lightseed && isSuperAdmin) {
    // The node's own letter from the profile's admin door; a face's letter is written on its community page.
    const letterPlace = place || defaultCommunity;
    if (!letterPlace) return <div className="min-h-screen flex items-center justify-center"><Loading /></div>;
    return <NewsletterAdmin community={letterPlace} onBack={() => setTab('profile')} />;
  }

  if (tab === 'about') {
    // The crown page is the hosting community's profile, driven entirely from data and
    // rendered by the same component used for every community. Its menu name is derived
    // independently (About / Host / Node / Hub) from backend authority. Off-domain or
    // before a host resolves, the lightseed community remains the fallback reading.
    const aboutCommunity = place || defaultCommunity;
    if (!aboutCommunity) return <div className="min-h-screen flex items-center justify-center"><Loading /></div>;
    return (
      <CommunityProfile
        onViewLightHouse={setViewingLightHouse}
        community={aboutCommunity}
        isHost={aboutCommunity.id === place?.id}
        onViewTree={(tree: Lifetree) => setSelectedTree(tree)}
        onClose={() => setTab('dashboard')}
        onUpdate={(updates) => {
          if (impersonatedCommunity && aboutCommunity.id === impersonatedCommunity.id) setImpersonatedCommunity(prev => prev ? { ...prev, ...updates } : null);
          if (hostCommunity && aboutCommunity.id === hostCommunity.id) setHostCommunity(prev => prev ? { ...prev, ...updates } : null);
          if (defaultCommunity && aboutCommunity.id === defaultCommunity.id) setDefaultCommunity(prev => prev ? { ...prev, ...updates } : null);
        }}
      />
    );
  }

  if (tab === 'communities') {
    return (
      <CommunityList
        onSelect={(community) => setSelectedCommunity(community)}
        myTrees={myTrees}
        currentUserId={lightseed?.uid}
        host={place}
      />
    );
  }

  if (tab === 'collab') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
        <CollabsPage theme={theme} onSelectCommunity={setSelectedCommunity} quote={observatory.observatoryQuote} quoteCopied={observatory.quoteCopied} onCopyQuote={observatory.copyQuote} />
      </div>
    );
  }

  // Search box reused inside the Visions/Events/Pulses headers (under the title).
  const searchBox = <SearchBox value={search.term} onChange={search.setTerm} suggestions={search.suggestions} />;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 min-h-[80vh]">
      {tab === 'forest' && (
        /* The forest's controls in the same band as every list: search left, the
           grid/map switch, then the CTAs (lightseed glow) at the right. */
        <SectionHeader
          title={t('forest')}
          tone={tabTone('forest', theme)}
          footer={<SearchBox value={search.term} onChange={search.setTerm} suggestions={search.suggestions} forest />}
          toggle={
            <div className="flex shrink-0 items-center rounded-full bg-white/15 p-0.5 backdrop-blur-sm dark:bg-slate-900/15">
              <button onClick={() => setViewMode('grid')} title={t('list_view')} aria-pressed={viewMode === 'grid'}
                className={`rounded-full p-2 transition-all ${viewMode === 'grid' ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-white/75 hover:text-white'}`}>
                <Icons.List />
              </button>
              <button onClick={() => setViewMode('map')} title={t('map_view')} aria-pressed={viewMode === 'map'}
                className={`rounded-full p-2 transition-all ${viewMode === 'map' ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-white/75 hover:text-white'}`}>
                <Icons.Map />
              </button>
            </div>
          }
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => doors.openPlant({ type: 'LIFETREE', step: 2 })}
                className={`bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all active:scale-95 ${CTA_GLOW}`}
                style={{ backgroundColor: theme.primary }}
              >
                <Icons.Tree />
                <span className="hidden sm:inline">{t('plant_lifetree')}</span>
                <span className="sm:hidden">{t('path_plant_cta')}</span>
              </button>
              {myTrees.length > 0 && (
                <button
                  onClick={() => doors.openPlant({ type: 'GUARDED', step: 2 })}
                  className={`bg-sky-600 hover:bg-sky-700 text-white px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all active:scale-95 ${CTA_GLOW}`}
                  style={{ backgroundColor: theme.secondary }}
                >
                  <Icons.Shield />
                  <span className="hidden sm:inline">{t('guard_tree')}</span>
                  <span className="sm:hidden">{t('guard')}</span>
                </button>
              )}
            </div>
          }
        />
      )}

      {tab === 'observatory' && (
        <ObservatoryPage
          tone={tabTone('observatory', theme)}
          alignments={alignmentCards}
          onAcceptAlignment={onAcceptAlignment}
          onRejectAlignment={onRejectAlignment}
          onViewAlignmentTree={onViewAlignmentTree}
          isAnalyzingSynergy={resonance.isAnalyzingSynergy}
          synergies={resonance.synergies}
          lastSynergyAt={resonance.lastSynergyAt}
          canRefreshResonance={resonance.canRefreshResonance}
          synergyCooldownLeft={resonance.synergyCooldownLeft}
          onRefreshResonance={resonance.refreshResonanceObservatory}
          favoriteResonanceIds={resonance.favoriteResonanceIds}
          onToggleFavorite={resonance.toggleFavoriteResonance}
          onReach={resonance.reachResonantTree}
          observatoryQuote={observatory.observatoryQuote}
          quoteCopied={observatory.quoteCopied}
          onCopyQuote={observatory.copyQuote}
        />
      )}

      {tab === 'forest' ? (
        <ForestPage
          lightHouseDomain={activeDataDomain || null}
          lightHousesPublicOnly={activeCommunity?.reflectsPublic === true}
          onViewLightHouse={setViewingLightHouse}
          effectiveIsDark={isDark}
          showNatureTrees={filters.showNatureTrees} setShowNatureTrees={filters.setShowNatureTrees}
          showUserTrees={filters.showUserTrees} setShowUserTrees={filters.setShowUserTrees}
          showValidatedTrees={filters.showValidatedTrees} setShowValidatedTrees={filters.setShowValidatedTrees}
          viewMode={viewMode}
          filteredData={filteredData}
          loadingMore={loadingMore}
          activeTree={activeTree}
          mapRefreshKey={mapRefreshKey}
          isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} isInitiate={isInitiate}
          currentUserId={lightseed?.uid}
          guardedTreeIds={guardedTreeIds}
          sentinelRef={forestSentinelRef}
          onView={setSelectedTree}
          onReach={openReach}
          onPlayGrowth={doors.setShowGrowthPlayer}
          onQuickSnap={handleQuickSnap}
          onValidate={(id: string, nextValidated: boolean) => { (nextValidated
            // Initiates (git ledger) validate in their own name, like the superadmin;
            // everyone else signs with their validated tree (peer web of trust).
            ? validateLifetree(id, (isSuperAdmin || isInitiate) ? lightseed!.uid : activeTree!.id)
            : unvalidateLifetree(id)
          ).then(() => { notify(speak(nextValidated ? 'validated_toast' : 'validation_removed_toast')); loadContent(true); }); }}
          onRefresh={() => loadContent(true)}
        />
      ) : tab === 'visions' ? (
        <VisionsPage
          visions={filteredData}
          synergies={resonance.synergies}
          favoriteResonanceIds={resonance.favoriteResonanceIds}
          onToggleFavorite={resonance.toggleFavoriteResonance}
          onReach={resonance.reachResonantTree}
          isAnalyzingSynergy={resonance.isAnalyzingSynergy}
          onAnalyze={resonance.handleAnalyzeSynergy}
          canAnalyze={data.length >= 2}
          lightseed={lightseed}
          onCreateVision={() => doors.setShowVisionModal(true)}
          onSelectVision={setSelectedVision}
          loadingMore={loadingMore}
          viewer={{ uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin }}
          searchBox={searchBox}
          tone={tabTone('visions', theme)}
        />
      ) : tab === 'events' ? (
        <PulseFeedPage
          title={t('events')}
          tone={tabTone('events', theme)}
          fg={tabFg('events')}
          densityKey="events"
          searchBox={
            <div className="flex w-full items-center gap-2">
              <div className="min-w-0 flex-1">{searchBox}</div>
              {/* Past events rest behind this toggle; the clock snapshot refreshes
                  on each touch so "today" stays honest in a long-lived session. */}
              <button
                onClick={events.togglePast}
                title={t('past_events_hint')}
                className={`whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium shadow-sm transition-colors ${events.showPast
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-emerald-100 bg-white/80 text-slate-500 hover:text-slate-700 dark:border-emerald-900 dark:bg-slate-900/80'}`}
              >
                {t('past_events')}
              </button>
            </div>
          }
          action={lightseed && (
            <button onClick={() => doors.setShowEventModal(true)} className={`bg-sky-600 hover:bg-sky-700 text-white px-4 py-1.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap ${CTA_GLOW}`}>
              <Icons.Plus /> <span>{t('create_event')}</span>
            </button>
          )}
          items={events.ordered}
          emptyText={t('no_events_found')}
          loadingMore={loadingMore}
          lightseed={lightseed}
          onMatch={(p: Pulse) => { setSelectedPulse(p); doors.openPulseModal(); }}
          onView={(p: Pulse) => { void onViewPulseOrAlignment(p); }}
          pattern
          // Big-cards density uses the shared EventCard; its community face opens
          // the host community (the same resolution the dashboard banner uses).
          renderBigCard={(ev: Pulse) => {
            const hostFace = place || defaultCommunity;
            const face = hostFace && (!ev.communityId || ev.communityId === hostFace.id) ? hostFace : null;
            return (
              <EventCard
                event={ev}
                onOpen={() => { void onViewPulseOrAlignment(ev); }}
                community={face}
                onOpenCommunity={face ? () => setSelectedCommunity(face) : undefined}
                isDark={isDark}
              />
            );
          }}
        />
      ) : tab === 'offerings' ? (
        // Offerings holds two full-width sub-tabs: the offering pulses, and beds (a bed
        // is an offering). The strip renders inside each sub-page's SectionHeader band.
        (() => {
          const offeringsTabs = (
            <FullWidthTabs
              active={offeringsSub}
              onChange={(k) => setOfferingsSub(k as OfferingsSub)}
              // One tone for the whole strip: the active sub-tab's, matching its band below.
              tone={tabTone(offeringsSub === 'beds' ? 'beds' : 'offerings', theme)}
              tabs={[
                { key: 'offerings', label: t('offerings'), icon: <Icons.Exchange /> },
                { key: 'beds', label: t('beds'), icon: <Icons.Moon /> },
              ]}
            />
          );
          return offeringsSub === 'beds' ? (
            <BedsBrowsePage
              onViewTree={setSelectedTree}
              lightHouseDomain={activeDataDomain || null}
              lightHousesPublicOnly={activeCommunity?.reflectsPublic === true}
              theme={theme}
              tabs={offeringsTabs}
            />
          ) : (
            <PulseFeedPage
              title={t('offerings')}
              tone={tabTone('offerings', theme)}
              densityKey="offerings"
              searchBox={searchBox}
              action={lightseed && (
                <button onClick={() => doors.setShowOfferModal(true)} style={{ backgroundColor: tabTone('offerings') }} className={`hover:brightness-110 text-white px-4 py-1.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap ${CTA_GLOW}`}>
                  <Icons.Plus /> <span>{t('offer_make')}</span>
                </button>
              )}
              items={filteredData}
              emptyText={t('offerings_none_page')}
              loadingMore={loadingMore}
              lightseed={lightseed}
              onMatch={(p: Pulse) => { setSelectedPulse(p); doors.openPulseModal(); }}
              onView={(p: Pulse) => { void onViewPulseOrAlignment(p); }}
              pattern
              tabs={offeringsTabs}
              searchOnTablet
            />
          );
        })()
      ) : tab !== 'observatory' && tab !== 'profile' && tab !== 'inspiration' && tab !== 'about' && tab !== 'dashboard' && tab !== 'newsletter' && tab !== 'communities' && (
        <PulseFeedPage
          title={t('pulses')}
          tone={tabTone('pulses', theme)}
          densityKey="pulses"
          searchBox={searchBox}
          action={lightseed && (
            <button onClick={() => doors.openPulseModal()} className={`bg-orange-600 hover:bg-orange-700 text-white px-4 py-1.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap ${CTA_GLOW}`}>
              <Icons.Pulse /> <span>{t('emit_pulse')}</span>
            </button>
          )}
          items={filteredData}
          emptyText={t('no_trees_found')}
          loadingMore={loadingMore}
          lightseed={lightseed}
          onMatch={(p: Pulse) => { doors.setMatchCandidate(p); doors.openPulseModal(); }}
          onView={(p: Pulse) => { void onViewPulseOrAlignment(p); }}
        />
      )}
    </main>
  );
};
