import React, { lazy } from 'react';
import type { Community, Lifetree, ReachAudience, Vision } from '../../types';
import type { BeingOverlays } from '../../hooks/useBeingOverlays';
import type { ModalDoors } from '../../hooks/useModalDoors';
import type { useSiteTheme } from '../../hooks/useSiteTheme';
import { useSession } from '../../contexts/SessionContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { validateLifetree, unvalidateLifetree } from '../../services/firebase';
import { canEditEvent } from '../../domain/pulseVisibility';
import { isBedTree } from '../../domain/bed';
import { notify } from '../ui/Toast';
import { showAlert } from '../ui/Dialog';
import { speak } from '../../utils/translations';

const LifetreeDetail = lazy(() => import('../LifetreeDetail').then(m => ({ default: m.LifetreeDetail })));
const BedProfile = lazy(() => import('../beds/BedProfile').then(m => ({ default: m.BedProfile })));
const VisionProfile = lazy(() => import('../VisionProfile').then(m => ({ default: m.VisionProfile })));
const EventProfile = lazy(() => import('../EventProfile').then(m => ({ default: m.EventProfile })));
const GrowthPlayerModal = lazy(() => import('../GrowthPlayerModal').then(m => ({ default: m.GrowthPlayerModal })));
const OfferingProfile = lazy(() => import('../offerings/OfferingProfile').then(m => ({ default: m.OfferingProfile })));
const AlignmentView = lazy(() => import('../sections/AlignmentView').then(m => ({ default: m.AlignmentView })));
const CovenantProfile = lazy(() => import('../CovenantProfile').then(m => ({ default: m.CovenantProfile })));

type EffectiveTheme = ReturnType<typeof useSiteTheme>['effectiveTheme'];

// Whether a being stands in-flow on the page (below the sticky nav), in place of the tab's
// content. Non-event, non-offering pulses ride the full-screen overlay instead (AppOverlays).
export const isBeingDetailOpen = (b: Pick<BeingOverlays, 'selectedTree' | 'selectedVision' | 'selectedAlignment' | 'selectedCovenantId' | 'selectedPulse'>): boolean =>
  !!(b.selectedTree || b.selectedVision || b.selectedAlignment || b.selectedCovenantId
    || (b.selectedPulse && (b.selectedPulse.type === 'offering' || b.selectedPulse.type === 'event')));

