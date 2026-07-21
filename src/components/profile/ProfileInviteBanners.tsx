import React, { useState, useEffect, useCallback } from 'react';
import { showAlert } from '../ui/Dialog';
import { type TreeOwnershipInvite, treeRelationLabels } from '../../types';
import { getPendingTreeInvites, acceptTreeInvite, declineTreeInvite, getMyCommunityTreeInvites, respondCommunityTreeInvite, type CommunityTreeInvite } from '../../services/firebase';

interface ProfileInviteBannersProps {
  uid: string;
  // Surfaces notices via the shell's shared dialog modal.
  notify: (message: string) => void;
}

// The banners shown above the profile tabs: Tree Circle invitations (shared care of a tree)
// and community invitations (a community asking one of your trees to stand with it).
export const ProfileInviteBanners: React.FC<ProfileInviteBannersProps> = ({ uid, notify }) => {
  const [treeInvites, setTreeInvites] = useState<TreeOwnershipInvite[]>([]);
  const [communityInvites, setCommunityInvites] = useState<CommunityTreeInvite[]>([]);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);

  const refreshTreeInvites = useCallback(() => {
    getPendingTreeInvites(uid).then(setTreeInvites).catch(() => {});
    getMyCommunityTreeInvites(uid).then(setCommunityInvites).catch(() => {});
  }, [uid]);
  useEffect(() => { refreshTreeInvites(); }, [refreshTreeInvites]);

  const handleAcceptInvite = async (id: string) => {
    setInviteBusyId(id);
    try { await acceptTreeInvite(id); refreshTreeInvites(); }
    catch (e: any) { showAlert(e?.message || 'Failed to accept invitation.'); }
    setInviteBusyId(null);
  };

  const handleDeclineInvite = async (id: string) => {
    setInviteBusyId(id);
    try { await declineTreeInvite(id); refreshTreeInvites(); }
    catch (e: any) { showAlert(e?.message || 'Failed to decline invitation.'); }
    setInviteBusyId(null);
  };

  return (
    <>
      {/* Tree Circle invitations — someone has invited you into shared care of a tree */}
      {treeInvites.length > 0 && (
        <div className="mb-6 space-y-3">
          {treeInvites.map(inv => (
            <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-emerald-900">
                  <span className="font-bold">{inv.invitedByName || 'Someone'}</span> invited you to become a{' '}
                  <span className="font-bold">{(treeRelationLabels[inv.role] || inv.role).toLowerCase()}</span> of{' '}
                  <span className="font-bold">{inv.lifetreeName || 'a Lifetree'}</span>.
                </p>
                {inv.message && <p className="mt-1 text-xs italic text-emerald-700/80">“{inv.message}”</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => handleAcceptInvite(inv.id)} disabled={inviteBusyId === inv.id} className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50">{inviteBusyId === inv.id ? '…' : 'Accept'}</button>
                <button onClick={() => handleDeclineInvite(inv.id)} disabled={inviteBusyId === inv.id} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Community invitations — a community asked one of your trees to stand with it */}
      {communityInvites.length > 0 && (
        <div className="mb-6 space-y-3">
          {communityInvites.map(inv => (
            <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 p-4 shadow-sm">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-teal-900">
                  <span className="font-bold">{inv.communityName || 'A community'}</span> invited your tree{' '}
                  <span className="font-bold">{inv.lifetreeName || 'a Lifetree'}</span> to stand with it.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={async () => { try { await respondCommunityTreeInvite(inv, true); setCommunityInvites(prev => prev.filter(i => i.id !== inv.id)); notify(`${inv.lifetreeName} now stands with ${inv.communityName}.`); } catch (e: any) { notify(e?.message || 'Could not accept.'); } }} className="rounded-full bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-teal-700">Accept</button>
                <button onClick={async () => { try { await respondCommunityTreeInvite(inv, false); setCommunityInvites(prev => prev.filter(i => i.id !== inv.id)); } catch { /* keep */ } }} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
