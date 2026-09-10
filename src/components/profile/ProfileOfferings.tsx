import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Pulse } from '../../types';
import { getMyPulses } from '../../services/firebase';
import { offeringStatusOf } from '../../domain/offering';
import { normalizePulseType } from '../../domain/pulse';
import { SectionTitle } from '../ui/SectionTitle';
import { Loading } from '../ui/Loading';
import { Picture } from '../ui/Picture';

interface ProfileOfferingsProps {
  uid: string;
  onViewOffering?: (pulse: Pulse) => void;
}

// My Offerings tab: everything this being has offered — a bed, a service, a piece of code, or a
// care laid at another being's leaf — with the standing of each (domain/offering). The twin
// blocks a taken-up offering mints on both chains are NOT offerings themselves ('standard'), so
// this stays a list of what was offered, never of what it became.
export const ProfileOfferings: React.FC<ProfileOfferingsProps> = ({ uid, onViewOffering }) => {
  const { t } = useLanguage();
  const [offerings, setOfferings] = useState<Pulse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getMyPulses(uid)
      .then((data: Pulse[]) => {
        if (!alive) return;
        setOfferings(data.filter(p => normalizePulseType(p.type) === 'offering'));
      })
      .catch(() => { if (alive) setOfferings([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [uid]);

  // What still stands comes first; the answered and the withdrawn settle below it.
  const rank = (p: Pulse) => (offeringStatusOf(p) === 'open' ? 0 : 1);
  const statusKey = (p: Pulse) => `offering_status_${offeringStatusOf(p) || 'open'}` as const;
  const tone = (p: Pulse) => ({
    open: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    accepted: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    withdrawn: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    declined: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  })[offeringStatusOf(p) || 'open'];

  return (
    <div>
      <SectionTitle title={t('my_offerings')} sub={t('my_offerings_sub')} />
      {loading ? (
        <div className="flex justify-center rounded-2xl border border-slate-100 bg-slate-50/50 py-16 dark:border-slate-800 dark:bg-slate-900/50"><Loading /></div>
      ) : offerings.length === 0 ? (
        <p className="py-10 text-center text-slate-400">{t('no_offerings_yet')}</p>
      ) : (
        <ul className="space-y-2">
          {[...offerings].sort((a, b) => rank(a) - rank(b)).map(p => (
            <li key={p.id}>
              <button type="button" onClick={() => onViewOffering?.(p)}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-100 px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
                  {p.imageUrl ? <Picture size={480} src={p.imageUrl} className="h-full w-full object-cover" /> : <Icons.Handshake />}
                </span>
                <span className="min-w-0 flex-1">
                  <span dir="auto" className="block truncate text-sm font-bold text-slate-700 dark:text-slate-200">{p.title}</span>
                  {p.offeredToName && (
                    <span dir="auto" className="block truncate text-[11px] text-slate-400">{t('offered_to').replace('{name}', p.offeredToName)}</span>
                  )}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tone(p)}`}>{t(statusKey(p))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
