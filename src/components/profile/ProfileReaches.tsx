import React, { useState, useEffect } from 'react';
import { Lifetree, Lightseed, Pulse, ReachAudience } from '../../types';
import { fetchMyReaches } from '../../services/firebase';
import { useRefreshSignal } from '../../hooks/useRefreshSignal';
import { ReachInbox } from '../inspiration/ReachInbox';

interface ProfileReachesProps {
  lightseed: Lightseed;
  myTrees: Lifetree[];
  reachPartner?: Lifetree | null;
  reachAudience?: ReachAudience;
  onConsumeReach?: () => void;
  onOpenTreeById?: (treeId: string) => void;
  onOpenCareById?: (treeId: string) => void;
}

// Direct Messages tab — the ReachInbox fed with all reaches involving me. The inbox renders
// immediately (no loading gate): opening a reach from a tree keeps the requested thread —
// remounting on load would drop the selection.
export const ProfileReaches: React.FC<ProfileReachesProps> = ({
  lightseed,
  myTrees,
  onOpenTreeById,
  onOpenCareById,
  reachPartner,
  reachAudience,
  onConsumeReach,
}) => {
  const [reaches, setReaches] = useState<Pulse[]>([]);
  // A watering posts into the guardians' thread from another screen entirely; the bus is how an
  // open inbox learns of it (the list updates in place, so the reader keeps the thread they are in).
  const signal = useRefreshSignal(['reaches']);

  useEffect(() => {
    let alive = true;
    fetchMyReaches(lightseed.uid)
      .then((res) => { if (alive) setReaches(res.items); })
      .catch((e) => console.error('Fetch profile data error', e));
    return () => { alive = false; };
  }, [lightseed.uid, signal]);

  return (
    <ReachInbox
      pulses={reaches}
      myTrees={myTrees}
      lightseed={lightseed}
      onOpenTreeById={onOpenTreeById}
      onOpenCareById={onOpenCareById}
      requestedPartner={reachPartner || null}
      requestedAudience={reachAudience}
      onConsumeRequested={onConsumeReach}
    />
  );
};
