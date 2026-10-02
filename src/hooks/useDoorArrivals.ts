import { useState, useEffect, useRef } from 'react';
import type { CommunityInvite, Lightseed } from '../types';
import type { BeingOverlays } from './useBeingOverlays';
import { getPendingTreeInvites, getCommunityInvite, getCommunityById, getPersonName } from '../services/firebase';
import { getTreeInvite, claimTreeInvite, acceptTreeInvite } from '../services/firebase/trees';
import { getLifetreeById } from '../services/firebase/pulses';
import { showConfirm } from '../components/ui/Dialog';
import { treeInviteClaimRefusal } from '../domain/treeInvite';
import { roleLabelKey } from '../domain/treeCircle';
import type { TreeKeepingInvite } from '../domain/treeCircle';
import { findBeingByLid } from '../services/firebase/beings';
import { lidFromPath, beingPath } from '../domain/beingLink';
import { inviteIdFromPath } from '../domain/communityDoor';
import { asksSignIn, withoutSignInAsk } from '../domain/ssoDoor';
import { notify } from '../components/ui/Toast';
import { speak, spokenLine } from '../utils/translations';

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
  openProfile?: () => void;
}) {
  const { authLoading, lightseed, isStaff, tab, inviteParam, beings, openAuth, openProfile } = params;
  // THE OPEN DOOR to a tree's circle (ring 2026-10-01; domain/treeInvite): an unclaimed invitation
  // the visitor arrived holding — carried until the signed-in hand claims it, then released.
  const [arrivedTreeInvite, setArrivedTreeInvite] = useState<TreeKeepingInvite | null>(null);
  // An invitation the visitor arrived holding (/i/<id>) — carried until used or dismissed.
  const [arrivedInvite, setArrivedInvite] = useState<CommunityInvite | null>(null);
  const [pendingTreeInvites, setPendingTreeInvites] = useState(0);
  // A /b/<lid> arrival is PENDING from the first paint until the being resolves (ring
  // 2026-09-29): the shell holds its neutral loader meanwhile, so a shared tree link opens
  // straight onto the tree — not onto a dashboard that then changes under the reader.
  const [doorPending, setDoorPending] = useState<boolean>(() => typeof window !== 'undefined' && !!lidFromPath(window.location.pathname));
  const doorResolvedRef = useRef(false);

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
    if ((arrivedInvite || arrivedTreeInvite) && !lightseed && !authLoading) openAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to the resolved /i/ arrival once auth settles; mirrors the ?invite effect above
  }, [arrivedInvite, arrivedTreeInvite, lightseed, authLoading]);

  // THE CLAIM: once a hand is signed in, the carried tree invitation is taken (one write the rules
  // judge), spoken, and left under the profile's Invitations where acceptance lives.
  // One claim per arrival (a ref, not a cleared state: the carried invitation is harmless once
  // signed in — the sign-in door reads it only while signed out).
  const claimedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!arrivedTreeInvite || !lightseed?.uid || claimedRef.current === arrivedTreeInvite.id) return;
    claimedRef.current = arrivedTreeInvite.id;
    const inv = arrivedTreeInvite;
    const refusal = treeInviteClaimRefusal({
      exists: true, open: inv.open, status: inv.status, invitedUserId: inv.invitedUserId, invitedByUserId: inv.invitedByUserId,
      revokedAtMs: inv.revokedAt ? (inv.revokedAt as { toMillis?: () => number }).toMillis?.() ?? null : null,
      expiresAtMs: inv.expiresAt ? (inv.expiresAt as { toMillis?: () => number }).toMillis?.() ?? null : null,
      claimantUid: lightseed.uid, nowMs: Date.now(),
    });
    if (refusal) { notify(speak(refusal), 'error'); return; }
    // Taken, then ASKED right where the visitor stands (Zoltán, 2026-10-02: two friends claimed a link and
    // waited, unseen, under their profile). A yes accepts on the server's hand and opens the tree; a
    // "not now" — or a seat that needs what they have not yet (a guardian's own living tree) — leaves
    // the invitation waiting under Invitations, as before.
    const uid = lightseed.uid;
    claimTreeInvite(inv.id, uid)
      .then(async () => {
        const who = inv.invitedByName || (await getPersonName(inv.invitedByUserId).catch(() => '')) || speak('someone');
        const words = { who, role: speak(roleLabelKey(inv.role)).toLowerCase(), tree: inv.lifetreeName || speak('a_tree') };
        const yes = await showConfirm(spokenLine('tree_invite_accept_q', words), { title: 'tree_invite_accept_title', confirmText: 'accept', cancelText: 'not_now' });
        if (!yes) { notify(speak(spokenLine('tree_invite_claimed', words))); openProfile?.(); return; }
        try {
          await acceptTreeInvite(inv.id);
          const tree = await getLifetreeById(inv.lifetreeId).catch(() => null);
          if (tree) beings.setSelectedTree(tree);
          notify('🌱 ' + speak(spokenLine('tree_invite_welcome', words)));
        } catch (e) {
          const code = e instanceof Error ? (e.message.split(' ').pop() || '') : '';
          notify(speak(code === 'guard_no_living_tree' ? 'tree_invite_plant_first' : spokenLine('tree_invite_claimed', words)), 'error');
          openProfile?.();
        }
      })
      .catch(() => notify(speak('tree_invite_taken'), 'error'));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot claim once the hand is signed in
  }, [arrivedTreeInvite, lightseed?.uid]);

  // The /b/<lid> door — a scanned QR lands here. Resolved once the session settles
  // (what the scanner may see depends on who they are), then the path is cleaned.
  useEffect(() => {
    if (authLoading) return;
    const lid = lidFromPath(window.location.pathname);
    if (!lid) return;
    // ONE resolution per arrival: the session flag may settle more than once, and a second
    // open of the same being would draw it twice (the flicker a shared link once showed).
    if (doorResolvedRef.current) return;
    doorResolvedRef.current = true;
    // The address is KEPT (only normalized) — /b/<lid> is a real, refreshable door now:
    // the hosting rewrite serves the shell for it, and this effect re-opens the being.
    window.history.replaceState(window.history.state, '', beingPath(lid));
    findBeingByLid(lid, !!lightseed, { uid: lightseed?.uid, isStaff }).then(found => {
      if (!found) { notify(speak('being_link_unseen')); return; }
      if (found.kind === 'tree') beings.setSelectedTree(found.tree);
      else if (found.kind === 'lightHouse') beings.setViewingLightHouse(found.lightHouse);
      else if (found.kind === 'vision') beings.setSelectedVision(found.vision);
      else beings.setSelectedPulse(found.pulse);
    }).catch(() => {}).finally(() => setDoorPending(false));
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
      if (invite && community) { setArrivedInvite(invite); beings.setSelectedCommunity(community); return; }
      // Not a community's door: perhaps a tree circle's (the same /i/ prefix, its own ledger).
      const treeInvite = await getTreeInvite(inviteId).catch(() => null);
      if (!treeInvite) { notify(speak('invite_not_found')); return; }
      setArrivedTreeInvite(treeInvite);
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

  return { arrivedInvite, setArrivedInvite, arrivedTreeInvite, pendingTreeInvites, doorPending };
}
