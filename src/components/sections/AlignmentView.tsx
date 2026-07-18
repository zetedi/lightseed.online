import { useEffect, useState } from 'react';
import type { Alignment, AlignmentNote, Lifetree } from '../../types';
import { getLifetreeById, getPulseById, getPersonName, postAlignmentNote, getAlignmentById, getCovenantForAlignment } from '../../services/firebase';
import { Icons } from '../ui/Icons';
import { Loading } from '../ui/Loading';
import { useLanguage } from '../../contexts/LanguageContext';
import { ProfileHero } from '../ui/ProfileHero';
import { SectionTitle } from '../ui/SectionTitle';

// THE alignment view — the one page every alignment opens into, whether reached from a feed's
// sync-block, a tree's chain leaf, the profile's alignments list, or the Observatory. Same
// profile scaffold as visions/events: the two sides it binds, the two pulses that rhymed, and
// the discussion that carries it from initiation to a finalised sync-block. An accepted
// alignment is a mutual sync-block on both chains; a pending one is still an open conversation.
//
// Today each side/party of an alignment is a lifetree. The direction (Indra's net) is that
// alignments will also bind decisions, community events, and node pulses — so the framing here
// stays entity-generic ("side"/"party") where cheap, and only the leaf rendering assumes trees.

interface Side { tree: Lifetree | null; ownerName?: string; pulse?: { title?: string; body?: string } | null; }

interface AlignmentViewProps {
  alignment: Alignment;
  currentUserId?: string;
  onClose: () => void;
  // Navigate to a side's entity — a lifetree today; other party kinds later.
  onViewTree?: (tree: Lifetree) => void;
  // Open this alignment's cryptographic twin — the 2-party Covenant (domain/covenant.ts).
  onViewCovenant?: (covenantId: string) => void;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Open', cls: 'bg-amber-100 text-amber-700' },
  ACCEPTED: { label: 'Finalised', cls: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Declined', cls: 'bg-slate-100 text-slate-500' },
};

// One party of the alignment — rendered as its tree today; the card stays side-shaped so other
// party kinds (decision, event, node) can slot in later.
const PartySide = ({ side, tone, onView }: { side: Side; tone: 'sky' | 'emerald'; onView?: (t: Lifetree) => void }) => {
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

export const AlignmentView = ({ alignment, currentUserId, onClose, onViewTree, onViewCovenant }: AlignmentViewProps) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [initiator, setInitiator] = useState<Side>({ tree: null });
  const [target, setTarget] = useState<Side>({ tree: null });
  const [covenantId, setCovenantId] = useState<string | null>(null);
  // The live alignment — the prop can be stale (e.g. loaded with the profile's history tab), so
  // messages and status are refreshed from the source on open and after every send.
  const [messages, setMessages] = useState<AlignmentNote[]>(alignment.messages || []);
  const [liveStatus, setLiveStatus] = useState(alignment.status);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- flips the loading flag and re-seeds from the (possibly stale) prop synchronously before the async live refresh below
    setLoading(true);
    setMessages(alignment.messages || []);
    setLiveStatus(alignment.status);
    setDraft(''); setError(null);
    (async () => {
      const [live, iTree, tTree, iPulse, tPulse, iName, tName, covenant] = await Promise.all([
        getAlignmentById(alignment.id).catch(() => null),
        getLifetreeById(alignment.initiatorTreeId).catch(() => null),
        getLifetreeById(alignment.targetTreeId).catch(() => null),
        getPulseById(alignment.initiatorPulseId).catch(() => null),
        getPulseById(alignment.targetPulseId).catch(() => null),
        getPersonName(alignment.initiatorUid).catch(() => undefined),
        getPersonName(alignment.targetUid).catch(() => undefined),
        getCovenantForAlignment(alignment.id).catch(() => null),
      ]);
      if (!alive) return;
      setCovenantId(covenant?.id ?? null);
      if (live) { setMessages(live.messages || []); setLiveStatus(live.status); }
      setInitiator({ tree: iTree, ownerName: iName, pulse: iPulse ? { title: (iPulse as any).title, body: (iPulse as any).body } : null });
      setTarget({ tree: tTree, ownerName: tName, pulse: tPulse ? { title: (tPulse as any).title, body: (tPulse as any).body } : null });
      setLoading(false);
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on alignment.id on purpose: the other alignment fields are fetched fresh inside; depending on them would refetch on every parent render (the prop object churns)
  }, [alignment.id]);

  const status = STATUS[liveStatus] || STATUS.PENDING;
  const isParticipant = !!currentUserId && (alignment.initiatorUid === currentUserId || alignment.targetUid === currentUserId);
  const canSpeak = isParticipant && liveStatus === 'PENDING';
  const nameFor = (uid: string) => (uid === alignment.initiatorUid ? initiator.ownerName : target.ownerName) || 'Someone';

  const send = async () => {
    if (!currentUserId || !draft.trim() || posting) return;
    setPosting(true); setError(null);
    const text = draft.trim();
    try {
      await postAlignmentNote(alignment.id, currentUserId, text);
      // Re-read the source (not an optimistic echo) — picks up the counterpart's notes too.
      const live = await getAlignmentById(alignment.id).catch(() => null);
      if (live) { setMessages(live.messages || []); setLiveStatus(live.status); }
      setDraft('');
    } catch (e: any) {
      setError(e?.message || 'Could not send.');
    } finally {
      setPosting(false);
    }
  };

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
            <Icons.Venn />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="min-w-0 break-words text-2xl font-light tracking-wide">Alignment</h1>
            <p className="mt-1 text-xs text-slate-300">A resonance between two lifetrees, sealed on both chains.</p>
          </div>
        </div>
      </ProfileHero>

      <div className="mx-auto mt-6 max-w-3xl px-4 sm:px-6">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-6 shadow-lg">
          <SectionTitle title="The bond" sub={canSpeak ? 'This alignment is still open: speak, then finalise when you’re ready.' : 'What these two trees aligned on.'} />

          {loading ? (
            <div className="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 shadow-sm">
              <Loading />
            </div>
          ) : (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <PartySide side={initiator} tone="sky" onView={onViewTree} />
            {/* A calm connector — the two sides linked, no colour, no label. */}
            <svg width="44" height="24" viewBox="0 0 44 24" fill="none" stroke="#cbd5e1" strokeWidth="1.6" aria-hidden="true" className="shrink-0">
              <circle cx="17" cy="12" r="8" />
              <circle cx="27" cy="12" r="8" />
            </svg>
            <PartySide side={target} tone="emerald" onView={onViewTree} />
          </div>
          )}

          {!loading && (initiator.pulse?.body || initiator.pulse?.title || target.pulse?.body || target.pulse?.title) && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PulseChip cap="their pulse" text={initiator.pulse?.body || initiator.pulse?.title} tone="sky" />
              <PulseChip cap="matched pulse" text={target.pulse?.body || target.pulse?.title} tone="emerald" />
            </div>
          )}

