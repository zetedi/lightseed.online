import React, { useState, useEffect, useCallback } from 'react';
import { showAlert } from '../ui/Dialog';
import { type TreeOwnershipInvite, roleLabelKey } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { speak, spokenLine } from '../../utils/translations';
import { getPendingTreeInvites, acceptTreeInvite, declineTreeInvite, getMyCommunityTreeInvites, respondCommunityTreeInvite, type CommunityTreeInvite } from '../../services/firebase';

interface ProfileInviteBannersProps {
  uid: string;
  // Surfaces notices via the shell's shared dialog modal.
  notify: (message: string) => void;
}

// The banners shown above the profile tabs: Tree Circle invitations (shared care of a tree)
// and community invitations (a community asking one of your trees to stand with it).
export const ProfileInviteBanners: React.FC<ProfileInviteBannersProps> = ({ uid, notify }) => {
  const { t } = useLanguage();
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
    catch (e: any) { showAlert(e?.message || 'err_invite_accept'); }
    setInviteBusyId(null);
  };

  const handleDeclineInvite = async (id: string) => {
    setInviteBusyId(id);
    try { await declineTreeInvite(id); refreshTreeInvites(); }
    catch (e: any) { showAlert(e?.message || 'err_invite_decline'); }
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
                  {t('invite_banner_tree')
                    .replace('{name}', inv.invitedByName || t('someone'))
                    .replace('{role}', t(roleLabelKey(inv.role)).toLowerCase())
                    .replace('{tree}', inv.lifetreeName || t('a_lifetree'))}
                </p>
                {inv.message && <p className="mt-1 text-xs italic text-emerald-700/80">“{inv.message}”</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => handleAcceptInvite(inv.id)} disabled={inviteBusyId === inv.id} className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50">{inviteBusyId === inv.id ? '…' : t('accept')}</button>
                <button onClick={() => handleDeclineInvite(inv.id)} disabled={inviteBusyId === inv.id} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">{t('decline')}</button>
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
                  {t('invite_banner_community')
                    .replace('{community}', inv.communityName || t('a_community'))
                    .replace('{tree}', inv.lifetreeName || t('a_lifetree'))}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={async () => { try { await respondCommunityTreeInvite(inv, true); setCommunityInvites(prev => prev.filter(i => i.id !== inv.id)); notify(speak(spokenLine('tree_stands_with', { tree: inv.lifetreeName || '', community: inv.communityName || '' }))); } catch (e: any) { notify(speak(e?.message || 'err_accept')); } }} className="rounded-full bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-teal-700">{t('accept')}</button>
                <button onClick={async () => { try { await respondCommunityTreeInvite(inv, false); setCommunityInvites(prev => prev.filter(i => i.id !== inv.id)); } catch { /* keep */ } }} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">{t('decline')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
