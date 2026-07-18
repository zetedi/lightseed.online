import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '../../contexts/SessionContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { notify } from '../ui/Toast';
import { announce } from '../../services/refreshBus';
import { useRefreshSignal } from '../../hooks/useRefreshSignal';
import { addMonths, monthGrid, parseYmd, todayStr } from '../../domain/calendar';
import { stayRequestProblem, type Stay } from '../../domain/stay';
import { holdBlocks, type Hold } from '../../domain/hold';
import {
  requestStay, getBedStaysForHost, getMyBedStays, readBedOccupancy, setStayStatus, withdrawStay,
  placeHold, releaseHold, getBedHolds, getLifetreeById,
} from '../../services/firebase';
import type { Lifetree } from '../../types';

// The bed's calendar — a month of nights, busy or free, and the door to reserve one. Availability
// is read from the bed's public occupancy (identity-free), so a prospective guest sees busy/free
// without reading anyone's stay. The host additionally sees the real reservations, each wearing the
// guest's chosen tree. A soft view-hold (domain/hold.ts) whispers when another is choosing.

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const growth = (s: { guestTreeGrowthUrl?: string }) => s.guestTreeGrowthUrl || '/seed.webp';

export const BedCalendar: React.FC<{ bed: Lifetree; onViewTree?: (t: Lifetree) => void }> = ({ bed, onViewTree }) => {
  const { t } = useLanguage();
  const { lightseed, activeTree } = useSession();
  const uid = lightseed?.uid;
  const isHost = !!uid && bed.ownerId === uid;
  const bump = useRefreshSignal(['beds']);
  // Captured once — a calendar needs a day, not a ticking clock (and render stays pure).
  const [nowMs] = useState(() => Date.now());

  const start = parseYmd(todayStr(nowMs))!;
  const [ym, setYm] = useState({ year: start.year, month: start.month });
  const [occupancy, setOccupancy] = useState<{ fromDate: string; toDate: string }[]>([]);
  const [stays, setStays] = useState<Stay[]>([]);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [pick, setPick] = useState<{ from?: string; to?: string }>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    readBedOccupancy(bed.id).then(o => { if (alive) setOccupancy(o); }).catch(() => {});
    getBedHolds(bed.id).then(h => { if (alive) setHolds(h); }).catch(() => {});
    (isHost ? getBedStaysForHost(bed.id, uid!) : uid ? getMyBedStays(bed.id, uid) : Promise.resolve<Stay[]>([]))
      .then(s => { if (alive) setStays(s.slice().sort((a, b) => a.fromDate.localeCompare(b.fromDate))); })
      .catch(() => {});
    return () => { alive = false; };
  }, [bed.id, uid, isHost, bump]);

  // A guest choosing nights places a soft hold; it lapses on its own, and we release on leaving.
  useEffect(() => {
    if (!uid || isHost) return;
    placeHold(bed.id, uid).catch(() => {});
    return () => { releaseHold(bed.id, uid).catch(() => {}); };
  }, [bed.id, uid, isHost]);

  const weeks = useMemo(() => monthGrid(ym.year, ym.month), [ym]);
  const today = todayStr(nowMs);
  const othersChoosing = !!holds.find(h => holdBlocks(h, uid || '', nowMs));

  // A night is taken if any public occupancy range covers it ([from, to) — departure is free).
  const nightTaken = useCallback(
    (dateStr: string) => occupancy.some(o => dateStr >= o.fromDate && dateStr < o.toDate),
    [occupancy],
  );
  const rangeFree = (from: string, to: string) => !occupancy.some(o => o.fromDate < to && from < o.toDate);

  // `asDeparture` marks a click on an occupied cell being used as the check-out morning (a taken
  // cell later than the chosen arrival — legitimately free; rangeFree validates the span).
  const onPick = (dateStr: string, asDeparture: boolean) => {
    setPick(p => {
      if (asDeparture && p.from) return { from: p.from, to: dateStr };
      if (!p.from || (p.from && p.to)) return { from: dateStr };
      if (dateStr <= p.from) return { from: dateStr };
      return { from: p.from, to: dateStr };
    });
  };

  const problem = !pick.from
    ? t('arrival') + ' → ' + t('departure')
    : !pick.to
    ? 'Pick your departure day'
    : (stayRequestProblem(pick.from, pick.to, nowMs) || (rangeFree(pick.from, pick.to) ? null : t('booked')));

  const request = async () => {
    if (!uid || !pick.from || !pick.to || problem) return;
    setBusy(true);
    try {
      await requestStay(
        bed,
        {
          uid,
          name: lightseed?.displayName || '',
          tree: activeTree ? { id: activeTree.id, name: activeTree.name, growthUrl: activeTree.latestGrowthUrl || activeTree.imageUrl || '' } : undefined,
        },
        { fromDate: pick.from, toDate: pick.to, note },
      );
      notify('🛏️ Your request is in; the keeper will answer.');
      announce('beds', bed.id);
      setPick({});
      setNote('');
      releaseHold(bed.id, uid).catch(() => {});
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not request the nights.', 'error');
    }
    setBusy(false);
  };

  const answer = async (stay: Stay, status: 'accepted' | 'declined') => {
    setBusy(true);
    try {
      await setStayStatus(stay.id, status);
      notify(status === 'accepted' ? '🛏️ Welcomed.' : 'Declined.');
      announce('beds', bed.id);
    } catch {
      notify('Could not answer the request.', 'error');
    }
    setBusy(false);
  };

  const withdraw = async (stay: Stay) => {
    setBusy(true);
    try {
      await withdrawStay(stay.id);
      notify('Withdrawn.');
      announce('beds', bed.id);
    } catch {
      notify('Could not withdraw.', 'error');
    }
    setBusy(false);
  };

  // The host may open the guest's chosen tree — the face the guest denormalised onto the stay
  // expressly for this. A private/absent tree simply doesn't open (graceful, no error).
  const openGuestTree = async (s: Stay) => {
    if (!onViewTree || !s.guestTreeId) return;
    try {
      const tree = await getLifetreeById(s.guestTreeId);
      if (tree) onViewTree(tree);
    } catch { /* the guest's tree is private or gone — nothing to open */ }
  };

  const statusPill = (s: Stay['status']) => {
    const map: Record<string, string> = {
      requested: 'bg-amber-100 text-amber-700',
      accepted: 'bg-emerald-100 text-emerald-700',
      declined: 'bg-slate-100 text-slate-400',
    };
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[s]}`}>{s}</span>;
  };

  return (
    <div className="space-y-5">
      {/* The month grid */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={() => setYm(addMonths(ym.year, ym.month, -1))}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Previous month">
            <span className="inline-block rotate-180 [&>svg]:h-4 [&>svg]:w-4"><Icons.ChevronRight /></span>
          </button>
          <h3 className="text-sm font-semibold tracking-wide text-slate-700">{MONTHS[ym.month - 1]} {ym.year}</h3>
          <button type="button" onClick={() => setYm(addMonths(ym.year, ym.month, 1))}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Next month">
            <span className="inline-block [&>svg]:h-4 [&>svg]:w-4"><Icons.ChevronRight /></span>
          </button>
        </div>
        {uid && !isHost && (
          <p className="mb-2 text-center text-[11px] text-slate-400">Tap your first night, then the morning you leave.</p>
        )}
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-300">
          {WEEKDAYS.map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weeks.flat().map((cell, i) => {
            const past = cell.dateStr < today;
            const taken = nightTaken(cell.dateStr);
            const disabled = past || taken || !cell.inMonth;
            // [from, to) — the departure day is a non-night, so N nights highlight N cells.
            const inRange = pick.from && (pick.to
              ? cell.dateStr >= pick.from && cell.dateStr < pick.to
              : cell.dateStr === pick.from);
            // Checking out on someone's check-in day is free: an occupied cell later than the chosen
            // arrival may still be picked as the DEPARTURE morning (taken, yet a valid endpoint).
            const asDeparture = taken && !!pick.from && !past && cell.inMonth && cell.dateStr > pick.from;
            const isDeparture = !!pick.to && cell.dateStr === pick.to && cell.inMonth;
            const clickable = !disabled || asDeparture;
            const base = 'aspect-square rounded-lg text-xs flex items-center justify-center transition-colors';
            // A booked night always reads as booked, even inside a picked span (taken wins).
            const tone = !cell.inMonth ? 'text-slate-200'
              : taken ? 'bg-rose-50 text-rose-300 line-through'
              : inRange ? 'bg-emerald-600 text-white font-semibold'
              : past ? 'text-slate-300'
              : 'text-slate-600 hover:bg-emerald-50';
            // The chosen check-out morning gets a distinct ring so the second tap plainly registers.
            const ring = isDeparture ? 'ring-2 ring-emerald-500 ring-offset-1' : '';
            return (
              <button key={i} type="button" disabled={!clickable || (!uid) || isHost}
                onClick={() => onPick(cell.dateStr, asDeparture)}
                className={`${base} ${tone} ${ring} ${!clickable ? 'cursor-default' : ''}`}>
                {cell.day}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-slate-400">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-rose-100" />{t('booked')}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-100" />{t('available')}</span>
        </div>
      </div>

      {/* Reserve — for a signed-in guest (not the host) */}
      {uid && !isHost && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5">
          {othersChoosing && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{t('bed_being_viewed')}</p>
          )}
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">{t('arrival')} → {t('departure')}</span>
            <span className="font-semibold text-slate-700">{pick.from || '—'} → {pick.to || '—'}</span>
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="A word to the keeper (optional)…"
            className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400" />
          <button type="button" onClick={request} disabled={!!problem || busy}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
            {problem || t('request_stay')}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400">{t('view_hold_note')}</p>
        </div>
      )}

      {/* The reservations — host sees every guest's tree; a guest sees their own requests */}
      {uid && stays.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">{isHost ? t('who_stayed') : t('reserve')}</h3>
          <div className="space-y-2">
            {stays.map(s => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
                {isHost && s.guestTreeId
                  ? <button type="button" onClick={() => openGuestTree(s)} aria-label={s.guestTreeName || 'guest tree'}
                      className="h-9 w-9 flex-none rounded-full ring-emerald-200 transition-shadow hover:ring-2">
                      <img src={growth(s)} alt="" className="h-9 w-9 rounded-full object-cover" />
                    </button>
                  : <img src={growth(s)} alt="" className="h-9 w-9 flex-none rounded-full object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-700">{isHost ? (s.guestTreeName || s.guestName || 'A guest') : bed.name}</span>
                    {statusPill(s.status)}
                  </div>
                  <div className="text-xs text-slate-400">{s.fromDate} → {s.toDate} · {s.nights} {t('nights').toLowerCase()}</div>
                </div>
                {isHost && s.status === 'requested' && (
                  <div className="flex flex-none gap-1.5">
                    <button type="button" disabled={busy} onClick={() => answer(s, 'accepted')}
                      className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">✓</button>
                    <button type="button" disabled={busy} onClick={() => answer(s, 'declined')}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 hover:bg-slate-200 disabled:opacity-50">✕</button>
                  </div>
                )}
                {!isHost && s.status !== 'declined' && (
                  <button type="button" disabled={busy} onClick={() => withdraw(s)}
                    className="flex-none rounded-full px-2 py-1 text-[11px] text-slate-400 hover:text-rose-500">withdraw</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!uid && (
        <p className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-sm text-slate-400">
          Sign in to reserve these nights.
        </p>
      )}
    </div>
  );
};
