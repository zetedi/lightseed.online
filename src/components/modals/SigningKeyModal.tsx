import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { ensureSigningKey, restoreFromPhrase, hasSigningKey, signingAvailable } from '../../services/keys';
import { parsePhrase } from '../../domain/signing';

// The signing-key setup + backup flow (Covenant, Phase 1). This wires NO signing action yet — it only
// lets a being create their device keypair (and see the recovery phrase ONCE) or restore it from the
// phrase on a new device. The private key never leaves the device; only the public key is published.

type View = 'status' | 'phrase' | 'restore';

export const SigningKeyModal: React.FC<{ uid: string; onClose: () => void; notify: (m: string) => void }> = ({ uid, onClose, notify }) => {
  const { t } = useLanguage();
  const [view, setView] = useState<View>('status');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [publicKeyB64, setPublicKeyB64] = useState<string | null>(null);
  const [phrase, setPhrase] = useState<string[]>([]);
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [restoreInput, setRestoreInput] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ok, present] = await Promise.all([signingAvailable(), hasSigningKey(uid).catch(() => false)]);
      if (!alive) return;
      setAvailable(ok);
      setHasKey(present);
    })();
    return () => { alive = false; };
  }, [uid]);

  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await ensureSigningKey(uid);
      setPublicKeyB64(res.publicKeyB64);
      if (res.created && res.recoveryPhrase) {
        setPhrase(res.recoveryPhrase);
        setConfirmedSaved(false);
        setView('phrase');
      } else {
        setHasKey(true);
        notify(t('signing_key_ready'));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create the signing key.');
    }
    setBusy(false);
  };

  const finishPhrase = () => {
    setPhrase([]); // let the seed-derived words go — never persisted, never shown again
    setHasKey(true);
    setView('status');
    notify(t('signing_key_created'));
  };

  const restore = async () => {
    const words = parsePhrase(restoreInput);
    setBusy(true); setErr(null);
    try {
      const res = await restoreFromPhrase(words, uid);
      setPublicKeyB64(res.publicKeyB64);
      setHasKey(true);
      setView('status');
      notify(t('signing_key_restored'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not restore from that phrase.');
    }
    setBusy(false);
  };

  const copyPhrase = async () => {
    try { await navigator.clipboard.writeText(phrase.join(' ')); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  const title = view === 'phrase' ? t('signing_phrase_title') : view === 'restore' ? t('signing_restore_title') : t('signing_key');

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        {available === false && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{t('signing_unavailable')}</p>
        )}

        {view === 'status' && (
          <>
            <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <span className="mt-0.5 text-emerald-600 [&>svg]:h-5 [&>svg]:w-5"><Icons.Key /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">{hasKey ? t('signing_key_ready') : t('signing_key_none')}</p>
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
              <button type="button" onClick={() => { setErr(null); setView('restore'); }} disabled={available === false}
                className="w-full rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {t('signing_key_restore')}
              </button>
            </div>
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

        {view === 'restore' && (
          <>
            <p className="text-sm text-slate-600">{t('signing_restore_intro')}</p>
            <textarea value={restoreInput} onChange={e => setRestoreInput(e.target.value)} rows={4} autoFocus
              placeholder={t('signing_restore_placeholder')}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400" />
            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => { setErr(null); setView('status'); }}
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
