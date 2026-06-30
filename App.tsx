
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  signInWithGoogle,
  logout,
  fetchPulses,
  fetchEventPulses,
  createEvent,
  updateEvent,
  fetchReachPulses,
  fetchMyReaches,
  listenToMyReaches,
  listenToReachesForTrees,
  mintPulse,
  fetchLifetrees,
  fetchAllLifetrees,
  plantLifetree,
  uploadBase64Image,
  validateLifetree,
  unvalidateLifetree,
  proposeAlignment,
  getPendingAlignments,
  acceptAlignment,
  fetchVisions,
  getLifetreeById,
  createVision,
  deleteLifetree,
  deleteVision,
  ensureGenesis,
  claimSuperAdmin,
  grantAdmin,
  revokeAdmin,
  getCommunityByDomain,
  listenToUserProfile,
  getPendingTreeInvites
} from './services/firebase';
import { findVisionSynergies } from './services/gemini';
import { setActiveIntelligenceId } from './services/intelligence';
import { type Pulse, type Lifetree, type Alignment, type Vision, type Community, type VisionSynergy, type ReachAudience } from './types';
import Logo from './components/Logo';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { useLifeseed } from './hooks/useLifeseed';
import { isHubDomain, useConfig } from './hooks/useConfig';
import { normalizeTheme } from './utils/theme';

// Components
import { Icons } from './components/ui/Icons';
import { Navigation } from './components/Navigation';
import { LifetreeCard } from './components/LifetreeCard';
import { ForestMap } from './components/ForestMap';
import { LifetreeDetail } from './components/LifetreeDetail';
import { VisionDetail } from './components/VisionDetail';
import { PulseDetail } from './components/PulseDetail';
import { queryableLevels, canEditEvent, pulseScope } from './src/domain/pulseVisibility';
import { passesForestFilter, canViewTree } from './src/domain/views/forest';
import { isWateringOverdue } from './src/domain/watering';
import { GrowthPlayerModal } from './components/GrowthPlayerModal';
import { LightseedProfile } from './components/LightseedProfile';
import { Dashboard } from './components/Dashboard';
import { Loading } from './components/ui/Loading';
import { ScrollChevrons } from './components/ui/ScrollChevrons';
import { Footer } from './components/ui/Footer';
import { FirstRunChecklist } from './components/FirstRunChecklist';
import { useOnboardingState } from './hooks/useOnboardingState';
import { useImageUpload } from './hooks/useImageUpload';
import { useForestFilters } from './hooks/useForestFilters';
import { useDashboardStats } from './hooks/useDashboardStats';
import { useObservatoryQuote } from './hooks/useObservatoryQuote';
import { useSuperAdminConsole } from './hooks/useSuperAdminConsole';
import { setChainLocked } from './src/domain/chain';
import { ForestPage } from './pages/ForestPage';
import { Partners } from './components/intelligence/Partners';
import { ObservatoryPage } from './pages/ObservatoryPage';
import { PulseFeedPage } from './pages/PulseFeedPage';
import { VisionsPage } from './pages/VisionsPage';
import { resonanceId } from './components/ResonancePanel';
import { LifeseedWidget } from './components/LifeseedWidget';
import { NewsletterAdmin } from './components/NewsletterAdmin';
import { CommunityList } from './components/CommunityList';
import { CommunityProfile } from './components/CommunityProfile';
import { DialogHost, showAlert, showConfirm } from './components/ui/Dialog';
import { isExplicitlyValidatedTree } from './utils/validation';

// Modals
import { PlantTreeModal } from './components/modals/PlantTreeModal';
import { AuthModal } from './components/modals/AuthModal';
import { EmitPulseModal } from './components/modals/EmitPulseModal';
import { EventModal } from './components/modals/EventModal';
import { CreateVisionModal } from './components/modals/CreateVisionModal';

const extractGpsFromImage = async (file: File): Promise<{latitude: number, longitude: number} | null> => {
    const EXIF = (await import('exif-js')).default;
    return new Promise((resolve) => {
        try {
            EXIF.getData(file as any, function(this: any) {
                const lat = EXIF.getTag(this, "GPSLatitude");
                const latRef = EXIF.getTag(this, "GPSLatitudeRef");
                const lng = EXIF.getTag(this, "GPSLongitude");
                const lngRef = EXIF.getTag(this, "GPSLongitudeRef");

                if (lat && latRef && lng && lngRef) {
                    const convertToDecimal = (gpsArr: any, ref: string) => {
                        const d = gpsArr[0].numerator / gpsArr[0].denominator;
                        const m = gpsArr[1].numerator / gpsArr[1].denominator;
                        const s = gpsArr[2].numerator / gpsArr[2].denominator;
                        let decimal = d + (m / 60) + (s / 3600);
                        if (ref === "S" || ref === "W") decimal = -decimal;
                        return decimal;
                    };

                    resolve({
                        latitude: convertToDecimal(lat, latRef),
                        longitude: convertToDecimal(lng, lngRef)
                    });
                } else {
                    resolve(null);
                }
            });
        } catch (e) {
            console.error("EXIF Error:", e);
            resolve(null);
        }
    });
};

