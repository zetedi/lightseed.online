import React, { useState, useEffect } from 'react';
import { showAlert, showConfirm } from '../ui/Dialog';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { getAdmins, deleteUserAsAdmin, listUsersAsAdmin, triggerSystemEmail, getNodeLimits, setNodeLimits } from '../../services/firebase';
import { resetLight } from '../../services/firebase/light';
import type { AdminUserRow } from '../../services/firebase';
import { DEFAULT_NODE_LIMITS } from '../../domain/limits';
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
  const [userList, setUserList] = useState<AdminUserRow[] | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Node planting caps (config/limits) — quality, not quantity.
  const [maxLifetrees, setMaxLifetrees] = useState(DEFAULT_NODE_LIMITS.maxLifetrees);
  const [maxGuardedTrees, setMaxGuardedTrees] = useState(DEFAULT_NODE_LIMITS.maxGuardedTrees);
  const [savingLimits, setSavingLimits] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) { getAdmins().then(setAdmins); }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isAdmin && !isSuperAdmin) return;
    getNodeLimits().then(l => { setMaxLifetrees(l.maxLifetrees); setMaxGuardedTrees(l.maxGuardedTrees); }).catch(() => undefined);
  }, [isAdmin, isSuperAdmin]);

  const handleSaveLimits = async () => {
    setSavingLimits(true);
    try {
      await setNodeLimits({ maxLifetrees, maxGuardedTrees });
      notify(`Planting limits saved: ${maxLifetrees} lifetrees + ${maxGuardedTrees} guarded = ${maxLifetrees + maxGuardedTrees} trees per being.`);
    } catch (e: any) { notify(e?.message || 'Could not save the limits.'); }
    setSavingLimits(false);
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try { setUserList(await listUsersAsAdmin()); }
    catch (e: any) { showAlert(e?.message || 'Could not load the users.'); }
    setLoadingUsers(false);
  };

  const handleDeleteUser = async (target?: AdminUserRow) => {
    const targetUid = (target?.uid || deleteUserUid).trim();
    if (!targetUid) return;
    const who = target ? `${target.displayName || target.email || targetUid}${target.email ? ` (${target.email})` : ''}` : targetUid;
    if (!(await showConfirm(`Permanently delete ${who} and all their trees, pulses, visions and account? This cannot be undone.`, { title: 'Delete user', confirmText: 'Delete user', danger: true }))) return;
    setDeletingUser(true);
    try {
      await deleteUserAsAdmin(targetUid);
      setDeleteUserUid('');
      setUserList(prev => prev ? prev.filter(u => u.uid !== targetUid) : prev);
      showAlert('User deleted.');
    }
    catch (e: any) { showAlert(e?.message || 'Could not delete the user.'); }
    setDeletingUser(false);
  };

  // RESET LIGHT — the testing-phase restart (ring 2026-07-21). Node owner only; the callable
  // enforces it too. Burns every ray and every glow; the care itself stays on the chains.
  const [resettingLight, setResettingLight] = useState(false);
  const handleResetLight = async () => {
    const sure = await showConfirm(
      'Remove ALL light from the system? Every ray and every glow burns back to zero. The care itself stays on the chains, and the light already left the trees in better shape, so nothing real is lost. Light re-enters only through witnessed care.',
      { title: 'Reset light', confirmText: 'Reset light', danger: true },
    );
    if (!sure) return;
    setResettingLight(true);
    try {
      const r = await resetLight();
      notify(`The light is reset: ${r.rays} rays (${r.rayUnits} units) and ${r.glowHomes} glow homes (${r.glowUnits} units) returned to the sun.`);
    } catch (e: any) {
      notify(e?.message || 'Could not reset the light.');
    }
    setResettingLight(false);
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
      {/* The testing-phase restart — node owner only (the callable refuses everyone else). */}
      {isSuperAdmin && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="min-w-0">
            <p className="font-semibold text-amber-900 text-sm">Reset light</p>
            <p className="text-xs text-amber-700/80">Burn every ray and every glow back to zero. The care stays on the chains; the trees keep what the light gave them.</p>
          </div>
          <button onClick={handleResetLight} disabled={resettingLight} className="rounded-full border border-amber-300 bg-white text-amber-700 hover:bg-amber-100 text-xs font-bold px-4 py-2 whitespace-nowrap transition-colors disabled:opacity-50">
            {resettingLight ? 'Resetting…' : 'Reset light'}
          </button>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-100 p-4">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm">Email delivery test</p>
          <p className="text-xs text-slate-500">Send yourself a test message to verify delivery.</p>
        </div>
        <button onClick={handleTestEmail} className="rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 whitespace-nowrap transition-colors">{mailStatus || 'Send test'}</button>
      </div>

      {/* Node planting limits — per-being caps, editable by node admins (config/limits). */}
      {(isAdmin || isSuperAdmin) && (
        <div className="mb-4 rounded-2xl border border-slate-100 p-5 space-y-3">
          <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider"><Icons.Tree /> Planting limits</h4>
          <p className="text-xs text-slate-500">How many trees one being may tend on this node. We would like quality, not quantity.</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Lifetrees
              <input type="number" min={1} value={maxLifetrees} onChange={e => setMaxLifetrees(Number(e.target.value))}
                className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-800 focus:outline-none focus:border-emerald-400" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Guarded trees
              <input type="number" min={1} value={maxGuardedTrees} onChange={e => setMaxGuardedTrees(Number(e.target.value))}
                className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-800 focus:outline-none focus:border-emerald-400" />
            </label>
            <div className="flex-1 text-xs text-slate-400 pb-2 whitespace-nowrap">= {(maxLifetrees || 0) + (maxGuardedTrees || 0)} together</div>
            <button onClick={handleSaveLimits} disabled={savingLimits || maxLifetrees < 1 || maxGuardedTrees < 1}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 transition-colors">
              {savingLimits ? 'Saving…' : 'Save limits'}
            </button>
          </div>
        </div>
      )}
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
              <button disabled={!deleteUserUid.trim() || deletingUser} onClick={() => handleDeleteUser()} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors whitespace-nowrap">{deletingUser ? 'Deleting…' : 'Delete user'}</button>
            </div>

            {/* Browse the network's users instead of pasting uids by hand. */}
            {userList === null ? (
              <button onClick={loadUsers} disabled={loadingUsers} className="w-full rounded-lg border border-red-200 bg-white py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50">
                {loadingUsers ? 'Loading users…' : 'Browse users'}
              </button>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{userList.length} users</p>
                  <button onClick={loadUsers} disabled={loadingUsers} className="text-[11px] font-bold text-slate-400 hover:text-slate-600 disabled:opacity-50">{loadingUsers ? 'Refreshing…' : 'Refresh'}</button>
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                  {userList.length === 0 && <p className="text-xs text-slate-400">No users found.</p>}
                  {userList.map(u => (
                    <div key={u.uid} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 border border-slate-100">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-700">
                          {u.displayName || u.email || u.uid}
                          {u.isSuperAdmin && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">node owner</span>}
                        </p>
                        <p className="truncate text-[10px] text-slate-400">{u.email || 'no email'} · <span className="font-mono">{u.uid}</span>{u.createdAt ? ` · ${new Date(u.createdAt).toLocaleDateString()}` : ''}</p>
                      </div>
                      <button
                        disabled={deletingUser || u.uid === uid || u.isSuperAdmin}
                        title={u.uid === uid ? 'You cannot delete yourself here.' : (u.isSuperAdmin ? 'The node owner cannot be deleted.' : 'Delete this user')}
                        onClick={() => handleDeleteUser(u)}
                        className="shrink-0 rounded-lg bg-red-600 px-2.5 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
