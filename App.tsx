
import React, { useState, useEffect, useRef } from 'react';
import {
  signInWithGoogle,
  logout,
  fetchPulses,
  mintPulse,
  fetchLifetrees,
  plantLifetree,
  uploadImage,
  uploadBase64Image,
  validateLifetree,
  unvalidateLifetree,
  proposeAlignment,
  getPendingAlignments,
  acceptAlignment,
  fetchVisions,
  createVision,
  deleteLifetree,
  deleteVision,
  ensureGenesis,
  getMyPulses,
  getMyVisions,
  getMyAlignmentsHistory,
  claimSuperAdmin,
  grantAdmin,
  revokeAdmin
} from './services/firebase';
import { findVisionSynergies } from './services/gemini';
import { type Pulse, type Lifetree, type Alignment, type Vision, type Community, type VisionSynergy } from './types';
import Logo from './components/Logo';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { useLifeseed } from './hooks/useLifeseed';
import { useConfig } from './hooks/useConfig';

// Components
import { Icons } from './components/ui/Icons';
import { Navigation } from './components/Navigation';
import { LifetreeCard } from './components/LifetreeCard';
import { VisionCard } from './components/VisionCard';
import { PulseCard } from './components/PulseCard';
import { ForestMap } from './components/ForestMap';
import { LifetreeDetail } from './components/LifetreeDetail';
import { VisionDetail } from './components/VisionDetail';
import { PulseDetail } from './components/PulseDetail';
import { GrowthPlayerModal } from './components/GrowthPlayerModal';
import { OracleChat } from './components/OracleChat';
import { LightseedProfile } from './components/LightseedProfile';
import { AboutPage } from './components/AboutPage';
import { Dashboard } from './components/Dashboard';
import { Loading } from './components/ui/Loading';
import { LifeseedWidget } from './components/LifeseedWidget';
import { NewsletterAdmin } from './components/NewsletterAdmin';
import { CommunityList } from './components/CommunityList';
import { CommunityProfile } from './components/CommunityProfile';
import { isExplicitlyValidatedTree } from './utils/validation';

// Modals
import { PlantTreeModal } from './components/modals/PlantTreeModal';
import { EmitPulseModal } from './components/modals/EmitPulseModal';
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

