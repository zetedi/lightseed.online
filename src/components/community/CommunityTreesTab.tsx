import React, { useState } from 'react';
import { showAlert } from '../ui/Dialog';
import { Icons } from '../ui/Icons';
import { Community, Lifetree } from '../../types';
import { fetchAllLifetrees, inviteTreeToCommunity } from '../../services/firebase';
import { SectionTitle } from '../ui/SectionTitle';
import { tabTone } from '../../utils/tabTheme';
import { GuardianButton } from './GuardianButton';

interface CommunityTreesTabProps {
  community: Community;
  currentUserId?: string;
  // Domain trees + participating trees, deduped (computed in the shell — shared with other tabs).
  communityTrees: Lifetree[];
  onViewTree?: (tree: Lifetree) => void;
  // Guardianship is shared state (also shown on the First Tree tab), so it lives in the shell.
  guardedTreeIds: Set<string>;
  togglingId: string | null;
  onToggleGuardian: (tree: Lifetree) => void;
}

// Community Trees tab — the tree grid plus the invite-a-tree flow.
export const CommunityTreesTab: React.FC<CommunityTreesTabProps> = ({
  community,
  currentUserId,
  communityTrees,
  onViewTree,
  guardedTreeIds,
  togglingId,
  onToggleGuardian,
}) => {
  // Inviting a tree to stand with this community.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteCandidates, setInviteCandidates] = useState<Lifetree[] | null>(null);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);

  const searchInviteCandidates = async () => {
    const term = inviteSearch.trim().toLowerCase();
    if (!term) { setInviteCandidates([]); return; }
    setInviteCandidates(null); // loading
    try {
      const all = await fetchAllLifetrees();
      const here = new Set(communityTrees.map(t => t.id));
      setInviteCandidates(all.filter(t => !t.isNature && !here.has(t.id) && (t.name || '').toLowerCase().includes(term)).slice(0, 8));
    } catch { setInviteCandidates([]); }
  };

  const handleInviteTree = async (tree: Lifetree) => {
    if (!currentUserId || inviteBusyId) return;
    setInviteBusyId(tree.id);
    try {
      await inviteTreeToCommunity({
        communityId: community.id, communityName: community.name || community.domain,
        lifetreeId: tree.id, lifetreeName: tree.name || 'A tree', treeOwnerId: tree.ownerId,
        invitedByUserId: currentUserId,
      });
      showAlert(`Invitation sent — ${tree.name}'s keeper will decide.`, 'Invite a tree');
      setInviteCandidates(prev => (prev || []).filter(t => t.id !== tree.id));
    } catch (e: any) {
      showAlert(e?.message || 'Could not send the invite.');
    }
    setInviteBusyId(null);
  };

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <SectionTitle title="Community Trees" sub="Lifetrees rooted here or standing with this community. Join a guardianship to help tend one." />
        {currentUserId && (
          <button onClick={() => { setInviteOpen(o => !o); setInviteCandidates(null); setInviteSearch(''); }} className="shrink-0 rounded-full bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-teal-700 active:scale-95">
            <span className="flex items-center gap-1.5"><Icons.Plus /> Invite a tree</span>
          </button>
        )}
      </div>
      {inviteOpen && (
        <div className="mb-4 rounded-lg border border-teal-100 bg-teal-50/50 p-4">
          <div className="flex gap-2">
            <input dir="auto" value={inviteSearch} onChange={e => setInviteSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') searchInviteCandidates(); }}
              placeholder="Search trees by name…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-teal-300" />
            <button onClick={searchInviteCandidates} className="shrink-0 rounded-full bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700">Search</button>
          </div>
          {inviteCandidates !== null && (
            <div className="mt-3 space-y-2">
              {inviteCandidates.length === 0 ? (
                <p className="text-xs text-slate-400">No matching trees (already-standing and nature trees are hidden).</p>
              ) : inviteCandidates.map(tr => (
                <div key={tr.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white p-2.5">
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {tr.latestGrowthUrl || tr.imageUrl ? <img src={tr.latestGrowthUrl || tr.imageUrl} className="h-full w-full object-cover" alt="" /> : <div className="h-full w-full" style={{ backgroundColor: community.theme?.primary || tabTone('communities') }} />}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{tr.name}</span>
                  <button onClick={() => handleInviteTree(tr)} disabled={inviteBusyId === tr.id} className="shrink-0 rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-50 disabled:opacity-50">
                    {inviteBusyId === tr.id ? '…' : 'Invite'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {communityTrees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500"><Icons.Tree /></div>
          <p className="text-sm">No lifetrees linked to this domain yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {communityTrees.map(tree => (
            <div
              key={tree.id}
              className={`flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm ${onViewTree ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}
              onClick={() => onViewTree?.(tree)}
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {tree.latestGrowthUrl || tree.imageUrl ? <img src={tree.latestGrowthUrl || tree.imageUrl} className="h-full w-full object-cover" alt={tree.name} /> : <div className="h-full w-full" style={{ backgroundColor: community.theme?.primary || tabTone('communities') }} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-bold text-slate-800">{tree.name}</p>
                <p className="truncate text-[11px] uppercase tracking-wide text-emerald-600">{tree.locationName || '—'}</p>
              </div>
              <GuardianButton tree={tree} guardian={guardedTreeIds.has(tree.id)} busy={togglingId === tree.id} onToggle={onToggleGuardian} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
