import { useMemo } from 'react';
import type { Lifetree, Lightseed } from '../types';
import type { PathwayInput } from '../domain/pathway';
import { isWateringOverdue } from '../domain/watering';
import { sustainingSeven } from '../domain/sustainingSeven';
import { usePathwayFacts } from './usePathwayFacts';

// THE PATHWAY'S FACTS (ring 2026-09-16, lifted out of App.tsx unchanged). The plain facts
// derivePathway reads (domain/pathway): session facts straight from the trees/stats in hand,
// the link-borne ones (membership, followed visions, my circle, my community) from
// usePathwayFacts — and the thirsty-tree count the nav's blue care marker shows.
export function usePathwayInput(params: {
  lightseed: Lightseed | null;
  myTrees: Lifetree[];
  guardedTrees: Lifetree[];
  statsAlignments: number;
  pendingAlignments: number;
}) {
  const { lightseed, myTrees, guardedTrees, statsAlignments, pendingAlignments } = params;

  // Trees of mine (owned or guarded) whose watering is overdue — drives the blue care marker
  // on the nav envelope, computed straight from the trees so it shows even before the daily
  // sweep mints a "water me" reach.
  // myTrees (owned, non-nature) and guardedTrees (guardian edges + owned nature) can overlap — a
  // tree you own AND hold a guardian link to sits in both. Dedupe by id so one thirsty tree is
  // counted once (the badge was reading 2 for a single overdue tree whose droplet draws once).
  const wateringNeededCount = useMemo(() => {
    const byId = new Map<string, Lifetree>();
    for (const tree of [...myTrees, ...guardedTrees]) byId.set(tree.id, tree);
    return [...byId.values()].filter(t => isWateringOverdue(t)).length;
  }, [myTrees, guardedTrees]);

  const pathwayFacts = usePathwayFacts(lightseed, myTrees);
  const pathwayInput = useMemo<PathwayInput>(() => {
    // Most recent EXPLICIT care (lastCaredAt) across own + guarded trees. Planting alone
    // is not caring — no fallback to createdAt here (that's validation's window, not ours).
    const caredMillis = [...myTrees, ...guardedTrees]
      .map(t => (t.lastCaredAt && typeof t.lastCaredAt.toMillis === 'function' ? t.lastCaredAt.toMillis() : 0))
      .filter(ms => ms > 0);
    return {
      signedIn: !!lightseed,
      myTreesCount: myTrees.length,
      guardedCount: guardedTrees.length,
      lastCaredAtMs: caredMillis.length ? Math.max(...caredMillis) : null,
      wateringOverdue: wateringNeededCount > 0,
      connectionsCount: statsAlignments + pendingAlignments,
      isMember: pathwayFacts.isMember,
      followedVisionsCount: pathwayFacts.followedVisionsCount,
      circleSize: pathwayFacts.circleSize,
      tendedCount: pathwayFacts.tendedCount,
      // The floor of seven, read by the same pure rule as the profile card.
      sevenSustaining: lightseed ? sustainingSeven(myTrees, pathwayFacts.guardianEdges, lightseed.uid).sustaining : 0,
      ownsCommunity: pathwayFacts.ownsCommunity,
      communityHasCustomDomain: pathwayFacts.communityHasCustomDomain,
      communityHasTheme: pathwayFacts.communityHasTheme,
    };
  }, [lightseed, myTrees, guardedTrees, wateringNeededCount, statsAlignments, pendingAlignments, pathwayFacts]);

  return { wateringNeededCount, pathwayFacts, pathwayInput };
}
