import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from '../components/ui/Icons';
import Logo from '../components/Logo';
import { ResonanceScan } from '../components/ui/ResonanceScan';
import { ResonanceCard, resonanceId } from '../components/ResonancePanel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ListBox } from '../components/ui/ListBox';
import { ViewDensityToggle } from '../components/ui/ViewDensityToggle';
import { useListDensity, type ListDensity } from '../hooks/useListDensity';
import type { VisionSynergy } from '../types';
import type { AlignmentCard } from '../hooks/useAlignmentCards';

// The resonance grid at each density — these are wide, text-rich cards.
const resonanceGrid = (d: ListDensity) =>
  d === 'rows' ? 'grid gap-3 grid-cols-1'
  : d === 'mini' ? 'grid gap-3 md:grid-cols-2 lg:grid-cols-3'
  : 'grid gap-4 md:grid-cols-2';

// A round tree avatar: its latest image, or a coloured initial when there's none yet.
const TreeAvatar = ({ name, imageUrl, tone }: { name: string; imageUrl?: string; tone: 'sky' | 'emerald' }) => {
  const ring = tone === 'sky' ? 'ring-sky-300' : 'ring-emerald-300';
  const bg = tone === 'sky' ? 'bg-gradient-to-br from-sky-300 to-sky-500' : 'bg-gradient-to-br from-emerald-300 to-emerald-500';
  return imageUrl
    ? <img src={imageUrl} alt="" referrerPolicy="no-referrer" className={`h-16 w-16 rounded-full object-cover ring-2 ${ring} ring-offset-2 ring-offset-white`} />
    : <div className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-serif text-white ring-2 ${ring} ring-offset-2 ring-offset-white ${bg}`}>{(name || '·').charAt(0).toUpperCase()}</div>;
};

const TreeColumn = ({ tree, role, who, tone }: { tree: { name: string; imageUrl?: string }; role: string; who?: string; tone: 'sky' | 'emerald' }) => {
  const roleClass = tone === 'sky' ? 'text-sky-600 bg-sky-50' : 'text-emerald-700 bg-emerald-50';
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
      <TreeAvatar name={tree.name} imageUrl={tree.imageUrl} tone={tone} />
      <div className="truncate max-w-full font-serif text-base font-semibold text-slate-800">{tree.name}</div>
      {who && <div className="truncate max-w-full text-xs text-slate-500">{who}</div>}
      <span className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] ${roleClass}`}>{role}</span>
    </div>
  );
};

