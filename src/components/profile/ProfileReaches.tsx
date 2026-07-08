import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Lifetree, Lightseed, Pulse, ReachAudience } from '../../types';
import { fetchMyReaches } from '../../services/firebase';
import { ReachInbox } from '../inspiration/ReachInbox';

interface ProfileReachesProps {
  lightseed: Lightseed;
  myTrees: Lifetree[];
  reachPartner?: Lifetree | null;
  reachAudience?: ReachAudience;
  onConsumeReach?: () => void;
}

// Direct Messages tab — the ReachInbox fed with all reaches involving me. The inbox renders
// immediately (no loading gate): opening a reach from a tree keeps the requested thread —
// remounting on load would drop the selection.
export const ProfileReaches: React.FC<ProfileReachesProps> = ({
  lightseed,
  myTrees,
  reachPartner,
  reachAudience,
  onConsumeReach,
}) => {
  const { t } = useLanguage();
  const [reaches, setReaches] = useState<Pulse[]>([]);

  useEffect(() => {
    let alive = true;
    fetchMyReaches(lightseed.uid)
      .then((res) => { if (alive) setReaches(res.items); })
      .catch((e) => console.error('Fetch profile data error', e));
    return () => { alive = false; };
  }, [lightseed.uid]);

  return (
    <ReachInbox
      pulses={reaches}
      myTrees={myTrees}
      lightseed={lightseed}
      title={t('direct_messages')}
      requestedPartner={reachPartner || null}
      requestedAudience={reachAudience}
      onConsumeRequested={onConsumeReach}
    />
  );
};
