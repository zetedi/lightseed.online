import React, { useEffect, useState, useCallback } from 'react';
import { showAlert, showConfirm } from '../ui/Dialog';
import { notify } from '../ui/Toast';
import { Icons } from '../ui/Icons';
import { Timestamp } from 'firebase/firestore';
import { Community, CommunityInvite } from '../../types';
import { doorOf, communityInviteUrl, inviteStatus, type CommunityDoor } from '../../domain/communityDoor';
import { SectionTitle } from '../ui/SectionTitle';
import { firestoreStore } from '../../adapters/firestore';
import {
  getPersonName, updateCommunity,
  mintCommunityInvite, listCommunityInvites, revokeCommunityInvite,
} from '../../services/firebase';

// Members tab — the community's people, read from 'member' links (the LIN), and the DOOR
// (domain/communityDoor.ts). Door-keepers (owner + stewards) see pending 'join_request'
// links above the roster, accept (mint the member link, drop the request) or decline,
// remove members, and mint/revoke invitation links. The OWNER alone sets the door and
// appoints stewards. Names resolve from the world-readable persons/{uid} docs.

interface Row {
  uid: string;
  name: string;
}

interface CommunityMembersProps {
  community: Community;
  currentUserId?: string;
  // Owner, steward or staff — may accept/decline requests, remove members, mint invitations.
  canManage: boolean;
  // Owner or staff — may set the door and appoint/remove stewards (community-doc writes).
  isOwner: boolean;
  // Lets the shell keep its copy of the community fresh after a door change.
  onCommunityUpdate?: (updates: Partial<Community>) => void;
}

const DOORS: { value: CommunityDoor; label: string; hint: string }[] = [
  { value: 'open', label: 'Open', hint: 'any signed-in being may step in' },
  { value: 'invite', label: 'Invitation', hint: 'knock, or arrive holding an invitation' },
  { value: 'closed', label: 'Closed', hint: 'the community rests; no new members' },
];

const resolveNames = async (uids: string[]): Promise<Row[]> =>
  Promise.all(uids.map(async (uid) => ({ uid, name: (await getPersonName(uid)) || uid })));

