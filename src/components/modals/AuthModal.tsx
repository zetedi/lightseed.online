import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Icons } from '../ui/Icons';
import { showAlert } from '../ui/Dialog';
import { useLanguage } from '../../contexts/LanguageContext';
import { TermsModal } from '../TermsModal';
import { getTerms } from '../../utils/terms';
import { signInWithGoogle, signUpWithEmail, signInWithEmail, resetPassword, getNetworkInvite, submitInviteRequest } from '../../services/firebase';
import { friendlyAuthError } from '../../utils/authErrors';

const field = "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-500";

type Mode = 'signin' | 'signup' | 'request';

export const AuthModal = ({ onClose, inviteId, inviteOnly }: { onClose: () => void; inviteId?: string; inviteOnly: boolean }) => {
  const { t, language } = useLanguage();
  const terms = getTerms(language);
  const [mode, setMode] = useState<Mode>(inviteId ? 'signup' : 'signin');
  const [lockedEmail, setLockedEmail] = useState<string | null>(null);
  const [inviteValid, setInviteValid] = useState<boolean | null>(inviteId ? null : false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requestResult, setRequestResult] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);

  // Resolve an invitation → lock the email on the sign-up form.
  useEffect(() => {
    if (!inviteId) return;
    getNetworkInvite(inviteId).then(inv => {
      if (inv && inv.status === 'pending') {
        setLockedEmail(inv.email); setEmail(inv.email); setInviteValid(true); setMode('signup');
      } else {
        setInviteValid(false);
      }
    }).catch(() => setInviteValid(false));
  }, [inviteId]);

  const canSignup = !inviteOnly || inviteValid === true;

  const handleGoogle = async () => {
    setBusy(true);
    try { await signInWithGoogle({ inviteId, inviteOnly }); onClose(); }
    catch (e: any) {
      showAlert(e?.message === 'INVITE_ONLY'
        ? t('auth_invite_only_alert')
        : friendlyAuthError(e, t('auth_signin_failed')));
    }
    setBusy(false);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        if (!agreed) { showAlert(t('auth_accept_agreement')); setBusy(false); return; }
        await signUpWithEmail(email, password, name, { inviteId, inviteOnly });
      }
      onClose();
    } catch (e: any) {
      showAlert(e?.message === 'INVITE_ONLY' ? t('auth_invite_only_short') : friendlyAuthError(e, t('auth_failed')));
    }
    setBusy(false);
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try { setRequestResult(await submitInviteRequest(email, reason) || 'created'); }
    catch (e: any) { showAlert(e?.message || t('auth_request_failed')); }
    setBusy(false);
  };

  const handleReset = async () => {
    if (!email.trim()) { showAlert(t('auth_enter_email_first')); return; }
    try { await resetPassword(email); showAlert(t('auth_reset_sent')); }
    catch (e: any) { showAlert(friendlyAuthError(e, t('auth_reset_failed'))); }
  };

  const title = mode === 'request' ? t('auth_request_invitation') : (mode === 'signup' ? t('auth_join') : t('sign_in'));

  return (
    <Modal title={title} onClose={onClose}>
      {mode === 'request' ? (
        requestResult ? (
          <div className={`space-y-3 rounded-xl border p-5 text-center text-sm ${requestResult === 'pending_invite_exists' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
            {requestResult === 'pending_invite_exists' ? (
              <>
                <p className="text-base font-bold">{t('auth_invite_waiting_title')}</p>
                <p>{t('auth_invite_waiting_body')}</p>
              </>
            ) : requestResult === 'already_requested' ? (
              <>
                <p className="text-base font-bold">{t('auth_already_requested_title')}</p>
                <p>{t('auth_already_requested_body')}</p>
              </>
            ) : (
              <>
                <p className="text-base font-bold">{t('auth_request_received_title')}</p>
                <p>{t('auth_request_received_body')}</p>
              </>
            )}
            <button onClick={() => { setRequestResult(null); setMode('signin'); }} className="font-bold text-emerald-700">{t('auth_back_to_signin')}</button>
          </div>
        ) : (
          <form onSubmit={handleRequest} className="space-y-3">
            <p className="text-sm text-slate-500">{t('auth_request_intro')}</p>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder={t('auth_your_email')} className={field} />
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={t('auth_reason_placeholder')} className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-emerald-700 disabled:opacity-50">
              {busy ? '…' : t('auth_request_invitation')}
            </button>
            <button type="button" onClick={() => setMode('signin')} className="w-full text-center text-xs text-slate-500 hover:text-slate-700">{t('auth_back_to_signin')}</button>
          </form>
        )
      ) : (
        <div className="space-y-4">
          {inviteId && inviteValid === false && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{t('auth_invite_invalid')}</div>
          )}
          {lockedEmail && inviteValid && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{t('auth_invited_as')} <span className="font-bold">{lockedEmail}</span>.</div>
          )}

          <button onClick={handleGoogle} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50">
            <Icons.GoogleG /> <span>{t('auth_continue_google')}</span>
          </button>

          <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            <div className="h-px flex-1 bg-slate-200" /> {t('auth_or')} <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {mode === 'signup' && (
              <input value={name} onChange={e => setName(e.target.value)} placeholder={t('auth_your_name')} className={field} />
            )}
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={!!lockedEmail} required placeholder={t('auth_email')} className={field} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder={mode === 'signup' ? t('auth_set_password') : t('auth_password')} className={field} />

            {mode === 'signup' && (
              <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded text-emerald-600 focus:ring-emerald-500" />
                <span>
                  {terms.checkbox}{' '}
                  <button type="button" onClick={() => setShowTerms(true)} className="font-bold text-emerald-600 underline">{terms.title}</button>
                </span>
              </label>
            )}

            {mode === 'signup' && !canSignup ? (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                <p>{t('auth_invite_only_note')}</p>
                <button type="button" onClick={() => { setMode('request'); }} className="font-bold text-emerald-600">{t('auth_request_arrow')}</button>
              </div>
            ) : (
              <button type="submit" disabled={busy || (mode === 'signup' && !agreed)} className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-emerald-700 disabled:opacity-50">
                {busy ? '…' : (mode === 'signup' ? t('auth_create_account') : t('sign_in'))}
              </button>
            )}
          </form>

          <div className="flex items-center justify-between text-xs text-slate-500">
            {mode === 'signin' ? (
              <>
                <button onClick={handleReset} className="hover:text-slate-700">{t('auth_forgot_password')}</button>
                {(!inviteOnly || inviteValid)
                  ? <button onClick={() => setMode('signup')} className="font-bold text-emerald-600">{t('auth_create_an_account')}</button>
                  : <button onClick={() => setMode('request')} className="font-bold text-emerald-600">{t('auth_request_invitation')}</button>}
              </>
            ) : (
              <button onClick={() => setMode('signin')} className="font-bold text-emerald-600">{t('auth_have_account')}</button>
            )}
          </div>
        </div>
      )}

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
    </Modal>
  );
};