          {/* The discussion — initiation → response → finalised. Recursive: it stays open until
              the target accepts. */}
          <div className="mt-6">
            <SectionTitle title="The discussion" sub="How this alignment took shape." />
            <ol className="space-y-3">
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">{initiator.ownerName || 'A tree'}</span> reached toward <span className="font-semibold text-slate-800">{target.ownerName || 'another tree'}</span>; the match was acknowledged.</p>
              </li>
              {messages.map((m, i) => {
                const mine = m.by === currentUserId;
                return (
                  <li key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${mine ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                      <span className={`mb-0.5 block text-[10px] font-semibold uppercase tracking-wide ${mine ? 'text-white/70' : 'text-slate-400'}`}>{nameFor(m.by)}</span>
                      <span className="whitespace-pre-wrap break-words">{m.text}</span>
                    </div>
                  </li>
                );
              })}
              {liveStatus === 'ACCEPTED' && (
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                  <p className="text-sm font-medium text-emerald-700">Finalised: a shared sync-block sits on both chains.</p>
                </li>
              )}
              {liveStatus === 'REJECTED' && (
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                  <p className="text-sm text-slate-500">Declined: this alignment was not taken up.</p>
                </li>
              )}
            </ol>

            {canSpeak && (
              <div className="mt-4">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="Say something back…"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:bg-white"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  {error ? <span className="text-xs text-rose-500">{error}</span> : <span />}
                  <button
                    onClick={send}
                    disabled={!draft.trim() || posting}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                  >{posting ? 'Sending…' : 'Send'}</button>
                </div>
                <p className="mt-2 text-center text-[11px] text-slate-400">The target accepts from the Observatory to finalise; that seals the sync-block on both chains.</p>
              </div>
            )}
          </div>

          {isParticipant && covenantId && onViewCovenant && (
            <button
              onClick={() => onViewCovenant(covenantId)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white py-3 text-sm font-bold text-emerald-700 shadow-sm hover:bg-emerald-50"
            >
              <span className="[&>svg]:h-4 [&>svg]:w-4"><Icons.Venn /></span>
              {t('covenant_open')}
            </button>
          )}

          <div className="mt-6 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3.5 text-sm leading-snug text-emerald-800">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0"><path d="M12 3v18M5 10l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>{liveStatus === 'ACCEPTED'
              ? 'Accepted: a shared sync-block sits on both chains, a lasting mark that these trees aligned.'
              : liveStatus === 'REJECTED'
                ? 'This alignment was declined.'
                : 'Once accepted, a shared sync-block is woven into both chains (a permanent, mutual link).'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
