import { useEffect, useMemo, useState } from 'react';
import { firestoreStore } from '../adapters/firestore';
import { getMyCommunities } from '../services/firebase';
import { isHubDomain } from './useConfig';
import type { Lifetree, Lightseed } from '../types';

// The pathway's link-borne facts — the signals derivePathway needs that don't already live in
// the session (membership, followed visions, the circle on my trees, my community). Read once
// per sign-in / tree-set change through the Store port; each read is best-effort so a missing
// permission or offline start degrades to "not yet" rather than an error. `loaded` gates the
// CTA so the wrong stage never flashes while facts are in flight.
export interface PathwayFacts {
  loaded: boolean;
  isMember: boolean;
  followedVisionsCount: number;
  circleSize: number;
  ownsCommunity: boolean;
  communityHasCustomDomain: boolean;
  communityHasTheme: boolean;
}

const EMPTY: PathwayFacts = {
  loaded: false,
  isMember: false,
  followedVisionsCount: 0,
  circleSize: 0,
  ownsCommunity: false,
  communityHasCustomDomain: false,
  communityHasTheme: false,
};

export const usePathwayFacts = (lightseed: Lightseed | null, myTrees: Lifetree[]): PathwayFacts => {
  const [facts, setFacts] = useState<PathwayFacts>(EMPTY);
  // Key the effect on the tree ID SET, not the array identity — refreshTrees mints new arrays
  // with the same trees, and each would otherwise re-run the whole fact sweep.
  const treeIdsKey = useMemo(() => myTrees.map(t => t.id).sort().join(','), [myTrees]);
  const uid = lightseed?.uid;

  useEffect(() => {
    if (!uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset-on-signout; a signed-out visitor's facts are known immediately
      setFacts({ ...EMPTY, loaded: true });
      return;
    }
    let alive = true;
    const treeIds = treeIdsKey ? treeIdsKey.split(',') : [];
    Promise.all([
      firestoreStore.linksFrom(uid, 'member').catch(() => []),
      firestoreStore.linksFrom(uid, 'joined').catch(() => []),
      Promise.all(treeIds.map(id => firestoreStore.linksTo(id).catch(() => []))),
      getMyCommunities(uid).catch(() => []),
    ]).then(([memberLinks, joinedLinks, perTreeLinks, communities]) => {
      if (!alive) return;
      const circleSize = perTreeLinks.flat().filter(l => l.rel === 'co_owner' || l.rel === 'steward').length;
      const community = communities[0];
      const theme = community?.theme;
      setFacts({
        loaded: true,
        isMember: memberLinks.length > 0,
        followedVisionsCount: joinedLinks.length,
        circleSize,
        ownsCommunity: communities.length > 0,
        communityHasCustomDomain: !!community && !isHubDomain(community.domain),
        communityHasTheme: !!theme && Object.values(theme).some(v => !!v),
      });
    });
    return () => { alive = false; };
  }, [uid, treeIdsKey]);

  return facts;
};
