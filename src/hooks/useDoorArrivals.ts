import { useState, useEffect } from 'react';
import type { CommunityInvite, Lightseed } from '../types';
import type { BeingOverlays } from './useBeingOverlays';
import { getPendingTreeInvites, getCommunityInvite, getCommunityById } from '../services/firebase';
import { findBeingByLid } from '../services/firebase/beings';
import { lidFromPath, beingPath } from '../domain/beingLink';
import { inviteIdFromPath } from '../domain/communityDoor';
import { asksSignIn, withoutSignInAsk } from '../domain/ssoDoor';
import { notify } from '../components/ui/Toast';
import { speak } from '../utils/translations';

// THE DOORS A VISITOR ARRIVES THROUGH (ring 2026-09-16, lifted out of App.tsx unchanged).
// /b/<lid> (a scanned QR or a shared being), /i/<inviteId> (a community invitation), the
// ?invite and ?signin asks — each resolved once the session settles, each consuming its
// address; plus the pending Tree Circle invitations the envelope counts. The arrivals set
// the open beings and the sign-in door through the handles they are given.
export function useDoorArrivals(params: {
  authLoading: boolean;
  lightseed: Lightseed | null;
  isStaff: boolean;
  tab: string;
  inviteParam: string | null | undefined;
  beings: Pick<BeingOverlays, 'setSelectedTree' | 'setViewingLightHouse' | 'setSelectedVision' | 'setSelectedPulse' | 'setSelectedCommunity'>;
  openAuth: () => void;
}) {
  const { authLoading, lightseed, isStaff, tab, inviteParam, beings, openAuth } = params;
  // An invitation the visitor arrived holding (/i/<id>) — carried until used or dismissed.
  const [arrivedInvite, setArrivedInvite] = useState<CommunityInvite | null>(null);
  const [pendingTreeInvites, setPendingTreeInvites] = useState(0);

  // Pending Tree Circle invites — surfaced (separately) on the DM button.
  useEffect(() => {
    if (lightseed?.uid) getPendingTreeInvites(lightseed.uid).then(invs => setPendingTreeInvites(invs.length)).catch(() => {});
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset-on-signout counterpart of the async fetch above
    else setPendingTreeInvites(0);
  }, [lightseed?.uid, tab]);

  // Arriving on an invite link, signed out, opens the join flow.
  useEffect(() => {
    if (inviteParam && !lightseed && !authLoading) openAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to external URL state (?invite) once auth resolves; openAuth is a stable setter wrapper
  }, [inviteParam, lightseed, authLoading]);

  // Arriving on a community invitation (/i/), signed out, opens the join door directly — the
  // auth modal greets by the community name and starts in sign-up (see the AuthModal render).
  useEffect(() => {
    if (arrivedInvite && !lightseed && !authLoading) openAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to the resolved /i/ arrival once auth settles; mirrors the ?invite effect above
  }, [arrivedInvite, lightseed, authLoading]);

  // The /b/<lid> door — a scanned QR lands here. Resolved once the session settles
  // (what the scanner may see depends on who they are), then the path is cleaned.
  useEffect(() => {
    if (authLoading) return;
    const lid = lidFromPath(window.location.pathname);
    if (!lid) return;
    // The address is KEPT (only normalized) — /b/<lid> is a real, refreshable door now:
    // the hosting rewrite serves the shell for it, and this effect re-opens the being.
    window.history.replaceState(window.history.state, '', beingPath(lid));
    findBeingByLid(lid, !!lightseed, { uid: lightseed?.uid, isStaff }).then(found => {
      if (!found) { notify(speak('being_link_unseen')); return; }
      if (found.kind === 'tree') beings.setSelectedTree(found.tree);
      else if (found.kind === 'lightHouse') beings.setViewingLightHouse(found.lightHouse);
      else if (found.kind === 'vision') beings.setSelectedVision(found.vision);
      else beings.setSelectedPulse(found.pulse);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot door: runs when auth settles; the path is consumed on first resolution
  }, [authLoading]);

  // The /i/<inviteId> door — a community invitation link lands here. The community is
  // shown to anyone (greeting first); the invitation itself is carried into the profile,
  // where signing in and entering happen. The path is consumed like the /b/ door's.
  useEffect(() => {
    if (authLoading) return;
    const inviteId = inviteIdFromPath(window.location.pathname);
    if (!inviteId) return;
    window.history.replaceState({}, '', '/');
    getCommunityInvite(inviteId).then(async invite => {
      const community = invite ? await getCommunityById(invite.communityId) : null;
      if (!invite || !community) { notify(speak('invite_not_found')); return; }
      setArrivedInvite(invite);
      beings.setSelectedCommunity(community);
    }).catch(() => notify(speak('invite_not_found')));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot door: runs when auth settles; the path is consumed on first resolution
  }, [authLoading]);

  // The ?signin door (domain/ssoDoor) — a mother site's own "sign in" link (theohouse.org's
  // header door) lands here. Signed out, the sign-in dialog opens; either way the ask leaves
  // the address, so a copied URL is a door, not a demand. Consumed like the /b/ door's path.
  useEffect(() => {
    if (authLoading || !asksSignIn(window.location.search)) return;
    window.history.replaceState(window.history.state, '', window.location.pathname + withoutSignInAsk(window.location.search));
    if (!lightseed) openAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot door: runs when auth settles; the ask is consumed on first resolution
  }, [authLoading]);

  return { arrivedInvite, setArrivedInvite, pendingTreeInvites };
}
