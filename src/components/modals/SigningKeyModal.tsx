import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import {
  ensureSigningKey, restoreFromPhrase, getDeviceKeyInfo, getPublishedSigningKey, publishSigningKey,
  getPublishedSigningIdentity, rotateSigningKey, freezeSigningKey,
  beginSigningKeyRecovery, getPendingSigningKeyRecovery,
  getSigningKeyRecoveryPreview, witnessSigningKeyRecovery, activateSigningKeyRecovery,
  type PendingRecovery, type RecoveryPreview,
  signingAvailable, SigningKeyNeedsRestoreError, RestoreKeyMismatchError,
} from '../../services/keys';
import { parsePhrase, keyCustody, type KeyCustody } from '../../domain/signing';
import { KEY_RECOVERY_QUORUM } from '../../domain/keyEpoch';

// The signing-key lifecycle: create/restore, cross-signed rotation, unilateral emergency freeze,
// and three-witness recovery. The private key never leaves the device; only public proofs land.
// The modal reads the pure CUSTODY state (domain/signing.keyCustody) on open, so every conflict
// between this device and the published identity is surfaced, never silently resolved:
//   needs_restore — a key is published but absent here: restore from the phrase. Authentication
//     alone can never replace signing authority.
//   stale_device  — this device holds an OLDER key than the published one: restore the current
//     phrase here; it can never republish itself over the present identity.
//   restore mismatch — a valid phrase deriving a DIFFERENT key than the published one is refused,
//     because replacement requires a proof-bearing rotation or witnessed recovery.

type View = 'status' | 'phrase' | 'restore' | 'needs_restore' | 'rotate' | 'freeze' | 'witness';

