import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { SectionTitle } from '../ui/SectionTitle';
import { Loading } from '../ui/Loading';
import { getMyStays, getLifetreeById } from '../../services/firebase';
import { type Stay } from '../../domain/stay';
import type { Lifetree } from '../../types';

interface ProfileStaysProps {
  uid: string;
  // Opens the reserved bed's profile (a bed is a Lifetree).
  onViewTree?: (tree: Lifetree) => void;
}

const statusTone: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-slate-100 text-slate-400',
};

// My Stays — the guest side of the reservation: the beds this being has asked to sleep in. The
// keeper answers on the bed's own calendar; here the guest watches their requests ripen. Each row
// resolves its bed on tap (a bed is a Lifetree) so tapping opens the bed's page.
export const ProfileStays: React.FC<ProfileStaysProps> = ({ uid, onViewTree }) => {
  const { t } = useLanguage();
  const [stays, setStays] = useState<Stay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getMyStays(uid)
      .then(data => { if (alive) setStays(data.slice().sort((a, b) => b.fromDate.localeCompare(a.fromDate))); })
      .catch(e => console.error('Fetch stays error', e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [uid]);

  const open = async (s: Stay) => {
    if (!onViewTree || !s.bedId) return;
    try {
      const bed = await getLifetreeById(s.bedId);
      if (bed) onViewTree(bed);
    } catch { /* the bed is gone or drawn private — nothing to open */ }
  };

  return (
    <div>
      <SectionTitle title={t('my_stays')} sub={t('my_stays_sub')} />
      {loading ? (
        <div className="flex justify-center rounded-2xl border border-slate-100 bg-slate-50/50 py-16"><Loading /></div>
      ) : stays.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          No stays yet — find a bed in the Living menu.
        </p>
      ) : (
        <div className="space-y-2">
          {stays.map(s => (
            <button key={s.id} type="button" onClick={() => open(s)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 text-left shadow-sm transition-colors hover:border-slate-200 hover:bg-slate-50">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 text-white [&>svg]:h-5 [&>svg]:w-5"><Icons.Moon /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold text-slate-800">{s.bedName || 'A bed'}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusTone[s.status] || statusTone.declined}`}>{s.status}</span>
                </div>
                <div className="text-xs text-slate-400">{s.fromDate} → {s.toDate} · {s.nights} {t('nights').toLowerCase()}</div>
              </div>
              {onViewTree && <span className="flex-none text-slate-300 [&>svg]:h-4 [&>svg]:w-4"><Icons.ChevronRight /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
