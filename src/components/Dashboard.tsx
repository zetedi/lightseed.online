
import React, { useEffect, useState, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { getNetworkStats } from '../services/firebase';
import { Icons } from './ui/Icons';
import { ScrollChevrons } from './ui/ScrollChevrons';
import { QuoteCarousel } from './ui/QuoteCarousel';
import { LIGHTSEED_QUOTES } from '../content/quotes';
import Logo from './Logo';
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
}


const lifetreeImage = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 800'%3E%3Cdefs%3E%3CradialGradient id='g' cx='50%25' cy='50%25' r='60%25'%3E%3Cstop offset='0%25' stop-color='%23d1fae5'/%3E%3Cstop offset='100%25' stop-color='%23047857'/%3E%3C/radialGradient%3E%3Cfilter id='glow'%3E%3CfeGaussianBlur stdDeviation='8' result='coloredBlur'/%3E%3CfeMerge%3E%3CfeMergeNode in='coloredBlur'/%3E%3CfeMergeNode in='SourceGraphic'/%3E%3C/feMerge%3E%3C/filter%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23g)'/%3E%3Cg opacity='0.3'%3E%3Ccircle cx='400' cy='400' r='350' fill='none' stroke='%23fff' stroke-width='1'/%3E%3Ccircle cx='400' cy='400' r='250' fill='none' stroke='%23fff' stroke-width='1'/%3E%3Cpath d='M400 50 L400 750 M50 400 L750 400' stroke='%23fff' stroke-width='1' stroke-dasharray='10 10'/%3E%3C/g%3E%3Cpath d='M400 800 C 350 700 300 650 400 550 C 500 650 450 700 400 800' fill='%235d4037' opacity='0.8'/%3E%3Cg transform='translate(0,-50)'%3E%3Ccircle cx='400' cy='400' r='160' fill='%2310b981'/%3E%3Ccircle cx='300' cy='350' r='100' fill='%2334d399' opacity='0.9'/%3E%3Ccircle cx='500' cy='350' r='100' fill='%2334d399' opacity='0.9'/%3E%3Ccircle cx='400' cy='250' r='120' fill='%23059669' opacity='0.9'/%3E%3Ccircle cx='250' cy='450' r='80' fill='%236ee7b7' opacity='0.8'/%3E%3Ccircle cx='550' cy='450' r='80' fill='%236ee7b7' opacity='0.8'/%3E%3C/g%3E%3Cg filter='url(%23glow)'%3E%3Ccircle cx='400' cy='350' r='15' fill='%23fcd34d'/%3E%3Ccircle cx='320' cy='300' r='12' fill='%23fcd34d' opacity='0.8'/%3E%3Ccircle cx='480' cy='300' r='12' fill='%23fcd34d' opacity='0.8'/%3E%3Ccircle cx='280' cy='420' r='10' fill='%23fbbf24' opacity='0.8'/%3E%3Ccircle cx='520' cy='420' r='10' fill='%23fbbf24' opacity='0.8'/%3E%3Ccircle cx='400' cy='220' r='18' fill='%23fff' opacity='0.9'/%3E%3C/g%3E%3Cpath d='M400 350 L 320 300 M 400 350 L 480 300 M 400 350 L 400 220' stroke='%23fff' stroke-width='2' opacity='0.4'/%3E%3C/svg%3E`;

// A faint, tiling leaf-vein texture — gives the events banner an organic, living surface.
const LeafTexture = () => (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
            <pattern id="leafvein" width="66" height="66" patternUnits="userSpaceOnUse" patternTransform="rotate(14)">
                <path d="M33 6 C 50 20, 50 46, 33 60 C 16 46, 16 20, 33 6 Z" fill="none" stroke="white" strokeWidth="1.1" />
                <path d="M33 6 L33 60 M33 18 L45 13 M33 18 L21 13 M33 31 L47 25 M33 31 L19 25 M33 44 L43 40 M33 44 L23 40" stroke="white" strokeWidth="0.7" fill="none" />
            </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#leafvein)" />
    </svg>
);

export const Dashboard = ({ stats, hostCommunity, events, onViewEvent, onViewCommunity, onSetTab, onPlant, onLogin }: DashboardProps) => {
    const { t } = useLanguage();
    // Session-derived values read straight from context (no longer prop-drilled from App).
    const { lightseed, activeTree } = useSession();
    const firstTreeImage = activeTree?.latestGrowthUrl || activeTree?.imageUrl;
    const eventsScrollRef = useRef<HTMLDivElement>(null);
    const [networkStats, setNetworkStats] = useState({ trees: 0, pulses: 0, visions: 0 });
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoEnded, setVideoEnded] = useState(false);

    // The community banner: the appearance-editor hero first, then the gallery's first image.
    // One source so the white-label hero and the events carousel agree.
    const communityHero = hostCommunity?.heroImageUrl || hostCommunity?.imageUrls?.[0] || '';

    useEffect(() => {
        // Fetch global stats
        getNetworkStats().then(setNetworkStats);
    }, [lightseed]);

    const handleReplay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
            setVideoEnded(false);
        }
    };

    return (
        <div className="space-y-3 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* White-Label Community Hero — slim banner (~1/3); the carousel below carries the rest. */}
            {!lightseed && hostCommunity && (
                <div
                    onClick={() => onViewCommunity?.(hostCommunity)}
                    className="relative h-24 md:h-28 rounded-3xl overflow-hidden shadow-xl cursor-pointer group border-4 border-white/20"
                >
                    <div className="absolute inset-0 bg-slate-900"></div>
                    {communityHero && (
                        <img
                            src={communityHero}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-[10s] opacity-60"
                            alt={hostCommunity.name}
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-950/55 to-transparent"></div>
                    <div className="absolute inset-0 flex items-center gap-3 px-5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/30 bg-white/20 p-1.5 backdrop-blur-md transition-transform group-hover:scale-110">
                            {hostCommunity.logoUrl ? (
                                <img src={hostCommunity.logoUrl} className="h-full w-full rounded-xl object-cover" alt={`${hostCommunity.name} logo`} />
                            ) : (
                                <Icons.Globe size={26} className="text-white" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h1 className="truncate text-xl md:text-2xl font-thin tracking-tight text-white">{hostCommunity.name}</h1>
                            <p className="truncate font-mono text-xs text-emerald-300">{hostCommunity.domain}</p>
                        </div>
                        <span className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-full bg-white/90 px-4 py-2 text-xs font-bold text-emerald-900 shadow-lg transition-all group-hover:bg-white sm:inline-flex">
                            Explore <Icons.ArrowRight size={16} />
                        </span>
                    </div>
                </div>
            )}

            {/* Signed-out visitors: a full-width carousel of reflections (admin-editable per node)
                in place of the Home + Observatory cards. */}
            {!lightseed && <QuoteCarousel quotes={(hostCommunity?.carouselQuotes?.length ? hostCommunity.carouselQuotes : LIGHTSEED_QUOTES)} />}

            {/* Events banner — logged-in only. Full width (home card → plant card), half a card
                tall. A distorted node/community hero, a living leaf texture, and an oversized
                EVENTS wordmark running behind the cards. Looks special with or without a hero. */}
            {lightseed && events && events.length > 0 && (
                <div className="relative w-full overflow-hidden rounded-2xl h-80 md:h-64 bg-emerald-900 ring-1 ring-amber-300/50 shadow-[0_0_40px_-4px_rgba(251,191,36,0.5)]">
                    {/* Background: the node/community hero, softly distorted — or an emerald wash */}
                    {communityHero ? (
                        <img src={communityHero} className="absolute inset-0 h-full w-full scale-110 object-cover blur-[2px] saturate-150" alt="" />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-emerald-950 to-slate-900"></div>
                    )}
                    {/* Leaf-toned wash for legibility + character — light so the hero reads airier */}
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/30 via-slate-900/15 to-emerald-800/25"></div>
                    <LeafTexture />
                    {/* Oversized EVENTS wordmark — stretched to the banner's full width via
                        textLength; taller than the banner so the lower part is clipped. */}
                    <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
                        <text x="50" y="30" textAnchor="middle" textLength="99" lengthAdjust="spacingAndGlyphs" fontSize="42" fontWeight="900" letterSpacing="-1" fill="#ffffff" fillOpacity="0.16" style={{ textTransform: 'uppercase' }}>{t('events')}</text>
                    </svg>
                    {/* Cards float over it, under an explicit Events label. */}
                    <div className="relative z-10 flex h-full flex-col px-4 py-3">
                        <div className="mb-2 flex items-baseline gap-2">
                            <span className="text-xs font-bold uppercase tracking-[0.2em] text-white drop-shadow">{t('events')}</span>
                            <span className="truncate text-[11px] text-white/75">{t('events_sub')}</span>
                        </div>
                        <div ref={eventsScrollRef} className="scroll-hide-bar flex flex-1 items-stretch gap-5 overflow-x-auto">
                        {events.map(ev => (
                            <button
                                key={ev.id}
                                onClick={() => onViewEvent?.(ev)}
                                className="group flex w-36 shrink-0 flex-col overflow-hidden rounded-xl border border-white/25 bg-white/30 text-left shadow-lg backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/40 md:w-44"
                            >
                                <div className="w-full flex-1 overflow-hidden bg-white/10">
                                    {ev.imageUrl ? (
                                        <img src={ev.imageUrl} className="h-full w-full object-cover" alt={ev.title} />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-white/60"><Icons.Loc /></div>
                                    )}
                                </div>
                                <div className="min-w-0 p-2">
                                    <p className="truncate text-sm font-bold text-white drop-shadow">{ev.title}</p>
                                    <p className="truncate text-[11px] text-white/95">
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
                        <button onClick={(e) => { e.stopPropagation(); onPlant(); }} title={t('plant_or_stand')} className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-emerald-600/90 px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide text-white shadow ring-1 ring-white/25 transition-colors hover:bg-emerald-500 sm:px-3 [&>svg]:h-4 [&>svg]:w-4">
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
                <img src={lifetreeImage} className="absolute inset-0 w-full h-full object-cover" alt="Lifetree" />
                <video 
                    ref={videoRef}
                    src="/planting.mp4" 
                    autoPlay 
                    muted 
                    playsInline 
                    onEnded={() => setVideoEnded(true)}
                    className={`absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform opacity-90`}
                />
                <div className={`absolute inset-0 bg-black/10 ${videoEnded ? 'bg-black/40' : ''} transition-colors`}></div>
                
                {videoEnded && (
                    <div className="absolute top-2 right-2 z-20">
                        <button 
                            onClick={handleReplay}
                            className="bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md transition-all hover:scale-110 shadow-lg border border-white/30"
                        >
                            <Icons.Refresh />
                        </button>
                    </div>
                )}

                <div className="relative h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <h2 className="text-sm sm:text-lg font-bold uppercase tracking-widest text-white drop-shadow-md">{t('the_tree')}</h2>
                        <div className="p-2 bg-white/10 backdrop-blur rounded-lg"><Icons.Tree /></div>
                    </div>
                    <span className="inline-flex w-full flex-col items-center justify-center self-stretch rounded-full bg-emerald-600 px-4 py-2 shadow-lg ring-1 ring-white/25 transition-all group-hover:bg-emerald-500 sm:w-auto sm:self-start sm:px-6 sm:py-2.5 sm:group-hover:scale-[1.03]">
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