const GDPRBanner = () => {
    const [visible, setVisible] = useState(false);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('lifeseed_gdpr');
        if (!consent) setVisible(true);
    }, []);

    const handleAccept = () => {
        if (!checked) return;
        localStorage.setItem('lifeseed_gdpr', 'true');
        setVisible(false);
    }

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 animate-in slide-in-from-bottom-full duration-500">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-xs text-slate-600 text-center md:text-left max-w-2xl">
                    We use cookies and local storage to ensure you get the best experience on lightseed. By continuing, you agree to our terms and privacy policy.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer select-none">
                        <input 
                            type="checkbox" 
                            checked={checked} 
                            onChange={e => setChecked(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="font-medium">I accept</span>
                    </label>
                    <button 
                        onClick={handleAccept} 
                        disabled={!checked}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-full text-xs font-bold transition-colors shadow-sm"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}

type ThemeModePreference = 'light' | 'dark' | null;

// The full-screen overlay every detail view (tree / vision / event / community) scrolls inside.
// Module-scope so it keeps a stable identity (an inline definition remounts its subtree — and
// resets scroll — on every parent render).
const DetailWrapper = ({ children }: { children?: React.ReactNode }) => (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-900/90 backdrop-blur-sm">
        {children}
    </div>
);

const AppContent = () => {
    const { t } = useLanguage();
    const { lightseed, myTrees, guardedTrees, activeTree, defaultTreeId, setDefaultTree, isAdmin, isSuperAdmin, superAdminExists, loading: authLoading, refreshTrees } = useLifeseed();
    // The set of trees the signed-in user guards (the LIN, via guardian links) — passed to cards
    // so a card can show its guardian affordance without a per-card read.
    const guardedTreeIds = useMemo(() => new Set(guardedTrees.map(t => t.id)), [guardedTrees]);
    const onboarding = useOnboardingState(lightseed?.uid);
    const [tab, setTab] = useState('dashboard');
    const [viewMode, setViewMode] = useState<'grid' | 'map'>('map');
    const [data, setData] = useState<any[]>([]);
    const [alignments, setAlignments] = useState<Alignment[]>([]);
    const [selectedTree, setSelectedTree] = useState<Lifetree | null>(null);
    const [selectedVision, setSelectedVision] = useState<Vision | null>(null);
    const [selectedPulse, setSelectedPulse] = useState<Pulse | null>(null);
    // Bumped whenever we finish touching a tree (guardianship, edits) so the map re-reads it.
    const [mapRefreshKey, setMapRefreshKey] = useState(0);
    const [editingEvent, setEditingEvent] = useState<Pulse | null>(null);
    const [dashboardEvents, setDashboardEvents] = useState<Pulse[]>([]);
    // The Observatory's oracle quote (moved out of the dashboard card into the page header).
    const { observatoryQuote, quoteCopied: obsQuoteCopied, copyQuote: copyObservatoryQuote } = useObservatoryQuote(tab);
    const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
    const [reachTree, setReachTree] = useState<Lifetree | null>(null);
    // Preselected audience for a requested reach — 'guardians' when opened from a danger alert.
    const [reachAudience, setReachAudience] = useState<ReachAudience | undefined>(undefined);
    const [reachOpenSignal, setReachOpenSignal] = useState(0);
    const [unreadReaches, setUnreadReaches] = useState(0);
    const [pendingTreeInvites, setPendingTreeInvites] = useState(0);
    const [hostCommunity, setHostCommunity] = useState<Community | null>(null);
    // The lightseed community is the default "About" page when this node has none of its own.
    const [defaultCommunity, setDefaultCommunity] = useState<Community | null>(null);
    // Superadmin "switch to community view" — when set, the whole shell (theme, logo,
    // name, About page) renders as if this were the host community. Cleared via "Exit community".
    const [impersonatedCommunity, setImpersonatedCommunity] = useState<Community | null>(null);
    const [personalSiteTheme, setPersonalSiteTheme] = useState<any>(null);
    const [preferredIntelligenceId, setPreferredIntelligenceId] = useState<string | undefined>(undefined);
    const [personalSiteLogoUrl, setPersonalSiteLogoUrl] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Stats State for Dashboard
    const stats = useDashboardStats(lightseed, tab);
    
    // Pagination State
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const forestSentinelRef = useRef<HTMLDivElement>(null);

    // UI State
    const [showAuthModal, setShowAuthModal] = useState(false);
    // An ?invite=<token> link opens the join flow with a locked email.
    const inviteParam = useMemo(() => new URLSearchParams(window.location.search).get('invite') || undefined, []);

    // A ?tree=<id> share link opens that tree's page on load.
    useEffect(() => {
        const id = new URLSearchParams(window.location.search).get('tree');
        if (!id) return;
        getLifetreeById(id).then(tr => { if (tr) setSelectedTree(tr); }).catch(() => {});
    }, []);

    const [showPlantModal, setShowPlantModal] = useState(false);
    // How the plant modal should open: optionally straight to a type's plant step
    // (e.g. the "Guard Tree" button jumps past the type selection).
    const [plantInit, setPlantInit] = useState<{ type?: 'LIFETREE' | 'GUARDED'; step?: number }>({});
    const openPlant = (init: { type?: 'LIFETREE' | 'GUARDED'; step?: number } = {}) => {
        setPlantInit(init);
        setShowPlantModal(true);
    };
    const [showPulseModal, setShowPulseModal] = useState(false);
    // When growing from a specific tree's page, the pulse modal targets THAT tree (not the
    // active one). Reset to null for the generic "emit pulse" entry points.
    const [pulseTargetTree, setPulseTargetTree] = useState<Lifetree | null>(null);
    const openPulseModal = (target: Lifetree | null = null) => { setPulseTargetTree(target); setShowPulseModal(true); };
    const [showEventModal, setShowEventModal] = useState(false);
    const [showVisionModal, setShowVisionModal] = useState(false);
    const [showGrowthPlayer, setShowGrowthPlayer] = useState<string | null>(null);
    const [matchCandidate, setMatchCandidate] = useState<Pulse | null>(null);
    const { uploading, handleImageUpload } = useImageUpload();
    const { showNatureTrees, setShowNatureTrees, showUserTrees, setShowUserTrees, showValidatedTrees, setShowValidatedTrees } = useForestFilters();

    // AI Synergy State
    const [synergies, setSynergies] = useState<VisionSynergy[]>([]);
    const [isAnalyzingSynergy, setIsAnalyzingSynergy] = useState(false);
    const [lastSynergyAt, setLastSynergyAt] = useState(0); // ms of the last analysis (cost gate)
    const [favoriteResonances, setFavoriteResonances] = useState<VisionSynergy[]>([]);
    const favoriteResonanceIds = useMemo(() => new Set(favoriteResonances.map(resonanceId)), [favoriteResonances]);

    const toggleFavoriteResonance = (s: VisionSynergy) => {
        setFavoriteResonances(prev => {
            const id = resonanceId(s);
            const next = prev.some(f => resonanceId(f) === id) ? prev.filter(f => resonanceId(f) !== id) : [...prev, s];
            try { localStorage.setItem('resonance_favorites_v1', JSON.stringify(next)); } catch {}
            return next;
        });
    };

    const config = useConfig(impersonatedCommunity || hostCommunity);
    const [themeModePreference, setThemeModePreference] = useState<ThemeModePreference>(() => {
        const savedMode = localStorage.getItem('lifeseed_theme_mode');
        if (savedMode === 'light' || savedMode === 'dark') return savedMode;

        const legacyNightMode = localStorage.getItem('lifeseed_night_mode');
        if (legacyNightMode === 'true') return 'dark';
        if (legacyNightMode === 'false') return 'light';

        return null;
    });
    // While viewing as a community, the community's own branding wins over the
    // signed-in user's personal site theme/logo.
    const configuredTheme = !impersonatedCommunity && lightseed && personalSiteTheme
        ? normalizeTheme(personalSiteTheme, config.theme)
        : config.theme;
    const configuredLogoUrl = !impersonatedCommunity && lightseed && personalSiteLogoUrl && isHubDomain(window.location.hostname)
        ? personalSiteLogoUrl
        : config.logoUrl;
    const effectiveThemeMode = themeModePreference || configuredTheme.mode || 'light';
    const effectiveTheme = effectiveThemeMode === 'dark' ? {
        ...configuredTheme,
        background: '#020617',
        surface: '#0f172a',
        text: '#e2e8f0',
        neutral: '#cbd5e1',
        mode: 'dark' as const,
    } : {
        ...configuredTheme,
        background: configuredTheme.mode === 'dark' ? '#ffffff' : configuredTheme.background,
        surface: configuredTheme.mode === 'dark' ? '#ffffff' : (configuredTheme.surface || '#ffffff'),
        text: configuredTheme.mode === 'dark' ? '#0f172a' : (configuredTheme.text || '#0f172a'),
        neutral: configuredTheme.mode === 'dark' ? '#334155' : configuredTheme.neutral,
        mode: 'light' as const,
    };
    const effectiveIsDark = effectiveTheme.mode === 'dark';

    useEffect(() => {
        const root = document.documentElement;
        if (effectiveTheme) {
            root.style.setProperty('--color-primary', effectiveTheme.primary);
            root.style.setProperty('--color-secondary', effectiveTheme.secondary);
            root.style.setProperty('--color-accent', effectiveTheme.accent);
            root.style.setProperty('--color-background', effectiveTheme.background);
            root.style.setProperty('--color-surface', effectiveTheme.surface || '#ffffff');
            root.style.setProperty('--color-text', effectiveTheme.text || '#0f172a');
            root.dataset.mode = effectiveIsDark ? 'dark' : 'light';
        }
    }, [effectiveTheme.primary, effectiveTheme.secondary, effectiveTheme.accent, effectiveTheme.background, effectiveTheme.surface, effectiveTheme.text, effectiveIsDark]);

    useEffect(() => {
        if (localStorage.getItem('lifeseed_theme_mode') === null && localStorage.getItem('lifeseed_night_mode') === null) {
            setThemeModePreference(null);
        }
    }, [configuredTheme.mode]);

    const toggleNightMode = () => {
        setThemeModePreference(prev => {
            const currentMode = prev || configuredTheme.mode || 'light';
            const next = currentMode === 'dark' ? 'light' : 'dark';
            localStorage.setItem('lifeseed_theme_mode', next);
            localStorage.setItem('lifeseed_night_mode', String(next === 'dark'));
            return next;
        });
    };

    const bgHex = effectiveTheme.background;
    const bgEncoded = bgHex.replace('#', '%23');
    const patternStrokeEncoded = effectiveIsDark ? '%23fff' : '%23000';
    const patternStrokeOpacity = effectiveIsDark ? '.3' : '.14';
    const patternInnerOpacity = effectiveIsDark ? '.4' : '.18';
    
    const svgBackground = `data:image/svg+xml,%3Csvg width='332.5537705' height='320' xmlns='http://www.w3.org/2000/svg'%3E%3Cstyle%3E .outerCircle %7B fill: ${bgEncoded}; stroke: ${patternStrokeEncoded}; stroke-width: 7; stroke-opacity: ${patternStrokeOpacity}; %7D .circle %7B fill: none; stroke: ${patternStrokeEncoded}; stroke-width: .3; stroke-opacity: ${patternStrokeOpacity}; %7D .innerCircle %7B fill: ${bgEncoded}; stroke: ${patternStrokeEncoded}; stroke-width: 1.7; stroke-opacity: ${patternInnerOpacity}; %7D %3C/style%3E%3Crect width='100%25' height='100%25' fill='${bgEncoded}'/%3E%3Cdefs%3E%3CclipPath id='clean'%3E%3Crect width='332.5537705' height='320' /%3E%3C/clipPath%3E%3C/defs%3E%3Cg%3E%3Ccircle cx='-38.2768775' cy='-32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='96' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='160' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='224' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='288' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='352' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='0' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='64' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='128' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='192' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='256' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='320' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='-32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='96' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='160' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='224' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='288' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='352' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='0' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='64' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='128' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='192' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='256' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='320' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='-32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='96' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='160' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='224' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='288' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='352' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='0' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='64' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='128' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='192' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='256' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='320' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='-32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='96' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='160' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='224' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='288' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='352' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='0' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='64' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='128' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='192' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='256' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='320' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='96' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='160' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='64' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='128' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='192' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='96' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='160' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='288' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3C/g%3E%3C/svg%3E`;

    const backgroundStyle = {
        backgroundColor: bgHex,
        backgroundImage: `url("${svgBackground}")`,
        backgroundSize: '108px', 
        backgroundRepeat: 'repeat',
        backgroundPosition: 'center center',
        backgroundAttachment: 'fixed',
    };


    useEffect(() => {
        if (!lightseed) {
            setPersonalSiteTheme(null);
            setPersonalSiteLogoUrl('');
            setActiveIntelligenceId(undefined);
            return;
        }

        return listenToUserProfile(lightseed.uid, (profile) => {
            setPersonalSiteTheme(profile?.siteTheme || null);
            setPersonalSiteLogoUrl(profile?.siteLogoUrl || '');
            setPreferredIntelligenceId(profile?.preferredIntelligenceId || undefined);
            // Mirror the choice so stateless AI helpers route through it everywhere.
            setActiveIntelligenceId(profile?.preferredIntelligenceId || undefined);
        });
    }, [lightseed?.uid]);

    // Live unread-reach count powering the red envelope indicator in the nav.
    // Two listeners: reaches addressed to me (recipientUid) AND reaches aimed at any
    // of my trees (reachTreeId). The latter is a safety net so I'm still notified when
    // a send didn't capture recipientUid. Results are merged and de-duplicated by id.
    const myTreeIdsKey = myTrees.map((tree: Lifetree) => tree.id).join(',');
    useEffect(() => {
        if (!lightseed) {
            setUnreadReaches(0);
            return;
        }
        const uid = lightseed.uid;
        const byRecipient = new Map<string, Pulse>();
        const byTree = new Map<string, Pulse>();
        const recompute = () => {
            const merged = new Map<string, Pulse>([...byRecipient, ...byTree]);
            let unread = 0;
            merged.forEach(p => {
                if (p.authorId !== uid && !(p.seenBy || []).includes(uid)) unread++;
            });
            setUnreadReaches(unread);
        };
        const unsubRecipient = listenToMyReaches(uid, (pulses) => {
            byRecipient.clear();
            pulses.forEach(p => byRecipient.set(p.id, p));
            recompute();
        });
        const unsubTrees = listenToReachesForTrees(myTreeIdsKey ? myTreeIdsKey.split(',') : [], (pulses) => {
            byTree.clear();
            pulses.forEach(p => byTree.set(p.id, p));
            recompute();
        });
        return () => { unsubRecipient(); unsubTrees(); };
    }, [lightseed?.uid, myTreeIdsKey]);

    useEffect(() => { 
        if (tab !== 'dashboard') {
            loadContent(true);
        }
        ensureGenesis();
        // Fetch host community
        const domain = window.location.hostname;
        getCommunityByDomain(domain).then(setHostCommunity);
    }, [tab, lightseed, viewMode]);

    // Load the lightseed community once as the default About page fallback.
    useEffect(() => {
        getCommunityByDomain('lightseed.online').then(setDefaultCommunity).catch(() => {});
    }, []);

    // Pending Tree Circle invites — surfaced (separately) on the DM button.
    useEffect(() => {
        if (lightseed?.uid) getPendingTreeInvites(lightseed.uid).then(invs => setPendingTreeInvites(invs.length)).catch(() => {});
        else setPendingTreeInvites(0);
    }, [lightseed?.uid, tab]);

    // Arriving on an invite link, signed out, opens the join flow.
    useEffect(() => {
        if (inviteParam && !lightseed && !authLoading) setShowAuthModal(true);
    }, [inviteParam, lightseed, authLoading]);

    // Seed the Intelligence Commons (default personas + Gemini Oracle) once a super-admin
    // is known. Idempotent and gated by Firestore rules.
    useSuperAdminConsole(isSuperAdmin, lightseed?.uid);

    // Sync the chain-lock flag from the node's community ("big red stamp"). Off until a node sets it.
    useEffect(() => {
        setChainLocked(!!(impersonatedCommunity || hostCommunity)?.chainLocked);
    }, [impersonatedCommunity, hostCommunity]);

    // Events for the logged-in home carousel — visibility-scoped to this viewer + node.
    useEffect(() => {
        if (!lightseed) { setDashboardEvents([]); return; }
        const isDevHost = /localhost|127\.0\.0\.1|^192\.168\.|\.local$/.test(window.location.hostname);
        const currentDomain = (isDevHost && isSuperAdmin) ? 'lightseed.online' : window.location.hostname;
        const levels = queryableLevels({ uid: lightseed.uid, isStaff: isSuperAdmin || isAdmin });
        fetchEventPulses(undefined, currentDomain, levels).then(r => setDashboardEvents(r.items)).catch(() => {});
    }, [lightseed?.uid, isSuperAdmin, isAdmin]);

    // --- Browser back button: close overlays LAYER BY LAYER instead of leaving the app. ---
    // No router here, so we push one history entry per open overlay layer. Back pops ONE entry
    // and closes only the topmost layer (e.g. the growth player on top of a tree detail, then
    // the detail). Closing via the UI consumes our own entries silently. With nothing of ours
    // open, Back behaves normally and leaves the page.
    // Ordered base-first; the LAST open key is the topmost layer (closed first on Back).
    const openKeys = ([
        selectedTree && 'tree',
        selectedCommunity && 'community',
        selectedVision && 'vision',
        selectedPulse && 'pulse',
        showAuthModal && 'auth',
        showPlantModal && 'plant',
        showPulseModal && 'pulseModal',
        showEventModal && 'eventModal',
        showVisionModal && 'visionModal',
        editingEvent && 'editingEvent',     // nested on a pulse detail
        showGrowthPlayer && 'growthPlayer', // nested on a tree detail (or standalone)
    ].filter(Boolean) as string[]);
    const openKeysRef = useRef<string[]>([]);
    openKeysRef.current = openKeys;
    // We keep at most ONE history entry while any overlay is open ("armed"). Each Back closes
    // the topmost layer and, if layers remain, re-pushes one entry so the next Back is captured
    // too. Using only pushState + back() (never go(-n)) sidesteps the "one popstate per go()"
    // browser quirk.
    const armedRef = useRef(false);
    const skipNextPopRef = useRef(false);
    const openKeysSig = openKeys.join('|');
    useEffect(() => {
        const count = openKeys.length;
        if (count > 0 && !armedRef.current) {
            window.history.pushState({ lsOverlay: true }, '');
            armedRef.current = true;
        } else if (count === 0 && armedRef.current) {
            // All overlays closed via the UI — silently consume our history entry.
            armedRef.current = false;
            skipNextPopRef.current = true;
            window.history.back();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openKeysSig]);
    useEffect(() => {
        const closeKey = (k: string) => {
            switch (k) {
                case 'tree': setSelectedTree(null); break;
                case 'community': setSelectedCommunity(null); break;
                case 'vision': setSelectedVision(null); break;
                case 'pulse': setSelectedPulse(null); break;
                case 'auth': setShowAuthModal(false); break;
                case 'plant': setShowPlantModal(false); break;
                case 'pulseModal': setShowPulseModal(false); break;
                case 'eventModal': setShowEventModal(false); break;
                case 'visionModal': setShowVisionModal(false); break;
                case 'editingEvent': setEditingEvent(null); break;
                case 'growthPlayer': setShowGrowthPlayer(null); break;
            }
        };
        const onPop = () => {
            if (skipNextPopRef.current) { skipNextPopRef.current = false; return; } // our own back()
            const keys = openKeysRef.current;
            if (keys.length === 0) { armedRef.current = false; return; } // nothing of ours → let the browser go
            closeKey(keys[keys.length - 1]); // close ONLY the topmost layer
            if (keys.length - 1 > 0) {
                window.history.pushState({ lsOverlay: true }, ''); // layers remain → re-arm for the next Back
            } else {
                armedRef.current = false;
            }
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
                if (!loadingMore && hasMore && tab !== 'dashboard' && tab !== 'observatory' && tab !== 'inspiration' && tab !== 'profile' && tab !== 'about' && tab !== 'forest') {
                    loadContent(false);
                }
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [loadingMore, hasMore, tab, lastDoc]);

    // IntersectionObserver sentinel for forest list view
    useEffect(() => {
        if (tab !== 'forest' || viewMode !== 'grid') return;
        const sentinel = forestSentinelRef.current;
        if (!sentinel) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore) {
                    loadContent(false);
                }
            },
            { rootMargin: '200px' }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [tab, viewMode, hasMore, loadingMore, lastDoc]);

    const loadContent = async (reset = false) => {
        if (reset) {
            setData([]);
            setLastDoc(null);
            setHasMore(true);
            // Note: synergies are intentionally NOT cleared here — they're tab-independent and
            // cached, so they remain visible in the Observatory after analysing in Visions.
        }

        if (!reset && !hasMore) return;
        
        setLoadingMore(true);
        const currentLastDoc = reset ? undefined : lastDoc;
        const isDevHost = /localhost|127\.0\.0\.1|^192\.168\.|\.local$/.test(window.location.hostname);
        // On dev hosts a superadmin sees the whole network (no domain scoping).
        const currentDomain = (isDevHost && isSuperAdmin) ? 'lightseed.online' : window.location.hostname;
        // Broad feeds carry no scope, so this resolves to public (+ node when signed in; all
        // but private for staff) — keeping the query to docs the rules will allow.
        const feedLevels = queryableLevels({ uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin });
        // Tree visibility levels this viewer may query (null = staff, no filter).
        const treeLevels: string[] | null = (isSuperAdmin || isAdmin) ? null : (lightseed ? ['public', 'node'] : ['public']);

        try {
            if (tab === 'forest') {
                if (viewMode === 'map') {
                    // The map shows the whole forest at once (no pagination) so every tree appears.
                    const all = await fetchAllLifetrees(currentDomain, lightseed?.uid, treeLevels);
                    setData(all);
                    setLastDoc(null);
                    setHasMore(false);
                } else {
                    const res = await fetchLifetrees(currentLastDoc, currentDomain, lightseed?.uid, treeLevels);
                    setData(prev => {
                        const newItems = res.items;
                        if (reset) return newItems;
                        // Deduplicate items based on ID to prevent visual duplicates
                        const existingIds = new Set(prev.map(p => p.id));
                        return [...prev, ...newItems.filter(i => !existingIds.has(i.id))];
                    });
                    setLastDoc(res.lastDoc);
                    setHasMore(!!res.lastDoc);
                }
            }
            else if (tab === 'pulses') {
                const res = await fetchPulses(currentLastDoc, currentDomain, feedLevels);
                setData(prev => {
                    const newItems = res.items;
                    if (reset) return newItems;
                    const existingIds = new Set(prev.map(p => p.id));
                    return [...prev, ...newItems.filter(i => !existingIds.has(i.id))];
                });
                setLastDoc(res.lastDoc);
                setHasMore(!!res.lastDoc);
            }
            else if (tab === 'events') {
                const res = await fetchEventPulses(currentLastDoc, currentDomain, feedLevels);
                setData(prev => {
                    const newItems = res.items;
                    if (reset) return newItems;
                    const existingIds = new Set(prev.map(p => p.id));
                    return [...prev, ...newItems.filter(i => !existingIds.has(i.id))];
                });
                setLastDoc(res.lastDoc);
                setHasMore(!!res.lastDoc);
            }
            else if (tab === 'inspiration') {
                const res = await fetchReachPulses(currentLastDoc, currentDomain, feedLevels);
                setData(prev => {
                    const newItems = res.items;
                    if (reset) return newItems;
                    const existingIds = new Set(prev.map(p => p.id));
                    return [...prev, ...newItems.filter(i => !existingIds.has(i.id))];
                });
                setLastDoc(res.lastDoc);
                setHasMore(!!res.lastDoc);
            }
            else if (tab === 'visions') {
                const res = await fetchVisions(currentLastDoc, currentDomain);
                setData(prev => {
                    const newItems = res.items;
                    if (reset) return newItems;
                    const existingIds = new Set(prev.map(p => p.id));
                    return [...prev, ...newItems.filter(i => !existingIds.has(i.id))];
                });
                setLastDoc(res.lastDoc);
                setHasMore(!!res.lastDoc);
            }
            else if (tab === 'observatory' && lightseed) {
                 const res = await getPendingAlignments(lightseed.uid);
                 setAlignments(res);
            }
        } catch(e) {
            console.error("Load Content Error:", e);
        }
        setLoadingMore(false);
    };

    // A stable fingerprint of a vision set, so a cached result is tied to its visions.
    const synergyKey = (items: any[]) => items.map(v => v.id).sort().join(',');

    // Resonance refreshes once a week for members; admins have no limit. The whole point is
    // to protect the AI bill (each analysis spends the reader's key — or the node's).
    const SYNERGY_COOLDOWN = 7 * 24 * 3600 * 1000;
    const isStaff = isAdmin || isSuperAdmin;
    const synergyCooldownLeft = lastSynergyAt ? SYNERGY_COOLDOWN - (Date.now() - lastSynergyAt) : 0;
    const canRefreshResonance = isStaff || synergyCooldownLeft <= 0;

    // The single analysis path: gate → fetch visions → analyse → cache. Callers supply how
    // to get the visions (the current tab's list, or a fresh network fetch from Observatory).
    const runResonance = async (getVisions: () => Promise<any[]>) => {
        if (!canRefreshResonance) {
            const days = Math.max(1, Math.ceil(synergyCooldownLeft / (24 * 3600 * 1000)));
            showAlert(`Resonance refreshes once a week — about ${days} more day${days === 1 ? '' : 's'} to go.`);
            return;
        }
        setIsAnalyzingSynergy(true);
        try {
            const visions = await getVisions();
            if (visions.length < 2) { showAlert('At least two visions are needed to find resonance.'); setIsAnalyzingSynergy(false); return; }
            // Label each vision by its TREE name (visions are often auto-titled "Root Vision"),
            // so resonances read tree-to-tree rather than "Root Vision + Root Vision".
            const treeIds = Array.from(new Set(visions.map((v: any) => v.lifetreeId).filter(Boolean)));
            const treeInfo = new Map<string, { name?: string; place?: string }>();
            await Promise.all(treeIds.map(async (tid: string) => {
                try { const tr = await getLifetreeById(tid); if (tr) treeInfo.set(tid, { name: tr.name, place: (tr as any).locationName }); } catch {}
            }));
            const labeled = visions.map((v: any) => {
                const tid = v.lifetreeId;
                const info = tid ? treeInfo.get(tid) : undefined;
                const generic = !v.title || v.title.trim().toLowerCase() === 'root vision';
                // place + vision are the two bases of the resonance analysis.
                return { ...v, title: info?.name || (generic ? 'A vision' : v.title), place: info?.place || '' };
            });
            // Map the labels back to tree ids so a conversation can be started from a resonance.
            const treeIdByName = new Map<string, string>();
            labeled.forEach((v: any) => { const tid = v.lifetreeId; if (tid && v.title) treeIdByName.set(v.title.trim().toLowerCase(), tid); });
            const results = (await findVisionSynergies(labeled, preferredIntelligenceId)).map(r => ({
                ...r,
                tree1Id: treeIdByName.get((r.vision1Title || '').trim().toLowerCase()),
                tree2Id: treeIdByName.get((r.vision2Title || '').trim().toLowerCase()),
            }));
            setSynergies(results);
            const at = Date.now();
            setLastSynergyAt(at);
            // Cache so the resonances survive reloads (and feed the Observatory) without re-spending.
            try { localStorage.setItem('synergy_cache_v1', JSON.stringify({ key: synergyKey(visions), at, results })); } catch {}
            if (results.length === 0) showAlert('No clear resonances surfaced this time — try again as more visions grow.');
        } catch (e) {
            console.error(e);
            showAlert('Synergy analysis failed. Try again later.');
        }
        setIsAnalyzingSynergy(false);
    };

    const handleAnalyzeSynergy = () => runResonance(async () => data);
    const refreshResonanceObservatory = () => runResonance(async () => (await fetchVisions()).items);

    // Start a conversation with a resonant tree — resolve it, then open the reach thread.
    const reachResonantTree = async (treeId: string) => {
        try { const tree = await getLifetreeById(treeId); if (tree) openReach(tree); }
        catch { showAlert('Could not open a conversation with that tree.'); }
    };

    // Hydrate cached resonances on load (any tab) so the Observatory and Visions tab both
    // show the last result, and the weekly cooldown is known.
    useEffect(() => {
        try {
            const cached = JSON.parse(localStorage.getItem('synergy_cache_v1') || 'null');
            if (cached) {
                if (Array.isArray(cached.results)) setSynergies(cached.results);
                if (cached.at) setLastSynergyAt(cached.at);
            }
            const favs = JSON.parse(localStorage.getItem('resonance_favorites_v1') || 'null');
            if (Array.isArray(favs)) setFavoriteResonances(favs);
        } catch {}
    }, []);

    const handleTreeUpdate = (treeId: string, updates: any) => {
        setData(prev => prev.map(item => item.id === treeId ? { ...item, ...updates } : item));
        if (selectedTree?.id === treeId) {
            setSelectedTree(prev => prev ? { ...prev, ...updates } : null);
        }
        refreshTrees();
    };

    const openReach = (tree: Lifetree | null, audience?: ReachAudience) => {
        setSelectedTree(null);
        setReachTree(tree);
        setReachAudience(audience);
        setReachOpenSignal(s => s + 1);
        setTab('profile');
    };

    // Jump to the profile's Direct Messages page (renamed from "Inspiration").
    // reachOpenSignal tells LightseedProfile to switch to its reaches subtab.
    const openDirectMessages = () => {
        setSelectedTree(null);
        setSelectedVision(null);
        setSelectedPulse(null);
        setSelectedCommunity(null);
        setReachTree(null);
        setReachAudience(undefined);
        setReachOpenSignal(s => s + 1);
        setTab('profile');
    };

    
    const handleQuickSnap = async (treeId: string, file: File) => {
        if (!lightseed) return;
        try {
            const url = await handleImageUpload(file, `users/${lightseed.uid}/growth/${treeId}/${Date.now()}`);
            await mintPulse({
                lifetreeId: treeId,
                type: 'tree_growth',
                title: 'Growth Snapshot',
                body: `Snapped on ${new Date().toLocaleDateString()}`,
                imageUrl: url,
                authorId: lightseed.uid,
                authorName: lightseed.displayName || "Soul",
                authorPhoto: lightseed.photoURL || undefined,
            });
            loadContent(true); 
        } catch (e: any) {
            console.error("Quick Snap Error:", e);
            showAlert("Error taking picture: " + e.message);
        }
    }

    // After a tree growth mints, reflect the new latest image immediately (the open tree
    // page + the forest), without waiting for a full reload round-trip.
    const handleTreeGrown = (treeId: string, imageUrl?: string) => {
        if (imageUrl) {
            setSelectedTree(prev => (prev && prev.id === treeId
                ? { ...prev, latestGrowthUrl: imageUrl, blockHeight: (prev.blockHeight || 0) + 1 }
                : prev));
        }
        refreshTrees();
        loadContent(true);
    };

    const handleDeleteTree = async (treeId: string) => {
        if (!(await showConfirm("Are you sure you want to delete this lifetree? This cannot be undone.", { title: 'Delete Lifetree', confirmText: 'Delete', danger: true }))) return;
        try {
            await deleteLifetree(treeId);
            await refreshTrees();
            loadContent(true);
        } catch (e: any) {
            console.error("Delete Tree Error:", e);
            showAlert("Error deleting tree: " + e.message);
        }
    }

    const handleDeleteTreeConfirmed = async (treeId: string) => {
        try {
            await deleteLifetree(treeId);
            await refreshTrees();
            loadContent(true);
        } catch (e: any) {
            showAlert("Error deleting tree: " + e.message);
        }
    }

    const handleDeleteVisionInApp = async (visionId: string) => {
        if (!(await showConfirm("Are you sure you want to delete this vision?", { title: 'Delete Vision', confirmText: 'Delete', danger: true }))) return;
        try {
            await deleteVision(visionId);
            setSelectedVision(null);
            loadContent(true);
        } catch (e: any) {
            showAlert("Delete failed: " + e.message);
        }
    }

    const onAcceptAlignment = async (id: string) => {
        try { await acceptAlignment(id); showAlert("Alignment Accepted! Blocks synced."); loadContent(true); } 
        catch(e:any) { 
            console.error("Accept Alignment Error:", e);
            showAlert(e.message); 
        }
    }

    const filteredData = useMemo(() => data.filter((item: any) => {
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const text = (item.title || item.name || "") + " " + (item.body || "") + " " + (item.locationName || "") + " " + (item.eventLocation || "") + " " + (item.reachTreeName || "");
            if (!text.toLowerCase().includes(term)) return false;
        }
        if (tab === 'forest') {
            if (!canViewTree(item, { uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin, guardedIds: guardedTreeIds })) return false;
            if (!passesForestFilter(item, { showNature: showNatureTrees, showUser: showUserTrees, showValidated: showValidatedTrees }, isExplicitlyValidatedTree)) return false;
        }
        return true;
    }), [data, searchTerm, tab, showNatureTrees, showUserTrees, showValidatedTrees, lightseed?.uid, isSuperAdmin, isAdmin, guardedTreeIds]);

    // Trees of mine (owned or guarded) whose watering is overdue — drives the blue care marker
    // on the nav envelope, computed straight from the trees so it shows even before the daily
    // sweep mints a "water me" reach.
    const wateringNeededCount = useMemo(
        () => [...myTrees, ...guardedTrees].filter(t => isWateringOverdue(t)).length,
        [myTrees, guardedTrees]
    );

    // Signed-out visitors see only node-level events (the node's own happenings), not every
    // community/tree event. Node-scoped = not rooted in a community or a tree.
    const eventsForViewer = useMemo(
        () => (lightseed ? filteredData : filteredData.filter((ev: any) => pulseScope(ev) === 'node')),
        [filteredData, lightseed]
    );

    const searchSuggestions = useMemo(() => (
        Array.from(new Set(data.map((item: any) => item.title || item.name).filter(Boolean)))
    ), [data]);

    if (authLoading) return (
        <div className="h-screen w-full flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 z-0" style={backgroundStyle}></div>
            <div className="relative z-10"><Loading /></div>
        </div>
    );
    

    const renderMainContent = () => {
        if (tab === 'dashboard') {
            return (
                <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
                    <Dashboard 
                        lightseed={lightseed} 
                        stats={{
                            trees: myTrees.length,
                            pulses: stats.pulses,
                            visions: stats.visions,
                            alignments: stats.alignments,
                            danger: guardedTrees.filter(t => t.status === 'DANGER').length
                        }}
                        firstTreeImage={activeTree?.latestGrowthUrl || activeTree?.imageUrl}
                        hostCommunity={impersonatedCommunity || hostCommunity}
                        events={dashboardEvents}
                        onViewEvent={(p: Pulse) => setSelectedPulse(p)}
                        onViewCommunity={setSelectedCommunity}
                        onSetTab={setTab}
                        onPlant={() => openPlant()}
                        onLogin={() => setShowAuthModal(true)}
                    />
                </div>
            );
        }

        if (tab === 'profile' && lightseed) {
            return (
                <LightseedProfile
                    lightseed={lightseed}
                    myTrees={myTrees}
                    guardedTrees={guardedTrees}
                    isAdmin={isAdmin}
                    isSuperAdmin={isSuperAdmin}
                    superAdminExists={superAdminExists}
                    onViewTree={(tree: Lifetree) => setSelectedTree(tree)}
                    onDeleteTree={handleDeleteTree}
                    defaultTreeId={defaultTreeId}
                    onSetDefaultTree={setDefaultTree}
                    onViewVision={(v: Vision) => setSelectedVision(v)}
                    onPlant={() => openPlant()}
                    onClaimSuperAdmin={async () => {
                        const ok = await claimSuperAdmin(lightseed.uid);
                        if (ok) window.location.reload();
                        else showAlert('SuperAdmin already claimed.');
                    }}
                    onGrantAdmin={async (uid: string) => { await grantAdmin(uid); }}
                    onRevokeAdmin={async (uid: string) => { await revokeAdmin(uid); }}
                    onOpenNewsletterAdmin={() => setTab('newsletter')}
                    reachPartner={reachTree}
                    reachAudience={reachAudience}
                    reachOpenSignal={reachOpenSignal}
                    onConsumeReach={() => { setReachTree(null); setReachAudience(undefined); }}
                    onReachTree={(tree: Lifetree) => openReach(tree)}
                />
            );
        }

        if (tab === 'newsletter' && lightseed && isSuperAdmin) {
            return <NewsletterAdmin senderUid={lightseed.uid} onBack={() => setTab('profile')} />;
        }
        
        if (tab === 'about') {
            // "About" is the node's community page, driven entirely from the database and
            // rendered by the same component used everywhere a community is shown. The host
            // (domain) community is the node's own profile; off-domain or before it loads we
            // fall back to the lightseed community as the default about page.
            const aboutCommunity = impersonatedCommunity || hostCommunity || defaultCommunity;
            if (!aboutCommunity) return <div className="min-h-screen flex items-center justify-center"><Loading /></div>;
            return (
                <CommunityProfile
                    community={aboutCommunity}
                    onViewTree={(tree: Lifetree) => setSelectedTree(tree)}
                    onClose={() => setTab('dashboard')}
                    onUpdate={(updates) => {
                        if (impersonatedCommunity && aboutCommunity.id === impersonatedCommunity.id) setImpersonatedCommunity(prev => prev ? { ...prev, ...updates } : null);
                        if (hostCommunity && aboutCommunity.id === hostCommunity.id) setHostCommunity(prev => prev ? { ...prev, ...updates } : null);
                        if (defaultCommunity && aboutCommunity.id === defaultCommunity.id) setDefaultCommunity(prev => prev ? { ...prev, ...updates } : null);
                    }}
                    currentUser={lightseed}
                    currentUserId={lightseed?.uid}
                    isSuperAdmin={isSuperAdmin}
                    isAdmin={isAdmin}
                />
            );
        }

        if (tab === 'communities') {
            return (
                <CommunityList
                    onSelect={(community) => setSelectedCommunity(community)}
                    myTrees={myTrees}
                    currentUserId={lightseed?.uid}
                />
            );
        }

        if (tab === 'collab') {
            return (
                <div className="max-w-3xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
                        {/* Header — branch.webp, Observatory-style */}
                        <div className="relative h-40 md:h-52">
                            <div className="absolute inset-0 bg-slate-900" />
                            <img src="/branch.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
                            <div className="absolute bottom-4 left-6 right-6 text-white">
                                <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-light drop-shadow"><Icons.Users /> {t('collab')}</h1>
                                <p className="mt-1 text-sm text-slate-200/90 drop-shadow">{t('collab_sub')}</p>
                            </div>
                        </div>
                        <div className="p-6"><Partners /></div>
                    </div>
                </div>
            );
        }

        // Search box reused inside the Visions/Events/Pulses headers (under the title).
        const searchBox = (
            <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Icons.Search />
                </div>
                <input
                    dir="auto"
                    type="text"
                    list="search-suggestions"
                    className="block w-full pl-10 pr-3 py-2 border border-emerald-100 rounded-xl leading-5 bg-white/80 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm shadow-sm"
                    placeholder={t('search_placeholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <datalist id="search-suggestions">
                    {searchSuggestions.map((s, i) => <option key={i} value={s} />)}
                </datalist>
            </div>
        );

        return (
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 min-h-[80vh]">
                {tab === 'forest' && (
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div className="relative w-full md:max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Icons.Search />
                            </div>
                            <input
                                dir="auto"
                                type="text"
                                list="search-suggestions"
                                className={`block w-full pl-10 pr-3 py-2 border rounded-lg leading-5 backdrop-blur focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm shadow-sm ${effectiveIsDark ? 'border-slate-700 bg-slate-900/80 text-white placeholder-slate-400' : 'border-slate-200 bg-white/90 text-slate-900 placeholder-slate-400'}`}
                                placeholder={t('search_placeholder')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ borderColor: effectiveTheme.primary }}
                            />
                            <datalist id="search-suggestions">
                                {searchSuggestions.map((s, i) => <option key={i} value={s} />)}
                            </datalist>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {tab === 'forest' && (
                                <button 
                                    onClick={() => openPlant({ type: 'LIFETREE', step: 2 })}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 transition-colors h-10"
                                    style={{ backgroundColor: effectiveTheme.primary }}
                                >
                                    <Icons.Tree />
                                    <span className="hidden sm:inline">{t('plant_lifetree')}</span>
                                    <span className="sm:hidden">Plant</span>
                                </button>
                            )}

                            {tab === 'forest' && myTrees.length > 0 && (
                                <button 
                                    onClick={() => openPlant({ type: 'GUARDED', step: 2 })}
                                    className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 transition-colors h-10"
                                    style={{ backgroundColor: effectiveTheme.secondary }}
                                >
                                    <Icons.Shield />
                                    <span className="hidden sm:inline">{t('guard_tree')}</span>
                                    <span className="sm:hidden">{t('guard')}</span>
                                </button>
                            )}

                            {tab === 'forest' && (
                                <div className={`backdrop-blur p-1 rounded-lg border flex shadow-sm h-10 ${effectiveIsDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white/90 border-slate-200'}`} style={{ borderColor: effectiveTheme.primary }}>
                                    <button 
                                        onClick={() => setViewMode('grid')}
                                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all flex items-center justify-center ${viewMode === 'grid' ? 'bg-emerald-600 text-white shadow' : effectiveIsDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-950'}`}
                                        style={viewMode === 'grid' ? { backgroundColor: effectiveTheme.primary } : {}}
                                    >
                                        <Icons.List />
                                        <span className="hidden lg:inline ml-2">{t('list_view')}</span>
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('map')}
                                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all flex items-center justify-center ${viewMode === 'map' ? 'bg-emerald-600 text-white shadow' : effectiveIsDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-950'}`}
                                        style={viewMode === 'map' ? { backgroundColor: effectiveTheme.primary } : {}}
                                    >
                                        <Icons.Map />
                                        <span className="hidden lg:inline ml-2">{t('map_view')}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tab === 'observatory' && (
                    <ObservatoryPage
                        alignments={alignments}
                        onAcceptAlignment={onAcceptAlignment}
                        isAnalyzingSynergy={isAnalyzingSynergy}
                        synergies={synergies}
                        lastSynergyAt={lastSynergyAt}
                        canRefreshResonance={canRefreshResonance}
                        synergyCooldownLeft={synergyCooldownLeft}
                        onRefreshResonance={refreshResonanceObservatory}
                        favoriteResonanceIds={favoriteResonanceIds}
                        onToggleFavorite={toggleFavoriteResonance}
                        onReach={reachResonantTree}
                        observatoryQuote={observatoryQuote}
                        quoteCopied={obsQuoteCopied}
                        onCopyQuote={copyObservatoryQuote}
                    />
                )}


                {tab === 'forest' ? (
                    <ForestPage
                        effectiveIsDark={effectiveIsDark}
                        showNatureTrees={showNatureTrees} setShowNatureTrees={setShowNatureTrees}
                        showUserTrees={showUserTrees} setShowUserTrees={setShowUserTrees}
                        showValidatedTrees={showValidatedTrees} setShowValidatedTrees={setShowValidatedTrees}
                        viewMode={viewMode}
                        filteredData={filteredData}
                        loadingMore={loadingMore}
                        activeTree={activeTree}
                        mapRefreshKey={mapRefreshKey}
                        isAdmin={isAdmin} isSuperAdmin={isSuperAdmin}
                        currentUserId={lightseed?.uid}
                        guardedTreeIds={guardedTreeIds}
                        sentinelRef={forestSentinelRef}
                        onView={setSelectedTree}
                        onReach={openReach}
                        onPlayGrowth={setShowGrowthPlayer}
                        onQuickSnap={handleQuickSnap}
                        onValidate={(id: string, nextValidated: boolean) => { (nextValidated
                            ? validateLifetree(id, isSuperAdmin ? lightseed!.uid : activeTree!.id)
                            : unvalidateLifetree(id)
                        ).then(() => { showAlert(nextValidated ? "Validated!" : "Validation removed."); loadContent(true); }); }}
                        onRefresh={() => loadContent(true)}
                    />
                ) : tab === 'visions' ? (
                    <VisionsPage
                        visions={filteredData}
                        synergies={synergies}
                        favoriteResonanceIds={favoriteResonanceIds}
                        onToggleFavorite={toggleFavoriteResonance}
                        onReach={reachResonantTree}
                        isAnalyzingSynergy={isAnalyzingSynergy}
                        onAnalyze={handleAnalyzeSynergy}
                        canAnalyze={data.length >= 2}
                        lightseed={lightseed}
                        onCreateVision={() => setShowVisionModal(true)}
                        onSelectVision={setSelectedVision}
                        loadingMore={loadingMore}
                        viewer={{ uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin }}
                        searchBox={searchBox}
                    />
                ) : tab === 'events' ? (
                    <PulseFeedPage
                        icon={<Icons.Loc />}
                        title={t('events')}
                        subtitle={t('events_sub')}
                        searchBox={searchBox}
                        action={lightseed && (
                            <button onClick={() => setShowEventModal(true)} className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-full font-bold shadow-lg shadow-sky-600/20 transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap">
                                <Icons.Plus /> <span>{t('create_event')}</span>
                            </button>
                        )}
                        items={eventsForViewer}
                        emptyText={t('no_events_found')}
                        loadingMore={loadingMore}
                        lightseed={lightseed}
                        onMatch={(p: Pulse) => { setSelectedPulse(p); openPulseModal(); }}
                        onView={(p: Pulse) => setSelectedPulse(p)}
                    />
                ) : tab !== 'observatory' && tab !== 'profile' && tab !== 'inspiration' && tab !== 'about' && tab !== 'dashboard' && tab !== 'newsletter' && tab !== 'communities' && (
                    <PulseFeedPage
                        icon={<Icons.PulseDuo />}
                        title={t('pulses')}
                        subtitle={t('pulses_sub')}
                        searchBox={searchBox}
                        action={lightseed && (
                            <button onClick={() => openPulseModal()} className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-full font-bold shadow-lg shadow-sky-600/20 transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap">
                                <Icons.Pulse /> <span>{t('emit_pulse')}</span>
                            </button>
                        )}
                        items={filteredData}
                        emptyText={t('no_trees_found')}
                        loadingMore={loadingMore}
                        lightseed={lightseed}
                        onMatch={(p: Pulse) => { setMatchCandidate(p); openPulseModal(); }}
                        onView={(p: Pulse) => setSelectedPulse(p)}
                    />
                )}

                {loadingMore && <div className="flex justify-center py-4"><Loading /></div>}
            </main>
        );
    };

    return (
        <div className={`min-h-screen relative font-sans flex flex-col ${effectiveIsDark ? 'text-slate-100' : 'text-slate-800'}`}>
            <div className="fixed inset-0 z-0 pointer-events-none" style={backgroundStyle}></div>
            {/* Page-level scroll affordance — only on the main page (hidden while a detail/modal is open). */}
            {openKeys.length === 0 && <ScrollChevrons axis="y" fixed />}

            <div className="relative z-20 flex-1">
                {impersonatedCommunity && (
                    <div className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-amber-500 px-4 py-1.5 text-center text-xs font-bold text-white shadow-md">
                        <span className="truncate">Viewing as <span className="font-extrabold">{impersonatedCommunity.name}</span> — community view</span>
                        <button
                            onClick={() => { setImpersonatedCommunity(null); setTab('dashboard'); window.scrollTo(0, 0); }}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/25 px-2.5 py-0.5 font-bold uppercase tracking-wide hover:bg-white/40"
                        >
                            <Icons.Close /> Exit community
                        </button>
                    </div>
                )}
                {(
                    <Navigation
                        lightseed={lightseed}
                        activeTab={tab}
                        setTab={(t: string) => { setSelectedTree(null); setTab(t); }}
                        onLogin={() => setShowAuthModal(true)}
                        onLogout={() => { logout(); setTab('dashboard'); }} 
                        onPlant={() => openPlant()} 
                        onPulse={() => openPulseModal()}
                        onCreateVision={() => setShowVisionModal(true)}
                        onProfile={() => setTab('profile')} 
                        pendingAlignmentsCount={alignments.length}
                        myTreesCount={myTrees.length}
                        dangerTreesCount={guardedTrees.filter(t => t.status === 'DANGER').length}
                        reachNotificationsCount={unreadReaches}
                        treeInviteCount={pendingTreeInvites}
                        careAlertCount={wateringNeededCount}
                        activeTreeImage={activeTree?.latestGrowthUrl || activeTree?.imageUrl}
                        onOpenReachInbox={openDirectMessages}
                        logoUrl={configuredLogoUrl}
                        appName={isHubDomain(window.location.hostname) ? '.seed' : config.name}
                        isNightMode={effectiveIsDark}
                        theme={effectiveTheme}
                        onToggleNightMode={toggleNightMode}
                    />
                )}
                
                {/* Show once to everyone who hasn't dismissed/completed it. We wait for the
                    profile to load (onboarding.loaded) and DON'T gate on tree count, so the card
                    can't flash in while trees are still loading. */}
                {!selectedTree && !!lightseed && onboarding.loaded && !onboarding.dismissed && (tab === 'dashboard' || tab === 'forest') && (
                    <div className="mx-auto max-w-7xl px-4 pt-6 animate-in fade-in duration-500">
                        <FirstRunChecklist
                            state={onboarding}
                            myTrees={myTrees}
                            guardedTrees={guardedTrees}
                            theme={effectiveTheme}
                            isDark={effectiveIsDark}
                            onPlant={openPlant}
                            onOpenTree={(t) => setSelectedTree(t)}
                            onGoObservatory={() => setTab('observatory')}
                        />
                    </div>
                )}
                {selectedTree ? (
                    <div className="animate-in fade-in duration-200">
                        <LifetreeDetail
                            tree={selectedTree}
                            onClose={() => { setSelectedTree(null); setMapRefreshKey(k => k + 1); }}
                            onPlayGrowth={setShowGrowthPlayer}
                            onValidate={(id: string, nextValidated: boolean) => (nextValidated
                                ? validateLifetree(id, isSuperAdmin ? lightseed!.uid : activeTree!.id)
                                : unvalidateLifetree(id)
                            ).then(() => {
                                handleTreeUpdate(id, {
                                    validated: nextValidated,
                                    validatorId: nextValidated ? (isSuperAdmin ? lightseed!.uid : activeTree!.id) : null,
                                });
                                showAlert(nextValidated ? "Validated!" : "Validation removed.");
                                loadContent(true);
                            })}
                            onUpdate={(updates: Partial<Lifetree>) => handleTreeUpdate(selectedTree.id, updates)}
                            onDelete={() => { handleDeleteTreeConfirmed(selectedTree.id); setSelectedTree(null); }}
                            onCreatePulse={() => openPulseModal(selectedTree)}
                            onReachTree={(tree: Lifetree) => openReach(tree)}
                            onAlertGuardians={() => openReach(selectedTree, 'guardians')}
                            onViewPulse={(p: Pulse) => { setSelectedTree(null); setSelectedPulse(p); }}
                            myActiveTree={activeTree}
                            isDefaultTree={defaultTreeId === selectedTree.id}
                            onSetDefault={() => { setDefaultTree(selectedTree.id); showAlert(`${selectedTree.name} is now your default tree.`); }}
                            currentUserId={lightseed?.uid}
                            currentUser={lightseed}
                            isAdmin={isAdmin}
                            isSuperAdmin={isSuperAdmin}
                            targetUserProfile={{ onlyValidatedCanReach: selectedTree.onlyValidatedCanReach }}
                        />
                        {showGrowthPlayer && <GrowthPlayerModal treeId={showGrowthPlayer} onClose={() => setShowGrowthPlayer(null)} />}
                    </div>
                ) : renderMainContent()}
                <GDPRBanner />
                <DialogHost />

                {showAuthModal && !lightseed && (
                    <AuthModal onClose={() => setShowAuthModal(false)} inviteId={inviteParam} inviteOnly={config.inviteOnly} />
                )}
            </div>

            <Footer community={impersonatedCommunity || hostCommunity || defaultCommunity} theme={effectiveTheme} isDark={effectiveIsDark} />

            {selectedVision && (
                <DetailWrapper>
                    <VisionDetail 
                        vision={selectedVision} 
                        onClose={() => setSelectedVision(null)} 
                        currentUserId={lightseed?.uid}
                        onDelete={handleDeleteVisionInApp}
                    />
                </DetailWrapper>
            )}
            
            {selectedPulse && (
                <DetailWrapper>
                    <PulseDetail
                        pulse={selectedPulse}
                        activeTree={activeTree}
                        onClose={() => setSelectedPulse(null)}
                        canEdit={canEditEvent(selectedPulse, { uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin }, { hostCommunity })}
                        onEdit={() => setEditingEvent(selectedPulse)}
                    />
                </DetailWrapper>
            )}

            {editingEvent && (
                <EventModal
                    lightseed={lightseed}
                    event={editingEvent}
                    scope={editingEvent.communityId ? 'community' : 'node'}
                    onClose={() => setEditingEvent(null)}
                    uploading={uploading}
                    handleImageUpload={handleImageUpload}
                    onCreate={async (data: any) => {
                        await updateEvent(editingEvent.id, data);
                        // Reflect the edit immediately in the open detail view.
                        setSelectedPulse(prev => prev && prev.id === editingEvent.id ? { ...prev, ...data } : prev);
                        setEditingEvent(null);
                    }}
                />
            )}

            {selectedCommunity && (
                <DetailWrapper>
                    <CommunityProfile
                        community={selectedCommunity}
                        onViewTree={(tree: Lifetree) => { setSelectedCommunity(null); setSelectedTree(tree); }}
                        onViewEvent={(p: Pulse) => { setSelectedCommunity(null); setSelectedPulse(p); }}
                        onClose={() => { setSelectedCommunity(null); setMapRefreshKey(k => k + 1); }}
                        onUpdate={(updates) => {
                            setSelectedCommunity(prev => prev ? { ...prev, ...updates } : null);
                            // If this is the host community, refresh the app shell (theme/logo) too.
                            if (selectedCommunity && hostCommunity && selectedCommunity.id === hostCommunity.id) {
                                setHostCommunity(prev => prev ? { ...prev, ...updates } : null);
                            }
                        }}
                        currentUser={lightseed}
                        currentUserId={lightseed?.uid}
                        isSuperAdmin={isSuperAdmin}
                        isAdmin={isAdmin}
                        onEnterCommunityView={isSuperAdmin ? (community) => {
                            setImpersonatedCommunity(community);
                            setSelectedCommunity(null);
                            setTab('about');
                            window.scrollTo(0, 0);
                        } : undefined}
                    />
                </DetailWrapper>
            )}

            {showGrowthPlayer && !selectedTree && <GrowthPlayerModal treeId={showGrowthPlayer} onClose={() => setShowGrowthPlayer(null)} />}

            {showPlantModal && (
                <PlantTreeModal
                    lightseed={lightseed}
                    initialType={plantInit.type}
                    initialStep={plantInit.step}
                    onClose={() => setShowPlantModal(false)}
                    onPlant={async (data: any) => {
                        await plantLifetree(data);
                        await refreshTrees();          // refresh the My Trees section immediately
                        if (tab === 'forest') loadContent(true); // and the forest/map
                    }}
                    uploading={uploading}
                    handleImageUpload={handleImageUpload}
                    extractGpsFromImage={extractGpsFromImage}
                />
            )}

            {showEventModal && (
                <EventModal
                    lightseed={lightseed}
                    onClose={() => setShowEventModal(false)}
                    uploading={uploading}
                    handleImageUpload={handleImageUpload}
                    onCreate={async (data: any) => {
                        await createEvent(data);
                        if (tab === 'events') loadContent(true);
                    }}
                />
            )}

            {showPulseModal && (
                <EmitPulseModal
                    lightseed={lightseed}
                    activeTree={activeTree}
                    matchCandidate={matchCandidate}
                    targetTree={pulseTargetTree}
                    onClose={() => { setShowPulseModal(false); setPulseTargetTree(null); }}
                    onMint={mintPulse}
                    onProposeAlignment={proposeAlignment}
                    onGrown={handleTreeGrown}
                    uploading={uploading}
                    handleImageUpload={handleImageUpload}
                    uploadBase64Image={uploadBase64Image}
                />
            )}

            {showVisionModal && (
                <CreateVisionModal
                    lightseed={lightseed}
                    activeTree={activeTree}
                    trees={myTrees}
                    onClose={() => setShowVisionModal(false)}
                    onCreate={createVision}
                    uploading={uploading}
                    handleImageUpload={handleImageUpload}
                    uploadBase64Image={uploadBase64Image}
                />
            )}
        </div>
    );
}

const App = () => {
  const params = new URLSearchParams(window.location.search);
  const isWidget = params.get('widget') === 'true';
  const widgetDomain = params.get('domain') || '';

  if (isWidget) return <LifeseedWidget domain={widgetDomain} />;

  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
};

export default App;
