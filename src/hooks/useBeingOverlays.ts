import { useState, useEffect } from 'react';
import type { Alignment, Community, Lifetree, Pulse, Vision } from '../types';
import type { LightHouse } from '../domain/lightHouse';
import { getAlignmentById, getLifetreeById, getPulseById, getCommunityById, getLightHouseById } from '../services/firebase';
import { onRefresh, type RefreshEvent } from '../services/refreshBus';
import { followEdit } from '../domain/refreshFollow';

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
  // AN EDIT IS SEEN WHERE IT STANDS (ring 2026-10-05; domain/refreshFollow): the open beings
  // follow the refresh bus. A whisper that names the open being and carries its patch is laid
  // over the copy; one that names it with no patch re-reads the document whole; every other
  // whisper is ignored. Before this only the open TREE followed (and only patches), so an edit
  // announced without its patch — a Light House's place, a mended home — stood stale on screen.
  useEffect(() => onRefresh((e: RefreshEvent) => {
    const follow = <T extends { id: string }>(
      topics: RefreshEvent['topic'][],
      set: React.Dispatch<React.SetStateAction<T | null>>,
      read: (id: string) => Promise<T | null>,
    ) => {
      if (!topics.includes(e.topic) || !e.id) return;
      set(open => {
        const action = followEdit(open?.id, e);
        if (action.kind === 'merge') return open ? { ...open, ...action.patch } as T : open;
        if (action.kind === 'reread') read(e.id!).then(fresh => { if (fresh) set(cur => (cur && cur.id === fresh.id ? fresh : cur)); }).catch(() => {});
        return open;
      });
    };
    follow<Lifetree>(['trees', 'beds'], setSelectedTree, getLifetreeById);
    follow<Pulse>(['events', 'pulses'], setSelectedPulse, getPulseById);
    follow<Community>(['communities'], setSelectedCommunity, getCommunityById);
    follow<LightHouse>(['lightHouses', 'beds'], setViewingLightHouse, getLightHouseById);
  }), []);
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
