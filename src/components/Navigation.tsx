
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { Icons } from './ui/Icons';
import { Modal } from './ui/Modal';
import Logo from './Logo';
import { tabTone } from '../utils/tabTheme';


interface NavigationProps {
  activeTab: string;
  setTab: (tab: string) => void;
  onPlant: () => void;
  onPulse: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onProfile: () => void;
  onCreateVision: () => void;
  pendingAlignmentsCount: number;
  reachNotificationsCount?: number;
  treeInviteCount?: number;
  careAlertCount?: number;
  logoUrl?: string;
  appName?: string;
  theme?: {
    primary: string;
    secondary: string;
    accent: string;
    neutral?: string;
    surface?: string;
    background?: string;
    text?: string;
  };
  isNightMode?: boolean;
  onToggleNightMode?: () => void;
  onOpenReachInbox?: () => void;
}

const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'hu', name: 'Magyar' },
    { code: 'qu', name: 'Runa Simi' },
    { code: 'sa', name: 'संस्कृतम्' },
    { code: 'ja', name: '日本語' },
    { code: 'ar', name: 'العربية' },
    { code: 'sw', name: 'Kiswahili' },
    { code: 'zh', name: '中文' },
];

const isDarkHex = (hex: string | undefined, fallback: boolean) => {
    if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return fallback;
    const value = hex.slice(1);
    const channels = [0, 2, 4].map((start) => {
        const channel = parseInt(value.slice(start, start + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    return luminance < 0.38;
};

export const Navigation = ({
    activeTab,
    setTab,
    onPlant,
    onPulse,
    onLogin,
    onLogout,
    onProfile,
    onCreateVision,
    pendingAlignmentsCount,
    reachNotificationsCount = 0,
    careAlertCount = 0,
    treeInviteCount = 0,
    logoUrl,
    appName = '.seed',
    theme,
    isNightMode = false,
    onToggleNightMode,
    onOpenReachInbox
}: NavigationProps) => {
    const { t, language, setLanguage } = useLanguage();
    // Session-derived values come straight from context now (no longer prop-drilled from App).
    const { lightseed, myTrees, guardedTrees, activeTree } = useSession();
    const myTreesCount = myTrees.length;
    const dangerTreesCount = guardedTrees.filter((tr) => tr.status === 'DANGER').length;
    const activeTreeImage = activeTree?.latestGrowthUrl || activeTree?.imageUrl;
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const langRef = useRef<HTMLDivElement>(null);
    
    const navBackground = theme?.surface || theme?.background || (isNightMode ? '#020617' : '#ffffff');
    const navIsDark = isDarkHex(navBackground, isNightMode);
    const navText = navIsDark ? '#f8fafc' : (theme?.text || '#0f172a');
    const navBorder = theme?.primary || (isNightMode ? '#1e293b' : '#e2e8f0');
    const navMuted = navIsDark ? '#bbf7d0' : (theme?.neutral || '#64748b');

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (langRef.current && !langRef.current.contains(event.target as Node)) setIsLangOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getTabStyle = (key: string) => {
        if (key === 'about') {
            if (activeTab === key) {
                return 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-900/20 font-bold ring-2 ring-amber-200 tracking-wide';
            }
            return navIsDark
                ? 'text-amber-100 bg-amber-500/15 border border-amber-300/50 hover:bg-amber-400 hover:text-slate-950 hover:border-amber-200 font-bold'
                : 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 hover:text-amber-900 font-bold';
        }
        if (activeTab === key) {
            const themes: any = { 
                dashboard: 'bg-indigo-600', visions: 'bg-amber-500', forest: 'bg-emerald-600', 
                pulses: 'bg-orange-600', events: 'bg-teal-600', observatory: 'bg-rose-600', inspiration: 'bg-indigo-600', about: 'bg-purple-600', communities: 'bg-teal-600', collab: 'bg-violet-600'
            };
            return `${themes[key] || 'bg-slate-700'} text-white shadow-lg shadow-black/20 font-bold tracking-wide`;
        }
        return navIsDark
            ? 'text-slate-300 hover:text-white hover:bg-white/10 font-medium'
            : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100 font-medium';
    }

    const getActiveTabColor = (tab: string) => {
        if (tab === 'visions' || tab === 'about') return theme?.accent;
        if (tab === 'pulses' || tab === 'events' || tab === 'inspiration') return theme?.secondary;
        return theme?.primary;
    };

    // Signed-out visitors get a slimmer menu: no Visions, Pulses, or Observatory.
    const signedIn = !!lightseed;
    const lightEarthTabs = signedIn ? ['forest', 'visions', 'events', 'pulses'] : ['forest', 'events'];
    // AI Collab (the node's intelligences) lives in the Intelligence group, visible to everyone.
    const intelligenceTabs = signedIn ? ['observatory', 'collab'] : ['collab'];
    const otherTabs = ['communities', 'about'];

    // Icon for each destination, used by the mobile menu tiles.
    const tabIcons: Record<string, React.ReactNode> = {
        forest: <Icons.Tree />,
        visions: <Icons.Eye />,
        events: <Icons.Loc />,
        pulses: <Icons.PulseDuo />,
        observatory: <Icons.Exchange />,
        communities: <Icons.Globe />,
        collab: <Icons.Users />,
        about: <Icons.Info />,
    };

    const getTabLabel = (tab: string) => {
        // For standard translation fallback, capitalize the first letter
        const fallback = tab.charAt(0).toUpperCase() + tab.slice(1);
        return t(tab as any) || fallback;
    };

    const getTabCount = (tab: string) => {
        if (tab === 'observatory') return pendingAlignmentsCount;
        return 0;
    };

    const NavTab = ({ tab }: { tab: string }) => {
        const count = getTabCount(tab);
        const button = (
            <button
                type="button"
                onClick={() => setTab(tab)}
                aria-describedby={tab === 'about' ? 'about-lin-tooltip' : undefined}
                className={`px-3 xl:px-4 py-2 rounded-full text-[10px] xl:text-xs transition-all flex items-center gap-1.5 whitespace-nowrap ${getTabStyle(tab)}`}
                // Always paint the active pill with the shared tabTone, so the pill and the list
                // page's header band underneath are literally the same pigment (one surface).
                style={activeTab === tab && tab !== 'about' ? { backgroundColor: tabTone(tab, theme) } : undefined}
            >
                <span>{getTabLabel(tab)}</span>
                {count > 0 && (
                    <span className="bg-red-500 text-white text-[9px] px-1.5 rounded-full min-w-[18px]">
                        {count}
                    </span>
                )}
            </button>
        );

        if (tab !== 'about') return button;

        return (
            <div className="relative group">
                {button}
                <div
                    id="about-lin-tooltip"
                    role="tooltip"
                    className={`pointer-events-none absolute right-0 top-[calc(100%+0.75rem)] z-50 w-80 max-w-[calc(100vw-2rem)] translate-y-1 rounded-xl border px-4 py-3 text-left text-xs leading-relaxed opacity-0 shadow-xl transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 ${
                        navIsDark
                            ? 'border-amber-200/30 bg-slate-950/95 text-amber-50 shadow-black/40 backdrop-blur'
                            : 'border-amber-200 bg-white/95 text-slate-700 shadow-amber-900/10 backdrop-blur'
                    }`}
                >
                    <span
                        className={`absolute -top-1.5 right-5 h-3 w-3 rotate-45 border-l border-t ${
                            navIsDark ? 'border-amber-200/30 bg-slate-950' : 'border-amber-200 bg-white'
                        }`}
                    />
                    {t('about_lin_description')}
                </div>
            </div>
        );
    };

    const NavGroup = ({ label, tabs }: { label: string, tabs: string[] }) => (
        <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-[0.2em] font-bold px-3 whitespace-nowrap" style={{ color: navMuted }}>{label}</span>
            <div className="flex items-center gap-1">
                {tabs.map(tab => <div key={tab}><NavTab tab={tab} /></div>)}
            </div>
        </div>
    );

    // Compact navigation tile used by the mobile menu (icon over a tiny label).
    const MobileNavTile = ({ tab, span = '', short = false, label }: { tab: string; span?: string; short?: boolean; label?: string }) => {
        const active = activeTab === tab;
        const count = getTabCount(tab);
        return (
            <button
                onClick={() => { setTab(tab); setIsMenuOpen(false); }}
                className={`relative flex flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-center transition-all ${span} ${short ? 'py-2' : 'min-h-[50px]'} ${
                    active ? 'text-white shadow-lg' : (navIsDark ? 'bg-white/5 text-slate-200 hover:bg-white/10' : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200/80')
                }`}
                style={active ? { backgroundColor: getActiveTabColor(tab) || navBorder } : undefined}
            >
                <span className="opacity-90 [&>svg]:h-4 [&>svg]:w-4">{tabIcons[tab]}</span>
                <span className="text-[8px] font-bold uppercase leading-none tracking-tight">{label ?? getTabLabel(tab)}</span>
                {count > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-black text-white">{count}</span>
                )}
            </button>
        );
    };

    // Wide quick-action button (Plant / Pulse / Vision) for the mobile menu's first row —
    // vertical so the label wraps to two lines, sized to match the nav tiles.
    const MobileActionTile = ({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: () => void; color: string }) => (
        <button
            onClick={() => { setIsMenuOpen(false); lightseed ? onClick() : onLogin(); }}
            className={`col-span-2 flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-center ${color} text-white shadow-lg`}
        >
            <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
            <span className="text-[8px] font-bold uppercase leading-[1.15] tracking-tight">{label}</span>
        </button>
    );

    return (
        <nav
            className={`sticky top-0 z-30 border-b ${isMenuOpen ? '' : 'shadow-sm'}`}
            style={{ backgroundColor: navBackground, borderColor: isMenuOpen ? 'rgba(251,191,36,0.6)' : navBorder, color: navText }}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-20 items-center">
                    <div className="flex items-center gap-3 cursor-pointer group shrink-0" onClick={() => setTab('dashboard')}>
                        <div className={`p-1 rounded-full group-hover:scale-110 transition-transform ${navIsDark ? 'bg-white' : 'bg-slate-50 border border-slate-200'}`} style={{ borderColor: navBorder }}>
                             {logoUrl ? <img src={logoUrl} className="w-8 h-8 rounded-full object-cover" alt="Logo" /> : <Logo width={32} height={32} />}
                        </div>
                        <span dir="ltr" className="hidden max-w-[160px] truncate font-light text-2xl lowercase tracking-wide sm:inline">{appName}</span>
                        {/* Mobile: the current list's name lives up here, next to the logo — the
                            page headers below carry no title, so this is the "where am I". */}
                        {activeTab !== 'dashboard' && !isMenuOpen && (
                            <span dir="auto" className="max-w-[40vw] truncate font-light text-xl tracking-wide sm:hidden" style={{ color: tabTone(activeTab, theme) }}>{getTabLabel(activeTab)}</span>
                        )}
                    </div>

                    {/* Mobile: night-mode + sign-out as circular icons next to the logo (only while the menu is open) */}
                    {lightseed && isMenuOpen && (
                        <div className="flex items-center gap-2 xl:hidden">
                            {onToggleNightMode && (
                                <button onClick={onToggleNightMode} title={isNightMode ? 'Light mode' : 'Night mode'} className={`rounded-full border p-2 transition-colors ${navIsDark ? 'bg-black/20 text-amber-300 hover:bg-black/30' : 'bg-white/70 text-slate-600 hover:bg-white'}`} style={{ borderColor: navBorder }}>
                                    {isNightMode ? <Icons.Sun /> : <Icons.Moon />}
                                </button>
                            )}
                            <button onClick={() => setShowLogoutConfirm(true)} title={t('sign_out')} className="rounded-full border border-red-400/50 bg-red-500/10 p-2 text-red-500 transition-colors hover:bg-red-500 hover:text-white">
                                <Icons.Exit />
                            </button>
                        </div>
                    )}

                    {/* Desktop Navigation Tabs */}
                    <div className="hidden xl:flex items-center gap-3 xl:gap-4 mx-2">
                        <NavGroup label={t('light_earth' as any)} tabs={lightEarthTabs} />
                        {intelligenceTabs.length > 0 && (
                            <>
                                <div className="w-px h-8 self-end mb-1" style={{ backgroundColor: navBorder }}></div>
                                <NavGroup label={t('intelligence' as any)} tabs={intelligenceTabs} />
                            </>
                        )}
                        <div className="w-px h-8 self-end mb-1" style={{ backgroundColor: navBorder }}></div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase tracking-[0.2em] font-bold px-3 whitespace-nowrap" style={{ color: navMuted }}>{t('network')}</span>
                            <div className="flex items-center gap-1">
                                {otherTabs.map(tab => <div key={tab}><NavTab tab={tab} /></div>)}
                            </div>
                        </div>
                    </div>

                    {/* Right Side UI Controls */}
                    <div className="flex items-center gap-2 md:gap-3 shrink-0">
                         {/* Language */}
                         <div className="relative" ref={langRef}>
                            <button
                                onClick={() => setIsLangOpen(!isLangOpen)}
                                className={`h-9 text-[10px] border rounded-full px-2.5 uppercase font-bold transition-colors flex items-center gap-1 ${navIsDark ? 'bg-black/20 hover:bg-black/30' : 'bg-white/70 hover:bg-white'}`}
                                style={{ borderColor: navBorder, color: navText }}
                            >
                                <Icons.Globe size={14} />
                                <span>{language}</span>
                            </button>
                            {isLangOpen && (
                                <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border py-2 z-50 text-slate-700">
                                    {languages.map(l => (
                                        <button key={l.code} onClick={() => { setLanguage(l.code as any); setIsLangOpen(false); }} className={`w-full text-left px-4 py-2 text-sm ${language === l.code ? 'bg-emerald-50 text-emerald-600 font-bold' : 'hover:bg-slate-50'}`}>
                                            {l.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                         </div>

                         {lightseed ? (
                            <>
                                {/* Direct messages — letter icon that glows green when there are unread messages */}
                                <button
                                    onClick={() => onOpenReachInbox?.()}
                                    title={t('direct_messages')}
                                    aria-label={t('direct_messages')}
                                    className={`relative inline-flex rounded-full border p-2 transition-all ${
                                        careAlertCount > 0
                                            ? 'border-sky-300 bg-sky-500/15 text-sky-500 shadow-[0_0_14px_rgba(14,165,233,0.7)] ring-1 ring-sky-300/70 animate-pulse'
                                            : (reachNotificationsCount > 0 || treeInviteCount > 0)
                                                ? 'border-emerald-300 bg-emerald-500/15 text-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.7)] ring-2 ring-emerald-300/70 animate-pulse'
                                                : (navIsDark ? 'bg-black/20 text-slate-200 hover:bg-black/30' : 'bg-white/70 text-slate-600 hover:bg-white')
                                    }`}
                                    style={(careAlertCount > 0 || reachNotificationsCount > 0 || treeInviteCount > 0) ? undefined : { borderColor: navBorder }}
                                >
                                    <Icons.Mail />
                                    {/* Watering needed — blue, top-left */}
                                    {careAlertCount > 0 && (
                                        <span title="A tree needs watering" className={`absolute -top-1 -left-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sky-500 px-1 text-[8px] font-black text-white ring-2 ${navIsDark ? 'ring-emerald-950' : 'ring-white'}`}>{careAlertCount > 9 ? '9+' : careAlertCount}</span>
                                    )}
                                    {/* Reaches — red, top-right */}
                                    {reachNotificationsCount > 0 && (
                                        <span className={`absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-black text-white ring-2 ${navIsDark ? 'ring-emerald-950' : 'ring-white'}`}>{reachNotificationsCount > 9 ? '9+' : reachNotificationsCount}</span>
                                    )}
                                    {/* Tree Circle invites — amber, bottom-right (marked separately) */}
                                    {treeInviteCount > 0 && (
                                        <span title={t('tree_circle_invitations')} className={`absolute -bottom-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[8px] font-black text-white ring-2 ${navIsDark ? 'ring-emerald-950' : 'ring-white'}`}>{treeInviteCount > 9 ? '9+' : treeInviteCount}</span>
                                    )}
                                </button>

                                {/* Avatar with profile link beneath it */}
                                <button onClick={onProfile} className="group flex flex-col items-center leading-none">
                                    <span className="relative">
                                        <img
                                            src={lightseed.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(lightseed.displayName || 'Visitor')}&background=random&color=fff`}
                                            className="w-9 h-9 rounded-full border-2 border-white/20 shadow-md group-hover:border-white transition-all object-cover"
                                            alt={lightseed.displayName || 'Profile'}
                                            referrerPolicy="no-referrer"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.onerror = null;
                                                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(lightseed.displayName || 'Visitor')}&background=random&color=fff`;
                                            }}
                                        />
                                        {/* DM unread is shown by the letter icon; here we only flag other notifications. */}
                                        {(pendingAlignmentsCount > 0 || dangerTreesCount > 0) && (
                                            <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 border-2 rounded-full ${navIsDark ? 'border-emerald-950' : 'border-white'}`}></span>
                                        )}
                                    </span>
                                    <span className="mt-1 text-[9px] font-bold uppercase tracking-wider transition-opacity group-hover:opacity-70" style={{ color: navMuted }}>{t('profile')}</span>
                                </button>

                                {/* Theme toggle */}
                                {onToggleNightMode && (
                                    <button
                                        onClick={onToggleNightMode}
                                        title={isNightMode ? 'Switch to light mode' : 'Switch to night mode'}
                                        className={`hidden xl:inline-flex rounded-full border p-2 transition-colors ${navIsDark ? 'bg-black/20 text-amber-300 hover:bg-black/30' : 'bg-white/70 text-slate-600 hover:bg-white'}`}
                                        style={{ borderColor: navBorder }}
                                    >
                                        {isNightMode ? <Icons.Sun /> : <Icons.Moon />}
                                    </button>
                                )}

                                {/* Exit — far right, with confirmation (desktop) */}
                                <button
                                    onClick={() => setShowLogoutConfirm(true)}
                                    title={t('sign_out')}
                                    className="hidden xl:inline-flex rounded-full border border-red-400/50 bg-red-500/10 p-2 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                                >
                                    <Icons.Exit />
                                </button>
                            </>
                         ) : (
                            <button onClick={onLogin} className="text-white px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shadow-lg transition-all active:scale-95" style={{ backgroundColor: theme?.primary || '#059669' }}>
                                {t('sign_in')}
                            </button>
                         )}

                         <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`xl:hidden rounded-full p-2 transition-all ${isMenuOpen ? 'border-2 border-amber-300 text-amber-500 shadow-[0_0_12px_rgba(251,191,36,0.55)]' : (navIsDark ? 'text-white hover:text-emerald-200' : 'text-slate-700 hover:text-slate-950')}`}>
                            {isMenuOpen ? <Icons.Close /> : <Icons.Menu />}
                         </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu — split into a top panel (actions + destinations) and a bottom
                panel (About + utilities). The page shows through the transparent middle;
                tapping there closes the menu. */}
            {isMenuOpen && (
                <div
                    className="xl:hidden fixed inset-x-0 top-20 bottom-0 z-[1100] flex flex-col justify-between gap-2 overflow-y-auto"
                    onClick={() => setIsMenuOpen(false)}
                >
                    {/* TOP PANEL */}
                    <div
                        onClick={e => e.stopPropagation()}
                        className="shrink-0 rounded-b-3xl border-t border-b border-amber-300/25 px-3 pb-3 pt-3 shadow-[0_22px_30px_-18px_rgba(251,191,36,0.5)] animate-in slide-in-from-top-4"
                        style={{ backgroundColor: navBackground, color: navText }}
                    >
                        {signedIn ? (
                          <>
                            {/* Row 1 — wide actions paired with their feeds (6 columns) */}
                            <div className="grid grid-cols-6 gap-1.5">
                                {activeTab === 'visions' ? (
                                    <MobileActionTile icon={<Icons.Plus />} label={t('create_vision')} onClick={onCreateVision} color="bg-amber-500" />
                                ) : (
                                    <MobileActionTile icon={<Icons.Tree />} label={t('plant_lifetree')} onClick={onPlant} color="bg-emerald-600" />
                                )}
                                <MobileNavTile tab="forest" />
                                <MobileActionTile icon={<Icons.Pulse />} label={t('emit_pulse')} onClick={onPulse} color="bg-sky-600" />
                                <MobileNavTile tab="pulses" />
                            </div>

                            {/* Row 2 — secondary destinations, short (matches the bottom row's height) */}
                            <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                                <MobileNavTile tab="visions" short />
                                <MobileNavTile tab="events" short />
                                <MobileNavTile tab="observatory" short label="Observe" />
                                <MobileNavTile tab="collab" short label="Collab" />
                                <MobileNavTile tab="communities" short label="Commune" />
                            </div>
                          </>
                        ) : (
                            /* Signed out: everything available fits one tight row (plant spans 2 → 6 cols). */
                            <div className="grid grid-cols-6 gap-1.5">
                                <MobileActionTile icon={<Icons.Tree />} label={t('plant_lifetree')} onClick={onPlant} color="bg-emerald-600" />
                                <MobileNavTile tab="forest" />
                                <MobileNavTile tab="events" />
                                <MobileNavTile tab="collab" label="Collab" />
                                <MobileNavTile tab="communities" label="Commune" />
                            </div>
                        )}
                    </div>

                    {/* BOTTOM PANEL */}
                    <div
                        onClick={e => e.stopPropagation()}
                        className="shrink-0 rounded-t-3xl border-t border-amber-300/70 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-22px_30px_-18px_rgba(251,191,36,0.5)] animate-in slide-in-from-bottom-4"
                        style={{ backgroundColor: navBackground, color: navText }}
                    >
                        {lightseed && reachNotificationsCount > 0 && (
                            <button
                                onClick={() => { onOpenReachInbox?.(); setIsMenuOpen(false); }}
                                className="mb-1.5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 py-2 text-xs font-bold text-red-600"
                            >
                                <span className="[&>svg]:h-4 [&>svg]:w-4"><Icons.Mail /></span>
                                <span>{reachNotificationsCount} new {reachNotificationsCount === 1 ? 'reach' : 'reaches'}</span>
                            </button>
                        )}

                        {/* Two buttons side by side: About the node · Profile page */}
                        <div className={`grid gap-2 ${lightseed ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            <button
                                onClick={() => { setTab('about'); setIsMenuOpen(false); }}
                                className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all ${
                                    activeTab === 'about'
                                        ? 'text-white shadow-lg'
                                        : (navIsDark ? 'border border-amber-300/50 bg-amber-500/10 text-amber-100' : 'border border-amber-200 bg-amber-50 text-amber-700')
                                }`}
                                style={activeTab === 'about' ? { backgroundColor: getActiveTabColor('about') || navBorder } : undefined}
                            >
                                <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]"><Icons.Info /></span>
                                <span>{t('about_the_node')}</span>
                            </button>

                            {lightseed && (
                                <button onClick={() => { onProfile(); setIsMenuOpen(false); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700">
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-200 bg-white">
                                        {activeTreeImage
                                            ? <img src={activeTreeImage} className="h-full w-full object-cover" alt="" referrerPolicy="no-referrer" />
                                            : <span className="text-emerald-500 [&>svg]:h-4 [&>svg]:w-4"><Icons.Tree /></span>}
                                    </span>
                                    <span>{t('profile_page')}</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showLogoutConfirm && (
                <Modal title={t('sign_out')} onClose={() => setShowLogoutConfirm(false)}>
                    <div className="space-y-5">
                        <p className="text-sm text-slate-600">Are you sure you want to sign out?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-sm transition-colors">{t('cancel')}</button>
                            <button onClick={() => { setShowLogoutConfirm(false); setIsMenuOpen(false); onLogout(); }} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-sm shadow-lg transition-colors flex items-center justify-center gap-2">
                                <Icons.Exit />
                                <span>{t('sign_out')}</span>
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </nav>
    );
};
