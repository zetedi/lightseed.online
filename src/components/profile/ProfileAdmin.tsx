import React, { useState, useEffect } from 'react';
import { showAlert, showConfirm } from '../ui/Dialog';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { getAdmins, deleteUserAsAdmin, triggerSystemEmail } from '../../services/firebase';
import { SectionTitle } from '../ui/SectionTitle';

interface ProfileAdminProps {
  uid: string;
  email: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  superAdminExists: boolean;
  onClaimSuperAdmin: () => void;
  onGrantAdmin: (uid: string) => Promise<void>;
  onRevokeAdmin: (uid: string) => Promise<void>;
  onOpenNewsletterAdmin: () => void;
  // Surfaces notices via the shell's shared dialog modal.
  notify: (message: string) => void;
}

// Admin tab — email delivery test, genesis superadmin claim, admin management,
// user deletion (re-testing onboarding) and the newsletter send.
export const ProfileAdmin: React.FC<ProfileAdminProps> = ({
  uid,
  email,
  isAdmin,
  isSuperAdmin,
  superAdminExists,
  onClaimSuperAdmin,
  onGrantAdmin,
  onRevokeAdmin,
  onOpenNewsletterAdmin,
  notify,
}) => {
  const { t } = useLanguage();
  const [mailStatus, setMailStatus] = useState<string | null>(null);

  // Admin management state (superadmin only)
  const [admins, setAdmins] = useState<{ uid: string }[]>([]);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [deleteUserUid, setDeleteUserUid] = useState('');
  const [deletingUser, setDeletingUser] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) { getAdmins().then(setAdmins); }
  }, [isSuperAdmin]);

  const handleDeleteUser = async () => {
    const targetUid = deleteUserUid.trim();
    if (!targetUid) return;
    if (!(await showConfirm(`Permanently delete user ${targetUid} and all their trees, pulses, visions and account? This cannot be undone.`, { title: 'Delete user', confirmText: 'Delete user', danger: true }))) return;
    setDeletingUser(true);
    try { await deleteUserAsAdmin(targetUid); setDeleteUserUid(''); showAlert('User deleted.'); }
    catch (e: any) { showAlert(e?.message || 'Could not delete the user.'); }
    setDeletingUser(false);
  };

  const handleTestEmail = async () => {
    const targetEmail = prompt('Enter the email address to send test to:', email ?? undefined);
    if (!targetEmail) return;

    setMailStatus('SENDING...');

    try {
      await triggerSystemEmail(
        targetEmail,
        'Debug Test: lightseed Network',
        `This is a test email sent at ${new Date().toLocaleTimeString()} to verify the SMTP pipeline. If you see this, the system is working.`,
        uid
      );

      setMailStatus(`SUCCESS! Sent to ${targetEmail}`);
      setTimeout(() => { setMailStatus(null); }, 5000);
    } catch (e: any) {
      notify('Failed to write to database: ' + e.message);
      setMailStatus(null);
    }
  };

  return (
    <div>
      <SectionTitle title={t('admin_title')} sub={t('admin_sub')} />
      <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-100 p-4">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm">Email delivery test</p>
          <p className="text-xs text-slate-500">Send yourself a test message to verify delivery.</p>
        </div>
        <button onClick={handleTestEmail} className="rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 whitespace-nowrap transition-colors">{mailStatus || 'Send test'}</button>
      </div>
      {!superAdminExists && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 flex items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-amber-800 text-sm">Genesis SuperAdmin unclaimed</h4>
            <p className="text-xs text-amber-700/80">Be the first to claim the SuperAdmin role.</p>
          </div>
          <button onClick={onClaimSuperAdmin} className="bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold px-4 py-2 rounded-full shadow whitespace-nowrap">Claim</button>
        </div>
      )}
      {isSuperAdmin && (
        <>
          <div className="rounded-2xl border border-slate-100 p-5 space-y-4">
            <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider"><Icons.Shield /> Admin Management</h4>
            <div className="flex gap-2">
              <input value={newAdminUid} onChange={e => setNewAdminUid(e.target.value)} placeholder="User UID" className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-indigo-400" />
              <button disabled={!newAdminUid || adminActionLoading} onClick={async () => { setAdminActionLoading(true); await onGrantAdmin(newAdminUid.trim()); setNewAdminUid(''); const updated = await getAdmins(); setAdmins(updated); setAdminActionLoading(false); }} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors">Grant</button>
            </div>
            <div className="flex flex-col gap-1.5">
              {admins.length === 0 && <p className="text-xs text-slate-400">No admins yet.</p>}
              {admins.map(a => (
                <div key={a.uid} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                  <span className="text-xs font-mono text-slate-600">{a.uid}</span>
                  <button onClick={async () => { setAdminActionLoading(true); await onRevokeAdmin(a.uid); setAdmins(prev => prev.filter(x => x.uid !== a.uid)); setAdminActionLoading(false); }} className="text-red-500 hover:text-red-600 text-xs font-bold ml-3 transition-colors">Revoke</button>
                </div>
              ))}
            </div>
          </div>

          {/* Delete a user — for re-testing onboarding. Removes their data + Auth account. */}
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50/40 p-5 space-y-3">
            <h4 className="font-bold text-red-700 flex items-center gap-2 text-sm uppercase tracking-wider"><Icons.Trash /> Delete a user</h4>
            <p className="text-xs text-slate-500">Permanently removes a user's trees, pulses, visions and account. Use for re-testing onboarding.</p>
            <div className="flex gap-2">
              <input value={deleteUserUid} onChange={e => setDeleteUserUid(e.target.value)} placeholder="User UID" className="flex-1 bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-red-400" />
              <button disabled={!deleteUserUid.trim() || deletingUser} onClick={handleDeleteUser} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors whitespace-nowrap">{deletingUser ? 'Deleting…' : 'Delete user'}</button>
            </div>
          </div>

          {/* Newsletter — unrelated to admin management, so it lives in its own section */}
          <div className="mt-4 rounded-2xl border border-slate-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider"><Icons.Send /> Newsletter</h4>
              <p className="text-xs text-slate-500 mt-1">Send a network update to all subscribers.</p>
            </div>
            <button onClick={onOpenNewsletterAdmin} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"><Icons.Send /><span>Send Newsletter</span></button>
          </div>
        </>
      )}
      {isAdmin && !isSuperAdmin && <p className="text-sm text-slate-500">You hold admin privileges in this network.</p>}
    </div>
  );
};
