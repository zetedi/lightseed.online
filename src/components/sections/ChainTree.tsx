import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import Logo from '../Logo';
import { Pulse } from '../../types';

// ChainTree — renders ANY being's chain (Indra's net). The "digital tree" is the universal
// chain renderer: every being (human, AI, community, node, tree) shares one profile anatomy,
// and its immutable pulse chain always draws as a living tree — trunk, branch, leaf, root.
// Entity-generic on purpose: this component knows Pulses, never Lifetrees — community/node/
// person profiles bind their own root card and stats later.

// The being's root/genesis card — the ROOT of the chain, drawn from the being itself
// (most beings are planted with no genesis pulse; special ones carry one).
export interface ChainRoot {
    imageUrl?: string | null;
    name: string;
    body?: string | null;
    // Pre-formatted "planted" line, e.g. "12/03/2025 · Under the old oak".
    plantedLabel?: string;
    // Fallback hash shown when there is no genesis pulse (the being's own genesis hash).
    hash?: string | null;
}

// The root-to-latest ledger shown at the foot of the chain.
export interface ChainStats {
    blockHeight?: number;
    genesisHash?: string;
    latestHash?: string;
}

interface ChainTreeProps {
    genesisBlock?: Pulse | null;
    // Growth blocks, DESCENDING (newest first) — the crown renders at the top, the root below.
    blocks: Pulse[];
    loading: boolean;
    onViewPulse: (pulse: Pulse) => void;
    // The Tend CTA at the crown — shown only when the viewer may tend this being.
    canTend?: boolean;
    onTend?: () => void;
    emptyText?: string;
    root?: ChainRoot | null;
    stats?: ChainStats | null;
}

// Collapse the middle of a long growth chain into one clickable line.
const COLLAPSE_AT = 6, CHAIN_HEAD = 3, CHAIN_TAIL = 2;

