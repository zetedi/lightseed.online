import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { Loading } from './ui/Loading';
import { SectionTitle } from './ui/SectionTitle';
import { SigningKeyModal } from './modals/SigningKeyModal';
import { getPersonName } from '../services/firebase';
import { hasSigningKey, readyToSign, SigningKeyNeedsRestoreError } from '../services/keys';
import {
  getCovenantBundle, signCovenant, verifyCovenant, breakCovenant,
  type CovenantSignature,
} from '../services/firebase/covenants';
import type { Covenant, CovenantParty } from '../domain/covenant';

// THE COVENANT PANEL — the covenant's one living face, wherever it appears: standalone under its
// own hero (CovenantProfile) or as a section of the alignment it twins (AlignmentView). It shows
// the pledge, the parties and each one's signed/awaiting state, a Sign button that runs
// signCovenant (prompting key setup via SigningKeyModal when the being has no device key yet),
// and the chain head. The verification line re-runs verifyCovenant on the raw data, so a reader
// sees the seal PROVEN, not merely asserted — un-forgeability made visible.

interface CovenantPanelProps {
  covenantId: string;
  currentUserId?: string;
  notify?: (m: string) => void;
  /** Lets an owning shell mirror the loaded covenant into its own chrome (hero title, status chip). */
  onLoaded?: (covenant: Covenant) => void;
}

const short = (h?: string) => (h ? `${h.slice(0, 8)}…${h.slice(-6)}` : '—');

