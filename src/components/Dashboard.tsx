
import { useEffect, useState, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { getNetworkStats, isHubDomain } from '../services/firebase';
import { reflectsInstancePublic } from '../domain/communityDoor';
import { headerSurface } from '../domain/themeSurface';
import { Icons } from './ui/Icons';
import { ScrollChevrons } from './ui/ScrollChevrons';
import { QuoteCarousel } from './ui/QuoteCarousel';
import { LIGHTSEED_QUOTES } from '../content/quotes';
import { Community, Pulse } from '../types';

export interface DashboardProps {
    stats: {
        trees: number;
        pulses: number;
        visions: number;
        alignments: number;
        danger: number;
    };
    hostCommunity?: Community | null;
    events?: Pulse[];
    onViewEvent?: (event: Pulse) => void;
    onViewCommunity?: (community: Community) => void;
    onSetTab: (tab: string) => void;
    onPlant: () => void;
    onLogin: () => void;
    // Themed domains colour the planting CTAs from Appearance settings.
    theme?: { primary?: string; surface?: string; background?: string; text?: string; neutral?: string };
    isDark?: boolean;
}




export const Dashboard = ({ stats, hostCommunity, events, onViewEvent, onSetTab, onPlant, onLogin, theme, isDark = false }: DashboardProps) => {
    // Themed domains colour the planting CTAs from Appearance (hub default stays emerald).
    const ctaPrimary = theme?.primary || '#059669';
    // The events banner wears the HEADER's actual surface — light where the header is
    // light (the hub), themed where a community themes it.
    const banner = headerSurface(theme, isDark);
    const { t } = useLanguage();
    // Session-derived values read straight from context (no longer prop-drilled from App).
    const { lightseed, activeTree } = useSession();
    const firstTreeImage = activeTree?.latestGrowthUrl || activeTree?.imageUrl;
    const eventsScrollRef = useRef<HTMLDivElement>(null);
    const [networkStats, setNetworkStats] = useState({ trees: 0, pulses: 0, visions: 0 });

    useEffect(() => {
        // The Forest card counts THIS place: only its own domain when the node is a scoped pond,
        // or the whole instance when it reflects the commons (getNetworkStats treats an absent
        // domain as unscoped). The reflect flag falls back to the hub-domain default when unset.
        const activeDomain = hostCommunity?.domain || window.location.hostname;
        const reflects = reflectsInstancePublic(hostCommunity?.reflectsPublic, isHubDomain(activeDomain));
        getNetworkStats(reflects ? undefined : activeDomain).then(setNetworkStats);
    }, [lightseed, hostCommunity?.domain, hostCommunity?.reflectsPublic]);


    return (
        <div className="space-y-3 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* (The node banner that used to sit here is gone — About Node is the same page, and
                the node's face is moving toward a customizable page over the seed.) */}

            {/* Signed-out visitors: a full-width carousel of reflections (admin-editable per node)
                in place of the Home + Observatory cards. */}
            {!lightseed && <QuoteCarousel quotes={(hostCommunity?.carouselQuotes?.length ? hostCommunity.carouselQuotes : LIGHTSEED_QUOTES)} />}

            {/* Events banner — logged-in only. Full width (home card → plant card), half a card
                tall. A distorted node/community hero, a living leaf texture, and an oversized
                EVENTS wordmark running behind the cards. Looks special with or without a hero. */}
            {lightseed && events && events.length > 0 && (
                <div className="relative w-full overflow-hidden rounded-2xl h-80 md:h-96 ring-1 ring-amber-300/50 shadow-[0_0_40px_-4px_rgba(251,191,36,0.5)]"
                     style={{ backgroundColor: banner.background }}>
                    {/* Cards float over the wash, under an explicit Events label. */}
                    <div className="relative z-10 flex h-full flex-col px-4 py-3">
                        <div className="mb-2 flex items-baseline gap-2">
                            <span className="text-sm sm:text-lg font-bold uppercase tracking-widest" style={{ color: banner.text }}>{t('events')}</span>
                            <span className="truncate text-[11px]" style={{ color: banner.muted }}>{t('events_sub')}</span>
                        </div>
                        <div ref={eventsScrollRef} className="scroll-hide-bar flex flex-1 items-stretch gap-7 overflow-x-auto">
                        {events.map(ev => (
                            <button
                                key={ev.id}
                                onClick={() => onViewEvent?.(ev)}
                                className={`group flex w-48 shrink-0 flex-col overflow-hidden rounded-xl border text-left shadow-lg backdrop-blur-md transition-all hover:-translate-y-0.5 md:w-60 ${banner.isDark ? 'border-white/25 bg-white/30 hover:bg-white/40' : 'border-slate-900/10 bg-white/70 hover:bg-white'}`}
                            >
                                <div className="w-full flex-1 overflow-hidden bg-white/10">
                                    {ev.imageUrl ? (
                                        <img src={ev.imageUrl} className="h-full w-full object-cover" alt={ev.title} />
                                    ) : (
                                        <div className={`flex h-full w-full items-center justify-center ${banner.isDark ? 'text-white/60' : 'text-slate-400'}`}><Icons.Loc /></div>
                                    )}
                                </div>
                                <div className="min-w-0 p-2">
                                    <p className="truncate text-lg font-light tracking-wide" style={{ color: banner.text }}>{ev.title}</p>
                                    <p className="truncate text-[11px]" style={{ color: banner.muted }}>
                                        {ev.eventDate ? new Date(ev.eventDate).toLocaleDateString() : ''}{ev.eventLocation ? ` · ${ev.eventLocation}` : ''}
                                    </p>
                                </div>
                            </button>
                        ))}
                        </div>
                    </div>
                    <ScrollChevrons scrollRef={eventsScrollRef} axis="x" />
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:gap-8">
            {/* Box 1: Home HUD — signed-in only (signed-out visitors see the quote carousel) */}
            {lightseed && (
            <div onClick={() => lightseed ? onSetTab('profile') : onLogin()} className="relative h-56 md:h-72 lg:h-80 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-purple-600"></div>
                {lightseed && firstTreeImage && <img src={firstTreeImage} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-[5s]" />}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors"></div>
                
                <div className="relative h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-sm sm:text-lg font-bold uppercase tracking-widest text-white drop-shadow-md">Home</h2>
                            <div className="text-lg sm:text-xl font-light truncate max-w-[120px]">{lightseed ? lightseed.displayName : t('sign_in')}</div>
                            <div className="text-[10px] text-amber-200 font-mono uppercase tracking-widest mt-1">{t('light_of_value')}</div>
                        </div>
                        {/* Plant CTA in the top-right (replaces the profile icon); icon-only on mobile. */}
                        <button onClick={(e) => { e.stopPropagation(); onPlant(); }} title={t('plant_or_stand')} style={{ backgroundColor: ctaPrimary }} className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide text-white shadow ring-1 ring-white/25 transition-opacity hover:opacity-90 sm:px-3 [&>svg]:h-4 [&>svg]:w-4">
                            <Icons.Tree /> <span className="hidden sm:inline">{t('plant_or_stand')}</span>
                        </button>
                    </div>

                    {lightseed && (
                        <div className="grid grid-cols-2 bg-white/10 backdrop-blur p-2 rounded-lg border border-white/10 mt-2">
                            <div className="text-center border-r border-b border-white/10 pb-2">
                                <span className="block text-[10px] uppercase text-emerald-200">{t('trees')}</span>
                                <span className="font-bold text-sm">{stats.trees}</span>
                            </div>
                            <div className="text-center border-b border-white/10 pb-2">
                                <span className="block text-[10px] uppercase text-sky-200">{t('pulses')}</span>
                                <span className="font-bold text-sm">{stats.pulses}</span>
                            </div>
                            <div className="text-center border-r border-white/10 pt-2">
                                <span className="block text-[10px] uppercase text-amber-200">{t('visions')}</span>
                                <span className="font-bold text-sm">{stats.visions}</span>
                            </div>
                            <div className="text-center pt-2">
                                <span className="block text-[10px] uppercase text-rose-200">{t('alignments')}</span>
                                <span className="font-bold text-sm">{stats.alignments}</span>
                            </div>
                        </div>
                    )}
                    
                    {stats.danger > 0 && (
                        <div className="absolute bottom-2 right-2 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-full animate-pulse shadow-lg flex items-center gap-1 whitespace-nowrap z-20 border-2 border-white/20">
                            <Icons.Siren /> {stats.danger} {t('guard_tree')}!
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* Box 2: Plant — signed-out only (signed-in users get the small CTA in the Home card). */}
            {!lightseed && (
            <div onClick={() => { if (!lightseed) onLogin(); else onPlant(); }} className="relative h-56 md:h-72 lg:h-80 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                {/* Real bark — the middle of trunkb.jpg, webp-treated. The planting film retired. */}
                <img src="/trunkb.webp" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                <div className="absolute inset-0 bg-black/25 group-hover:bg-black/20 transition-colors"></div>

                <div className="relative h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <h2 className="text-sm sm:text-lg font-bold uppercase tracking-widest text-white drop-shadow-md">{t('the_tree')}</h2>
                        <div className="p-2 bg-white/10 backdrop-blur rounded-lg"><Icons.Tree /></div>
                    </div>
                    <span style={{ backgroundColor: ctaPrimary }} className="inline-flex w-full flex-col items-center justify-center self-stretch rounded-full px-4 py-2 shadow-lg ring-1 ring-white/25 transition-all sm:w-auto sm:self-start sm:group-hover:scale-[1.03]">
                        <span className="text-center text-[11px] font-bold uppercase leading-tight tracking-wide sm:text-sm sm:tracking-widest">{t('plant_or_stand')}</span>
                        <span className="text-center text-[9px] font-medium leading-tight tracking-normal text-white/85 sm:text-[10px]">{t('create_new_world')}</span>
                    </span>
                </div>
            </div>
            )}

            {/* Box 4: Forest (Banner Style + Stats) */}
            <div onClick={() => onSetTab('forest')} className="relative h-56 md:h-72 lg:h-80 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                <img src="/mother.webp" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors"></div>
                <div className="relative h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <h2 className="text-sm sm:text-lg font-bold uppercase tracking-widest text-white drop-shadow-md">{t('the_forest')}</h2>
                        <div className="p-2 bg-white/10 backdrop-blur rounded-lg"><Icons.Map /></div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 bg-white/10 backdrop-blur p-2 rounded-lg border border-white/10">
                        <div className="text-center border-r border-b md:border-b-0 border-white/10 pb-2 md:pb-0">
                            <span className="block text-[10px] uppercase text-emerald-200">{t('trees')}</span>
                            <span className="font-bold text-sm">{networkStats.trees}</span>
                        </div>
                        <div className="text-center border-b md:border-b-0 md:border-r border-white/10 pb-2 md:pb-0">
                            <span className="block text-[10px] uppercase text-sky-200">{t('pulses')}</span>
                            <span className="font-bold text-sm">{networkStats.pulses}</span>
                        </div>
                        <div className="text-center col-span-2 md:col-span-1 pt-2 md:pt-0">
                            <span className="block text-[10px] uppercase text-amber-200">{t('visions')}</span>
                            <span className="font-bold text-sm">{networkStats.visions}</span>
                        </div>
                    </div>

                    <div className="text-sm font-medium uppercase tracking-wide border-t border-white/30 pt-2">{t('explore')}</div>
                </div>
            </div>
        </div>
        </div>
    );
};