export const ChainTree: React.FC<ChainTreeProps> = ({
    genesisBlock,
    blocks,
    loading,
    onViewPulse,
    canTend,
    onTend,
    emptyText,
    root,
    stats,
}) => {
    const { t } = useLanguage();
    // The chain can be long, so the middle collapses into a clickable line.
    const [chainExpanded, setChainExpanded] = useState(false);

    if (loading) {
        return <p className="py-10 text-center text-sm text-slate-400">Growing the digital tree…</p>;
    }
    if (blocks.length === 0 && !genesisBlock && !root) {
        return <p className="py-10 text-center text-sm text-slate-400">{emptyText || 'No pulses yet.'}</p>;
    }

    const chainCollapsible = blocks.length > COLLAPSE_AT;
    const hiddenChainCount = chainCollapsible && !chainExpanded ? blocks.length - CHAIN_HEAD - CHAIN_TAIL : 0;
    const COLLAPSED_MARKER = { _collapsed: true } as unknown as Pulse & { _collapsed?: boolean };
    const visibleChain: (Pulse & { _collapsed?: boolean })[] = (chainCollapsible && !chainExpanded)
        ? [...blocks.slice(0, CHAIN_HEAD), COLLAPSED_MARKER, ...blocks.slice(blocks.length - CHAIN_TAIL)]
        : blocks;

    return (
        <div className="rounded-2xl bg-slate-900 p-5 text-slate-200 shadow-sm md:p-8">
            {chainCollapsible && (
                <div className="mb-4 flex justify-center">
                    <button onClick={() => setChainExpanded(e => !e)} className="text-xs font-bold text-emerald-300 hover:text-emerald-200">
                        {chainExpanded ? 'Collapse the middle' : `Expand all ${blocks.length} pulses`}
                    </button>
                </div>
            )}

            <div className="relative flex flex-col items-start md:items-center">
                {/* Central Tree Trunk — a rounded cylinder with vertical bark grain. */}
                <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-4 md:w-8 -ml-2 md:-ml-4 rounded-t-full rounded-b-2xl shadow-inner overflow-hidden z-0"
                     style={{ background: 'linear-gradient(90deg, #3E2723 0%, #6D4C41 45%, #8D6E63 55%, #4E342E 100%)' }}>
                    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 5px)' }}></div>
                </div>

                <div className="w-full space-y-12 md:space-y-24 pb-24 relative z-10">
                    {/* Tend CTA — the crown at the top of the trunk. We don't grow it; it grows
                        naturally. Tending (our breath, our presence) is the care that lets it. */}
                    {canTend && onTend && (
                        <div className="flex w-full justify-start pl-12 md:justify-center md:pl-0">
                            <button onClick={onTend} title="Tend this tree — a pulse of care (we both grow)"
                                className="relative z-10 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-7 py-3 font-bold uppercase tracking-widest text-white ring-2 ring-yellow-300/60 shadow-[0_0_22px_rgba(250,204,21,0.55)] transition-all hover:bg-emerald-700 hover:shadow-[0_0_32px_rgba(250,204,21,0.85)] active:scale-95">
                                <Icons.HandLeaf /> <span>Tend</span>
                            </button>
                        </div>
                    )}
                    {visibleChain.map((pulse, index) => {
                        // The collapsed middle renders as one clickable horizontal line.
                        if (pulse._collapsed) {
                            return (
                                <div key="chain-collapsed" className="flex w-full justify-start pl-12 md:justify-center md:pl-0">
                                    <button onClick={() => setChainExpanded(true)}
                                        className="relative z-10 flex w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-emerald-300 bg-emerald-50/80 py-2.5 text-xs font-bold text-emerald-700 backdrop-blur-sm transition-colors hover:bg-emerald-100 md:max-w-md">
                                        <Icons.List />
                                        <span>{hiddenChainCount} more pulse{hiddenChainCount !== 1 ? 's' : ''} hidden — tap to expand</span>
                                    </button>
                                </div>
                            );
                        }
                        // Visual positioning logic:
                        // index 0, 2, 4 (Even) -> Right Side (Desktop)
                        // index 1, 3, 5 (Odd) -> Left Side (Desktop)
                        const isRightSide = index % 2 === 0;
                        const pulseImages = pulse.imageUrls?.length ? pulse.imageUrls : (pulse.imageUrl ? [pulse.imageUrl] : []);
                        const pulseBadge = pulse.type === 'event' ? 'EVENT' : pulse.type === 'tree_growth' ? 'GROWTH' : 'PULSE';

                        return (
                            <div key={pulse.id} className={`flex w-full relative ${isRightSide ? 'md:justify-end' : 'md:justify-start'} justify-start`}>

                                {/* Container Wrapper */}
                                {/* Mobile: Padded left to avoid trunk. Desktop: Half width. */}
                                <div className={`
                                    w-full md:w-1/2 relative flex items-center
                                    pl-12 md:pl-0
                                    ${isRightSide ? 'md:pl-16' : 'md:pr-16 md:flex-row-reverse'}
                                `}>

                                    {/* Mobile Branch (Always Left Trunk to Card) */}
                                    <svg className="md:hidden absolute top-1/2 -mt-6 left-[1.15rem] w-12 h-12 text-[#5D4037] pointer-events-none z-0" viewBox="0 0 50 50" preserveAspectRatio="none">
                                        {/* Curve from left (trunk) to right (card) */}
                                        <path d="M0,25 Q25,25 50,25" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" />
                                    </svg>

                                    {/* Desktop Branch */}
                                    <svg className={`hidden md:block absolute top-1/2 -mt-4 w-20 h-12 text-[#5D4037] pointer-events-none z-0 ${isRightSide ? 'left-0 -ml-2' : 'right-0 -mr-2'}`} viewBox="0 0 80 40" preserveAspectRatio="none">
                                        {isRightSide ? (
                                            // From Left (Trunk) to Right (Card)
                                            <path d="M0,20 C40,20 40,20 80,20" stroke="currentColor" strokeWidth="8" fill="none" strokeLinecap="round" />
                                        ) : (
                                            // From Right (Trunk) to Left (Card)
                                            <path d="M80,20 C40,20 40,20 0,20" stroke="currentColor" strokeWidth="8" fill="none" strokeLinecap="round" />
                                        )}
                                    </svg>

                                    {/* Leaf Card */}
                                    <div
                                        onClick={() => onViewPulse(pulse)}
                                        className={`
                                            relative bg-white border-2 border-emerald-100 shadow-md shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-500/30 hover:border-emerald-300
                                            transition-all cursor-pointer group w-full md:max-w-sm rounded-xl
                                            ${isRightSide
                                                ? 'md:rounded-tl-[0] md:rounded-bl-[3rem] md:rounded-tr-[2rem] md:rounded-br-[2rem] md:text-left'
                                                : 'md:rounded-tr-[0] md:rounded-br-[3rem] md:rounded-tl-[2rem] md:rounded-bl-[2rem] md:text-right'}
                                            text-left z-10
                                        `}
                                    >
                                        {/* Decorative Vein SVG */}
                                        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-5 text-emerald-500" viewBox="0 0 100 100" preserveAspectRatio="none">
                                            <path d={isRightSide ? "M0,50 Q50,25 100,0" : "M100,50 Q50,25 0,0"} stroke="currentColor" strokeWidth="1" fill="none" />
                                        </svg>

                                        <div className="p-4 md:p-6 relative z-10">
                                            <div className={`flex items-center gap-2 mb-3 ${isRightSide ? '' : 'md:flex-row-reverse'} flex-row`}>
                                                {pulseBadge === 'GROWTH' ? (
                                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold">GROWTH</span>
                                                ) : pulseBadge === 'EVENT' ? (
                                                    <span className="bg-sky-100 text-sky-700 text-[10px] px-2 py-0.5 rounded-full font-bold">EVENT</span>
                                                ) : (
                                                    <span className="bg-sky-100 text-sky-700 text-[10px] px-2 py-0.5 rounded-full font-bold">PULSE</span>
                                                )}
                                                {pulse.care === 'watering' && (
                                                    <span className="bg-sky-100 text-sky-700 text-[10px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1" title={pulse.wateringConfirmation?.note || ''}>💧 {typeof pulse.wateringConfirmation?.confidence === 'number' ? `${pulse.wateringConfirmation.confidence}%` : ''}{pulse.wateringConfirmedBy === 'guardian' ? ' ✓' : ''}</span>
                                                )}
                                                {/* Spacetime — the WHEN every block carries, and the WHERE when the pulse has one. */}
                                                <span className="text-xs text-slate-400 font-mono">
                                                    {new Date(pulse.createdAt?.toMillis()).toLocaleDateString()}
                                                    {pulse.eventLocation ? <span className="text-slate-400/80"> · {pulse.eventLocation}</span> : null}
                                                </span>
                                            </div>

                                            <div className={`flex gap-4 ${isRightSide ? '' : 'md:flex-row-reverse'} flex-row items-start`}>
                                                {pulseImages.length > 0 && (
                                                    <div className="relative shrink-0">
                                                        <img src={pulseImages[0]} className="w-16 h-16 rounded-lg object-cover bg-slate-50 border border-slate-100" />
                                                        {pulseImages.length > 1 && (
                                                            <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-600 shadow">{pulseImages.length}</span>
                                                        )}
                                                    </div>
                                                )}
                                                <div>
                                                    <h4 dir="auto" className="font-bold text-slate-800 text-base md:text-lg leading-tight mb-1 md:mb-2">{pulse.title}</h4>
                                                    <p dir="auto" className="text-xs text-slate-500 line-clamp-3">{pulse.body}</p>
                                                </div>
                                            </div>

                                            <div className={`mt-4 pt-2 border-t border-slate-50 text-[9px] font-mono text-slate-300 truncate ${isRightSide ? 'md:text-left' : 'md:text-right'} text-left`}>
                                                Hash: {pulse.hash.substring(0, 16)}...
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Genesis / planting card — the ROOT of the chain. Always shown,
                        drawn from the being itself (most beings have no genesis pulse). */}
                    {root && (
                        <div className="flex w-full justify-start md:justify-center pt-8 md:pt-12 relative pl-12 md:pl-0">
                             {/* Root Connection SVG */}
                             <svg className="md:hidden absolute top-0 left-[1.15rem] w-8 h-12 text-[#5D4037] pointer-events-none z-0" viewBox="0 0 20 40" preserveAspectRatio="none">
                                 <path d="M0,0 L0,40" stroke="currentColor" strokeWidth="6" />
                             </svg>

                             {/* The base is the PLANTING card: the genesis block (root) carrying the vision. */}
                             <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border-4 border-[#3E2723] bg-[#5D4037] text-amber-100 shadow-xl ring-4 ring-emerald-600/25 md:w-auto">
                                 {root.imageUrl && (
                                     <div className="relative h-40 w-full">
                                         <img src={root.imageUrl} alt={root.name} className="h-full w-full object-cover opacity-90" />
                                         <div className="absolute inset-0 bg-gradient-to-t from-[#5D4037] via-[#5D4037]/40 to-transparent" />
                                         <span className="absolute left-3 top-3 rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] font-bold text-amber-900 shadow">🌱 PLANTING</span>
                                     </div>
                                 )}
                                 <div className="p-6 text-center">
                                     <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/30 bg-amber-900/50 text-amber-200">
                                         <Logo width={22} height={22} />
                                     </div>
                                     <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-200">Root · Planted · Genesis</h4>
                                     {root.body && <p dir="auto" className="mx-auto mb-2 max-w-xs text-sm italic leading-relaxed text-amber-50/90">"{root.body}"</p>}
                                     <p className="text-[11px] text-amber-200/70">{root.plantedLabel}</p>
                                     <p className="mt-3 break-all px-2 font-mono text-[10px] text-amber-100/50">{genesisBlock?.hash || root.hash}</p>
                                 </div>
                             </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Immutable chain stats — the root-to-latest ledger, at the foot of the chain. */}
            {stats && (
                <div className="relative mt-4 overflow-hidden rounded-2xl bg-slate-900 p-6 font-mono text-xs text-slate-300 shadow-inner">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Logo width={100} height={100} /></div>
                    <h3 className="mb-6 flex items-center font-bold uppercase tracking-wider text-emerald-400">
                        <Icons.Hash /><span className="ml-2">Immutable Chain</span>
                    </h3>
                    <div className="relative z-10 grid gap-4 sm:grid-cols-3">
                        <div>
                            <p className="mb-1 text-[10px] uppercase text-slate-500">Block Height</p>
                            <p className="text-2xl text-white">{stats.blockHeight}</p>
                        </div>
                        <div className="break-all">
                            <p className="mb-1 text-[10px] uppercase text-slate-500">{t('genesis')} · root</p>
                            <p className="text-emerald-500/80" dir="ltr">{stats.genesisHash}</p>
                        </div>
                        <div className="break-all">
                            <p className="mb-1 text-[10px] uppercase text-slate-500">{t('latest_hash')}</p>
                            <p className="text-emerald-300" dir="ltr">{stats.latestHash}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