const AppContent = () => {
    const { t } = useLanguage();
    const { lightseed, myTrees, guardedTrees, activeTree, isAdmin, isSuperAdmin, superAdminExists, loading: authLoading, refreshTrees } = useLifeseed();
    const [tab, setTab] = useState('dashboard');
    const [viewMode, setViewMode] = useState<'grid' | 'map'>('map');
    const [data, setData] = useState<any[]>([]);
    const [alignments, setAlignments] = useState<Alignment[]>([]);
    const [selectedTree, setSelectedTree] = useState<Lifetree | null>(null);
    const [selectedVision, setSelectedVision] = useState<Vision | null>(null);
    const [selectedPulse, setSelectedPulse] = useState<Pulse | null>(null);
    const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
    const [hostCommunity, setHostCommunity] = useState<Community | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Stats State for Dashboard
    const [stats, setStats] = useState({ pulses: 0, visions: 0, alignments: 0 });
    
    // Pagination State
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const forestSentinelRef = useRef<HTMLDivElement>(null);

    // UI State
    const [showPlantModal, setShowPlantModal] = useState(false);
    const [showPulseModal, setShowPulseModal] = useState(false);
    const [showVisionModal, setShowVisionModal] = useState(false);
    const [showGrowthPlayer, setShowGrowthPlayer] = useState<string | null>(null);
    const [matchCandidate, setMatchCandidate] = useState<Pulse | null>(null);
    const [uploading, setUploading] = useState(false);
    const [showNatureTrees, setShowNatureTrees] = useState(true);
    const [showUserTrees, setShowUserTrees] = useState(true);
    const [showValidatedTrees, setShowValidatedTrees] = useState(false);

    // AI Synergy State
    const [synergies, setSynergies] = useState<VisionSynergy[]>([]);
    const [isAnalyzingSynergy, setIsAnalyzingSynergy] = useState(false);

    const config = useConfig(hostCommunity);

    useEffect(() => {
        const root = document.documentElement;
        if (config.theme) {
            root.style.setProperty('--color-primary', config.theme.primary);
            root.style.setProperty('--color-secondary', config.theme.secondary);
            root.style.setProperty('--color-accent', config.theme.accent);
            root.style.setProperty('--color-background', config.theme.background);
        }
    }, [config]);

    const bgHex = config.theme.background;
    const bgEncoded = bgHex.replace('#', '%23');
    
    const svgBackground = `data:image/svg+xml,%3Csvg width='332.5537705' height='320' xmlns='http://www.w3.org/2000/svg'%3E%3Cstyle%3E .outerCircle %7B fill: ${bgEncoded}; stroke: %23fff; stroke-width: 7; stroke-opacity: .3; %7D .circle %7B fill: none; stroke: %23fff; stroke-width: .3; stroke-opacity: .3; %7D .innerCircle %7B fill: ${bgEncoded}; stroke: %23fff; stroke-width: 1.7; stroke-opacity: .4; %7D %3C/style%3E%3Crect width='100%25' height='100%25' fill='${bgEncoded}'/%3E%3Cdefs%3E%3CclipPath id='clean'%3E%3Crect width='332.5537705' height='320' /%3E%3C/clipPath%3E%3C/defs%3E%3Cg%3E%3Ccircle cx='-38.2768775' cy='-32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='96' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='160' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='224' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='288' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='352' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='0' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='64' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='128' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='192' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='256' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='320' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='-32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='96' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='160' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='224' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='288' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='352' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='0' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='64' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='128' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='192' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='256' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='320' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='-32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='96' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='160' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='224' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='288' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='352' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='0' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='64' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='128' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='192' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='256' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='320' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='-32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='96' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='160' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='224' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='288' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='352' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='0' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='64' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='128' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='192' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='256' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='320' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='96' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='160' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='64' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='128' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='192' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='96' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='160' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='288' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3C/g%3E%3C/svg%3E`;

    const backgroundStyle = {
        backgroundImage: `url("${svgBackground}")`,
        backgroundSize: '108px', 
        backgroundRepeat: 'repeat',
        backgroundPosition: 'center center',
        backgroundAttachment: 'fixed',
    };

    // Dashboard Stats Fetcher
    useEffect(() => {
        if (lightseed) {
            Promise.all([
                getMyPulses(lightseed.uid),
                getMyVisions(lightseed.uid),
                getMyAlignmentsHistory(lightseed.uid)
            ]).then(([p, v, m]) => {
                setStats({
                    pulses: p.length,
                    visions: v.length,
                    alignments: m.length
                });
            }).catch(console.error);
        } else {
            setStats({ pulses: 0, visions: 0, alignments: 0 });
        }
    }, [lightseed, tab]); // Re-fetch when tab changes to refresh counts

    useEffect(() => { 
        if (tab !== 'dashboard') {
            loadContent(true);
        }
        ensureGenesis(); 
        // Fetch host community
        const domain = window.location.hostname;
        import('./services/firebase').then(({ getCommunityByDomain }) => {
            getCommunityByDomain(domain).then(setHostCommunity);
        });
    }, [tab, lightseed]);
    
    useEffect(() => {
        const handleScroll = () => {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
                if (!loadingMore && hasMore && tab !== 'dashboard' && tab !== 'observatory' && tab !== 'oracle' && tab !== 'profile' && tab !== 'about' && tab !== 'forest') {
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
            setSynergies([]);
        }

        if (!reset && !hasMore) return;
        
        setLoadingMore(true);
        const currentLastDoc = reset ? undefined : lastDoc;
        const currentDomain = window.location.hostname;

        try {
            if (tab === 'forest') {
                const res = await fetchLifetrees(currentLastDoc, currentDomain);
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
            else if (tab === 'pulses') {
                const res = await fetchPulses(currentLastDoc, currentDomain);
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

    const handleAnalyzeSynergy = async () => {
        if (data.length < 2) return;
        setIsAnalyzingSynergy(true);
        try {
            const results = await findVisionSynergies(data);
            setSynergies(results);
        } catch (e) {
            console.error(e);
            alert("Synergy analysis failed. Try again later.");
        }
        setIsAnalyzingSynergy(false);
    };

    const handleTreeUpdate = (treeId: string, updates: any) => {
        setData(prev => prev.map(item => item.id === treeId ? { ...item, ...updates } : item));
        if (selectedTree?.id === treeId) {
            setSelectedTree(prev => prev ? { ...prev, ...updates } : null);
        }
        refreshTrees();
    };

    const handleImageUpload = async (file: File, path: string) => {
        setUploading(true);
        const url = await uploadImage(file, path);
        setUploading(false);
        return url;
    };
    
    const handleQuickSnap = async (treeId: string, file: File) => {
        if (!lightseed) return;
        try {
            const url = await handleImageUpload(file, `users/${lightseed.uid}/growth/${treeId}/${Date.now()}`);
            await mintPulse({
                lifetreeId: treeId,
                type: 'GROWTH',
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
            alert("Error taking picture: " + e.message);
        }
    }

    const handleDeleteTree = async (treeId: string) => {
        if (!window.confirm("Are you sure you want to delete this lifetree? This cannot be undone.")) return;
        try {
            await deleteLifetree(treeId);
            await refreshTrees();
            loadContent(true);
        } catch (e: any) {
            console.error("Delete Tree Error:", e);
            alert("Error deleting tree: " + e.message);
        }
    }

    const handleDeleteTreeConfirmed = async (treeId: string) => {
        try {
            await deleteLifetree(treeId);
            await refreshTrees();
            loadContent(true);
        } catch (e: any) {
            alert("Error deleting tree: " + e.message);
        }
    }

    const handleDeleteVisionInApp = async (visionId: string) => {
        if (!confirm("Are you sure you want to delete this vision?")) return;
        try {
            await deleteVision(visionId);
            setSelectedVision(null);
            loadContent(true);
        } catch (e: any) {
            alert("Delete failed: " + e.message);
        }
    }

    const onAcceptAlignment = async (id: string) => {
        try { await acceptAlignment(id); alert("Alignment Accepted! Blocks synced."); loadContent(true); } 
        catch(e:any) { 
            console.error("Accept Alignment Error:", e);
            alert(e.message); 
        }
    }

    const filteredData = data.filter((item: any) => {
        let matches = true;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const text = (item.title || item.name || "") + " " + (item.body || "") + " " + (item.locationName || "");
            matches = matches && text.toLowerCase().includes(term);
        }
        if (tab === 'forest') {
            if (!showNatureTrees && item.isNature) {
                matches = false;
            }
            if (!showUserTrees && !item.isNature) {
                matches = false;
            }
            if (showValidatedTrees && !isExplicitlyValidatedTree(item)) {
                matches = false;
            }
        }
        return matches;
    });

    const searchSuggestions = Array.from(new Set(data.map((item: any) => item.title || item.name).filter(Boolean)));

    if (authLoading) return (
        <div className="h-screen w-full flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 z-0" style={backgroundStyle}></div>
            <div className="relative z-10"><Loading /></div>
        </div>
    );
    
    const DetailWrapper = ({children}: {children?: React.ReactNode}) => (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-900/90 backdrop-blur-sm">
            {children}
        </div>
    );

    const renderMainContent = () => {
        if (tab === 'dashboard') {
            return (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                        hostCommunity={hostCommunity}
                        onViewCommunity={setSelectedCommunity}
                        onSetTab={setTab} 
                        onPlant={() => { setShowPlantModal(true); }}
                        onLogin={signInWithGoogle} 
                    />
                </div>
            );
        }

        if (tab === 'profile' && lightseed) {
            return (
                <LightseedProfile
                    lightseed={lightseed}
                    myTrees={myTrees}
                    isAdmin={isAdmin}
                    isSuperAdmin={isSuperAdmin}
                    superAdminExists={superAdminExists}
                    onViewTree={(tree: Lifetree) => setSelectedTree(tree)}
                    onDeleteTree={handleDeleteTree}
                    onViewVision={(v: Vision) => setSelectedVision(v)}
                    onPlant={() => { setShowPlantModal(true); }}
                    onClaimSuperAdmin={async () => {
                        const ok = await claimSuperAdmin(lightseed.uid);
                        if (ok) window.location.reload();
                        else alert('SuperAdmin already claimed.');
                    }}
                    onGrantAdmin={async (uid: string) => { await grantAdmin(uid); }}
                    onRevokeAdmin={async (uid: string) => { await revokeAdmin(uid); }}
                    onOpenNewsletterAdmin={() => setTab('newsletter')}
                />
            );
        }

        if (tab === 'newsletter' && lightseed && isSuperAdmin) {
            return <NewsletterAdmin senderUid={lightseed.uid} onBack={() => setTab('profile')} />;
        }
        
        if (tab === 'about') {
            return <AboutPage onClose={() => setTab('dashboard')} />;
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

        return (
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 min-h-[80vh]">
                {tab !== 'observatory' && tab !== 'profile' && tab !== 'oracle' && tab !== 'about' && tab !== 'dashboard' && tab !== 'newsletter' && tab !== 'communities' && (
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div className="relative w-full md:max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Icons.Search />
                            </div>
                            <input 
                                dir="auto"
                                type="text"
                                list="search-suggestions"
                                className="block w-full pl-10 pr-3 py-2 border border-emerald-700 rounded-lg leading-5 bg-[#B2713A]/80 backdrop-blur placeholder-slate-200 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm shadow-sm"
                                placeholder={t('search_placeholder')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ borderColor: config.theme.primary }}
                            />
                            <datalist id="search-suggestions">
                                {searchSuggestions.map((s, i) => <option key={i} value={s} />)}
                            </datalist>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {tab === 'forest' && (
                                <button 
                                    onClick={() => { setShowPlantModal(true); }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 transition-colors h-10"
                                    style={{ backgroundColor: config.theme.primary }}
                                >
                                    <Icons.Tree />
                                    <span className="hidden sm:inline">{t('plant_lifetree')}</span>
                                    <span className="sm:hidden">Plant</span>
                                </button>
                            )}

                            {tab === 'forest' && myTrees.length > 0 && (
                                <button 
                                    onClick={() => { setShowPlantModal(true); }}
                                    className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 transition-colors h-10"
                                    style={{ backgroundColor: config.theme.secondary }}
                                >
                                    <Icons.Shield />
                                    <span className="hidden sm:inline">{t('guard_tree')}</span>
                                    <span className="sm:hidden">{t('guard')}</span>
                                </button>
                            )}

                            {tab === 'forest' && (
                                <div className="bg-[#B2713A]/80 backdrop-blur p-1 rounded-lg border border-emerald-700 flex shadow-sm h-10" style={{ borderColor: config.theme.primary }}>
                                    <button 
                                        onClick={() => setViewMode('grid')}
                                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all flex items-center justify-center ${viewMode === 'grid' ? 'bg-emerald-600 text-white shadow' : 'text-emerald-300 hover:text-white'}`}
                                        style={viewMode === 'grid' ? { backgroundColor: config.theme.primary } : {}}
                                    >
                                        <Icons.List />
                                        <span className="hidden lg:inline ml-2">{t('list_view')}</span>
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('map')}
                                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all flex items-center justify-center ${viewMode === 'map' ? 'bg-emerald-600 text-white shadow' : 'text-emerald-300 hover:text-white'}`}
                                        style={viewMode === 'map' ? { backgroundColor: config.theme.primary } : {}}
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
                    <div className="max-w-2xl mx-auto text-white">
                        <h2 className="text-2xl font-light mb-6">{t('pending_alignments')}</h2>
                        {alignments.length === 0 ? (
                            <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 p-12 text-center flex flex-col items-center">
                                <div className="mb-6 p-4 bg-slate-50 rounded-full">
                                    <Logo width={100} height={100} className="text-slate-800" />
                                </div>
                                <h3 className="text-xl font-light text-slate-800 mb-2">{t('no_pending_resonance')}</h3>
                                <p className="text-slate-500">{t('ether_quiet')}</p>
                            </div>
                        ) : alignments.map(a => (
                            <div key={a.id} className="bg-white/90 p-4 rounded-xl shadow-sm border border-slate-200 mb-4 flex flex-col gap-4 text-slate-800 animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex justify-between items-center">
                                    <div><p className="font-bold">{t('alignment_request')}</p><p className="text-sm text-slate-500">{t('from_another_tree')}</p></div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setTab('oracle'); }} className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-xs font-bold border border-emerald-100 flex items-center gap-1.5 hover:bg-emerald-100 transition-all">
                                            <Icons.MessageCircle size={14} /> Start Conversation
                                        </button>
                                        <button onClick={() => onAcceptAlignment(a.id)} className="bg-sky-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-md hover:bg-sky-600 transition-all">{t('accept_sync')}</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'oracle' && <OracleChat />}

                {tab === 'forest' ? (
                    <>
                         <div className="flex justify-center mb-6 gap-3">
                             <label className="flex items-center gap-2 cursor-pointer bg-[#B2713A]/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20 hover:bg-[#B2713A]/80 transition-colors shadow-sm">
                                <input 
                                    type="checkbox" 
                                    checked={showNatureTrees} 
                                    onChange={(e) => setShowNatureTrees(e.target.checked)} 
                                    className="rounded text-sky-500 focus:ring-sky-500 bg-white/20 border-white/30"
                                />
                                <span className="text-xs text-white font-medium flex items-center">
                                    <span className="mr-1"><Icons.Nature /></span> {t('nature')}
                                </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer bg-[#B2713A]/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20 hover:bg-[#B2713A]/80 transition-colors shadow-sm">
                                <input 
                                    type="checkbox" 
                                    checked={showUserTrees} 
                                    onChange={(e) => setShowUserTrees(e.target.checked)} 
                                    className="rounded text-emerald-400 focus:ring-emerald-400 bg-white/20 border-white/30"
                                />
                                <span className="text-xs text-white font-medium flex items-center">
                                    <span className="mr-1"><Icons.Tree /></span> {t('lifetrees')}
                                </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer bg-[#B2713A]/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20 hover:bg-[#B2713A]/80 transition-colors shadow-sm">
                                <input 
                                    type="checkbox" 
                                    checked={showValidatedTrees} 
                                    onChange={(e) => setShowValidatedTrees(e.target.checked)} 
                                    className="rounded text-emerald-300 focus:ring-emerald-300 bg-white/20 border-white/30"
                                />
                                <span className="text-xs text-white font-medium flex items-center">
                                    <span className="mr-1"><Icons.ShieldCheck /></span> {t('validated_trees')}
                                </span>
                            </label>
                        </div>

                        {viewMode === 'map' ? (
                            <ForestMap trees={filteredData} onView={setSelectedTree} loading={loadingMore && filteredData.length === 0} />
                        ) : (
                            <>
                                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                    {filteredData.length === 0 && !loadingMore ? (
                                        <p className="col-span-full text-center text-slate-400 py-10">{t('no_trees_found')}</p>
                                    ) : (
                                        filteredData.map((item: any) => (
                                            <React.Fragment key={item.id}>
                                                <LifetreeCard
                                                    tree={item}
                                                    myActiveTree={activeTree}
                                                    isAdmin={isAdmin}
                                                    isSuperAdmin={isSuperAdmin}
                                                    currentUserId={lightseed?.uid}
                                                    onPlayGrowth={setShowGrowthPlayer}
                                                    onQuickSnap={handleQuickSnap}
                                                    onValidate={(id: string, nextValidated: boolean) => (nextValidated
                                                        ? validateLifetree(id, isSuperAdmin ? lightseed!.uid : activeTree!.id)
                                                        : unvalidateLifetree(id)
                                                    ).then(() => { alert(nextValidated ? "Validated!" : "Validation removed."); loadContent(true); })}
                                                    onView={setSelectedTree}
                                                />
                                            </React.Fragment>
                                        ))
                                    )}
                                </div>
                                <div ref={forestSentinelRef} className="h-1" />
                            </>
                        )}
                    </>
                ) : tab === 'visions' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                         <div className="flex justify-between items-center mb-8 bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-xl">
                            <h2 className="text-4xl font-thin tracking-tight text-white">{t('visions')}</h2>
                            <button 
                                onClick={handleAnalyzeSynergy} 
                                disabled={isAnalyzingSynergy || data.length < 2}
                                className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 border border-amber-400/30 active:scale-95 disabled:opacity-50"
                            >
                                {isAnalyzingSynergy ? <Loading /> : <Icons.Sparkles />}
                                <span>{isAnalyzingSynergy ? 'Analyzing...' : 'Analyze Alignments'}</span>
                            </button>
                        </div>

                        {synergies.length > 0 && (
                            <div className="mb-12 bg-amber-50/90 backdrop-blur-md p-8 rounded-[2rem] border-2 border-amber-200 shadow-2xl animate-in zoom-in-95 duration-500">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="bg-amber-500 text-white p-2 rounded-xl shadow-lg"><Icons.SparkleFill size={24} /></div>
                                    <h3 className="text-2xl font-light text-amber-900 italic">Living Intelligence Resonance</h3>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    {synergies.map((s, i) => (
                                        <div key={i} className="bg-white/90 p-4 rounded-xl shadow-sm border border-amber-100">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="text-sm font-bold text-slate-800">{s.vision1Title} + {s.vision2Title}</div>
                                                <div className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Resonance: {s.score}%</div>
                                            </div>
                                            <p className="text-xs text-slate-600 italic">"{s.reasoning}"</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                            {filteredData.length === 0 && !loadingMore ? <p className="col-span-full text-center text-slate-400 py-10">{t('no_visions_found')}</p> :
                                filteredData.map((item: any) => (
                                    <div key={item.id} onClick={() => setSelectedVision(item)} className="cursor-pointer">
                                        <VisionCard vision={item} />
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                ) : tab !== 'observatory' && tab !== 'profile' && tab !== 'oracle' && tab !== 'about' && tab !== 'dashboard' && tab !== 'newsletter' && tab !== 'communities' && (
                    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                        {data.map((item) => (
                             <React.Fragment key={item.id}>
                                 <PulseCard 
                                    pulse={item} 
                                    lightseed={lightseed} 
                                    onMatch={(p: Pulse) => { setMatchCandidate(p); setShowPulseModal(true); }}
                                    onView={(p: Pulse) => setSelectedPulse(p)} 
                                />
                            </React.Fragment>
                        ))}
                    </div>
                )}

                {loadingMore && <div className="flex justify-center py-4"><Loading /></div>}
            </main>
        );
    };

    return (
        <div className="min-h-screen relative font-sans text-slate-800">
            <div className="fixed inset-0 z-0 pointer-events-none" style={backgroundStyle}></div>
            
            <div className="relative z-10">
                {tab !== 'about' && (
                    <Navigation 
                        lightseed={lightseed} 
                        activeTab={tab} 
                        setTab={setTab} 
                        onLogin={signInWithGoogle} 
                        onLogout={logout} 
                        onPlant={() => { setShowPlantModal(true); }} 
                        onPulse={() => setShowPulseModal(true)}
                        onCreateVision={() => setShowVisionModal(true)}
                        onProfile={() => setTab('profile')} 
                        pendingAlignmentsCount={alignments.length}
                        myTreesCount={myTrees.length}
                        dangerTreesCount={guardedTrees.filter(t => t.status === 'DANGER').length}
                        logoUrl={config.logoUrl}
                    />
                )}
                
                {renderMainContent()}
                <GDPRBanner />
            </div>

            {selectedTree && (
                <DetailWrapper>
                    <LifetreeDetail
                        tree={selectedTree}
                        onClose={() => setSelectedTree(null)}
                        onPlayGrowth={setShowGrowthPlayer}
                        onValidate={(id: string, nextValidated: boolean) => (nextValidated
                            ? validateLifetree(id, isSuperAdmin ? lightseed!.uid : activeTree!.id)
                            : unvalidateLifetree(id)
                        ).then(() => {
                            handleTreeUpdate(id, {
                                validated: nextValidated,
                                validatorId: nextValidated ? (isSuperAdmin ? lightseed!.uid : activeTree!.id) : null,
                            });
                            alert(nextValidated ? "Validated!" : "Validation removed.");
                            loadContent(true);
                        })}
                        onUpdate={(updates: Partial<Lifetree>) => handleTreeUpdate(selectedTree.id, updates)}
                        onDelete={() => { handleDeleteTreeConfirmed(selectedTree.id); setSelectedTree(null); }}
                        onCreatePulse={() => { setShowPulseModal(true); }}
                        onViewPulse={(p: Pulse) => { setSelectedTree(null); setSelectedPulse(p); }}
                        myActiveTree={activeTree}
                        currentUserId={lightseed?.uid}
                        isAdmin={isAdmin}
                        isSuperAdmin={isSuperAdmin}
                    />
                    {showGrowthPlayer && <GrowthPlayerModal treeId={showGrowthPlayer} onClose={() => setShowGrowthPlayer(null)} />}
                </DetailWrapper>
            )}

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
                    <PulseDetail pulse={selectedPulse} activeTree={activeTree} onClose={() => setSelectedPulse(null)} />
                </DetailWrapper>
            )}

            {selectedCommunity && (
                <DetailWrapper>
                    <CommunityProfile 
                        community={selectedCommunity}
                        onClose={() => setSelectedCommunity(null)}
                        onUpdate={(updates) => {
                            setSelectedCommunity(prev => prev ? { ...prev, ...updates } : null);
                        }}
                        currentUserId={lightseed?.uid}
                        isSuperAdmin={isSuperAdmin}
                        isAdmin={isAdmin}
                    />
                </DetailWrapper>
            )}

            {showGrowthPlayer && !selectedTree && <GrowthPlayerModal treeId={showGrowthPlayer} onClose={() => setShowGrowthPlayer(null)} />}

            {showPlantModal && (
                <PlantTreeModal 
                    lightseed={lightseed}
                    onClose={() => setShowPlantModal(false)}
                    onPlant={plantLifetree}
                    uploading={uploading}
                    handleImageUpload={handleImageUpload}
                    extractGpsFromImage={extractGpsFromImage}
                />
            )}

            {showPulseModal && (
                <EmitPulseModal 
                    lightseed={lightseed}
                    activeTree={activeTree}
                    matchCandidate={matchCandidate}
                    onClose={() => setShowPulseModal(false)}
                    onMint={mintPulse}
                    onProposeAlignment={proposeAlignment}
                    uploading={uploading}
                    handleImageUpload={handleImageUpload}
                    uploadBase64Image={uploadBase64Image}
                />
            )}

            {showVisionModal && (
                <CreateVisionModal 
                    lightseed={lightseed}
                    activeTree={activeTree}
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
