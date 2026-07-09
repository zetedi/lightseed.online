import { useEffect, useState } from 'react';
import type { Lifetree, Lightseed, Pulse } from '../types';
import { listenToMyReaches, listenToReachesForTrees } from '../services/firebase';

// The live unread-reach count powering the nav's red envelope indicator. Two Firestore listeners —
// reaches addressed to me (recipientUid) AND reaches aimed at any of my trees (reachTreeId, a safety
// net so I'm still notified when a send didn't capture recipientUid) — merged and de-duplicated by
// id. Extracted from App verbatim; returns 0 while signed out.
export function useReaches(lightseed: Lightseed | null, myTrees: Lifetree[]): number {
  const [unreadReaches, setUnreadReaches] = useState(0);
  const myTreeIdsKey = myTrees.map(tree => tree.id).join(',');
  const uid = lightseed?.uid;

  useEffect(() => {
    if (!uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the unread count when the user signs out
      setUnreadReaches(0);
      return;
    }
    const byRecipient = new Map<string, Pulse>();
    const byTree = new Map<string, Pulse>();
    const recompute = () => {
      const merged = new Map<string, Pulse>([...byRecipient, ...byTree]);
      let unread = 0;
      merged.forEach(p => {
        if (p.authorId !== uid && !(p.seenBy || []).includes(uid)) unread++;
      });
      setUnreadReaches(unread);
    };
    const unsubRecipient = listenToMyReaches(uid, (pulses) => {
      byRecipient.clear();
      pulses.forEach(p => byRecipient.set(p.id, p));
      recompute();
    });
    const unsubTrees = listenToReachesForTrees(myTreeIdsKey ? myTreeIdsKey.split(',') : [], (pulses) => {
      byTree.clear();
      pulses.forEach(p => byTree.set(p.id, p));
      recompute();
    });
    return () => { unsubRecipient(); unsubTrees(); };
  }, [uid, myTreeIdsKey]);

  return unreadReaches;
}
