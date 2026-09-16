import { useState, useEffect } from 'react';
import type { Alignment, Community, Lifetree, Pulse, Vision } from '../types';
import type { LightHouse } from '../domain/lightHouse';
import { getAlignmentById, getLifetreeById } from '../services/firebase';

// THE OPEN BEINGS (ring 2026-09-16, lifted out of App.tsx unchanged). Which being stands
// on screen: a tree (and the section it should open at), a vision, an alignment, a
// covenant, a pulse, a community, a Light House — and the one router every surface uses
// to open a pulse (an alignment sync-block opens the AlignmentView, everything else the
// pulse). The shell composes these; the overlays, the menu and the arrivals read and set
// them through this one object.
export function useBeingOverlays() {
  const [selectedTree, setSelectedTree] = useState<Lifetree | null>(null);
  // Which section the tree detail should open at (e.g. 'care' from the profile's droplet).
  const [treeSectionHint, setTreeSectionHint] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the section hint when the tree detail closes; the hint is set from many call sites, so deriving it there is riskier than this reset
  useEffect(() => { if (!selectedTree) setTreeSectionHint(null); }, [selectedTree]);
  const [selectedVision, setSelectedVision] = useState<Vision | null>(null);
  const [selectedAlignment, setSelectedAlignment] = useState<Alignment | null>(null);
  const [selectedCovenantId, setSelectedCovenantId] = useState<string | null>(null);
  const [selectedPulse, setSelectedPulse] = useState<Pulse | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  // A Light House opened into its own profile page (from the map marker or the LightHouse tab).
  const [viewingLightHouse, setViewingLightHouse] = useState<LightHouse | null>(null);
  // Bumped whenever we finish touching a tree (guardianship, edits) so the map re-reads it.
  const [mapRefreshKey, setMapRefreshKey] = useState(0);
  const bumpMapRefresh = () => setMapRefreshKey(k => k + 1);

  // A menu tab or the profile avatar ALWAYS lands on its page: close EVERY being overlay first.
  const closeAll = () => {
    setSelectedTree(null); setSelectedVision(null); setSelectedPulse(null);
    setViewingLightHouse(null); setSelectedCommunity(null);
    setSelectedAlignment(null); setSelectedCovenantId(null);
  };

  const openTreeById = (id: string) => {
    getLifetreeById(id).then(tr => { if (tr) setSelectedTree(tr); }).catch(() => {});
  };
  const openTreeSection = (tree: Lifetree, section: string | null) => {
    setTreeSectionHint(section);
    setSelectedTree(tree);
  };

  // THE single router for opening a pulse. An alignment sync-block (isMatch) opens the same
  // AlignmentView as the profile's alignments list — one view, reached from every surface
  // (feeds, tree leaves, dashboard, community events) — instead of the raw pulse modal.
  // Every sync-block carries the alignment id in `matchId` (legacy blocks were backfilled by
  // migrateBackfillMatchIds, run 2026-07-09). Everything else opens the pulse.
  const onViewPulseOrAlignment = async (p: Pulse) => {
    if (p.isMatch && p.matchId) {
      const alignment = await getAlignmentById(p.matchId).catch(() => null);
      if (alignment) { setSelectedTree(null); setSelectedAlignment(alignment); return; }
    }
    // A leaf opened from its own tree keeps the tree beneath it — the pulse overlay
    // paints above, and Back peels it away to land on the tree again.
    setSelectedTree(prev => (prev && p.lifetreeId === prev.id) ? prev : null);
    setSelectedPulse(p);
  };
  const onViewAlignmentTree = async (treeId: string) => {
    const tr = await getLifetreeById(treeId).catch(() => null);
    if (tr) setSelectedTree(tr);
  };

  return {
    selectedTree, setSelectedTree, treeSectionHint, setTreeSectionHint,
    selectedVision, setSelectedVision, selectedAlignment, setSelectedAlignment,
    selectedCovenantId, setSelectedCovenantId, selectedPulse, setSelectedPulse,
    selectedCommunity, setSelectedCommunity, viewingLightHouse, setViewingLightHouse,
    mapRefreshKey, bumpMapRefresh, closeAll, openTreeById, openTreeSection,
    onViewPulseOrAlignment, onViewAlignmentTree,
  };
}
export type BeingOverlays = ReturnType<typeof useBeingOverlays>;
