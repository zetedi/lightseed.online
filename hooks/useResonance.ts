import { useEffect, useMemo, useState } from 'react';
import type { Lifetree, ReachAudience, VisionSynergy } from '../types';
import { fetchVisions, getLifetreeById } from '../services/firebase';
import { findVisionSynergies } from '../services/gemini';
import { showAlert } from '../components/ui/Dialog';
import { resonanceId } from '../components/ResonancePanel';

// Resonance refreshes once a week for members; admins have no limit. The whole point is
// to protect the AI bill (each analysis spends the reader's key — or the node's).
const SYNERGY_COOLDOWN = 7 * 24 * 3600 * 1000;

// AI vision-resonance, extracted from App verbatim: the weekly-gated synergy analysis plus the
// favourites list, both cached in localStorage so they survive reloads (and feed the Observatory)
// without re-spending. `data` is the current forest feed (source for the in-tab "Analyse");
// `openReach` starts a conversation with a resonant tree.
export function useResonance(params: {
  data: any[];
  preferredIntelligenceId: string | undefined;
  isStaff: boolean;
  openReach: (tree: Lifetree | null, audience?: ReachAudience) => void;
}) {
  const { data, preferredIntelligenceId, isStaff, openReach } = params;

  const [synergies, setSynergies] = useState<VisionSynergy[]>([]);
  const [isAnalyzingSynergy, setIsAnalyzingSynergy] = useState(false);
  const [lastSynergyAt, setLastSynergyAt] = useState(0); // ms of the last analysis (cost gate)
  const [favoriteResonances, setFavoriteResonances] = useState<VisionSynergy[]>([]);
  const favoriteResonanceIds = useMemo(() => new Set(favoriteResonances.map(resonanceId)), [favoriteResonances]);

  const toggleFavoriteResonance = (s: VisionSynergy) => {
    setFavoriteResonances(prev => {
      const id = resonanceId(s);
      const next = prev.some(f => resonanceId(f) === id) ? prev.filter(f => resonanceId(f) !== id) : [...prev, s];
      try { localStorage.setItem('resonance_favorites_v1', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // A stable fingerprint of a vision set, so a cached result is tied to its visions.
  const synergyKey = (items: any[]) => items.map(v => v.id).sort().join(',');

  const synergyCooldownLeft = lastSynergyAt ? SYNERGY_COOLDOWN - (Date.now() - lastSynergyAt) : 0;
  const canRefreshResonance = isStaff || synergyCooldownLeft <= 0;

  // The single analysis path: gate → fetch visions → analyse → cache. Callers supply how
  // to get the visions (the current tab's list, or a fresh network fetch from Observatory).
  const runResonance = async (getVisions: () => Promise<any[]>) => {
    if (!canRefreshResonance) {
      const days = Math.max(1, Math.ceil(synergyCooldownLeft / (24 * 3600 * 1000)));
      showAlert(`Resonance refreshes once a week — about ${days} more day${days === 1 ? '' : 's'} to go.`);
      return;
    }
    setIsAnalyzingSynergy(true);
    try {
      const visions = await getVisions();
      if (visions.length < 2) { showAlert('At least two visions are needed to find resonance.'); setIsAnalyzingSynergy(false); return; }
      // Label each vision by its TREE name (visions are often auto-titled "Root Vision"),
      // so resonances read tree-to-tree rather than "Root Vision + Root Vision".
      const treeIds = Array.from(new Set(visions.map((v: any) => v.lifetreeId).filter(Boolean)));
      const treeInfo = new Map<string, { name?: string; place?: string }>();
      await Promise.all(treeIds.map(async (tid: string) => {
        try { const tr = await getLifetreeById(tid); if (tr) treeInfo.set(tid, { name: tr.name, place: (tr as any).locationName }); } catch {}
      }));
      const labeled = visions.map((v: any) => {
        const tid = v.lifetreeId;
        const info = tid ? treeInfo.get(tid) : undefined;
        const generic = !v.title || v.title.trim().toLowerCase() === 'root vision';
        // place + vision are the two bases of the resonance analysis.
        return { ...v, title: info?.name || (generic ? 'A vision' : v.title), place: info?.place || '' };
      });
      // Map the labels back to tree ids so a conversation can be started from a resonance.
      const treeIdByName = new Map<string, string>();
      labeled.forEach((v: any) => { const tid = v.lifetreeId; if (tid && v.title) treeIdByName.set(v.title.trim().toLowerCase(), tid); });
      const results = (await findVisionSynergies(labeled, preferredIntelligenceId)).map(r => ({
        ...r,
        tree1Id: treeIdByName.get((r.vision1Title || '').trim().toLowerCase()),
        tree2Id: treeIdByName.get((r.vision2Title || '').trim().toLowerCase()),
      }));
      setSynergies(results);
      const at = Date.now();
      setLastSynergyAt(at);
      // Cache so the resonances survive reloads (and feed the Observatory) without re-spending.
      try { localStorage.setItem('synergy_cache_v1', JSON.stringify({ key: synergyKey(visions), at, results })); } catch {}
      if (results.length === 0) showAlert('No clear resonances surfaced this time — try again as more visions grow.');
    } catch (e) {
      console.error(e);
      showAlert('Synergy analysis failed. Try again later.');
    }
    setIsAnalyzingSynergy(false);
  };

  const handleAnalyzeSynergy = () => runResonance(async () => data);
  const refreshResonanceObservatory = () => runResonance(async () => (await fetchVisions()).items);

  // Start a conversation with a resonant tree — resolve it, then open the reach thread.
  const reachResonantTree = async (treeId: string) => {
    try { const tree = await getLifetreeById(treeId); if (tree) openReach(tree); }
    catch { showAlert('Could not open a conversation with that tree.'); }
  };

  // Hydrate cached resonances on load (any tab) so the Observatory and Visions tab both
  // show the last result, and the weekly cooldown is known.
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('synergy_cache_v1') || 'null');
      if (cached) {
        if (Array.isArray(cached.results)) setSynergies(cached.results);
        if (cached.at) setLastSynergyAt(cached.at);
      }
      const favs = JSON.parse(localStorage.getItem('resonance_favorites_v1') || 'null');
      if (Array.isArray(favs)) setFavoriteResonances(favs);
    } catch {}
  }, []);

  return {
    synergies,
    isAnalyzingSynergy,
    lastSynergyAt,
    canRefreshResonance,
    synergyCooldownLeft,
    favoriteResonanceIds,
    toggleFavoriteResonance,
    handleAnalyzeSynergy,
    refreshResonanceObservatory,
    reachResonantTree,
  };
}
