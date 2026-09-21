import React, { lazy, Suspense } from 'react';
import type { Community, CommunityInvite, Lifetree, Pulse, Vision } from '../../types';
import type { BeingOverlays } from '../../hooks/useBeingOverlays';
import type { ModalDoors } from '../../hooks/useModalDoors';
import type { HostNode } from '../../hooks/useHostNode';
import { useSession } from '../../contexts/SessionContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  updateEvent, createEvent, plantLifetree, createVision, proposeAlignment, uploadBase64Image,
  setLightHouseVisibility, deleteLightHouse,
} from '../../services/firebase';
import { announce } from '../../services/refreshBus';
import { canEditEvent, placeOfRecordDomain, eventBirthScope, type HostStanding } from '../../domain/pulseVisibility';
import { readPhotoProvenance } from '../../utils/exif';
import { Icons } from '../ui/Icons';
import { notify } from '../ui/Toast';
import { speak, spokenLine } from '../../utils/translations';
import { DetailWrapper } from './DetailWrapper';

const CommunityProfile = lazy(() => import('../CommunityProfile').then(m => ({ default: m.CommunityProfile })));
const PulseDetail = lazy(() => import('../PulseDetail').then(m => ({ default: m.PulseDetail })));
const LightHouseProfile = lazy(() => import('../LightHouseProfile').then(m => ({ default: m.LightHouseProfile })));
const GrowthPlayerModal = lazy(() => import('../GrowthPlayerModal').then(m => ({ default: m.GrowthPlayerModal })));
const PlantTreeModal = lazy(() => import('../modals/PlantTreeModal').then(m => ({ default: m.PlantTreeModal })));
const EmitPulseModal = lazy(() => import('../modals/EmitPulseModal').then(m => ({ default: m.EmitPulseModal })));
const EventModal = lazy(() => import('../modals/EventModal').then(m => ({ default: m.EventModal })));
const OfferModal = lazy(() => import('../modals/OfferModal').then(m => ({ default: m.OfferModal })));
const CreateVisionModal = lazy(() => import('../modals/CreateVisionModal').then(m => ({ default: m.CreateVisionModal })));
const ProfileReaches = lazy(() => import('../profile/ProfileReaches').then(m => ({ default: m.ProfileReaches })));

