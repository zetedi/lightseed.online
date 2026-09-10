import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Pulse } from '../../types';
import { getMyPulses } from '../../services/firebase';
import { pulseKinds, matchesKind, pulseKindLabelKey } from '../../domain/pulseKinds';
import type { PulseType } from '../../domain/pulse';
import { SectionTitle } from '../ui/SectionTitle';
import { Loading } from '../ui/Loading';

import { Picture } from '../ui/Picture';
interface ProfilePulsesProps {
  uid: string;
  // Opens the pulse's profile view (the same one the pulses page uses).
  onViewPulse?: (pulse: Pulse) => void;
  // The manual "emit a pulse" entry, moved here when the top-level Pulses menu retired.
  onEmit?: () => void;
}

// My Pulses tab: everything the user has emitted, minus mycelial reach/chat messages. Also the
// home of the manual "emit a pulse" button (the top-level Pulses menu retired 2026-07-24).
export const ProfilePulses: React.FC<ProfilePulsesProps> = ({ uid, onViewPulse, onEmit }) => {
  const { t } = useLanguage();
  const [pulses, setPulses] = useState<Pulse[]>([]);
  // The sieve (domain/pulseKinds): only the kinds actually here are offered, so the row never
  // promises a kind this being has never emitted. null = all.
  const [kind, setKind] = useState<PulseType | null>(null);
  // Starts true: the component mounts fresh on every tab activation and fetches immediately.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getMyPulses(uid)
      .then((data) => {
        if (!alive) return;
        // My Pulses excludes mycelial reach/chat messages — those live under Reaches.
        // (getMyPulses already drops them; this is defence in depth, hence the widening.)
        setPulses(data.filter((p: Pulse) => { const type: string = p.type ?? ''; return type !== 'reach' && type !== 'tree_chat'; }));
      })
      .catch((e) => console.error('Fetch profile data error', e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [uid]);

  const kinds = pulseKinds(pulses.map(p => p.type));
  const shown = pulses.filter(p => matchesKind(p.type, kind));

  const emitButton = onEmit && (
    <button onClick={onEmit}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-orange-700 active:scale-95">
      <span className="[&>svg]:h-4 [&>svg]:w-4"><Icons.Pulse /></span> {t('emit_pulse')}
    </button>
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <SectionTitle title={t('my_pulses')} sub={t('my_pulses_sub')} />
        {emitButton}
      </div>
      {/* The kinds this being has actually emitted — one row, the chosen one lit. */}
      {!loading && kinds.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {[null, ...kinds].map(k => {
            const on = kind === k;
            return (
              <button key={k ?? 'all'} type="button" onClick={() => setKind(k)} aria-pressed={on}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all ${on
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'}`}>
                {k === null ? t('all_kinds') : t(pulseKindLabelKey(k))}
              </button>
            );
          })}
        </div>
      )}
      {loading ? <div className="flex justify-center rounded-2xl border border-slate-100 bg-slate-50/50 py-16 dark:bg-slate-900/50 dark:border-slate-800"><Loading /></div> : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {shown.length === 0 ? (
            <div className="col-span-full py-10 text-center text-slate-400">
              <p>{t('no_pulses_yet')}</p>
            </div>
          ) : shown.map((pulse) => (
            <div
              key={pulse.id}
              role={onViewPulse ? 'button' : undefined}
              onClick={() => onViewPulse?.(pulse)}
              className={`border border-slate-100 rounded-lg overflow-hidden group ${onViewPulse ? 'cursor-pointer transition-shadow hover:shadow-md hover:border-emerald-200' : ''}`}
            >
              <div className="h-24 bg-slate-100 relative dark:bg-slate-800">
                {pulse.imageUrl ? (
                  <Picture size={480} src={pulse.imageUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300"><Icons.Hash /></div>
                )}
              </div>
              <div className="p-3">
                <h4 className="font-bold text-sm text-slate-800 line-clamp-1 dark:text-slate-100">{pulse.title}</h4>
                <div className="mt-1 flex items-center space-x-3 text-[10px] text-slate-400">
                  <span>{pulse.loveCount} Loves</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
