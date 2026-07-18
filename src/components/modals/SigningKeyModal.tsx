import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import {
  ensureSigningKey, restoreFromPhrase, getDeviceKeyInfo, getPublishedSigningKey, publishSigningKey,
  signingAvailable, SigningKeyNeedsRestoreError, RestoreKeyMismatchError,
} from '../../services/keys';
import { parsePhrase, keyCustody, type KeyCustody } from '../../domain/signing';

// The signing-key setup + backup flow (Covenant, Phase 1). This wires NO signing action yet — it only
// lets a being create their device keypair (and see the recovery phrase ONCE) or restore it from the
// phrase on a new device. The private key never leaves the device; only the public key is published.
// The modal reads the pure CUSTODY state (domain/signing.keyCustody) on open, so every conflict
// between this device and the published identity is surfaced, never silently resolved:
//   needs_restore — a key is published but absent here: restore from the phrase, or the red-warned
//     "start fresh" door (a NEW key; prior signatures stay verifiable through the key lineage).
//   stale_device  — this device holds an OLDER key than the published one: restore the current
//     phrase here, or the red-warned takeover door (republish this device's key).
//   restore mismatch — a valid phrase deriving a DIFFERENT key than the published one is refused,
//     unless the being explicitly, red-warned, chooses to replace the published key with it.