export const CovenantPanel = ({ covenantId, currentUserId, notify, onLoaded }: CovenantPanelProps) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [covenant, setCovenant] = useState<Covenant | null>(null);
  const [parties, setParties] = useState<CovenantParty[]>([]);
  const [sigs, setSigs] = useState<CovenantSignature[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [check, setCheck] = useState<{ valid: boolean; verifiedCount: number; sealed: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [phrase, setPhrase] = useState<string[] | null>(null);

  // onLoaded rides a ref so a parent passing a fresh closure each render never re-triggers load.
  // Synced in its own effect (declared before the load effect) rather than during render.
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => { onLoadedRef.current = onLoaded; });

  const load = useCallback(async () => {
    const { covenant: c, parties: p, signatures: s } = await getCovenantBundle(covenantId);
    setCovenant(c);
    setParties(p);
    setSigs(s);
    if (c) { setCheck(await verifyCovenant(c, p, s)); onLoadedRef.current?.(c); }
    // Resolve party names (best-effort; falls back to a short uid).
    const entries = await Promise.all(p.map(async party => {
      const nm = (await getPersonName(party.uid).catch(() => '')) || '';
      return [party.uid, nm] as [string, string];
    }));
    setNames(Object.fromEntries(entries.filter(([, n]) => n !== '')));
    setLoading(false);
  }, [covenantId]);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- flips the loading flag before the async bundle fetch; re-runs only when covenantId changes (load is keyed on it)
    setLoading(true);
    (async () => { await load(); if (!alive) return; })();
    return () => { alive = false; };
  }, [load]);

  const signedUids = new Set(sigs.map(s => s.uid));
  const isParty = !!currentUserId && parties.some(p => p.uid === currentUserId);
  const hasSigned = !!currentUserId && signedUids.has(currentUserId);
  const nameFor = (uid: string) => names[uid] || `${uid.slice(0, 6)}…`;

  const doSign = useCallback(async () => {
    if (!currentUserId || busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await signCovenant({ id: covenantId });
      if (res.recoveryPhrase) setPhrase(res.recoveryPhrase); // a key was born mid-sign — surface it once
      await load();
      notify?.(res.sealed ? t('covenant_sealed_toast') : t('covenant_signed_toast'));
    } catch (e) {
      // A key conflict (stale device / published-but-absent) is the modal's business, not an error
      // line: it shows the custody state and the doors out (restore, or a red-warned choice).
      if (e instanceof SigningKeyNeedsRestoreError) setShowKey(true);
      else setErr(e instanceof Error ? e.message : 'Could not sign this covenant.');
    }
    setBusy(false);
  }, [currentUserId, busy, covenantId, load, notify, t]);

  const onSignClick = async () => {
    if (!currentUserId) return;
    // No device key yet → set one up (and back it up) first, then continue signing on modal close.
    if (!(await hasSigningKey(currentUserId))) { setShowKey(true); return; }
    await doSign();
  };

  const onBreak = async () => {
    if (!currentUserId || busy) return;
    setBusy(true); setErr(null);
    try {
      await breakCovenant(covenantId);
      await load();
      notify?.(t('covenant_broken_toast'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not break this covenant.');
    }
    setBusy(false);
  };

  if (loading || !covenant) {
    return <div className="flex justify-center py-16"><Loading /></div>;
  }

  return (
    <div className="space-y-6">
      {/* The pledge */}
      {covenant.body && (
        <div>
          <SectionTitle title={t('covenant_the_pledge')} sub={t('covenant_the_pledge_sub')} />
          <q className="block whitespace-pre-wrap font-serif text-base italic leading-relaxed text-slate-700">{covenant.body}</q>
        </div>
      )}

      {/* Verification — the seal PROVEN, not asserted */}
      <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3.5 text-sm leading-snug ${
        check?.sealed ? 'bg-emerald-50 text-emerald-800' : check && !check.valid ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600'
      }`}>
        <span className="mt-0.5 shrink-0 [&>svg]:h-4 [&>svg]:w-4">{check?.sealed ? <Icons.ShieldCheck /> : <Icons.Shield />}</span>
        <span>
          {check?.sealed
            ? t('covenant_verified_sealed').replace('{n}', String(check.verifiedCount)).replace('{q}', String(covenant.quorum))
            : check && !check.valid
              ? t('covenant_verified_forged')
              : t('covenant_verified_awaiting').replace('{n}', String(check?.verifiedCount ?? 0)).replace('{q}', String(covenant.quorum))}
        </span>
      </div>

      {/* The parties + each one's signed/awaiting state */}
      <div>
        <SectionTitle title={t('covenant_parties')} sub={t('covenant_parties_sub').replace('{q}', String(covenant.quorum))} />
        <ul className="space-y-2">
          {parties.map(p => {
            const signed = signedUids.has(p.uid);
            return (
              <li key={p.uid} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
                <div className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">{nameFor(p.uid)}</span>
                  {p.role && <span className="text-[11px] uppercase tracking-wide text-slate-400">{p.role}</span>}
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  signed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-50 text-amber-600'
                }`}>
                  <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{signed ? <Icons.ShieldCheck /> : <Icons.Shield />}</span>
                  {signed ? t('covenant_signed') : t('covenant_awaiting')}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}

      {/* Actions — a party signs their own hand; may break (never delete) once bound */}
      {isParty && covenant.status !== 'broken' && (
        <div className="flex flex-col gap-2">
          {!hasSigned && (
            <button type="button" onClick={onSignClick} disabled={busy}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              {busy ? t('covenant_signing') : t('covenant_sign')}
            </button>
          )}
          {hasSigned && covenant.status !== 'sealed' && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-center text-xs font-medium text-emerald-700">{t('covenant_you_signed')}</p>
          )}
          {(covenant.status === 'sealed' || hasSigned) && (
            <button type="button" onClick={onBreak} disabled={busy}
              className="w-full rounded-xl border border-rose-200 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
              {t('covenant_break')}
            </button>
          )}
        </div>
      )}

      {/* The chain — genesis, height, seal */}
      <div className="rounded-xl border border-slate-100 bg-slate-900 px-4 py-3 font-mono text-[11px] text-emerald-300/90">
        <div className="flex justify-between gap-3"><span className="text-slate-500">{t('genesis')}</span><span className="break-all">{short(covenant.genesisHash)}</span></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">head</span><span className="break-all">{short(covenant.latestHash)}</span></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">block</span><span>#{covenant.blockHeight}</span></div>
      </div>

      {/* The freshly-born recovery phrase (only if a key was created mid-sign) */}
      {phrase && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-xs font-semibold text-amber-800">{t('signing_phrase_warn')}</p>
          <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {phrase.map((w, i) => (
              <li key={i} className="flex items-baseline gap-2 rounded-lg border border-amber-100 bg-white px-2.5 py-1.5">
                <span className="w-5 shrink-0 text-right text-[10px] font-bold text-slate-400">{i + 1}</span>
                <span className="font-mono text-sm text-slate-800">{w}</span>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => setPhrase(null)} className="mt-2 text-xs font-bold text-amber-700 underline">{t('signing_phrase_done')}</button>
        </div>
      )}

      {showKey && currentUserId && (
        <SigningKeyModal
          uid={currentUserId}
          notify={m => notify?.(m)}
          onClose={async () => {
            setShowKey(false);
            // Resume ONLY when this device can actually sign now (custody resolved) — a stale
            // device also HAS a key, and resuming on mere key presence would re-throw the custody
            // conflict and reopen the modal in a loop the being cannot leave.
            if (await readyToSign(currentUserId)) await doSign();
          }}
        />
      )}
    </div>
  );
};