export const SigningKeyModal: React.FC<{ uid: string; onClose: () => void; notify: (m: string) => void }> = ({ uid, onClose, notify }) => {
  const { t } = useLanguage();
  const [view, setView] = useState<View>('status');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [custody, setCustody] = useState<KeyCustody | null>(null);
  const [publicKeyB64, setPublicKeyB64] = useState<string | null>(null);
  const [phrase, setPhrase] = useState<string[]>([]);
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [restoreInput, setRestoreInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [phrasePurpose, setPhrasePurpose] = useState<'created' | 'rotated' | 'recovery'>('created');
  const [confirmedRotate, setConfirmedRotate] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [confirmedFreeze, setConfirmedFreeze] = useState(false);
  const [suspectedSince, setSuspectedSince] = useState('');
  const [pendingRecovery, setPendingRecovery] = useState<PendingRecovery | null>(null);
  const [witnessCode, setWitnessCode] = useState('');
  const [witnessPreview, setWitnessPreview] = useState<RecoveryPreview | null>(null);
  const [confirmedWitness, setConfirmedWitness] = useState(false);

  // Positive list: these custody states mean a key IS on this device. Any future state defaults to
  // "no key here" — the safe reading (show the create/restore doors, never a false "ready").
  const hasKey = custody === 'ready' || custody === 'publish_needed' || custody === 'stale_device';

  const resetRestoreFlow = () => { setErr(null); };

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ok, device, published, identity, pending] = await Promise.all([
        signingAvailable(),
        getDeviceKeyInfo(uid).catch(() => null),
        getPublishedSigningKey(uid).catch(() => ''),
        getPublishedSigningIdentity(uid).catch(() => null),
        getPendingSigningKeyRecovery(uid).catch(() => null),
      ]);
      if (!alive) return;
      setAvailable(ok);
      setFrozen(identity?.state === 'frozen');
      setPendingRecovery(pending);
      const state = keyCustody(device?.publicKeyB64 ?? null, published);
      setCustody(state);
      if (device) setPublicKeyB64(device.publicKeyB64);
      // A published identity with no key here: open STRAIGHT on the restore guidance — never on a
      // status view whose Create button can only throw.
      if (identity?.state === 'frozen') setView('status');
      else if (state === 'needs_restore') setView('needs_restore');
    })();
    return () => { alive = false; };
  }, [uid]);

  // Shared success handling for first creation: surface the phrase once, or settle to ready.
  const settleEnsured = (res: { created: boolean; publicKeyB64: string; recoveryPhrase?: string[] }) => {
    setPublicKeyB64(res.publicKeyB64);
    if (res.created && res.recoveryPhrase) {
      setPhrasePurpose('created');
      setPhrase(res.recoveryPhrase);
      setConfirmedSaved(false);
      setView('phrase');
    } else {
      setCustody('ready');
      setView('status');
      notify(t('signing_key_ready'));
    }
  };

  const create = async () => {
    setBusy(true); setErr(null);
    try {
      settleEnsured(await ensureSigningKey(uid));
    } catch (e) {
      if (e instanceof SigningKeyNeedsRestoreError) {
        // A key is published but not on this device: never mint or republish over it.
        setView('needs_restore');
      } else {
        setErr(e instanceof Error ? e.message : 'Could not create the signing key.');
      }
    }
    setBusy(false);
  };

  // The publish_needed remedy: the device key exists but a past publish failed — publish it now,
  // loudly (the self-heal inside ensureSigningKey is best-effort and would swallow a failure).
  // Nothing is minted, no phrase is shown.
  const publishNow = async () => {
    setBusy(true); setErr(null);
    try {
      const device = await getDeviceKeyInfo(uid);
      if (!device) throw new Error('No signing key on this device.');
      await publishSigningKey(uid, device.publicKeyB64);
      setPublicKeyB64(device.publicKeyB64);
      setCustody('ready');
      notify(t('signing_key_ready'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not publish your signing key.');
    }
    setBusy(false);
  };

  const finishPhrase = () => {
    setPhrase([]); // let the seed-derived words go — never persisted, never shown again
    if (phrasePurpose !== 'recovery') setCustody('ready');
    setView('status');
    notify(t(
      phrasePurpose === 'rotated'
        ? 'signing_key_rotated'
        : phrasePurpose === 'recovery'
          ? 'signing_recovery_opened'
          : 'signing_key_created',
    ));
  };

  const rotate = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await rotateSigningKey(uid);
      setPublicKeyB64(res.publicKeyB64);
      setPhrase(res.recoveryPhrase);
      setPhrasePurpose('rotated');
      setConfirmedSaved(false);
      setConfirmedRotate(false);
      setCustody('ready');
      setView('phrase');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not rotate the signing key.');
    }
    setBusy(false);
  };

  const freeze = async () => {
    setBusy(true); setErr(null);
    try {
      const parsed = suspectedSince ? new Date(suspectedSince).getTime() : undefined;
      if (suspectedSince && !Number.isFinite(parsed)) throw new Error('Choose a valid date and time.');
      await freezeSigningKey(uid, parsed);
      setFrozen(true);
      setConfirmedFreeze(false);
      setView('status');
      notify(t('signing_frozen_done'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not freeze the signing key.');
    }
    setBusy(false);
  };

  const beginRecovery = async () => {
    setBusy(true); setErr(null);
    try {
      const result = await beginSigningKeyRecovery(uid);
      setPendingRecovery(result);
      setPhrase(result.recoveryPhrase);
      setPhrasePurpose('recovery');
      setConfirmedSaved(false);
      setView('phrase');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not begin witnessed recovery.');
    }
    setBusy(false);
  };

  const refreshRecovery = async () => {
    setBusy(true); setErr(null);
    try {
      setPendingRecovery(await getPendingSigningKeyRecovery(uid));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not refresh the witnesses.');
    }
    setBusy(false);
  };

  const activateRecovery = async () => {
    setBusy(true); setErr(null);
    try {
      const identity = await activateSigningKeyRecovery(uid);
      setPublicKeyB64(identity.publicKeyB64);
      setFrozen(false);
      setCustody('ready');
      setPendingRecovery(null);
      notify(t('signing_recovery_activated'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not activate the recovered key.');
    }
    setBusy(false);
  };

  const witnessRecovery = async () => {
    setBusy(true); setErr(null);
    try {
      if (!witnessPreview) {
        setWitnessPreview(await getSigningKeyRecoveryPreview(witnessCode));
        setBusy(false);
        return;
      }
      if (!confirmedWitness) throw new Error('Confirm the recovery you are witnessing.');
      await witnessSigningKeyRecovery(witnessCode, uid);
      setWitnessCode('');
      setWitnessPreview(null);
      setConfirmedWitness(false);
      setView('status');
      notify(t('signing_recovery_witnessed'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not witness that recovery.');
    }
    setBusy(false);
  };

  const restore = async () => {
    const words = parsePhrase(restoreInput);
    setBusy(true); setErr(null);
    try {
      const res = await restoreFromPhrase(words, uid);
      setPublicKeyB64(res.publicKeyB64);
      setCustody('ready');
      resetRestoreFlow();
      setView('status');
      notify(t('signing_key_restored'));
    } catch (e) {
      if (e instanceof RestoreKeyMismatchError) {
        setErr(t('signing_restore_mismatch_warn'));
      } else {
        setErr(e instanceof Error ? e.message : 'Could not restore from that phrase.');
      }
    }
    setBusy(false);
  };

  const copyPhrase = async () => {
    try { await navigator.clipboard.writeText(phrase.join(' ')); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  const copyRecoveryCode = async () => {
    if (!pendingRecovery) return;
    try {
      await navigator.clipboard.writeText(pendingRecovery.recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  const title = view === 'phrase' ? t('signing_phrase_title')
    : view === 'restore' ? t('signing_restore_title')
    : view === 'needs_restore' ? t('signing_needs_restore_title')
    : view === 'rotate' ? t('signing_rotate_title')
    : view === 'freeze' ? t('signing_freeze_title')
    : view === 'witness' ? t('signing_witness_title')
    : t('signing_key');

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        {available === false && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{t('signing_unavailable')}</p>
        )}

        {view === 'status' && (
          <>
            <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <span className={`mt-0.5 ${custody === 'stale_device' || custody === 'publish_needed' ? 'text-amber-600' : 'text-emerald-600'} [&>svg]:h-5 [&>svg]:w-5`}><Icons.Key /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  {frozen ? t('signing_frozen')
                    : custody === 'stale_device' ? t('signing_stale_title')
                    : custody === 'publish_needed' ? t('signing_publish_needed')
                    : hasKey ? t('signing_key_ready') : t('signing_key_none')}
                </p>
                <p className="text-xs text-slate-500">{t('signing_key_help')}</p>
              </div>
            </div>

            {publicKeyB64 && (
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">{t('signing_pubkey_label')}</p>
                <p className="break-all rounded-lg bg-slate-900 px-3 py-2 font-mono text-[11px] text-emerald-300">{publicKeyB64}</p>
              </div>
            )}

            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}

            <div className="flex flex-col gap-2">
              {!hasKey && !frozen && (
                <button type="button" onClick={create} disabled={busy || available === false}
                  className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {busy ? t('signing_key_creating') : t('signing_key_create')}
                </button>
              )}
              {custody === 'publish_needed' && !frozen && (
                <button type="button" onClick={publishNow} disabled={busy || available === false}
                  className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {busy ? t('signing_key_creating') : t('signing_publish_now')}
                </button>
              )}
              <button type="button" onClick={() => { resetRestoreFlow(); setView('restore'); }} disabled={available === false || frozen}
                className="w-full rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {t('signing_key_restore')}
              </button>
              {custody === 'ready' && !frozen && (
                <button type="button" onClick={() => { setErr(null); setConfirmedRotate(false); setView('rotate'); }}
                  className="w-full rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  {t('signing_rotate')}
                </button>
              )}
              {custody === 'ready' && !frozen && (
                <button type="button" onClick={() => {
                  setErr(null); setWitnessCode(''); setWitnessPreview(null); setConfirmedWitness(false); setView('witness');
                }}
                  className="w-full rounded-xl border border-indigo-200 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-50">
                  {t('signing_witness')}
                </button>
              )}
              {!frozen && publicKeyB64 && (
                <button type="button" onClick={() => { setErr(null); setConfirmedFreeze(false); setSuspectedSince(''); setView('freeze'); }}
                  className="w-full rounded-xl border border-red-200 py-3 text-sm font-bold text-red-700 hover:bg-red-50">
                  {t('signing_freeze')}
                </button>
              )}
            </div>

            {frozen && (
              <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-3 py-3">
                <p className="text-xs text-red-700">{t('signing_frozen_help')}</p>
                {pendingRecovery ? (
                  <>
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-red-500">{t('signing_recovery_code')}</p>
                      <p className="break-all rounded-lg bg-white px-2 py-2 font-mono text-[11px] text-slate-700">{pendingRecovery.recoveryCode}</p>
                      <button type="button" onClick={copyRecoveryCode}
                        className="mt-1 text-[11px] font-bold text-red-700 hover:text-red-900">
                        {copied ? t('copied') : t('copy')}
                      </button>
                    </div>
                    <p className="text-xs font-semibold text-red-800">
                      {t('signing_witness_count')}: {pendingRecovery.witnessCount} / {KEY_RECOVERY_QUORUM}
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={refreshRecovery} disabled={busy}
                        className="flex-1 rounded-lg border border-red-200 bg-white py-2 text-xs font-bold text-red-700 disabled:opacity-50">
                        {t('refresh')}
                      </button>
                      <button type="button" onClick={activateRecovery} disabled={busy || pendingRecovery.witnessCount < KEY_RECOVERY_QUORUM}
                        className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-bold text-white disabled:opacity-50">
                        {t('signing_recovery_activate')}
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" onClick={beginRecovery} disabled={busy || available === false}
                    className="w-full rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                    {busy ? t('signing_key_creating') : t('signing_recovery_begin')}
                  </button>
                )}
              </div>
            )}

            {custody === 'stale_device' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">{t('signing_stale_warn')}</p>
              </div>
            )}
          </>
        )}

        {view === 'phrase' && (
          <>
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <span className="mt-0.5 text-amber-600 [&>svg]:h-5 [&>svg]:w-5"><Icons.Shield /></span>
              <p className="text-xs text-amber-800">{t('signing_phrase_warn')}</p>
            </div>
            <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {phrase.map((w, i) => (
                <li key={i} className="flex items-baseline gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                  <span className="w-5 shrink-0 text-right text-[10px] font-bold text-slate-400">{i + 1}</span>
                  <span className="font-mono text-sm text-slate-800">{w}</span>
                </li>
              ))}
            </ol>
            <button type="button" onClick={copyPhrase}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200">
              <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{copied ? <Icons.ShieldCheck /> : <Icons.Copy />}</span>{copied ? t('copied') : t('copy')}
            </button>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={confirmedSaved} onChange={e => setConfirmedSaved(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>{t('signing_phrase_confirm')}</span>
            </label>
            <button type="button" onClick={finishPhrase} disabled={!confirmedSaved}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              {t('signing_phrase_done')}
            </button>
          </>
        )}

        {view === 'rotate' && (
          <>
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <span className="mt-0.5 text-amber-600 [&>svg]:h-5 [&>svg]:w-5"><Icons.Shield /></span>
              <p className="text-xs text-amber-800">{t('signing_rotate_warn')}</p>
            </div>
            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={confirmedRotate} onChange={e => setConfirmedRotate(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>{t('signing_rotate_confirm')}</span>
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setView('status')} disabled={busy}
                className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                {t('back')}
              </button>
              <button type="button" onClick={rotate} disabled={busy || !confirmedRotate}
                className="flex-1 rounded-xl bg-amber-600 py-3 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50">
                {busy ? t('signing_key_creating') : t('signing_rotate')}
              </button>
            </div>
          </>
        )}

        {view === 'freeze' && (
          <>
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
              <span className="mt-0.5 text-red-600 [&>svg]:h-5 [&>svg]:w-5"><Icons.Shield /></span>
              <p className="text-xs text-red-700">{t('signing_freeze_warn')}</p>
            </div>
            <label className="block text-xs font-semibold text-slate-600">
              {t('signing_suspected_since')}
              <input type="datetime-local" value={suspectedSince} onChange={e => setSuspectedSince(e.target.value)}
                max={new Date().toISOString().slice(0, 16)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800" />
            </label>
            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={confirmedFreeze} onChange={e => setConfirmedFreeze(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>{t('signing_freeze_confirm')}</span>
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setView('status')} disabled={busy}
                className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                {t('back')}
              </button>
              <button type="button" onClick={freeze} disabled={busy || !confirmedFreeze}
                className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                {busy ? t('signing_key_creating') : t('signing_freeze')}
              </button>
            </div>
          </>
        )}

        {view === 'witness' && (
          <>
            <p className="text-sm text-slate-600">{t('signing_witness_intro')}</p>
            <textarea value={witnessCode} onChange={e => {
              setWitnessCode(e.target.value); setWitnessPreview(null); setConfirmedWitness(false); setErr(null);
            }}
              rows={3} autoFocus placeholder={t('signing_recovery_code')}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400" />
            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
            {witnessPreview && (
              <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
                <p><span className="font-bold">{t('signing_recovery_for')}:</span> {witnessPreview.targetName}</p>
                <p className="break-all font-mono text-[10px]">{witnessPreview.targetLid}</p>
                <p><span className="font-bold">{t('signing_suspected_since')}:</span> {new Date(witnessPreview.suspectedSinceMs).toLocaleString()}</p>
                <p className="break-all font-mono text-[10px]">{witnessPreview.fromFingerprint.slice(0, 16)}… → {witnessPreview.toFingerprint.slice(0, 16)}…</p>
                <label className="flex items-start gap-2 pt-1 text-xs">
                  <input type="checkbox" checked={confirmedWitness} onChange={e => setConfirmedWitness(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  <span>{t('signing_witness_confirm')}</span>
                </label>
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setView('status')} disabled={busy}
                className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                {t('back')}
              </button>
              <button type="button" onClick={witnessRecovery} disabled={busy || !witnessCode.trim() || (!!witnessPreview && !confirmedWitness)}
                className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                {busy ? t('signing_key_creating') : witnessPreview ? t('signing_witness') : t('signing_recovery_read')}
              </button>
            </div>
          </>
        )}

        {view === 'needs_restore' && (
          <>
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <span className="mt-0.5 text-amber-600 [&>svg]:h-5 [&>svg]:w-5"><Icons.Shield /></span>
              <p className="text-xs text-amber-800">{t('signing_needs_restore_warn')}</p>
            </div>
            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
            <button type="button" onClick={() => { resetRestoreFlow(); setView('restore'); }}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700">
              {t('signing_key_restore')}
            </button>
            <button type="button" onClick={() => { setErr(null); setConfirmedFreeze(false); setSuspectedSince(''); setView('freeze'); }}
              className="w-full rounded-xl border border-red-200 py-3 text-sm font-bold text-red-700 hover:bg-red-50">
              {t('signing_freeze')}
            </button>
          </>
        )}

        {view === 'restore' && (
          <>
            <p className="text-sm text-slate-600">{t('signing_restore_intro')}</p>
            <textarea value={restoreInput} onChange={e => { setRestoreInput(e.target.value); setErr(null); }} rows={4} autoFocus
              placeholder={t('signing_restore_placeholder')}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400" />
            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => { resetRestoreFlow(); setView('status'); }}
                className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200">
                {t('back')}
              </button>
              <button type="button" onClick={restore} disabled={busy || parsePhrase(restoreInput).length === 0}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                {busy ? t('signing_key_restoring') : t('signing_key_restore')}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