export const CommunityMembers: React.FC<CommunityMembersProps> = ({ community, currentUserId, canManage, isOwner, onCommunityUpdate }) => {
  const [members, setMembers] = useState<Row[] | null>(null);
  const [requests, setRequests] = useState<Row[]>([]);
  const [stewardUids, setStewardUids] = useState<Set<string>>(new Set());
  const [busyUid, setBusyUid] = useState<string | null>(null);

  // The door as shown — updated optimistically on change, source of truth stays the doc.
  const [door, setDoor] = useState<CommunityDoor>(doorOf(community));
  const [doorBusy, setDoorBusy] = useState(false);

  // Does this community own the domain we're viewing from? Then it is the node here, and its
  // door also governs sign-up (not just joining) — worth saying so to its keeper.
  const norm = (d?: string) => (d || '').toLowerCase().replace(/^www\./, '');
  const isThisDomainsNode = !!community.domain
    && typeof window !== 'undefined'
    && norm(community.domain) === norm(window.location.hostname);

  const [invites, setInvites] = useState<CommunityInvite[]>([]);
  const [minting, setMinting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [memberLinks, requestLinks, stewardLinks] = await Promise.all([
        firestoreStore.linksTo(community.id, 'member'),
        firestoreStore.linksTo(community.id, 'join_request'),
        firestoreStore.linksTo(community.id, 'steward'),
      ]);
      // The owner is implicitly a member even without a link (legacy circles).
      const memberUids = Array.from(new Set([community.ownerId, ...memberLinks.map(l => l.from)].filter(Boolean)));
      const requestUids = requestLinks.map(l => l.from).filter(uid => !memberUids.includes(uid));
      const [memberRows, requestRows] = await Promise.all([resolveNames(memberUids), resolveNames(requestUids)]);
      setStewardUids(new Set(stewardLinks.map(l => l.from)));
      setMembers(memberRows);
      setRequests(requestRows);
    } catch (e) {
      console.error('Members load failed:', e);
      setMembers([]);
    }
  }, [community.id, community.ownerId]);

  useEffect(() => { load(); }, [load]);

  // The invitation ledger is the keepers' view — others never query it (rules would refuse).
  useEffect(() => {
    if (!canManage) return;
    listCommunityInvites(community.id).then(setInvites).catch(() => {});
  }, [community.id, canManage]);

  const handleDoor = async (next: CommunityDoor) => {
    if (next === door || doorBusy) return;
    setDoorBusy(true);
    try {
      await updateCommunity(community.id, { door: next });
      setDoor(next);
      onCommunityUpdate?.({ door: next });
      notify(next === 'open' ? '🚪 The door stands open.' : next === 'invite' ? '🚪 The door now asks for an invitation.' : '🚪 The door is closed.');
    } catch (e: any) { showAlert(e?.message || 'Could not change the door.'); }
    setDoorBusy(false);
  };

  const copyInviteUrl = async (inviteId: string) => {
    const url = communityInviteUrl(window.location.origin, inviteId);
    try { await navigator.clipboard.writeText(url); notify('🎟 Invitation link copied. Share it to open the door.'); }
    catch { showAlert(url); } // clipboard unavailable: show the link instead
  };

  const handleMintInvite = async () => {
    if (!currentUserId || minting) return;
    setMinting(true);
    try {
      const invite = await mintCommunityInvite(community.id, currentUserId);
      setInvites(prev => [invite, ...prev]);
      await copyInviteUrl(invite.id);
    } catch (e: any) { showAlert(e?.message || 'Could not mint the invitation.'); }
    setMinting(false);
  };

  const handleRevokeInvite = async (invite: CommunityInvite) => {
    if (!(await showConfirm('Revoke this invitation link? Anyone still holding it will find the door unmoved by it.', { title: 'Revoke invitation', confirmText: 'Revoke', danger: true }))) return;
    try {
      await revokeCommunityInvite(invite.id);
      setInvites(prev => prev.map(i => i.id === invite.id ? { ...i, revokedAt: Timestamp.now() } : i));
    } catch (e: any) { showAlert(e?.message || 'Could not revoke the invitation.'); }
  };

  const handleAccept = async (uid: string) => {
    setBusyUid(uid);
    try {
      await firestoreStore.link(uid, 'member', community.id);
      await firestoreStore.unlink(uid, 'join_request', community.id);
      await load();
    } catch (e: any) { showAlert(e?.message || 'Could not accept the request.'); }
    setBusyUid(null);
  };

  const handleDecline = async (uid: string) => {
    setBusyUid(uid);
    try {
      await firestoreStore.unlink(uid, 'join_request', community.id);
      setRequests(prev => prev.filter(r => r.uid !== uid));
    } catch (e: any) { showAlert(e?.message || 'Could not decline the request.'); }
    setBusyUid(null);
  };

  const handleRemove = async (row: Row) => {
    if (!(await showConfirm(`Remove ${row.name} from ${community.name}?`, { title: 'Remove member', confirmText: 'Remove', danger: true }))) return;
    setBusyUid(row.uid);
    try {
      await firestoreStore.unlink(row.uid, 'member', community.id);
      // Expulsion must take the deed with the membership: a lingering steward link keeps full
      // keeper power (and re-entry) invisibly. Strip it too so Remove really removes.
      if (stewardUids.has(row.uid)) {
        await firestoreStore.unlink(row.uid, 'steward', community.id);
        setStewardUids(prev => { const next = new Set(prev); next.delete(row.uid); return next; });
      }
      setMembers(prev => prev ? prev.filter(m => m.uid !== row.uid) : prev);
    } catch (e: any) { showAlert(e?.message || 'Could not remove the member.'); }
    setBusyUid(null);
  };

  // Stewardship is delegation: the owner shares the door, not the deed.
  const handleSteward = async (row: Row, make: boolean) => {
    setBusyUid(row.uid);
    try {
      if (make) await firestoreStore.link(row.uid, 'steward', community.id);
      else await firestoreStore.unlink(row.uid, 'steward', community.id);
      setStewardUids(prev => {
        const next = new Set(prev);
        if (make) next.add(row.uid); else next.delete(row.uid);
        return next;
      });
      notify(make ? `🤲 ${row.name} now keeps the door with you.` : `${row.name} no longer keeps the door.`);
    } catch (e: any) { showAlert(e?.message || 'Could not change stewardship.'); }
    setBusyUid(null);
  };

  const statusOf = (i: CommunityInvite) => inviteStatus(
    { revokedAtMs: i.revokedAt ? i.revokedAt.toMillis() : null, expiresAtMs: i.expiresAt ? i.expiresAt.toMillis() : null },
    Date.now(),
  );

  return (
    <div>
      <SectionTitle title="Members" sub="The people of this community; and, for its keepers, the door itself." />

      {/* The DOOR — owner-set: who may join, and how. Distinct from visibility (who may see). */}
      {isOwner && (
        <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">The door</p>
          <div className="flex flex-wrap gap-1.5">
            {DOORS.map(d => (
              <button key={d.value} onClick={() => handleDoor(d.value)} disabled={doorBusy}
                title={d.hint}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${door === d.value
                  ? 'bg-emerald-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                {d.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] italic text-slate-400">{DOORS.find(d => d.value === door)?.hint}.</p>
          {/* When this community owns the current domain (it is the node here), its door also
              governs SIGN-UP — opening it delegates the front gate to the keeper. */}
          {isThisDomainsNode && (
            <p className="mt-1 text-[11px] italic text-emerald-600">
              This community is the node for {community.domain}. {door === 'closed'
                ? 'Sign-up here is closed; only invited people can create an account.'
                : 'Anyone can create an account here (identity is open); the door still gates who becomes a member.'}
            </p>
          )}
        </div>
      )}

      {/* Invitations — the shareable keys. Keepers mint and revoke; revocation is a mark. */}
      {canManage && (
        <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Invitations</p>
            <button onClick={handleMintInvite} disabled={minting || door === 'closed'}
              title={door === 'closed' ? 'The door is closed; invitations would wait outside.' : 'Mint a shareable invitation link'}
              className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50">
              {minting ? 'Minting…' : 'Mint invitation link'}
            </button>
          </div>
          {invites.length === 0 ? (
            <p className="text-[11px] italic text-slate-400">No invitations yet. A minted link opens the door to whoever holds it, and records who invited whom.</p>
          ) : (
            <div className="space-y-1.5">
              {invites.map(i => {
                const status = statusOf(i);
                return (
                  <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[11px] text-slate-600">…/i/{i.id}</p>
                      <p className="text-[10px] text-slate-400">
                        {i.createdAt?.toMillis ? new Date(i.createdAt.toMillis()).toLocaleDateString() : ''}
                        {status !== 'live' && <span className="ml-1.5 font-bold uppercase text-red-400">{status}</span>}
                      </p>
                    </div>
                    {status === 'live' && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button onClick={() => copyInviteUrl(i.id)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500 transition-colors hover:bg-slate-50">
                          Copy
                        </button>
                        <button onClick={() => handleRevokeInvite(i)}
                          className="rounded-lg border border-red-100 bg-white px-2.5 py-1 text-[11px] font-bold text-red-500 transition-colors hover:bg-red-50">
                          Revoke
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {canManage && requests.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700">Join requests</p>
          <div className="space-y-1.5">
            {requests.map(r => (
              <div key={r.uid} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 border border-amber-100">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-700">{r.name}</p>
                  <p className="truncate font-mono text-[10px] text-slate-400">{r.uid}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button onClick={() => handleAccept(r.uid)} disabled={busyUid === r.uid}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50">
                    {busyUid === r.uid ? '…' : 'Accept'}
                  </button>
                  <button onClick={() => handleDecline(r.uid)} disabled={busyUid === r.uid}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50">
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {members === null ? (
        <p className="py-8 text-center text-sm text-slate-400">Gathering the circle…</p>
      ) : members.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No members yet.</p>
      ) : (
        <div className="space-y-1.5">
          {members.map(m => (
            <div key={m.uid} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Icons.Users size={16} /></span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-700">
                    {m.name}
                    {m.uid === community.ownerId && <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700">keeper</span>}
                    {stewardUids.has(m.uid) && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">steward</span>}
                    {m.uid === currentUserId && m.uid !== community.ownerId && <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-700">you</span>}
                  </p>
                  <p className="truncate font-mono text-[10px] text-slate-400">{m.uid}</p>
                </div>
              </div>
              {canManage && m.uid !== community.ownerId && (
                <div className="flex shrink-0 items-center gap-1.5">
                  {isOwner && (
                    <button onClick={() => handleSteward(m, !stewardUids.has(m.uid))} disabled={busyUid === m.uid}
                      title={stewardUids.has(m.uid) ? 'No longer keeps the door' : 'Delegate the door: accept knocks, mint invitations'}
                      className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50">
                      {stewardUids.has(m.uid) ? 'Unsteward' : 'Make steward'}
                    </button>
                  )}
                  <button onClick={() => handleRemove(m)} disabled={busyUid === m.uid}
                    className="rounded-lg border border-red-100 bg-white px-3 py-1.5 text-xs font-bold text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50">
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
