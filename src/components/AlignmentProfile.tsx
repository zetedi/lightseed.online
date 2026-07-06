import React, { useEffect, useState } from 'react';
import type { Alignment, Lifetree } from '../types';
import { getLifetreeById, getPulseById, getPersonName } from '../services/firebase';
import { Icons } from './ui/Icons';
import { useLanguage } from '../contexts/LanguageContext';
import { ProfileHero } from './ui/ProfileHero';
import { SectionTitle } from './ui/SectionTitle';

// An alignment's own page — the same profile scaffold as visions/events. Shows the two trees it
// binds, the two pulses that rhymed, and its status. An accepted alignment is a mutual sync-block
// on both chains; a pending one is awaiting the target's acceptance.

interface Side { tree: Lifetree | null; ownerName?: string; pulse?: { title?: string; body?: string } | null; }

interface AlignmentProfileProps {
  alignment: Alignment;
  currentUserId?: string;
  onClose: () => void;
  onViewTree?: (tree: Lifetree) => void;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
  ACCEPTED: { label: 'Synced', cls: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Declined', cls: 'bg-slate-100 text-slate-500' },
};

const TreeSide = ({ side, tone, onView }: { side: Side; tone: 'sky' | 'emerald'; onView?: (t: Lifetree) => void }) => {
  const ring = tone === 'sky' ? 'ring-sky-300' : 'ring-emerald-300';
  const bg = tone === 'sky' ? 'from-sky-300 to-sky-500' : 'from-emerald-300 to-emerald-500';
  const t = side.tree;
  const img = t?.latestGrowthUrl || t?.imageUrl;
  return (
    <button onClick={() => t && onView?.(t)} disabled={!t} className="flex min-w-0 flex-col items-center gap-1.5 text-center disabled:cursor-default">
      {img
        ? <img src={img} alt="" referrerPolicy="no-referrer" className={`h-20 w-20 rounded-full object-cover ring-2 ${ring} ring-offset-2 ring-offset-white`} />
        : <div className={`flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${bg} text-3xl font-serif text-white ring-2 ${ring} ring-offset-2 ring-offset-white`}>{(t?.name || '·').charAt(0).toUpperCase()}</div>}
      <div className="truncate max-w-full font-serif text-lg font-semibold text-slate-800">{t?.name || 'A tree'}</div>
      {side.ownerName && <div className="truncate max-w-full text-xs text-slate-500">tended by {side.ownerName}</div>}
    </button>
  );
};

const PulseChip = ({ cap, text, tone }: { cap: string; text?: string; tone: 'sky' | 'emerald' }) => (
  <div className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 ${tone === 'sky' ? 'border-l-[3px] border-l-sky-400' : 'border-l-[3px] border-l-emerald-400'}`}>
    <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">{cap}</span>
    <q className="font-serif text-sm italic text-slate-700">{text || '—'}</q>
  </div>
);

export const AlignmentProfile = ({ alignment, currentUserId, onClose, onViewTree }: AlignmentProfileProps) => {
  const { t } = useLanguage();
  const [initiator, setInitiator] = useState<Side>({ tree: null });
  const [target, setTarget] = useState<Side>({ tree: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      const [iTree, tTree, iPulse, tPulse, iName, tName] = await Promise.all([
        getLifetreeById(alignment.initiatorTreeId).catch(() => null),
        getLifetreeById(alignment.targetTreeId).catch(() => null),
        getPulseById(alignment.initiatorPulseId).catch(() => null),
        getPulseById(alignment.targetPulseId).catch(() => null),
        getPersonName(alignment.initiatorUid).catch(() => undefined),
        getPersonName(alignment.targetUid).catch(() => undefined),
      ]);
      if (!alive) return;
      setInitiator({ tree: iTree, ownerName: iName, pulse: iPulse ? { title: (iPulse as any).title, body: (iPulse as any).body } : null });
      setTarget({ tree: tTree, ownerName: tName, pulse: tPulse ? { title: (tPulse as any).title, body: (tPulse as any).body } : null });
    })();
    return () => { alive = false; };
  }, [alignment.id]);

  const status = STATUS[alignment.status] || STATUS.PENDING;
  const youAreTarget = currentUserId && alignment.targetUid === currentUserId;

  return (
    <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300 pb-20 bg-slate-50">
      <ProfileHero heroImageUrl={initiator.tree?.latestGrowthUrl || initiator.tree?.imageUrl}>
        <div className="flex items-center justify-between mb-6">
          <button onClick={onClose} className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium">
            <Icons.ArrowLeft /><span>{t('back')}</span>
          </button>
          <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${status.cls}`}>{status.label}</span>
        </div>
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-sky-50 text-sky-500 shadow-xl">
            <Icons.Exchange />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="min-w-0 break-words text-2xl font-light tracking-wide">Alignment</h1>
            <p className="mt-1 text-xs text-slate-300">A resonance between two lifetrees, sealed on both chains.</p>
          </div>
        </div>
      </ProfileHero>

      <div className="mx-auto -mt-8 max-w-3xl px-4 sm:px-6">
        <div className="rounded-xl border border-slate-100 bg-white p-4 sm:p-6 shadow-lg">
          <SectionTitle title="The bond" sub={youAreTarget && alignment.status === 'PENDING' ? 'This alignment is awaiting your acceptance.' : 'What these two trees aligned on.'} />

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <TreeSide side={initiator} tone="sky" onView={onViewTree} />
            <div className="flex flex-col items-center gap-1.5">
              <svg width="72" height="48" viewBox="0 0 72 48" aria-hidden="true">
                <circle cx="28" cy="24" r="19" fill="none" stroke="#0ea5e9" strokeWidth="1.6" />
                <circle cx="44" cy="24" r="19" fill="none" stroke="#10b981" strokeWidth="1.6" />
                <path d="M36 7 A19 19 0 0 1 36 41 A19 19 0 0 1 36 7 Z" fill="#f59e0b" opacity="0.2" />
                <circle cx="36" cy="24" r="2.6" fill="#f59e0b" />
              </svg>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-600">{alignment.status === 'ACCEPTED' ? 'synced' : 'aligns'}</span>
            </div>
            <TreeSide side={target} tone="emerald" onView={onViewTree} />
          </div>

          {(initiator.pulse?.body || initiator.pulse?.title || target.pulse?.body || target.pulse?.title) && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PulseChip cap="their pulse" text={initiator.pulse?.body || initiator.pulse?.title} tone="sky" />
              <PulseChip cap="matched pulse" text={target.pulse?.body || target.pulse?.title} tone="emerald" />
            </div>
          )}

          <div className="mt-6 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3.5 text-sm leading-snug text-emerald-800">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0"><path d="M12 3v18M5 10l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>{alignment.status === 'ACCEPTED'
              ? 'Accepted — a shared sync-block sits on both chains, a lasting mark that these trees aligned.'
              : alignment.status === 'REJECTED'
                ? 'This alignment was declined.'
                : 'Once accepted, a shared sync-block is woven into both chains — a permanent, mutual link.'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
