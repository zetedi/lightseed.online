import { useEffect, useState } from 'react';
import { getPersonName, joinCommunityOpen, joinCommunityWithInvite, requestKeepership, withdrawKeeperRequest } from '@backend';
import type { Community, CommunityInvite } from '../types';
import { doorOf, checkInvite } from '../domain/communityDoor';
import { isParticipant } from '../domain/views/participation';
import { graphStore } from '../services/store';
import { showAlert } from '../components/ui/Dialog';
import { notify } from '../components/ui/Toast';
import { spokenLine } from '../utils/translations';

// THE VIEWER AT A COMMUNITY'S DOOR — everything the community's face needs to know about the
// one looking at it, and the hands by which they may enter. Lifted whole out of
// CommunityProfile (ring 2026-11-19): the face draws the door, this hook reads and opens it.
// The rules and the server are the law of who may enter; this only asks.
export const useCommunityDoor = (
  community: Community,
  currentUserId: string | undefined,
  // An invitation the viewer arrived holding (/i/<id>).
  arrivedInvite?: CommunityInvite | null,
) => {
  // FULL PEERS (domain/keeperCircle, ring 2026-08-12): a `keeper` link holder edits, deletes
  // and keeps exactly as the founding anchorUid does — resolved from the links load below.
  const [isKeeperByLink, setIsKeeperByLink] = useState(false);
  // Membership is a prism over the LIN ('member' links), read through the Store port. The owner
  // is implicitly a member (seeded synchronously so first render is correct); everyone else is
  // resolved from links below. Legacy memberIds arrays are no longer read.
  const memberSeed = !!currentUserId && community.anchorUid === currentUserId;
  const [memberByLink, setMemberByLink] = useState(false);
  // Has this viewer already asked to join? (join_request link — see the Members tab.)
  const [joinRequested, setJoinRequested] = useState(false);
  const [joining, setJoining] = useState(false);
  // Has this viewer already asked to KEEP? (keeper_request link — answered in the Members tab.)
  const [keepRequested, setKeepRequested] = useState(false);
  const [keepAsking, setKeepAsking] = useState(false);
  // Stewardship — the delegated door-keepers (accept knocks, mint invitations).
  const [isSteward, setIsSteward] = useState(false);
  useEffect(() => {
    let alive = true;
    graphStore.linksTo(community.id)
      .then(links => {
        if (!alive) return;
        setMemberByLink(isParticipant(links.filter(l => l.rel === 'member'), currentUserId));
        setJoinRequested(!!currentUserId && links.some(l => l.rel === 'join_request' && l.from === currentUserId));
        setIsSteward(!!currentUserId && links.some(l => l.rel === 'steward' && l.from === currentUserId));
        setIsKeeperByLink(!!currentUserId && links.some(l => l.rel === 'keeper' && l.from === currentUserId));
        setKeepRequested(!!currentUserId && links.some(l => l.rel === 'keeper_request' && l.from === currentUserId));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [community.id, currentUserId]);
  const isMember = memberSeed || memberByLink;

  // The DOOR (domain/communityDoor.ts) — how a non-member may enter, if at all.
  const door = doorOf(community);
  const inviteForHere = arrivedInvite && arrivedInvite.communityId === community.id ? arrivedInvite : null;
  const [inviterName, setInviterName] = useState('');
  useEffect(() => {
    if (!inviteForHere) return;
    getPersonName(inviteForHere.createdBy).then(n => setInviterName(n || '')).catch(() => {});
  }, [inviteForHere]);

  // Join — a request for the community's keeper(s), surfaced on their Members tab.
  const handleJoin = async () => {
    if (!currentUserId) { showAlert('err_signin_join'); return; }
    setJoining(true);
    try {
      await graphStore.link(currentUserId, 'join_request', community.id);
      setJoinRequested(true);
      notify(`🌱 ${spokenLine('join_request_sent', { name: community.name })}`);
    } catch (e: any) { showAlert(e?.message || 'err_join_request'); }
    setJoining(false);
  };

  // Ask to KEEP — a keepership knock (keeper_request link); a sitting keeper answers, and
  // the server mints only after the living-tree proof (domain/keeperCircle).
  const handleAskToKeep = async () => {
    if (!currentUserId) { showAlert('err_signin_join'); return; }
    setKeepAsking(true);
    try {
      if (keepRequested) {
        await withdrawKeeperRequest(currentUserId, community.id);
        setKeepRequested(false);
      } else {
        await requestKeepership(currentUserId, community.id);
        setKeepRequested(true);
        notify(spokenLine('keeper_request_sent', {}));
      }
    } catch (e: any) { showAlert(e?.message || 'err_action'); }
    setKeepAsking(false);
  };
  // Step in through an OPEN door — no knock needed while the founding season lasts.
  const handleStepIn = async () => {
    if (!currentUserId) return;
    setJoining(true);
    try {
      await joinCommunityOpen(currentUserId, community.id);
      setMemberByLink(true);
      notify(spokenLine('welcome_to_community', { name: community.name }));
    } catch (e: any) { showAlert(e?.message || 'err_join'); }
    setJoining(false);
  };
  // Enter holding an invitation — membership plus the append-only 'invited_by' mark.
  const handleEnterWithInvite = async () => {
    if (!currentUserId || !inviteForHere) return;
    const verdict = checkInvite({
      communityId: inviteForHere.communityId,
      createdBy: inviteForHere.createdBy,
      revokedAtMs: inviteForHere.revokedAt ? inviteForHere.revokedAt.toMillis() : null,
      expiresAtMs: inviteForHere.expiresAt ? inviteForHere.expiresAt.toMillis() : null,
    }, community.id, door, Date.now());
    if (!verdict.usable) {
      showAlert(verdict.reason === 'revoked' ? 'invite_revoked'
        : verdict.reason === 'expired' ? 'invite_expired'
        : verdict.reason === 'door_closed' ? 'invite_door_closed'
        : 'invite_other_community');
      return;
    }
    setJoining(true);
    try {
      const { remembered } = await joinCommunityWithInvite(currentUserId, inviteForHere);
      setMemberByLink(true);
      notify(spokenLine(remembered ? 'welcome_remembered' : 'welcome_to_community', { name: community.name }));
    } catch (e: any) { showAlert(e?.message || 'err_door_not_open'); }
    setJoining(false);
  };

  return {
    isKeeperByLink, isMember, isSteward, joinRequested, keepRequested, joining, keepAsking,
    door, inviteForHere, inviterName,
    handleJoin, handleAskToKeep, handleStepIn, handleEnterWithInvite,
  };
};
