
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { Modal } from './ui/Modal';
import Logo from './Logo';


interface NavigationProps {
  lightseed: any;
  activeTab: string;
  setTab: (tab: string) => void;
  onPlant: () => void;
  onPulse: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onProfile: () => void;
  onCreateVision: () => void;
  pendingAlignmentsCount: number;
  myTreesCount: number;
  dangerTreesCount: number;
  reachNotificationsCount?: number;
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
    lightseed, 
    activeTab, 
    setTab, 
    onPlant, 
    onPulse, 
    onLogin, 
    onLogout, 
    onProfile, 
    onCreateVision, 
    pendingAlignmentsCount, 
    myTreesCount = 0, 
    dangerTreesCount = 0,
    reachNotificationsCount = 0,
    logoUrl,
    appName = '.seed',
    theme,
    isNightMode = false,
    onToggleNightMode,
    onOpenReachInbox
}: NavigationProps) => {
    const { t, language, setLanguage } = useLanguage();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const langRef = useRef<HTMLDivElement>(null);
    
    const hasNotification = pendingAlignmentsCount > 0 || dangerTreesCount > 0 || reachNotificationsCount > 0;
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
                pulses: 'bg-sky-600', events: 'bg-teal-600', observatory: 'bg-rose-600', inspiration: 'bg-indigo-600', about: 'bg-purple-600', communities: 'bg-teal-600'
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

    const lightEarthTabs = ['forest', 'visions', 'events', 'pulses'];
    const intelligenceTabs = ['observatory'];
    const otherTabs = ['communities', 'about'];

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
                className={`px-3 xl:px-4 py-2 rounded-full text-[10px] xl:text-xs transition-all flex items-center gap-1.5 ${getTabStyle(tab)}`}
                style={activeTab === tab && getActiveTabColor(tab) ? { backgroundColor: getActiveTabColor(tab) } : undefined}
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
            <span className="text-[9px] uppercase tracking-[0.2em] font-bold px-3" style={{ color: navMuted }}>{label}</span>
            <div className="flex items-center gap-1">
                {tabs.map(tab => <div key={tab}><NavTab tab={tab} /></div>)}
            </div>
        </div>
    );

    return (
        <nav
            className="sticky top-0 z-30 border-b shadow-sm"
            style={{ backgroundColor: navBackground, borderColor: navBorder, color: navText }}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-20 items-center">
                    <div className="flex items-center gap-3 cursor-pointer group shrink-0" onClick={() => setTab('dashboard')}>
                        <div className={`p-1 rounded-full group-hover:scale-110 transition-transform ${navIsDark ? 'bg-white' : 'bg-slate-50 border border-slate-200'}`} style={{ borderColor: navBorder }}>
                             {logoUrl ? <img src={logoUrl} className="w-8 h-8 rounded-full object-cover" alt="Logo" /> : <Logo width={32} height={32} />}
                        </div>
                        <span dir="ltr" className="hidden max-w-[160px] truncate font-light text-2xl lowercase tracking-wide sm:inline">{appName}</span>
                    </div>

                    {/* Desktop Navigation Tabs */}
                    <div className="hidden lg:flex items-center gap-6 xl:gap-8 mx-4">
                        <NavGroup label={t('light_earth' as any)} tabs={lightEarthTabs} />
                        <div className="w-px h-8 self-end mb-1" style={{ backgroundColor: navBorder }}></div>
                        <NavGroup label={t('intelligence' as any)} tabs={intelligenceTabs} />
                        <div className="w-px h-8 self-end mb-1" style={{ backgroundColor: navBorder }}></div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase tracking-[0.2em] font-bold px-3" style={{ color: navMuted }}>Network</span>
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
                                {/* Avatar with profile link beneath it */}
                                <button onClick={onProfile} className="group flex flex-col items-center leading-none">
                                    <span className="relative">
                                        <img
                                            src={lightseed.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(lightseed.displayName || 'User')}&background=random&color=fff`}
                                            className="w-9 h-9 rounded-full border-2 border-white/20 shadow-md group-hover:border-white transition-all object-cover"
                                            alt={lightseed.displayName || 'Profile'}
                                        />
                                        {reachNotificationsCount > 0 ? (
                                            <span className={`absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-black text-white ring-2 ${navIsDark ? 'ring-emerald-950' : 'ring-white'}`}>{reachNotificationsCount}</span>
                                        ) : hasNotification ? (
                                            <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 border-2 rounded-full ${navIsDark ? 'border-emerald-950' : 'border-white'}`}></span>
                                        ) : null}
                                    </span>
                                    <span className="mt-1 text-[9px] font-bold uppercase tracking-wider transition-opacity group-hover:opacity-70" style={{ color: navMuted }}>{t('profile')}</span>
                                </button>

                                {/* Theme toggle */}
                                {onToggleNightMode && (
                                    <button
                                        onClick={onToggleNightMode}
                                        title={isNightMode ? 'Switch to light mode' : 'Switch to night mode'}
                                        className={`hidden sm:inline-flex rounded-full border p-2 transition-colors ${navIsDark ? 'bg-black/20 text-amber-300 hover:bg-black/30' : 'bg-white/70 text-slate-600 hover:bg-white'}`}
                                        style={{ borderColor: navBorder }}
                                    >
                                        {isNightMode ? <Icons.Sun /> : <Icons.Moon />}
                                    </button>
                                )}

                                {/* Exit — far right, with confirmation */}
                                <button
                                    onClick={() => setShowLogoutConfirm(true)}
                                    title={t('sign_out')}
                                    className="hidden sm:inline-flex rounded-full border border-red-400/50 bg-red-500/10 p-2 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                                >
                                    <Icons.Exit />
                                </button>
                            </>
                         ) : (
                            <button onClick={onLogin} className="text-white px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shadow-lg transition-all active:scale-95" style={{ backgroundColor: theme?.primary || '#059669' }}>
                                {t('sign_in')}
                            </button>
                         )}

                         <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`lg:hidden p-2 transition-colors ${navIsDark ? 'text-white hover:text-emerald-200' : 'text-slate-700 hover:text-slate-950'}`}>
                            {isMenuOpen ? <Icons.Close /> : <Icons.Menu />}
                         </button>
                    </div>
                </div>
            </div>

            {/* Mobile Sidebar/Menu */}
            {isMenuOpen && (
                <div
                    className="lg:hidden fixed inset-x-0 top-20 bottom-0 border-t py-6 px-4 flex flex-col gap-6 overflow-y-auto animate-in slide-in-from-top-10 z-50 pb-24"
                    style={{ backgroundColor: navBackground, borderColor: navBorder, color: navText }}
                >
                    {lightseed && (
                        <div className="grid grid-cols-2 gap-3">
                            {activeTab === 'visions' ? (
                                <button onClick={() => { onCreateVision(); setIsMenuOpen(false); }} className="bg-amber-500 p-3 rounded-xl flex flex-row items-center justify-center gap-2 font-bold text-xs shadow-lg border border-amber-500/50 text-white">
                                    <Icons.Sparkles /> <span>{t('create_vision')}</span>
                                </button>
                            ) : (
                                <button onClick={() => { onPlant(); setIsMenuOpen(false); }} className="bg-emerald-600 p-3 rounded-xl flex flex-row items-center justify-center gap-2 font-bold text-xs shadow-lg border border-emerald-500/50">
                                    <Icons.Tree /> <span>{t('plant_lifetree')}</span>
                                </button>
                            )}
                            <button onClick={() => { onPulse(); setIsMenuOpen(false); }} className="bg-sky-600 p-3 rounded-xl flex flex-row items-center justify-center gap-2 font-bold text-xs shadow-lg border border-sky-500/50">
                                <Icons.HeartPulse /> <span>{t('emit_pulse')}</span>
                            </button>
                        </div>
                    )}
                    
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold px-4" style={{ color: navMuted }}>{t('light_earth' as any)}</h3>
                            {lightEarthTabs.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => { setTab(tab); setIsMenuOpen(false); }}
                                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium ${activeTab === tab ? 'text-white' : navIsDark ? 'hover:bg-white/10' : 'hover:bg-white/70'}`}
                                    style={activeTab === tab ? { backgroundColor: getActiveTabColor(tab) || navBorder } : { color: navText }}
                                >
                                    {getTabLabel(tab)}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold px-4" style={{ color: navMuted }}>{t('intelligence' as any)}</h3>
                            {intelligenceTabs.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => { setTab(tab); setIsMenuOpen(false); }}
                                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium flex justify-between items-center ${activeTab === tab ? 'text-white' : navIsDark ? 'hover:bg-white/10' : 'hover:bg-white/70'}`}
                                    style={activeTab === tab ? { backgroundColor: getActiveTabColor(tab) || navBorder } : { color: navText }}
                                >
                                    <span>{getTabLabel(tab)}</span>
                                    {getTabCount(tab) > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{getTabCount(tab)}</span>}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold px-4" style={{ color: navMuted }}>Network</h3>
                            {otherTabs.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => { setTab(tab); setIsMenuOpen(false); }}
                                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium ${tab === 'about' ? 'border border-amber-300/50' : ''} ${activeTab === tab ? 'text-white' : navIsDark ? 'hover:bg-white/10' : 'hover:bg-white/70'}`}
                                    style={activeTab === tab ? { backgroundColor: getActiveTabColor(tab) || navBorder } : { color: navText }}
                                >
                                    {getTabLabel(tab)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {lightseed && (
                        <div className="mt-4 space-y-2">
                            <button onClick={() => { onProfile(); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-all flex items-center justify-center gap-2">
                                 <Icons.FingerPrint />
                                 <span>{t('profile')}</span>
                            </button>
                            {onToggleNightMode && (
                                <button onClick={() => { onToggleNightMode(); }} className="w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2" style={{ color: navText, borderColor: navBorder, borderWidth: 1 }}>
                                    {isNightMode ? <Icons.Sun /> : <Icons.Moon />}
                                    <span>{isNightMode ? 'Light mode' : 'Night mode'}</span>
                                </button>
                            )}
                            <button onClick={() => { setIsMenuOpen(false); setShowLogoutConfirm(true); }} className="w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold text-red-500 border border-red-400/40 bg-red-500/10 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2">
                                 <Icons.Exit />
                                 <span>{t('sign_out')}</span>
                            </button>
                            {reachNotificationsCount > 0 && (
                                <button
                                    onClick={() => { onOpenReachInbox?.(); setIsMenuOpen(false); }}
                                    className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <Icons.Mail />
                                    <span>{reachNotificationsCount} new {reachNotificationsCount === 1 ? 'reach' : 'reaches'}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {showLogoutConfirm && (
                <Modal title={t('sign_out')} onClose={() => setShowLogoutConfirm(false)}>
                    <div className="space-y-5">
                        <p className="text-sm text-slate-600">Are you sure you want to sign out?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-sm transition-colors">{t('cancel')}</button>
                            <button onClick={() => { setShowLogoutConfirm(false); onLogout(); }} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-sm shadow-lg transition-colors flex items-center justify-center gap-2">
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