// THE OVERLAYS AND MODALS (ring 2026-09-16, lifted out of App.tsx unchanged): everything
// that floats over the page from the shell's root — the pulse overlay, the community and
// Light House profiles, the messages inbox, the growth player, and the modals that mint
// (plant, event, offer, pulse, vision). Rendered outside the z-20 content wrapper, in the
// order the shell always stacked them.
export const AppOverlays: React.FC<{
  beings: BeingOverlays;
  doors: ModalDoors;
  host: HostNode;
  hostStanding: HostStanding;
  tab: string;
  setTab: (tab: string) => void;
  arrivedInvite: CommunityInvite | null;
  setArrivedInvite: (invite: CommunityInvite | null) => void;
  loadContent: (reset?: boolean) => void;
  uploading: boolean;
  handleImageUpload: (file: File, path: string) => Promise<string>;
  mintCarrying: (data: Partial<Pulse> & { lifetreeId: string }) => Promise<void>;
  handleGrowVision: (vision: Vision, data: { title?: string; body?: string; imageUrl?: string; growthCategory?: string }) => Promise<void>;
  handleTreeGrown: () => void;
  openTreeFromReaches: (id: string, opts?: { closeReachModal?: boolean }) => void;
  openCareFromReaches: (id: string) => void;
}> = ({ beings, doors, host, hostStanding, tab, setTab, arrivedInvite, setArrivedInvite, loadContent, uploading, handleImageUpload, mintCarrying, handleGrowVision, handleTreeGrown, openTreeFromReaches, openCareFromReaches }) => {
  const { t } = useLanguage();
  const { lightseed, myTrees, activeTree, isAdmin, isSuperAdmin, refreshTrees } = useSession();
  const { selectedTree, selectedPulse, setSelectedPulse, selectedCommunity, setSelectedCommunity, setSelectedTree, setViewingLightHouse, viewingLightHouse, onViewPulseOrAlignment, bumpMapRefresh } = beings;
  const { hostCommunity, setHostCommunity, impersonatedCommunity, setImpersonatedCommunity, defaultCommunity, setDefaultCommunity, setSeedView } = host;
  const place: Community | null = impersonatedCommunity || hostCommunity;

  return (
    <Suspense fallback={null}>
      {/* Non-event pulses keep the full-screen overlay (they carry their own sticky top bar).
          Offerings are excluded too: they wear their own being-face (OfferingProfile). */}
      {selectedPulse && selectedPulse.type !== 'event' && selectedPulse.type !== 'offering' && (
        <DetailWrapper belowHeader>
          <PulseDetail
            pulse={selectedPulse}
            activeTree={activeTree}
            onClose={() => setSelectedPulse(null)}
            backLabel={selectedTree && selectedPulse.lifetreeId === selectedTree.id ? t('back_to_name').replace('{name}', selectedTree.name) : t('back')}
            canEdit={canEditEvent(selectedPulse, { uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin }, { hostCommunity })}
            onEdit={() => doors.setEditingEvent(selectedPulse)}
          />
        </DetailWrapper>
      )}

      {doors.editingEvent && (
        <EventModal
          lightseed={lightseed}
          event={doors.editingEvent}
          scope={doors.editingEvent.communityId ? 'community' : 'node'}
          onClose={() => doors.setEditingEvent(null)}
          uploading={uploading}
          handleImageUpload={handleImageUpload}
          onCreate={async (data: Parameters<typeof updateEvent>[1]) => {
            // updateEvent itself announces the edit WITH its patch, which every
            // open list merges (a second, patchless announce read as a removal
            // and made the edited event vanish from the feed).
            const editing = doors.editingEvent!;
            await updateEvent(editing.id, data);
            setSelectedPulse(prev => prev && prev.id === editing.id ? { ...prev, ...data } : prev);
            doors.setEditingEvent(null);
          }}
        />
      )}

      {selectedCommunity && (
        <DetailWrapper belowHeader>
          <CommunityProfile
            onViewLightHouse={setViewingLightHouse}
            community={selectedCommunity}
            isHost={selectedCommunity.id === place?.id}
            arrivedInvite={arrivedInvite}
            onSignIn={() => doors.setShowAuthModal(true)}
            onViewTree={(tree: Lifetree) => { setSelectedCommunity(null); setSelectedTree(tree); }}
            onViewEvent={(p: Pulse) => { setSelectedCommunity(null); void onViewPulseOrAlignment(p); }}
            onClose={() => { setSelectedCommunity(null); setArrivedInvite(null); bumpMapRefresh(); }}
            onUpdate={(updates) => {
              setSelectedCommunity(prev => prev ? { ...prev, ...updates } : null);
              // Whisper the edit to every open communities list, so its card wears
              // the new face (appearance, name, vision) without a reload.
              if (selectedCommunity) announce('communities', selectedCommunity.id);
              // If this is the host (or default/dev) community, refresh the app shell so
              // settings like showStats/theme apply to the dashboard immediately, not on reload.
              if (selectedCommunity && hostCommunity && selectedCommunity.id === hostCommunity.id) {
                setHostCommunity(prev => prev ? { ...prev, ...updates } : null);
              }
              if (selectedCommunity && defaultCommunity && selectedCommunity.id === defaultCommunity.id) {
                setDefaultCommunity(prev => prev ? { ...prev, ...updates } : null);
              }
            }}
            onEnterCommunityView={isSuperAdmin ? (community) => {
              setImpersonatedCommunity(community);
              setSelectedCommunity(null);
              setTab('about');
              // Community view opens in the seed; the corner switcher lets staff
              // flip to the community's custom landing and back.
              setSeedView(true);
              window.scrollTo(0, 0);
            } : undefined}
          />
        </DetailWrapper>
      )}

      {viewingLightHouse && (
        <DetailWrapper belowHeader>
          <LightHouseProfile
            lightHouse={viewingLightHouse}
            onClose={() => setViewingLightHouse(null)}
            onViewCommunity={setSelectedCommunity}
            // Opening a bed/tree from a Light House closes the house overlay so the
            // detail comes to the foreground (selectedTree renders in-flow, beneath the
            // fixed DetailWrapper — without this it opens in the background).
            onViewTree={(tr) => { setViewingLightHouse(null); setSelectedTree(tr); }}
            canEdit={isSuperAdmin || isAdmin || viewingLightHouse.ownerId === lightseed?.uid}
            editIsStaffOnly={viewingLightHouse.ownerId !== lightseed?.uid && (isSuperAdmin || isAdmin)}
            onDelete={async (id) => {
              await deleteLightHouse(id);
              setViewingLightHouse(null);
              announce('lightHouses', id);
              notify(speak('lh_released'));
            }}
            onSetVisibility={async (id, v) => {
              await setLightHouseVisibility(id, v);
              setViewingLightHouse(prev => prev && prev.id === id ? { ...prev, visibility: v } : prev);
              announce('lightHouses', id);
              notify(speak(spokenLine('lh_visibility_now', { v: v === 'community' ? speak('vis_community') : speak(v === 'public' ? 'vis_public' : 'vis_node') })));
            }}
          />
        </DetailWrapper>
      )}

      {/* Direct Messages as a large overlay: the nav envelope and reach deep-links open the
          inbox here, in place, instead of steering to the profile's Reaches tab. */}
      {doors.showReachModal && lightseed && (
        <DetailWrapper>
          {/* Mobile: near-full-screen with a whisper of margin + radius, so the messages
              card visibly floats OVER the app; on desktop it centres vertically, so the
              top and bottom margins are equal. */}
          <div className="mx-auto w-full max-w-6xl px-2 py-2 sm:flex sm:min-h-full sm:flex-col sm:justify-center sm:px-6 sm:py-6 lg:py-10">
            <div className="relative min-h-[calc(100dvh-1rem)] rounded-2xl border border-slate-200/70 bg-white p-3 pt-3 shadow-2xl sm:min-h-0 sm:p-6 sm:pt-4 dark:border-slate-700/70 dark:bg-slate-900">
              <button
                onClick={() => doors.setShowReachModal(false)}
                title={t('close')}
                aria-label={t('close_messages')}
                className="absolute right-3 top-3 z-10 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <Icons.Close />
              </button>
              <ProfileReaches
                lightseed={lightseed}
                myTrees={myTrees}
                reachPartner={doors.reachTree}
                reachAudience={doors.reachAudience}
                onConsumeReach={() => { doors.setReachTree(null); doors.setReachAudience(undefined); }}
                onOpenTreeById={(id: string) => openTreeFromReaches(id, { closeReachModal: true })}
                onOpenCareById={openCareFromReaches}
                // Here the inbox IS the screen: it takes the room, not a 70vh slot.
                tall
              />
            </div>
          </div>
        </DetailWrapper>
      )}

      {doors.showGrowthPlayer && !selectedTree && <GrowthPlayerModal treeId={doors.showGrowthPlayer} onClose={() => doors.setShowGrowthPlayer(null)} />}

      {doors.showPlantModal && (
        <PlantTreeModal
          lightseed={lightseed}
          initialType={doors.plantInit.type}
          initialStep={doors.plantInit.step}
          onClose={() => doors.setShowPlantModal(false)}
          onPlant={async (data: Parameters<typeof plantLifetree>[0]) => {
            await plantLifetree(data);
            await refreshTrees();          // refresh the My Trees section immediately
            if (tab === 'forest') loadContent(true); // and the forest/map
          }}
          uploading={uploading}
          handleImageUpload={handleImageUpload}
          readPhotoProvenance={readPhotoProvenance}
        />
      )}

      {doors.showEventModal && (
        <EventModal
          lightseed={lightseed}
          onClose={() => doors.setShowEventModal(false)}
          uploading={uploading}
          handleImageUpload={handleImageUpload}
          // A KEEPER's event is born IN the host community (ring 2026-09-21), so the form may
          // offer Members; a member's or a visitor's stays standalone (public / node / private).
          scope={eventBirthScope(hostStanding)}
          onCreate={async (data: Parameters<typeof createEvent>[0]) => {
            // Stamped with the place of record — the host's canonical domain, not the
            // hostname of whichever door the hand stood at (domain/pulseVisibility).
            await createEvent({
              ...data,
              domain: placeOfRecordDomain(place, window.location.hostname),
              ...(hostStanding.keeper && place ? { communityId: place.id } : {}),
            });
            if (tab === 'events') loadContent(true);
          }}
        />
      )}

      {doors.showOfferModal && (
        <OfferModal
          to={doors.offerTo ?? undefined}
          onClose={doors.closeOffer}
          onCreated={() => { if (tab === 'offerings') loadContent(true); }}
        />
      )}

      {doors.editingOffering && (
        <OfferModal
          offering={doors.editingOffering}
          onClose={() => doors.setEditingOffering(null)}
          onSaved={(updates) => {
            const editing = doors.editingOffering!;
            setSelectedPulse(prev => prev && prev.id === editing.id ? { ...prev, ...updates } : prev);
            if (tab === 'offerings') loadContent(true);
          }}
        />
      )}

      {doors.showPulseModal && (
        <EmitPulseModal
          lightseed={lightseed}
          activeTree={activeTree}
          matchCandidate={doors.matchCandidate}
          targetTree={doors.pulseTargetTree}
          targetVision={doors.pulseTargetVision}
          onClose={doors.closePulseModal}
          onMint={mintCarrying}
          onGrowVision={handleGrowVision}
          onProposeAlignment={async (data: Parameters<typeof proposeAlignment>[0]) => { await proposeAlignment(data); }}
          onGrown={handleTreeGrown}
          uploading={uploading}
          handleImageUpload={handleImageUpload}
          uploadBase64Image={uploadBase64Image}
        />
      )}

      {doors.showVisionModal && (
        <CreateVisionModal
          lightseed={lightseed}
          activeTree={activeTree}
          trees={myTrees}
          onClose={() => doors.setShowVisionModal(false)}
          onCreate={async (data: Parameters<typeof createVision>[0]) => { await createVision(data); }}
          uploading={uploading}
          handleImageUpload={handleImageUpload}
          uploadBase64Image={uploadBase64Image}
        />
      )}
    </Suspense>
  );
};