const PulseChip = ({ cap, text, tone }: { cap: string; text?: string; tone: 'sky' | 'emerald' }) => (
  <div className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 ${tone === 'sky' ? 'border-l-[3px] border-l-sky-400' : 'border-l-[3px] border-l-emerald-400'}`}>
    <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.12em] text-slate-400">{cap}</span>
    <q className="line-clamp-2 font-serif text-[13px] italic text-slate-700">{text || '—'}</q>
  </div>
);

// The Observatory: pending alignments + the Living Intelligence Resonance field. Extracted from
// App.tsx into a page so it can be maintained on its own (the shell only passes data + callbacks).
interface ObservatoryPageProps {
  alignments: AlignmentCard[];
  onAcceptAlignment: (id: string) => void;
  onRejectAlignment: (id: string) => void;
  onViewAlignmentTree: (treeId: string) => void;
  isAnalyzingSynergy: boolean;
  synergies: VisionSynergy[];
  lastSynergyAt: number | null;
  canRefreshResonance: boolean;
  synergyCooldownLeft: number;
  onRefreshResonance: () => void;
  favoriteResonanceIds: Set<string>;
  onToggleFavorite: (s: VisionSynergy) => void;
  onReach: (treeId: string, treeName: string) => void;
  observatoryQuote: string;
  quoteCopied: boolean;
  onCopyQuote: () => void;
  tone: string; // the active menu item's colour — band and pill are one surface
}

export const ObservatoryPage = ({
  alignments, onAcceptAlignment, onRejectAlignment, onViewAlignmentTree, isAnalyzingSynergy, synergies, lastSynergyAt,
  canRefreshResonance, synergyCooldownLeft, onRefreshResonance, favoriteResonanceIds,
  onToggleFavorite, onReach, observatoryQuote, quoteCopied, onCopyQuote, tone,
}: ObservatoryPageProps) => {
  const { t } = useLanguage();
  const [density, setDensity] = useListDensity('observatory');
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <SectionHeader
        title={t('pending_alignments')}
        tone={tone}
        // The observatory quote lives in the band — a whisper where a search box would sit.
        footer={observatoryQuote ? (
          <div className="hidden min-w-0 items-center gap-1.5 md:flex">
            <p dir="auto" className="min-w-0 truncate text-sm italic text-white/90">"{observatoryQuote}"</p>
            <button
              onClick={onCopyQuote}
              title="Copy quote" aria-label="Copy quote"
              className="inline-flex shrink-0 items-center rounded-full bg-white/15 p-1 text-white/80 backdrop-blur transition-colors hover:bg-white/25 hover:text-white"
            >
              {quoteCopied ? <span className="px-0.5 text-[10px] font-bold">✓</span> : <Icons.Copy size={13} />}
            </button>
          </div>
        ) : undefined}
        toggle={<ViewDensityToggle value={density} onChange={setDensity} />}
        collapsibleSearch={false}
      >
        {/* The empty "field is calm" state only when there's truly nothing — no alignments AND
            no resonances. Otherwise the resonance section carries it. */}
        {(alignments.length > 0 || synergies.length === 0) && (
          <ListBox tone={tone} className="mb-6">
            {alignments.length === 0 ? (
              <div className="flex flex-col items-center p-12 text-center">
                <div className="mb-6 rounded-full bg-white p-4 shadow-sm">
                  <Logo width={100} height={100} className="text-slate-800" />
                </div>
                <h3 className="mb-2 text-xl font-light text-slate-800">{t('no_pending_resonance')}</h3>
                <p className="text-slate-500">{t('ether_quiet')}</p>
              </div>
            ) : (
              <div className={density === 'rows' ? 'space-y-2.5' : density === 'mini' ? 'grid gap-3 md:grid-cols-2' : 'space-y-4'}>
                {alignments.map(a => (
                  <div key={a.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                    {/* Header — who's asking, and that it's on you */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                      <span className="text-sm font-semibold text-slate-700">{t('alignment_request')}</span>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">{t('awaiting_you')}</span>
                    </div>

                    {/* The two trees meeting */}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-2 pt-5">
                      <TreeColumn tree={a.theirTree} role={t('reaching_out')} who={a.theirTree.ownerName ? `${t('tended_by')} ${a.theirTree.ownerName}` : undefined} tone="sky" />
                      {/* A calm connector — the two trees linked, no colour, no label. */}
                      <svg width="44" height="24" viewBox="0 0 44 24" fill="none" stroke="#cbd5e1" strokeWidth="1.6" aria-hidden="true" className="shrink-0">
                        <circle cx="17" cy="12" r="8" />
                        <circle cx="27" cy="12" r="8" />
                      </svg>
                      <TreeColumn tree={a.yourTree} role={t('your_tree_role')} tone="emerald" />
                    </div>

                    {/* The two pulses that rhyme */}
                    {(a.theirPulse?.body || a.theirPulse?.title || a.yourPulse?.body || a.yourPulse?.title) && (
                      <div className="grid grid-cols-2 gap-2.5 px-4 pb-1 pt-1.5">
                        <PulseChip cap={t('their_pulse')} text={a.theirPulse?.body || a.theirPulse?.title} tone="sky" />
                        <PulseChip cap={t('your_pulse')} text={a.yourPulse?.body || a.yourPulse?.title} tone="emerald" />
                      </div>
                    )}

                    {/* What accepting does — the ledger consequence, in plain words */}
                    <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-[13px] leading-snug text-emerald-800">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0"><path d="M12 3v18M5 10l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      <span>{t('alignment_meaning')}</span>
                    </div>

                    {/* Accept · Decline · look before deciding */}
                    <div className="flex flex-wrap items-center gap-2.5 px-4 py-4">
                      <button onClick={() => onAcceptAlignment(a.id)} className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-emerald-700 active:scale-95">{t('accept_sync')}</button>
                      <button onClick={() => onRejectAlignment(a.id)} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 transition-all hover:bg-slate-50">{t('decline_alignment')}</button>
                      <span className="flex-1"></span>
                      <button onClick={() => onViewAlignmentTree(a.theirTree.id)} className="truncate text-xs font-bold text-sky-600 transition-colors hover:text-sky-700">{t('visit_tree')} {a.theirTree.name} →</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ListBox>
        )}

        {/* Living Intelligence Resonance — its own cloud. */}
        <ResonanceScan active={isAnalyzingSynergy}>
          <ListBox tone={tone}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white"><Icons.SparkleFill size={20} /></div>
                <p className="min-w-0 truncate text-sm text-slate-500">
                  {lastSynergyAt ? `${t('last_read')} ${new Date(lastSynergyAt).toLocaleDateString()}` : t('resonance_field_hint')}
                </p>
              </div>
              <button
                onClick={onRefreshResonance}
                disabled={isAnalyzingSynergy || !canRefreshResonance}
                title={!canRefreshResonance ? `Refreshes weekly — about ${Math.max(1, Math.ceil(synergyCooldownLeft / 86400000))} day(s) left` : 'Re-read the field'}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow transition-all hover:bg-amber-600 active:scale-95 disabled:opacity-50"
              >
                {isAnalyzingSynergy
                  ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  : <Icons.Refresh />}
                <span>{isAnalyzingSynergy ? t('reading') : canRefreshResonance ? t('refresh') : `~${Math.max(1, Math.ceil(synergyCooldownLeft / 86400000))}d`}</span>
              </button>
            </div>
            {synergies.length > 0 ? (
              <div className={resonanceGrid(density)}>
                {[...synergies].sort((a, b) => (b.score || 0) - (a.score || 0)).map((s, i) => (
                  <ResonanceCard key={i} s={s} isFavorite={favoriteResonanceIds.has(resonanceId(s))} onToggleFavorite={() => onToggleFavorite(s)} onReach={onReach} />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">{t('no_resonances_yet')}</p>
            )}
          </ListBox>
        </ResonanceScan>
      </SectionHeader>
    </div>
  );
};
