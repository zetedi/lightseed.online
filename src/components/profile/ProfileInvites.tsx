import React, { useState, useEffect, useCallback } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { createNetworkInvite, getSentInvites, getInviteRequests, approveInviteRequest, declineInviteRequest, triggerSystemEmail } from '../../services/firebase';
import { SectionTitle } from '../ui/SectionTitle';
import { Modal } from '../ui/Modal';

// The invite documents are schemaless in Firestore; these are the fields this tab reads.
interface SentInvite {
  id: string;
  email: string;
  status: string;
}

interface InviteRequest {
  id: string;
  email: string;
  reason?: string;
  status: string;
}

interface ProfileInvitesProps {
  uid: string;
  isSuperAdmin: boolean;
  // Invitations unlock once the user has planted a tree (superadmins are exempt).
  hasTrees: boolean;
  // Live allotment — kept in the shell, where the profile listener writes it.
  invitesRemaining: number;
  // Surfaces notices via the shell's shared dialog modal.
  notify: (message: string) => void;
}

// Invitations tab — send network invites, review sent ones, and (superadmin) handle join requests.
export const ProfileInvites: React.FC<ProfileInvitesProps> = ({ uid, isSuperAdmin, hasTrees, invitesRemaining, notify }) => {
  const { t } = useLanguage();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);

  const [sentInvites, setSentInvites] = useState<SentInvite[]>([]);
  const [sentCursor, setSentCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [sentHasMore, setSentHasMore] = useState(false);
  const [inviteRequests, setInviteRequests] = useState<InviteRequest[]>([]);
  const [reqCursor, setReqCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [reqHasMore, setReqHasMore] = useState(false);
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null);
  const [showDeclinedRequests, setShowDeclinedRequests] = useState(false);

  const refreshSentInvites = useCallback(() => {
    getSentInvites(uid).then(res => { setSentInvites(res.items); setSentCursor(res.lastDoc); setSentHasMore(res.hasMore); }).catch(() => {});
  }, [uid]);
  useEffect(() => { refreshSentInvites(); }, [refreshSentInvites]);

  const loadMoreSentInvites = () => {
    if (!sentCursor) return;
    getSentInvites(uid, sentCursor).then(res => { setSentInvites(prev => [...prev, ...res.items]); setSentCursor(res.lastDoc); setSentHasMore(res.hasMore); }).catch(() => {});
  };

  const refreshInviteRequests = useCallback(() => {
    if (!isSuperAdmin) return;
    getInviteRequests().then(res => { setInviteRequests(res.items); setReqCursor(res.lastDoc); setReqHasMore(res.hasMore); }).catch(() => {});
  }, [isSuperAdmin]);
  useEffect(() => { refreshInviteRequests(); }, [refreshInviteRequests]);

  const loadMoreInviteRequests = () => {
    if (!isSuperAdmin || !reqCursor) return;
    getInviteRequests(reqCursor).then(res => { setInviteRequests(prev => [...prev, ...res.items]); setReqCursor(res.lastDoc); setReqHasMore(res.hasMore); }).catch(() => {});
  };

  const setRequestStatusLocal = (id: string, status: string) =>
    setInviteRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));

  const handleApproveRequest = async (id: string) => {
    setRequestBusyId(id);
    try { await approveInviteRequest(id, uid); setRequestStatusLocal(id, 'approved'); notify('Invitation sent.'); }
    catch (e: any) { notify(e?.message || 'Failed to approve.'); }
    setRequestBusyId(null);
  };

  const handleDeclineRequest = async (req: InviteRequest) => {
    setRequestBusyId(req.id);
    try {
      // A kind rejection — they're welcome to ask again with more context.
      try {
        await triggerSystemEmail(req.email, 'About your lightseed invitation request',
          "Thank you for your interest in lightseed. For now, the reason to join wasn't yet clear to us, or didn't feel aligned with the spirit of the network. You are warmly welcome to request again, with a little more about your intention.\n\nWith care,\nthe lightseed stewards", uid);
      } catch (mailErr) { console.warn('Kind rejection email failed', mailErr); }
      await declineInviteRequest(req.id);
      setRequestStatusLocal(req.id, 'declined');
    } catch (e: any) { notify(e?.message || 'Failed to decline.'); }
    setRequestBusyId(null);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setSendingInvite(true);
    try {
      await createNetworkInvite(inviteEmail, uid, inviteMessage, { unlimited: isSuperAdmin });
      refreshSentInvites();
      notify(t('invite_sent'));
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteMessage('');
    } catch (e: any) {
      notify(e.message || 'Failed to send invite');
    }
    setSendingInvite(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle title={t('invitations')} sub={t('invites_sub')} />
        {(!hasTrees && !isSuperAdmin) ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100"><Icons.Tree /></div>
            <p className="text-sm">Plant your first tree to unlock invitations.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 p-5 space-y-3">
            <p className="text-sm text-slate-500">{t('invites_remaining')}: <span className="font-bold text-emerald-600">{isSuperAdmin ? 'Unlimited' : invitesRemaining}</span></p>
            <p className="text-xs text-slate-400">Invite someone by email — they'll receive a link that opens the join page with their email locked in.</p>
            <button onClick={() => setShowInviteModal(true)} disabled={!isSuperAdmin && invitesRemaining <= 0} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-emerald-700 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"><Icons.UserPlus /> <span>{t('send_invite')}</span></button>
          </div>
        )}
      </div>

      {/* Invitations you've sent */}
      {(hasTrees || isSuperAdmin) && (
        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Sent Invitations</h4>
          {sentInvites.length === 0 ? (
            <p className="text-xs text-slate-400">You haven't sent any invitations yet.</p>
          ) : (
            <div className="space-y-2">
              {sentInvites.map(inv => (
                <div key={inv.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <span className="truncate text-sm font-medium text-slate-800">{inv.email}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${inv.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{inv.status === 'accepted' ? 'Joined' : 'Pending'}</span>
                </div>
              ))}
            </div>
          )}
          {sentHasMore && (
            <button onClick={loadMoreSentInvites} className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50">Load more</button>
          )}
        </div>
      )}

      {/* Invite requests — people asking to join (super-admin) */}
      {isSuperAdmin && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">Invite Requests</h4>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <input type="checkbox" checked={showDeclinedRequests} onChange={e => setShowDeclinedRequests(e.target.checked)} className="h-3.5 w-3.5 rounded text-emerald-600 focus:ring-emerald-500" />
                Show declined
              </label>
              <button onClick={refreshInviteRequests} className="text-xs font-bold text-slate-400 hover:text-slate-700">Refresh</button>
            </div>
          </div>
          {(() => {
            const visible = inviteRequests.filter(r => r.status !== 'declined' || showDeclinedRequests);
            return visible.length === 0 ? (
              <p className="text-xs text-slate-400">No requests{showDeclinedRequests ? '' : ' to review'}.</p>
            ) : (
              <div className="space-y-2">
                {visible.map(req => (
                  <div key={req.id} className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{req.email}</p>
                      {req.reason && <p className="mt-0.5 line-clamp-3 text-xs italic text-slate-500">“{req.reason}”</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {req.status === 'pending' ? (
                        <>
                          <button onClick={() => handleApproveRequest(req.id)} disabled={requestBusyId === req.id} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{requestBusyId === req.id ? '…' : 'Invite'}</button>
                          <button onClick={() => handleDeclineRequest(req)} disabled={requestBusyId === req.id} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Decline</button>
                        </>
                      ) : (
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{req.status === 'approved' ? 'Invited' : 'Declined'}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          {reqHasMore && (
            <button onClick={loadMoreInviteRequests} className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50">Load more</button>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <Modal title={t('send_invite')} onClose={() => setShowInviteModal(false)}>
          <form onSubmit={handleSendInvite} className="space-y-4">
            <p className="text-xs text-slate-500 mb-4">{t('invites_remaining')}: {invitesRemaining}</p>
            <input
              required
              type="email"
              placeholder={t('invite_email_placeholder')}
              className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
            <textarea
              placeholder={t('invite_message_placeholder')}
              className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none h-24"
              value={inviteMessage}
              onChange={e => setInviteMessage(e.target.value)}
            />
            <button
              disabled={sendingInvite}
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg transition-colors shadow-lg active:scale-95 disabled:opacity-50"
            >
              {sendingInvite ? t('loading') : t('send_invite')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};
