import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { setNewsletterSubscription, updateUserProfile, setOnlyValidatedCanReach, deleteUserAccount, logout } from '../../services/firebase';
import { SectionTitle } from '../ui/SectionTitle';
import { Modal } from '../ui/Modal';

// Module-scope (not created during render) so React keeps the DOM node between renders.
const Toggle = ({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={onClick}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
  >
    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

interface ProfileSettingsProps {
  uid: string;
  email: string | null;
  // The toggle values live in the shell, where the live profile listener writes them;
  // the change callbacks reflect a successful save back into that shared state.
  onlyValidatedCanReach: boolean;
  onOnlyValidatedChange: (value: boolean) => void;
  newsletterSubscribed: boolean;
  onNewsletterChange: (value: boolean) => void;
  dmEmailNotifications: boolean;
  onDmEmailChange: (value: boolean) => void;
  // Surfaces notices via the shell's shared dialog modal.
  notify: (message: string) => void;
}

// Settings tab — contact privacy, newsletter and email-notification toggles, account deletion.
export const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  uid,
  email,
  onlyValidatedCanReach,
  onOnlyValidatedChange,
  newsletterSubscribed,
  onNewsletterChange,
  dmEmailNotifications,
  onDmEmailChange,
  notify,
}) => {
  const { t } = useLanguage();
  const [togglingNewsletter, setTogglingNewsletter] = useState(false);
  const [togglingDmEmail, setTogglingDmEmail] = useState(false);
  const [togglingValidatedReach, setTogglingValidatedReach] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleNewsletterToggle = async () => {
    if (!email || togglingNewsletter) return;
    setTogglingNewsletter(true);
    try {
      const nextValue = !newsletterSubscribed;
      await setNewsletterSubscription(uid, email, nextValue);
      onNewsletterChange(nextValue);
      notify(nextValue ? 'Newsletter subscribed.' : 'Newsletter unsubscribed.');
    } catch (e: any) {
      notify(e.message || 'Failed to update newsletter preference.');
    }
    setTogglingNewsletter(false);
  };

  const handleDmEmailToggle = async () => {
    if (togglingDmEmail) return;
    setTogglingDmEmail(true);
    try {
      const nextValue = !dmEmailNotifications;
      await updateUserProfile(uid, { emailNotifications: { directMessages: nextValue } });
      onDmEmailChange(nextValue);
      notify(nextValue
        ? 'You will be emailed when someone sends you a direct message.'
        : 'Direct message email notifications turned off.');
    } catch (e: any) {
      notify(e.message || 'Failed to update email notification preference.');
    }
    setTogglingDmEmail(false);
  };

  const handleOnlyValidatedToggle = async () => {
    if (togglingValidatedReach) return;
    setTogglingValidatedReach(true);
    try {
      const nextValue = !onlyValidatedCanReach;
      await setOnlyValidatedCanReach(uid, nextValue);
      onOnlyValidatedChange(nextValue);
      notify(nextValue
        ? 'Only validated trees can now send you direct messages.'
        : 'Anyone can now send you direct messages.');
    } catch (e: any) {
      notify(e.message || 'Failed to update contact privacy.');
    }
    setTogglingValidatedReach(false);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteUserAccount();
      await logout();
      notify(t('delete_goodbye'));
      window.location.reload();
    } catch (e: any) {
      console.error('Delete Account Error:', e);
      if (e.message && (e.message.includes('log out') || e.message.includes('recent-login'))) {
        notify('Security Check: Please sign in again to confirm deletion.');
        await logout();
        window.location.reload();
        return;
      }
      notify(e.message);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div>
      <SectionTitle title={t('settings_title')} sub={t('settings_sub')} />
      <div className="rounded-2xl border border-slate-100 divide-y divide-slate-100">
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm">{t('only_validated_can_reach')}</p>
            <p className="text-xs text-slate-500">{t('only_validated_can_reach_help')}</p>
          </div>
          <Toggle on={onlyValidatedCanReach} onClick={handleOnlyValidatedToggle} disabled={togglingValidatedReach} />
        </div>
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm">Newsletter</p>
            <p className="text-xs text-slate-500">A gentle update from the network every few weeks.</p>
          </div>
          <Toggle on={newsletterSubscribed} onClick={handleNewsletterToggle} disabled={togglingNewsletter || !email} />
        </div>
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm">Email me when someone sends me a direct message</p>
            <p className="text-xs text-slate-500">You can turn this off anytime.</p>
          </div>
          <Toggle on={dmEmailNotifications} onClick={handleDmEmailToggle} disabled={togglingDmEmail || !email} />
        </div>
      </div>
      <div className="mt-6 rounded-2xl border border-red-100 bg-red-50/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-red-700 text-sm">{t('delete_account')}</p>
          <p className="text-xs text-red-500/80">Permanently remove your trees, pulses, visions and profile.</p>
        </div>
        <button onClick={() => setShowDeleteConfirm(true)} className="rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-600 hover:text-white text-xs font-bold px-4 py-2 transition-colors whitespace-nowrap self-start sm:self-auto">{t('delete_account')}</button>
      </div>

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <Modal title={t('delete_confirm_title')} onClose={() => setShowDeleteConfirm(false)}>
          <div className="space-y-6">
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-red-800 text-sm">
              <p className="font-bold mb-1">{t('delete_confirm_desc')}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isDeleting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Icons.Trash />}
                <span>{t('delete_account')}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