type View = 'status' | 'phrase' | 'restore' | 'needs_restore';

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

  const [confirmedFresh, setConfirmedFresh] = useState(false);
  const [confirmedTakeover, setConfirmedTakeover] = useState(false);
  // Restore met a published key this phrase does not derive; replacing needs an explicit yes.
  const [restoreMismatch, setRestoreMismatch] = useState(false);
  const [confirmedReplace, setConfirmedReplace] = useState(false);

  // Positive list: these custody states mean a key IS on this device. Any future state defaults to
  // "no key here" — the safe reading (show the create/restore doors, never a false "ready").
  const hasKey = custody === 'ready' || custody === 'publish_needed' || custody === 'stale_device';

  // Every exit from the restore flow forgets the red replace state, so a stale confirmation can
  // never arm the replace button on a later visit.
  const resetRestoreFlow = () => { setErr(null); setRestoreMismatch(false); setConfirmedReplace(false); };

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ok, device, published] = await Promise.all([
        signingAvailable(),
        getDeviceKeyInfo(uid).catch(() => null),
        getPublishedSigningKey(uid).catch(() => ''),
      ]);
      if (!alive) return;
      setAvailable(ok);
      const state = keyCustody(device?.publicKeyB64 ?? null, published);
      setCustody(state);
      if (device) setPublicKeyB64(device.publicKeyB64);
      // A published identity with no key here: open STRAIGHT on the restore guidance — never on a
      // status view whose Create button can only throw.
      if (state === 'needs_restore') { setConfirmedFresh(false); setView('needs_restore'); }
    })();
    return () => { alive = false; };
  }, [uid]);

  // Shared success handling for create / start-fresh / takeover: surface the phrase once, or settle
  // to ready (device and published identity agree again).
  const settleEnsured = (res: { created: boolean; publicKeyB64: string; recoveryPhrase?: string[] }) => {
    setPublicKeyB64(res.publicKeyB64);
    if (res.created && res.recoveryPhrase) {
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
        // A key is published but not on this device: never silently mint a new one — offer restore,
        // with "start fresh" only as an explicit, warned choice.
        setConfirmedFresh(false);
        setView('needs_restore');
      } else {
        setErr(e instanceof Error ? e.message : 'Could not create the signing key.');
      }
    }
    setBusy(false);
  };

  // The deliberate replacePublished doors share one handler. What it DOES depends on custody
  // (ensureSigningKey): with no device key it mints a NEW key (start fresh); on a stale device it
  // republishes THIS device's older key (takeover). Both are red-warned, explicit choices; prior
  // signatures stay verifiable through the append-only key lineage either way.
  const replacePublishedKey = async (failMessage: string) => {
    setBusy(true); setErr(null);
    try {
      settleEnsured(await ensureSigningKey(uid, { replacePublished: true }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : failMessage);
    }
    setBusy(false);
  };
  const startFresh = () => replacePublishedKey('Could not create the signing key.');
  const takeOver = () => replacePublishedKey('Could not republish this device\'s key.');

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
    setCustody('ready');
    setView('status');
    notify(t('signing_key_created'));
  };

  const restore = async () => {
    const words = parsePhrase(restoreInput);
    setBusy(true); setErr(null);
    try {
      const res = await restoreFromPhrase(words, uid, restoreMismatch && confirmedReplace ? { replacePublished: true } : undefined);
      setPublicKeyB64(res.publicKeyB64);
      setCustody('ready');
      resetRestoreFlow();
      setView('status');
      notify(t('signing_key_restored'));
    } catch (e) {
      if (e instanceof RestoreKeyMismatchError) {
        // A valid phrase, a DIFFERENT key than the published identity: refuse silently replacing it.
        // The red-warned checkbox below turns the same button into a deliberate replacement.
        setRestoreMismatch(true);
        setConfirmedReplace(false);
      } else {
        setErr(e instanceof Error ? e.message : 'Could not restore from that phrase.');
      }
    }
    setBusy(false);
  };

  const copyPhrase = async () => {
    try { await navigator.clipboard.writeText(phrase.join(' ')); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  const title = view === 'phrase' ? t('signing_phrase_title')
    : view === 'restore' ? t('signing_restore_title')
    : view === 'needs_restore' ? t('signing_needs_restore_title')
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
                  {custody === 'stale_device' ? t('signing_stale_title')
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
              {!hasKey && (
                <button type="button" onClick={create} disabled={busy || available === false}
                  className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {busy ? t('signing_key_creating') : t('signing_key_create')}
                </button>
              )}
              {custody === 'publish_needed' && (
                <button type="button" onClick={publishNow} disabled={busy || available === false}
                  className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {busy ? t('signing_key_creating') : t('signing_publish_now')}
                </button>
              )}
              <button type="button" onClick={() => { resetRestoreFlow(); setView('restore'); }} disabled={available === false}
                className="w-full rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {t('signing_key_restore')}
              </button>
            </div>

            {custody === 'stale_device' && (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">{t('signing_stale_warn')}</p>
                <label className="flex items-start gap-2 text-xs text-amber-900">
                  <input type="checkbox" checked={confirmedTakeover} onChange={e => setConfirmedTakeover(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  <span>{t('signing_stale_confirm')}</span>
                </label>
                <button type="button" onClick={takeOver} disabled={busy || !confirmedTakeover}
                  className="w-full rounded-xl border border-amber-300 bg-white py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50">
                  {busy ? t('signing_key_creating') : t('signing_stale_takeover')}
                </button>
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
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-700">{t('signing_start_fresh_warn')}</p>
              <label className="flex items-start gap-2 text-xs text-red-800">
                <input type="checkbox" checked={confirmedFresh} onChange={e => setConfirmedFresh(e.target.checked)} className="mt-0.5 h-4 w-4" />
                <span>{t('signing_start_fresh_confirm')}</span>
              </label>
              <button type="button" onClick={startFresh} disabled={busy || !confirmedFresh}
                className="w-full rounded-xl border border-red-300 bg-white py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">
                {busy ? t('signing_key_creating') : t('signing_start_fresh')}
              </button>
            </div>
          </>
        )}

        {view === 'restore' && (
          <>
            <p className="text-sm text-slate-600">{t('signing_restore_intro')}</p>
            <textarea value={restoreInput} onChange={e => { setRestoreInput(e.target.value); setRestoreMismatch(false); setConfirmedReplace(false); }} rows={4} autoFocus
              placeholder={t('signing_restore_placeholder')}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400" />
            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
            {restoreMismatch && (
              <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-700">{t('signing_restore_mismatch_warn')}</p>
                <label className="flex items-start gap-2 text-xs text-red-800">
                  <input type="checkbox" checked={confirmedReplace} onChange={e => setConfirmedReplace(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  <span>{t('signing_restore_replace_confirm')}</span>
                </label>
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => { resetRestoreFlow(); setView('status'); }}
                className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200">
                {t('back')}
              </button>
              <button type="button" onClick={restore} disabled={busy || parsePhrase(restoreInput).length === 0 || (restoreMismatch && !confirmedReplace)}
                className={`flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50 ${restoreMismatch ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                {busy ? t('signing_key_restoring') : restoreMismatch ? t('signing_restore_replace') : t('signing_key_restore')}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
