import React, { useEffect, useState, useCallback } from 'react';
import { showAlert, showConfirm } from '../ui/Dialog';
import { Icons } from '../ui/Icons';
import { Community } from '../../types';
import { SectionTitle } from '../ui/SectionTitle';
import { firestoreStore } from '../../adapters/firestore';
import { getPersonName } from '../../services/firebase';

// Members tab — the community's people, read from 'member' links (the LIN). The owner (or
// staff) sees pending 'join_request' links above the roster and can accept (mint the member
// link, drop the request) or decline, and can remove members. Names resolve from the
// world-readable persons/{uid} docs.

interface Row {
  uid: string;
  name: string;
}

interface CommunityMembersProps {
  community: Community;
  currentUserId?: string;
  // Owner or staff — may accept/decline requests and remove members.
  canManage: boolean;
}

const resolveNames = async (uids: string[]): Promise<Row[]> =>
  Promise.all(uids.map(async (uid) => ({ uid, name: (await getPersonName(uid)) || uid })));

export const CommunityMembers: React.FC<CommunityMembersProps> = ({ community, currentUserId, canManage }) => {
  const [members, setMembers] = useState<Row[] | null>(null);
  const [requests, setRequests] = useState<Row[]>([]);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [memberLinks, requestLinks] = await Promise.all([
        firestoreStore.linksTo(community.id, 'member'),
        firestoreStore.linksTo(community.id, 'join_request'),
      ]);
      // The owner is implicitly a member even without a link (legacy circles).
      const memberUids = Array.from(new Set([community.ownerId, ...memberLinks.map(l => l.from)].filter(Boolean)));
      const requestUids = requestLinks.map(l => l.from).filter(uid => !memberUids.includes(uid));
      const [memberRows, requestRows] = await Promise.all([resolveNames(memberUids), resolveNames(requestUids)]);
      setMembers(memberRows);
      setRequests(requestRows);
    } catch (e) {
      console.error('Members load failed:', e);
      setMembers([]);
    }
  }, [community.id, community.ownerId]);

  useEffect(() => { load(); }, [load]);

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
      setMembers(prev => prev ? prev.filter(m => m.uid !== row.uid) : prev);
    } catch (e: any) { showAlert(e?.message || 'Could not remove the member.'); }
    setBusyUid(null);
  };

  return (
    <div>
      <SectionTitle title="Members" sub="The people of this community — and, for its keepers, who is asking to join." />

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
                    {m.uid === currentUserId && m.uid !== community.ownerId && <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-700">you</span>}
                  </p>
                  <p className="truncate font-mono text-[10px] text-slate-400">{m.uid}</p>
                </div>
              </div>
              {canManage && m.uid !== community.ownerId && (
                <button onClick={() => handleRemove(m)} disabled={busyUid === m.uid}
                  className="shrink-0 rounded-lg border border-red-100 bg-white px-3 py-1.5 text-xs font-bold text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50">
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
