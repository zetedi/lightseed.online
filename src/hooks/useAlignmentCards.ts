import { useState, useEffect, useMemo } from 'react';
import type { Alignment, Lifetree } from '../types';
import { getLifetreeById, getPulseById, getPersonName } from '../services/firebase';

// A pending alignment, hydrated for display: the two trees (theirs + yours), the two matched
// pulses' text, and the human behind the initiating tree. The raw Alignment only stores ids, so
// the Observatory card resolves them here once (keyed by the set of alignment ids) rather than
// showing the opaque "from another tree" placeholder.
export interface AlignmentCard {
  id: string;
  createdAt?: Alignment['createdAt'];
  theirTree: { id: string; name: string; imageUrl?: string; ownerName?: string };
  yourTree: { id: string; name: string; imageUrl?: string };
  theirPulse?: { title?: string; body?: string };
  yourPulse?: { title?: string; body?: string };
}

const treeImage = (t?: Lifetree | null) => t?.latestGrowthUrl || t?.imageUrl;

export const useAlignmentCards = (alignments: Alignment[], myTrees: Lifetree[]): AlignmentCard[] => {
  const idKey = alignments.map(a => a.id).join(',');

  // A synchronous placeholder for each alignment so the Observatory shows the right number of
  // cards immediately (no flash of the "field is calm" empty state while the details resolve).
  // `yourTree` is a local lookup, so it's correct from the first paint; `theirTree`/pulses fill in.
  const seed = useMemo<AlignmentCard[]>(() => alignments.map(a => {
    const yourTree = myTrees.find(t => t.id === a.targetTreeId) || null;
    return {
      id: a.id,
      createdAt: a.createdAt,
      theirTree: { id: a.initiatorTreeId, name: 'A tree' },
      yourTree: { id: a.targetTreeId, name: yourTree?.name || 'Your tree', imageUrl: treeImage(yourTree) },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [idKey, myTrees]);

  const [enriched, setEnriched] = useState<Record<string, AlignmentCard>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale enriched cards when the alignment list empties
    if (!alignments.length) { setEnriched({}); return; }
    let alive = true;
    (async () => {
      const entries = await Promise.all(alignments.map(async (a): Promise<[string, AlignmentCard]> => {
        const [theirTree, theirPulse, yourPulse, ownerName] = await Promise.all([
          getLifetreeById(a.initiatorTreeId).catch(() => null),
          getPulseById(a.initiatorPulseId).catch(() => null),
          getPulseById(a.targetPulseId).catch(() => null),
          getPersonName(a.initiatorUid).catch(() => undefined),
        ]);
        const yourTree = myTrees.find(t => t.id === a.targetTreeId) || null;
        return [a.id, {
          id: a.id,
          createdAt: a.createdAt,
          theirTree: { id: a.initiatorTreeId, name: theirTree?.name || 'A tree', imageUrl: treeImage(theirTree), ownerName },
          yourTree: { id: a.targetTreeId, name: yourTree?.name || 'Your tree', imageUrl: treeImage(yourTree) },
          theirPulse: theirPulse ? { title: theirPulse.title, body: theirPulse.body } : undefined,
          yourPulse: yourPulse ? { title: yourPulse.title, body: yourPulse.body } : undefined,
        }];
      }));
      if (alive) setEnriched(Object.fromEntries(entries));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  // Prefer the enriched card once resolved; fall back to the synchronous seed meanwhile.
  return seed.map(s => enriched[s.id] || s);
};