// THE BEING IN-FLOW (ring 2026-09-16, lifted out of App.tsx unchanged): the open tree (or
// bed), vision, alignment, covenant, offering or event, rendered below the header in place
// of the tab's page. One at a time, in the order the shell always preferred them.
export const BeingDetail: React.FC<{
  beings: BeingOverlays;
  doors: ModalDoors;
  hostCommunity: Community | null;
  impersonatedCommunity: Community | null;
  theme: EffectiveTheme;
  carryingTree: Lifetree | null;
  setCarryingTree: (tree: Lifetree | null) => void;
  handleTreeUpdate: (treeId: string, updates: Partial<Lifetree>) => void;
  handleDeleteTreeConfirmed: (treeId: string) => Promise<void>;
  handleDeleteVision: (visionId: string) => Promise<void>;
  openReach: (tree: Lifetree | null, audience?: ReachAudience) => void;
  loadContent: (reset?: boolean) => void;
}> = ({ beings, doors, hostCommunity, impersonatedCommunity, theme, carryingTree, setCarryingTree, handleTreeUpdate, handleDeleteTreeConfirmed, handleDeleteVision, openReach, loadContent }) => {
  const { t } = useLanguage();
  const { lightseed, myTrees, activeTree, defaultTreeId, setDefaultTree, isAdmin, isSuperAdmin, isInitiate } = useSession();
  const {
    selectedTree, setSelectedTree, selectedVision, setSelectedVision, selectedAlignment, setSelectedAlignment,
    selectedCovenantId, setSelectedCovenantId, selectedPulse, setSelectedPulse, bumpMapRefresh,
    onViewPulseOrAlignment, treeSectionHint,
  } = beings;
  const host = impersonatedCommunity || hostCommunity;

  if (selectedTree) return (
    <div className="animate-in fade-in duration-200">
      {isBedTree(selectedTree) ? (
        <BedProfile
          bed={selectedTree}
          onClose={() => { setSelectedTree(null); bumpMapRefresh(); }}
          onViewTree={setSelectedTree}
          onViewPulse={onViewPulseOrAlignment}
          onUpdate={(updates: Partial<Lifetree>) => handleTreeUpdate(selectedTree.id, updates)}
          onDelete={() => { setSelectedTree(null); bumpMapRefresh(); }}
        />
      ) : (
        <LifetreeDetail
          tree={selectedTree}
          host={host}
          onClose={() => { setSelectedTree(null); bumpMapRefresh(); }}
          onPlayGrowth={doors.setShowGrowthPlayer}
          onValidate={(id: string, nextValidated: boolean) => (nextValidated
            ? validateLifetree(id, (isSuperAdmin || isInitiate) ? lightseed!.uid : activeTree!.id)
            : unvalidateLifetree(id)
          ).then(() => {
            handleTreeUpdate(id, {
              validated: nextValidated,
              validatorId: nextValidated ? ((isSuperAdmin || isInitiate) ? lightseed!.uid : activeTree!.id) : null,
            } as Partial<Lifetree>);
            notify(speak(nextValidated ? 'validated_toast' : 'validation_removed_toast'));
            loadContent(true);
          })}
          onUpdate={(updates: Partial<Lifetree>) => handleTreeUpdate(selectedTree.id, updates)}
          onDelete={() => { handleDeleteTreeConfirmed(selectedTree.id); setSelectedTree(null); }}
          onCreatePulse={() => doors.openPulseModal(selectedTree)}
          onReachTree={(tree: Lifetree) => openReach(tree)}
          onAlertGuardians={() => openReach(selectedTree, 'guardians')}
          onViewPulse={onViewPulseOrAlignment}
          initialSection={treeSectionHint || undefined}
          // Superadmin voice-bridge: carry this being's pulses (see useCarrying).
          carrying={carryingTree?.id === selectedTree.id}
          onCarry={isSuperAdmin ? setCarryingTree : undefined}
          isDefaultTree={defaultTreeId === selectedTree.id}
          onSetDefault={() => { setDefaultTree(selectedTree.id); showAlert(t('default_tree_set_toast').replace('{name}', selectedTree.name)); }}
          targetUserProfile={{ onlyValidatedCanReach: selectedTree.onlyValidatedCanReach }}
        />
      )}
      {doors.showGrowthPlayer && <GrowthPlayerModal treeId={doors.showGrowthPlayer} onClose={() => doors.setShowGrowthPlayer(null)} />}
    </div>
  );

  if (selectedVision) return (
    <div className="animate-in fade-in duration-200">
      <VisionProfile
        vision={selectedVision}
        onClose={() => setSelectedVision(null)}
        currentUserId={lightseed?.uid}
        onDelete={handleDeleteVision}
        myTrees={myTrees}
        onGrow={(v: Vision) => doors.openVisionGrowth(v)}
        onViewPulse={(p) => setSelectedPulse(p)}
        onOffer={(v: Vision) => doors.openOffer({ kind: 'vision', id: v.id, lid: v.lid, name: v.title, keeperUid: v.authorId, rootTreeId: v.lifetreeId })}
        onViewTree={(tree) => { setSelectedVision(null); setSelectedTree(tree); }}
        hostStrictScope={host?.strictScope}
      />
    </div>
  );

  if (selectedAlignment) return (
    <div className="animate-in fade-in duration-200">
      <AlignmentView
        alignment={selectedAlignment}
        currentUserId={lightseed?.uid}
        onClose={() => setSelectedAlignment(null)}
        onViewTree={(tree) => { setSelectedAlignment(null); setSelectedTree(tree); }}
        notify={notify}
      />
    </div>
  );

  if (selectedCovenantId) return (
    <div className="animate-in fade-in duration-200">
      <CovenantProfile
        covenantId={selectedCovenantId}
        currentUserId={lightseed?.uid}
        onClose={() => setSelectedCovenantId(null)}
        notify={notify}
      />
    </div>
  );

  if (selectedPulse && selectedPulse.type === 'offering') return (
    // An offering has its own being-face; its tree view is its lifecycle.
    <div className="animate-in fade-in duration-200">
      <OfferingProfile
        offering={selectedPulse}
        onClose={() => setSelectedPulse(null)}
        onUpdate={(u) => setSelectedPulse(prev => prev ? { ...prev, ...u } : prev)}
        onEdit={() => doors.setEditingOffering(selectedPulse)}
      />
    </div>
  );

  if (selectedPulse && selectedPulse.type === 'event') return (
    // Events render in-flow (below the sticky nav header), like the tree/vision views.
    <div className="animate-in fade-in duration-200">
      <EventProfile
        theme={theme}
        pulse={selectedPulse}
        activeTree={activeTree}
        onClose={() => setSelectedPulse(null)}
        canEdit={canEditEvent(selectedPulse, { uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin }, { hostCommunity })}
        onEdit={() => doors.setEditingEvent(selectedPulse)}
        currentUserId={lightseed?.uid}
        myTrees={myTrees}
        hostStrictScope={host?.strictScope}
      />
    </div>
  );

  return null;
};
