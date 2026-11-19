import { useEffect, useState } from 'react';
import { formCommunityFromCircle } from '@backend';
import type { Community } from '../types';
import { formCircleRefusal } from '../domain/treeCircle';
import { graphStore } from '../services/store';
import { announce } from '../services/refreshBus';
import { showAlert } from '../services/dialogBus';
import { notify } from '../services/toastBus';
import { spokenLine } from '../utils/translations';

// A CIRCLE BECOMING A COMMUNITY — who may ask, the chosen name, and the ask itself. Lifted
// whole out of CommunityProfile (ring 2026-11-19).
export const useCircleForming = (
  community: Community,
  currentUserId: string | undefined,
  canEdit: boolean,
  onUpdate: ((updates: Partial<Community>) => void) | undefined,
) => {
  // A circle's GRADUATION banner (domain/treeCircle formCircleRefusal): shown to the hands
  // that may form — the keeper circle, or a keeper of the root tree. The server is the
  // one hand that stamps forming; this banner only carries the ask and the chosen name.
  const isUnformedCircle = community.formation === 'tree_keeping' && !community.formedAt;
  const [treeKeeper, setTreeKeeper] = useState(false);
  const [formName, setFormName] = useState('');
  const [forming, setForming] = useState(false);
  const [justFormed, setJustFormed] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-keys the draft + formed state when the profile switches communities
    setFormName((community.name || '').replace(/\s*Circle\s*$/i, '')); setJustFormed(false);
  }, [community.id, community.name]);
  useEffect(() => {
    if (!isUnformedCircle || !currentUserId || !community.rootLifetreeId) { setTreeKeeper(false); return; }
    let alive = true;
    graphStore.linksFrom(currentUserId, 'keeper')
      .then(links => { if (alive) setTreeKeeper(links.some(l => l.to === community.rootLifetreeId)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isUnformedCircle, currentUserId, community.rootLifetreeId]);
  const mayFormCommunity = isUnformedCircle && !justFormed && !!currentUserId
    && formCircleRefusal({
      formation: community.formation, formedAtMs: null,
      isCircleKeeper: canEdit, isTreeKeeper: treeKeeper,
    }) === null;
  const handleFormCommunity = async () => {
    const name = formName.trim();
    if (!name || forming) return;
    setForming(true);
    try {
      const res = await formCommunityFromCircle(community.id, name);
      setJustFormed(true);
      onUpdate?.({ name: res.name, visibility: 'public', ...(res.bornOn ? { bornOn: res.bornOn } : {}) });
      announce('communities');
      notify(spokenLine('circle_formed', { name: res.name }));
    } catch (e: any) {
      const m = String(e?.message || '');
      showAlert(m.includes('not_hand') ? 'circle_form_not_hand' : m.includes('already_formed') ? 'circle_form_already' : m || 'err_action');
    }
    setForming(false);
  };

  return { mayFormCommunity, formName, setFormName, forming, handleFormCommunity };
};
