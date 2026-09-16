import { useState } from 'react';
import type { Lifetree, Pulse, ReachAudience, Vision } from '../types';
import type { OfferedTo } from '../domain/offering';

export type PlantInit = { type?: 'LIFETREE' | 'GUARDED'; step?: number };

// THE MODAL DOORS (ring 2026-09-16, lifted out of App.tsx unchanged). Every dialog the
// shell can open — sign-in, plant, pulse, event, offer, vision, growth player, the reach
// inbox, the care sheet, the Path overview — with the small openers that aim them (the
// pulse modal at a tree or a vision, the plant modal at a type's step, the offer form at
// a being). One object, so the menu, the pages, the overlays and the arrivals all pull
// the same handles.
export function useModalDoors() {
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [showPlantModal, setShowPlantModal] = useState(false);
  // How the plant modal should open: optionally straight to a type's plant step
  // (e.g. the "Guard Tree" button jumps past the type selection).
  const [plantInit, setPlantInit] = useState<PlantInit>({});
  const openPlant = (init: PlantInit = {}) => {
    setPlantInit(init);
    setShowPlantModal(true);
  };

  const [showPulseModal, setShowPulseModal] = useState(false);
  // When growing from a specific tree's page, the pulse modal targets THAT tree (not the
  // active one). Reset to null for the generic "emit pulse" entry points.
  const [pulseTargetTree, setPulseTargetTree] = useState<Lifetree | null>(null);
  // When growing from a vision's page, the pulse modal targets THAT vision (vision growth).
  const [pulseTargetVision, setPulseTargetVision] = useState<Vision | null>(null);
  const openPulseModal = (target: Lifetree | null = null) => { setPulseTargetTree(target); setPulseTargetVision(null); setShowPulseModal(true); };
  const openVisionGrowth = (vision: Vision) => { setPulseTargetVision(vision); setPulseTargetTree(null); setShowPulseModal(true); };
  const closePulseModal = () => { setShowPulseModal(false); setPulseTargetTree(null); setPulseTargetVision(null); };

  const [showEventModal, setShowEventModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  // The offering of care (ring 2026-09-06): the being the offer form is pointed at, when it is.
  const [offerTo, setOfferTo] = useState<OfferedTo | null>(null);
  const openOffer = (to: OfferedTo) => { setOfferTo(to); setShowOfferModal(true); };
  const closeOffer = () => { setShowOfferModal(false); setOfferTo(null); };
  // The offering being retold (its own modal layer, nested on the offering profile).
  const [editingOffering, setEditingOffering] = useState<Pulse | null>(null);
  const [showVisionModal, setShowVisionModal] = useState(false);
  const [showGrowthPlayer, setShowGrowthPlayer] = useState<string | null>(null);
  const [matchCandidate, setMatchCandidate] = useState<Pulse | null>(null);
  const [editingEvent, setEditingEvent] = useState<Pulse | null>(null);

  // The Reach inbox as a large overlay — the envelope (and reach deep-links) open messages
  // in place instead of steering to the profile tab, which keeps its own Reaches tab.
  const [showReachModal, setShowReachModal] = useState(false);
  const [reachTree, setReachTree] = useState<Lifetree | null>(null);
  // Preselected audience for a requested reach — 'guardians' when opened from a danger alert.
  const [reachAudience, setReachAudience] = useState<ReachAudience | undefined>(undefined);

  // The care corner's modal (the small care sheet), open when the droplet is pressed.
  const [careModalOpen, setCareModalOpen] = useState(false);
  // A care ping in the reaches opens the simple care modal FOR THAT TREE — the same modal the
  // bead opens, aimed by the message instead of the default-tree cascade.
  const [careOverride, setCareOverride] = useState<Lifetree | null>(null);
  // The Path overview — the Light Path's full ruleset, opened from the card's label.
  const [showPathOverview, setShowPathOverview] = useState(false);
  // A blocking overlay for the few operations that take a beat (a vision's cascade delete removes
  // its chain + links). Darkens the app, shows the spinner, and confirms in a snackbar when done.
  const [busyLabel, setBusyLabel] = useState<string | null>(null);

  return {
    showAuthModal, setShowAuthModal,
    showPlantModal, setShowPlantModal, plantInit, openPlant,
    showPulseModal, setShowPulseModal, pulseTargetTree, pulseTargetVision, openPulseModal, openVisionGrowth, closePulseModal,
    showEventModal, setShowEventModal,
    showOfferModal, setShowOfferModal, offerTo, openOffer, closeOffer,
    editingOffering, setEditingOffering,
    showVisionModal, setShowVisionModal,
    showGrowthPlayer, setShowGrowthPlayer,
    matchCandidate, setMatchCandidate,
    editingEvent, setEditingEvent,
    showReachModal, setShowReachModal, reachTree, setReachTree, reachAudience, setReachAudience,
    careModalOpen, setCareModalOpen, careOverride, setCareOverride,
    showPathOverview, setShowPathOverview,
    busyLabel, setBusyLabel,
  };
}
export type ModalDoors = ReturnType<typeof useModalDoors>;
