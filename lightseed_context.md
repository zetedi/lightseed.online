# Project Context Snapshot

Generated: Sun Jun 28 01:38:10 EEST 2026

## Git
main
0755c14 Watering, links, AI, growth evolution.

## Directory shape
```
src
  adapters
  domain
    views
```

## Key files detected
```
./App.tsx
./components/LifetreeCard.tsx
./components/LifetreeDetail.tsx
./components/PulseCard.tsx
./components/PulseDetail.tsx
./components/VisionCard.tsx
./components/VisionDetail.tsx
./components/modals/CreateVisionModal.tsx
./components/modals/EmitPulseModal.tsx
./components/modals/PlantTreeModal.tsx
./components/ui/AppearanceEditor.tsx
./config/default.ts
./config/types.ts
./contexts/LanguageContext.tsx
./firebase.json
./firestore.indexes.json
./functions/tsconfig.json
./hooks/useConfig.ts
./lifeseed.config.json
./lightseed_context.md
./services/firebase.ts
./src/adapters/firestore.ts
./src/domain/community.ts
./src/domain/decision.ts
./src/domain/entity.ts
./src/domain/intelligence.ts
./src/domain/lifetree.ts
./src/domain/link.ts
./src/domain/policy.ts
./src/domain/pulse.ts
./src/domain/pulseVisibility.ts
./src/domain/reach.ts
./src/domain/sanctuary.ts
./src/domain/store.ts
./src/domain/treeCircle.ts
./src/domain/views/circle.ts
./src/domain/views/council.ts
./src/domain/views/forest.ts
./src/domain/views/participation.ts
./src/domain/views/threads.ts
./src/domain/watering.ts
./tsconfig.json
./types.ts
./vite.config.ts
config/default.ts
config/types.ts
src/adapters/firestore.ts
src/domain/community.ts
src/domain/decision.ts
src/domain/entity.ts
src/domain/intelligence.ts
src/domain/lifetree.ts
src/domain/link.ts
src/domain/policy.ts
src/domain/pulse.ts
src/domain/pulseVisibility.ts
src/domain/reach.ts
src/domain/sanctuary.ts
src/domain/store.ts
src/domain/treeCircle.ts
src/domain/views/circle.ts
src/domain/views/council.ts
src/domain/views/forest.ts
src/domain/views/participation.ts
src/domain/views/threads.ts
src/domain/watering.ts
```

## Package overview
```json
{
  "name": "lightseed.online",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --mode development",
    "dev:clean": "vite --mode clean",
    "prod": "vite build --mode production",
    "build": "vite build",
    "build:clean": "vite build --mode clean",
    "preview": "vite preview",
    "seed:lightseed": "node scripts/seed-lightseed.mjs",
    "migrate:reach-privacy": "node scripts/backfill-reach-privacy.mjs"
  },
  "dependencies": {
    "@google/generative-ai": "^0.24.1",
    "dotenv": "^17.4.2",
    "exif-js": "^2.3.0",
    "firebase": "^12.6.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-quill-new": "^3.8.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.3.0",
    "@tailwindcss/typography": "^0.5.19",
    "@types/node": "^22.14.0",
    "@vitejs/plugin-react": "^5.0.0",
    "autoprefixer": "^10.5.0",
    "firebase-admin": "^12.6.0",
    "postcss": "^8.5.15",
    "tailwindcss": "^4.3.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.0"
  }
}
```

## Selected source excerpts

### ./App.tsx
```
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  signInWithGoogle,
  logout,
  fetchPulses,
  fetchEventPulses,
  backfillPulseVisibility,
  migrateArraysToLinks,
  dropLegacyArrays,
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
  uploadImage,
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
  getMyPulses,
  getMyVisions,
  getMyAlignmentsHistory,
  claimSuperAdmin,
  grantAdmin,
  revokeAdmin,
  getCommunityByDomain,
  listenToUserProfile,
  getPendingTreeInvites
} from './services/firebase';
import { findVisionSynergies } from './services/gemini';
import { ensureIntelligenceCommons, setActiveIntelligenceId } from './services/intelligence';
import { type Pulse, type Lifetree, type Alignment, type Vision, type Community, type VisionSynergy, type ReachAudience } from './types';
import Logo from './components/Logo';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { useLifeseed } from './hooks/useLifeseed';
import { isHubDomain, useConfig } from './hooks/useConfig';
import { normalizeTheme } from './utils/theme';
import { Icons } from './components/ui/Icons';
import { Navigation } from './components/Navigation';
import { LifetreeCard } from './components/LifetreeCard';
import { VisionCard } from './components/VisionCard';
import { PulseCard } from './components/PulseCard';
import { ForestMap } from './components/ForestMap';
import { LifetreeDetail } from './components/LifetreeDetail';
import { VisionDetail } from './components/VisionDetail';
import { PulseDetail } from './components/PulseDetail';
import { queryableLevels, canEditEvent } from './src/domain/pulseVisibility';
import { GrowthPlayerModal } from './components/GrowthPlayerModal';
import { LightseedProfile } from './components/LightseedProfile';
import { Dashboard } from './components/Dashboard';
import { Loading } from './components/ui/Loading';
import { ScrollChevrons } from './components/ui/ScrollChevrons';
import { ResonanceScan } from './components/ui/ResonanceScan';
import { ResonancePanel, ResonanceCard, resonanceId } from './components/ResonancePanel';
import { SectionHeader } from './components/ui/SectionHeader';
import { LifeseedWidget } from './components/LifeseedWidget';
import { NewsletterAdmin } from './components/NewsletterAdmin';
import { CommunityList } from './components/CommunityList';
import { CommunityProfile } from './components/CommunityProfile';
import { DialogHost, showAlert, showConfirm } from './components/ui/Dialog';
import { isExplicitlyValidatedTree } from './utils/validation';
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
const DetailWrapper = ({ children }: { children?: React.ReactNode }) => (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-900/90 backdrop-blur-sm">
        {children}
    </div>
);
const AppContent = () => {
    const { t } = useLanguage();
    const { lightseed, myTrees, guardedTrees, activeTree, defaultTreeId, setDefaultTree, isAdmin, isSuperAdmin, superAdminExists, loading: authLoading, refreshTrees } = useLifeseed();
    const guardedTreeIds = useMemo(() => new Set(guardedTrees.map(t => t.id)), [guardedTrees]);
    const [tab, setTab] = useState('dashboard');
    const [viewMode, setViewMode] = useState<'grid' | 'map'>('map');
    const [data, setData] = useState<any[]>([]);
    const [alignments, setAlignments] = useState<Alignment[]>([]);
    const [selectedTree, setSelectedTree] = useState<Lifetree | null>(null);
    const [selectedVision, setSelectedVision] = useState<Vision | null>(null);
    const [selectedPulse, setSelectedPulse] = useState<Pulse | null>(null);
    const [mapRefreshKey, setMapRefreshKey] = useState(0);
    const [editingEvent, setEditingEvent] = useState<Pulse | null>(null);
    const [dashboardEvents, setDashboardEvents] = useState<Pulse[]>([]);
    const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
    const [reachTree, setReachTree] = useState<Lifetree | null>(null);
    const [reachAudience, setReachAudience] = useState<ReachAudience | undefined>(undefined);
    const [reachOpenSignal, setReachOpenSignal] = useState(0);
    const [unreadReaches, setUnreadReaches] = useState(0);
    const [pendingTreeInvites, setPendingTreeInvites] = useState(0);
    const [hostCommunity, setHostCommunity] = useState<Community | null>(null);
    const [defaultCommunity, setDefaultCommunity] = useState<Community | null>(null);
    const [impersonatedCommunity, setImpersonatedCommunity] = useState<Community | null>(null);
    const [personalSiteTheme, setPersonalSiteTheme] = useState<any>(null);
    const [preferredIntelligenceId, setPreferredIntelligenceId] = useState<string | undefined>(undefined);
    const [personalSiteLogoUrl, setPersonalSiteLogoUrl] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [stats, setStats] = useState({ pulses: 0, visions: 0, alignments: 0 });
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const forestSentinelRef = useRef<HTMLDivElement>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const inviteParam = useMemo(() => new URLSearchParams(window.location.search).get('invite') || undefined, []);
    const [showPlantModal, setShowPlantModal] = useState(false);
    const [plantInit, setPlantInit] = useState<{ type?: 'LIFETREE' | 'GUARDED'; step?: number }>({});
    const openPlant = (init: { type?: 'LIFETREE' | 'GUARDED'; step?: number } = {}) => {
        setPlantInit(init);
        setShowPlantModal(true);
    };
    const [showPulseModal, setShowPulseModal] = useState(false);
    const [pulseTargetTree, setPulseTargetTree] = useState<Lifetree | null>(null);
    const openPulseModal = (target: Lifetree | null = null) => { setPulseTargetTree(target); setShowPulseModal(true); };
    const [showEventModal, setShowEventModal] = useState(false);
    const [showVisionModal, setShowVisionModal] = useState(false);
    const [showGrowthPlayer, setShowGrowthPlayer] = useState<string | null>(null);
    const [matchCandidate, setMatchCandidate] = useState<Pulse | null>(null);
    const [uploading, setUploading] = useState(false);
    const [showNatureTrees, setShowNatureTrees] = useState(true);
    const [showUserTrees, setShowUserTrees] = useState(true);
    const [showValidatedTrees, setShowValidatedTrees] = useState(false);
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
```

### ./components/LifetreeCard.tsx
```
import React, { useRef, useState, ChangeEvent } from 'react';
import { showAlert, showConfirm } from "./ui/Dialog";
import { type Lifetree } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import Logo from './Logo';
import { ValidationBadge } from './ValidationBadge';
import { colors } from '../utils/theme';
import { canToggleValidation, isExplicitlyValidatedTree } from '../utils/validation';
import { canReachTree, type ReachTargetProfile } from '../utils/reachPermissions';
import { isWateringOverdue } from '../src/domain/watering';
import { DefaultCardImage } from './ui/DefaultCardImage';
import { ImageCropModal } from './ui/ImageCropModal';
interface LifetreeCardProps {
    tree: Lifetree;
    myActiveTree: Lifetree | null;
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
    currentUserId?: string;
    guardedTreeIds?: Set<string>;
    targetUserProfile?: ReachTargetProfile | null;
    onValidate: (id: string, nextValidated: boolean) => Promise<void>;
    onPlayGrowth: (id: string) => void;
    onQuickSnap: (id: string, file: File) => Promise<void>;
    onView: (tree: Lifetree) => void;
    onReach?: (tree: Lifetree) => void;
    onAlertGuardians?: (tree: Lifetree) => void;
}
export const LifetreeCard = ({ tree, myActiveTree, isAdmin, isSuperAdmin, currentUserId, guardedTreeIds, targetUserProfile, onValidate, onPlayGrowth, onQuickSnap, onView, onReach, onAlertGuardians }: LifetreeCardProps) => {
    const { t } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [pendingSnap, setPendingSnap] = useState<File | null>(null);
    const isGuardian = !!currentUserId && !!guardedTreeIds?.has(tree.id);
    const needsWater = isWateringOverdue(tree);
    const hasValidationBadge = isExplicitlyValidatedTree(tree);
    const showValidateAction = canToggleValidation({ tree, myActiveTree, isAdmin, isSuperAdmin });
    const targetProfile = targetUserProfile ?? { onlyValidatedCanReach: tree.onlyValidatedCanReach };
    const canReach = canReachTree({ targetTree: tree, targetUserProfile: targetProfile, myActiveTree, currentUserId, isAdmin, isSuperAdmin });
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setPendingSnap(e.target.files[0]); // crop first, then snap
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    const handleCropped = async (file: File) => {
        setPendingSnap(null);
        setUploading(true);
        await onQuickSnap(tree.id, file);
        setUploading(false);
    };
    const triggerUpload = (e: React.MouseEvent) => {
        e.stopPropagation();
        fileInputRef.current?.click();
    }
    return (
        <div 
            onClick={() => onView(tree)}
            className={`bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 group relative cursor-pointer ${tree.isNature ? 'ring-1 ring-sky-100' : (hasValidationBadge ? 'ring-1 ring-emerald-100' : '')}`}
        >
             <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1">
                {tree.isNature ? (
                    <span className="bg-sky-100 text-sky-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center shadow-sm">
                        <Icons.Shield />
                        <span className="ml-1 text-[9px]">NATURE</span>
                    </span>
                ) : null}
                {isGuardian && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center shadow-sm w-fit">
                        <Icons.Shield />
                        <span className="ml-1 text-[9px]">Guardian</span>
                    </span>
                )}
            </div>
            {/* Quick Snap - For Owner OR Guardian */}
             {(myActiveTree && myActiveTree.id === tree.id) || isGuardian ? (
                 <div className="absolute top-2 left-2 z-20">
                     <button 
                        onClick={triggerUpload} 
                        disabled={uploading}
                        className="flex items-center gap-1.5 bg-white/95 text-slate-800 px-2.5 py-1 rounded-full shadow-md hover:bg-white hover:text-emerald-700 transition-all active:scale-95"
                    >
                        {uploading ? <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div> : <Icons.Camera />}
                        <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">{t('quick_snap')}</span>
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        capture="environment" 
                        onChange={handleFileChange} 
                        onClick={(e) => e.stopPropagation()}
                    />
                 </div>
            ) : null}
            <div className="relative h-36 bg-slate-200 overflow-hidden group">
                {tree.latestGrowthUrl || tree.imageUrl ? (
                    <img
                        src={tree.latestGrowthUrl || tree.imageUrl}
                        alt={tree.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[3s]"
                    />
                ) : (
                    <DefaultCardImage />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none"></div>
                {hasValidationBadge && (
                    <div className="absolute bottom-2 right-2 z-20">
                        <ValidationBadge compact />
                    </div>
                )}
                <div className="absolute bottom-2 left-3 right-3 text-white pointer-events-none">
                    <h3 dir="auto" className="text-lg font-light tracking-wide truncate">{tree.name}</h3>
                    {tree.shortTitle && <p dir="auto" className="text-xs font-bold text-emerald-200 uppercase tracking-widest truncate">{tree.shortTitle}</p>}
                    <div className="flex items-center text-xs text-slate-300 mt-0.5 gap-2 rtl:space-x-reverse">
                         {!tree.isNature && <span className="px-1.5 py-0 border border-slate-500 rounded-full text-[9px] bg-slate-800/50 backdrop-blur">
                            {t('block')}: {tree.blockHeight || 0}
                        </span>}
                        {tree.isNature && tree.status === 'DANGER' && (
                            onAlertGuardians ? (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onAlertGuardians(tree); }}
                                    title="Message this tree's guardians"
                                    className="pointer-events-auto bg-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold animate-pulse hover:bg-red-600 active:scale-95 transition-all"
                                >
                                    DANGER · alert guardians
                                </button>
                            ) : (
                                <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold animate-pulse">DANGER</span>
                            )
                        )}
                        {needsWater && (
                            <span className="bg-sky-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold animate-pulse inline-flex items-center gap-1">💧 NEEDS WATER</span>
                        )}
                    </div>
                </div>
            </div>
            <div className="p-3">
                <p dir="auto" className="text-slate-600 text-xs font-light italic leading-relaxed truncate">
                    "{tree.body}"
                </p>
                <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button onClick={(e) => { e.stopPropagation(); onPlayGrowth(tree.id); }} className="flex items-center gap-1 text-[10px] bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded transition-colors uppercase tracking-wider font-semibold">
                        <Icons.Play />
                        <span>Growth</span>
                    </button>
                    {onReach && (
                        canReach ? (
                            <button onClick={(e) => { e.stopPropagation(); onReach(tree); }} className="flex items-center gap-1 text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-700 px-2 py-1 rounded transition-colors uppercase tracking-wider font-semibold">
                                <Icons.Lightning />
                                <span>Reach</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled
                                onClick={(e) => e.stopPropagation()}
                                title={t('only_if_validated')}
                                className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-400 px-2 py-1 rounded uppercase tracking-wider font-semibold cursor-not-allowed"
                            >
                                <Icons.Eye size={12} />
                                <span>{t('only_if_validated')}</span>
                            </button>
                        )
                    )}
                    <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row">
                        {showValidateAction && (
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    const nextValidated = !hasValidationBadge;
                                    const message = nextValidated ? 'Validate this tree?' : 'Remove validation from this tree?';
                                    if (await showConfirm(message, { title: 'Validation' })) onValidate(tree.id, nextValidated);
                                }}
                                className="text-[10px] bg-primary text-white px-3 py-1.5 rounded-full shadow hover:opacity-90 transition-all uppercase font-bold tracking-wider"
                            >
                                {hasValidationBadge ? 'Remove Validation' : t('validate_action')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
            {/* Crop the snapped photo before it becomes a growth pulse. The wrapper stops the
                overlay click from bubbling up to the card's onView handler. */}
            {pendingSnap && (
                <div onClick={(e) => e.stopPropagation()}>
                    <ImageCropModal
                        file={pendingSnap}
                        aspect={1}
                        title="Frame the growth"
                        onCancel={() => setPendingSnap(null)}
                        onConfirm={handleCropped}
                    />
                </div>
            )}
        </div>
    );
};
```

### ./components/LifetreeDetail.tsx
```
import React, { useState, useEffect, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { showAlert, showConfirm } from "./ui/Dialog";
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import Logo from './Logo';
import { ValidationBadge } from './ValidationBadge';
import { AutocompleteInput } from './ui/AutocompleteInput';
import { updateLifetree, setTreeStatus, getPulsesByTreeId, createTreeInvite, setWateringSchedule, recordWatering, confirmWateringPulse, sendWateringAlert, fileToWebpBase64 } from '../services/firebase';
import { analyzeWateringPhoto } from '../services/gemini';
import { Pulse, type InvitableRole, treeRelationLabels } from '../types';
import { canToggleValidation, isExplicitlyValidatedTree } from '../utils/validation';
import { canReachTree } from '../utils/reachPermissions';
import { isOnWateringSchedule, isWateringOverdue, daysUntilWatering, daysOverdue, lastWateredMillis, wateringAlertedToday } from '../src/domain/watering';
import { treeCircle } from '../src/domain/views/circle';
import { firestoreStore } from '../src/adapters/firestore';
import { canTendTree } from '../src/domain/policy';
export const LifetreeDetail = ({ tree, onClose, onPlayGrowth, onValidate, onUpdate, onDelete, onCreatePulse, onReachTree, onViewPulse, onAlertGuardians, myActiveTree, isDefaultTree, onSetDefault, currentUserId, currentUser, isAdmin, isSuperAdmin, targetUserProfile }: any) => {
   const { t } = useLanguage();
   const isOwner = currentUserId === tree.ownerId;
   const isNature = tree.isNature;
   const [localIsGuardian, setLocalIsGuardian] = useState(false);
   const [guardianCount, setGuardianCount] = useState(0);
   const [guardianNonce, setGuardianNonce] = useState(0);
   useEffect(() => {
       let alive = true;
       firestoreStore.linksTo(tree.id, 'guardian').then(links => {
           if (!alive) return;
           setLocalIsGuardian(!!currentUserId && links.some(l => l.from === currentUserId));
           setGuardianCount(links.length);
       }).catch(() => {});
       return () => { alive = false; };
   }, [tree.id, currentUserId, guardianNonce]);
   const canDelete = isOwner || isAdmin || isSuperAdmin;
   const canEdit = isOwner || localIsGuardian || isSuperAdmin;
   const hasValidationBadge = isExplicitlyValidatedTree(tree);
   const showValidateAction = canToggleValidation({ tree, myActiveTree, isAdmin, isSuperAdmin });
   const targetProfile = targetUserProfile ?? { onlyValidatedCanReach: tree.onlyValidatedCanReach };
   const canReach = canReachTree({ targetTree: tree, targetUserProfile: targetProfile, myActiveTree, currentUserId, isAdmin, isSuperAdmin });
   const hasCoordinates = Number.isFinite(tree.latitude) && Number.isFinite(tree.longitude);
   const fieldClassName = "h-10 w-full max-w-sm rounded border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
   const [isEditing, setIsEditing] = useState(false);
   const [showDeleteModal, setShowDeleteModal] = useState(false);
   const [editName, setEditName] = useState(tree.name);
   const [editShortTitle, setEditShortTitle] = useState(tree.shortTitle || '');
   const [editBody, setEditBody] = useState(tree.body);
   const [editLat, setEditLat] = useState(tree.latitude || (tree as any).lat || 0);
   const [editLng, setEditLng] = useState(tree.longitude || (tree as any).lng || 0);
   const [editLocationName, setEditLocationName] = useState(tree.locationName || '');
   const [editCreatedAt, setEditCreatedAt] = useState(() => {
       if (!tree.createdAt) return '';
       const d = tree.createdAt.toDate ? tree.createdAt.toDate() : new Date(tree.createdAt);
       const offset = d.getTimezoneOffset() * 60000;
       return new Date(d.getTime() - offset).toISOString().slice(0, 16);
   });
   const [editDomain, setEditDomain] = useState(tree.domain || '');
   const [isSaving, setIsSaving] = useState(false);
   const [chain, setChain] = useState<Pulse[]>([]);
   const [genesisBlock, setGenesisBlock] = useState<Pulse | null>(null);
   const [growthBlocks, setGrowthBlocks] = useState<Pulse[]>([]);
   const [loadingChain, setLoadingChain] = useState(false);
   const [localStatus, setLocalStatus] = useState(tree.status || 'HEALTHY');
   const [isLocating, setIsLocating] = useState(false);
   const [showInvite, setShowInvite] = useState(false);
   const [inviteUserId, setInviteUserId] = useState('');
   const [inviteRole, setInviteRole] = useState<InvitableRole>('co_owner');
   const [inviteMessage, setInviteMessage] = useState('');
   const [inviteBusy, setInviteBusy] = useState(false);
   const [inviteStatus, setInviteStatus] = useState<string | null>(null);
   const [waterMode, setWaterMode] = useState<'scheduled' | 'self_sustaining'>(tree.watering?.mode === 'self_sustaining' ? 'self_sustaining' : 'scheduled');
   const [waterInterval, setWaterInterval] = useState<number>(tree.watering?.intervalDays || 7);
   const [waterBusy, setWaterBusy] = useState(false);
   const [waterMsg, setWaterMsg] = useState<string | null>(null);
   const [confirmingId, setConfirmingId] = useState<string | null>(null);
   const waterFileRef = useRef<HTMLInputElement>(null);
   useEffect(() => {
       setWaterMode(tree.watering?.mode === 'self_sustaining' ? 'self_sustaining' : 'scheduled');
       setWaterInterval(tree.watering?.intervalDays || 7);
       setWaterMsg(null);
   }, [tree.id]);
   const loadChain = () => {
        setLoadingChain(true);
        getPulsesByTreeId(tree.id).then(pulses => {
            if (pulses.length > 0) {
                const last = pulses[pulses.length - 1];
                if (last.previousHash === "0" || last.title === "Genesis Pulse") {
                    setGenesisBlock(last);
                    setGrowthBlocks(pulses.slice(0, pulses.length - 1));
                } else {
                    setGrowthBlocks(pulses);
                }
            } else {
                setGrowthBlocks([]);
            }
            setChain(pulses);
        }).finally(() => setLoadingChain(false));
   };
   useEffect(() => { loadChain(); }, [tree.id]);
   const handleSave = async () => {
       setIsSaving(true);
       try {
           const updates: any = {
               name: editName,
               shortTitle: editShortTitle,
               body: editBody,
               latitude: Number(editLat),
               longitude: Number(editLng),
               locationName: editLocationName.trim() || null,
               domain: editDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '') || null,
               ...(editCreatedAt && { createdAt: new Date(editCreatedAt) })
           };
           await updateLifetree(tree.id, updates);
           if (onUpdate) onUpdate(updates);
           setIsEditing(false);
       } catch (e) {
           showAlert("Failed to save changes.");
       }
       setIsSaving(false);
   };
   const handleLocateMe = () => {
       setIsLocating(true);
       navigator.geolocation.getCurrentPosition((pos) => {
           setEditLat(pos.coords.latitude);
           setEditLng(pos.coords.longitude);
           setIsLocating(false);
       }, (err) => {
           showAlert("Location failed: " + err.message);
           setIsLocating(false);
       });
   }
   const handleToggleGuardian = async () => {
       if (!canTendTree(currentUserId)) return;
       setIsSaving(true);
       try {
           const isJoining = !localIsGuardian;
           await (isJoining ? firestoreStore.link(currentUserId, 'guardian', tree.id) : firestoreStore.unlink(currentUserId, 'guardian', tree.id));
           setLocalIsGuardian(isJoining);
           setGuardianCount(c => Math.max(0, c + (isJoining ? 1 : -1)));
           setGuardianNonce(n => n + 1);
       } catch(e: any) { showAlert(e.message); }
       setIsSaving(false);
   }
   const handleToggleDanger = async () => {
       if (!localIsGuardian) return;
       const newStatus = localStatus === 'DANGER' ? 'HEALTHY' : 'DANGER';
       if (newStatus === "DANGER" && !(await showConfirm("Are you sure you want to report this tree is in DANGER? This will alert all guardians.", { title: "Report Danger", confirmText: "Report", danger: true }))) return;
       setIsSaving(true);
       try {
           await setTreeStatus(tree.id, newStatus);
           setLocalStatus(newStatus);
           if (onUpdate) onUpdate({ status: newStatus });
       } catch(e: any) { showAlert(e.message); }
       setIsSaving(false);
   }
   const GuardianshipPanel = () => (
        <div className={`bg-sky-50 text-sky-900 p-6 rounded-2xl shadow-inner border border-sky-100 overflow-hidden relative ${!isNature ? 'mt-6' : ''}`}>
            <h3 className="text-sky-600 font-bold uppercase tracking-wider mb-4 flex items-center">
                <Icons.Shield />
                <span className="ml-2">Guardians</span>
            </h3>
            <p className="text-sm mb-6 text-sky-800/80">
                This tree is protected by the community. Join the guardians to monitor its health and add memories.
            </p>
            <div className="space-y-3">
                {currentUserId ? (
                    <button 
                        onClick={handleToggleGuardian}
                        disabled={isSaving}
                        className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 ${localIsGuardian ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-sky-600 text-white hover:bg-sky-700'}`}
                    >
                        {localIsGuardian ? "Leave Guardianship" : "Join Guardianship"}
                    </button>
                ) : (
                    <p className="text-xs text-center italic">Sign in to become a guardian.</p>
                )}
                {localIsGuardian && (
                    <button 
                        onClick={handleToggleDanger}
                        disabled={isSaving}
                        className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center space-x-2 ${localStatus === 'DANGER' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
                    >
                        {localStatus === 'DANGER' ? (
                            <><span>RESOLVE DANGER</span></>
                        ) : (
                            <><Icons.Siren /><span>REPORT DANGER</span></>
                        )}
                    </button>
                )}
            </div>
            <div className="mt-4 pt-4 border-t border-sky-200 text-xs text-sky-600 font-mono">
                Guardians: {guardianCount}
            </div>
        </div>
   );
   const canInviteToCircle = isOwner || isSuperAdmin;
   const [circle, setCircle] = useState<ReturnType<typeof treeCircle>>({ groups: [], size: 0 });
   useEffect(() => {
       let alive = true;
       firestoreStore.linksTo(tree.id)
           .then(links => { if (alive) setCircle(treeCircle(tree.ownerId, links)); })
           .catch(() => {});
       return () => { alive = false; };
   }, [tree.id, tree.ownerId, guardianNonce]);
   const handleSendInvite = async (e: React.FormEvent) => {
       e.preventDefault();
       if (!currentUserId || !inviteUserId.trim() || inviteBusy) return;
       setInviteBusy(true);
       setInviteStatus(null);
       try {
           await createTreeInvite({
               lifetree: tree,
               invitedUserId: inviteUserId.trim(),
               role: inviteRole,
               message: inviteMessage.trim(),
               invitedByUserId: currentUserId,
           });
           setInviteUserId('');
           setInviteMessage('');
           setShowInvite(false);
           setInviteStatus('Invitation sent. When they accept, a circle opens around this tree.');
```

### ./components/PulseCard.tsx
```
import React, { useState, useEffect } from 'react';
import { type Pulse, type Lightseed } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { isPulseLoved, lovePulse } from '../services/firebase';
import { Icons } from './ui/Icons';
import { DefaultCardImage } from './ui/DefaultCardImage';
interface PulseCardProps {
    pulse: Pulse;
    lightseed: Lightseed | null;
    onMatch: (p: Pulse) => void;
    onView?: (p: Pulse) => void;
}
export const PulseCard = ({ pulse, lightseed, onMatch, onView }: PulseCardProps) => {
    const { t } = useLanguage();
    const [loved, setLoved] = useState(false);
    const [count, setCount] = useState(pulse.loveCount || 0);
    const images = pulse.imageUrls?.length ? pulse.imageUrls : (pulse.imageUrl ? [pulse.imageUrl] : []);
    const badge = pulse.type === 'event' ? 'EVENT' : pulse.type === 'GROWTH' ? 'GROWTH' : '';
    useEffect(() => {
        if (lightseed) isPulseLoved(pulse.id, lightseed.uid).then(setLoved);
    }, [pulse, lightseed]);
    const handleLove = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening detail view
        if (!lightseed) return;
        const newStatus = !loved;
        setLoved(newStatus);
        setCount(c => newStatus ? c + 1 : c - 1);
        await lovePulse(pulse.id, lightseed.uid);
    }
    const handleMatchClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening detail view
        onMatch(pulse);
    }
    return (
        <div 
            onClick={() => onView && onView(pulse)}
            className={`bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 group cursor-pointer ${pulse.care === 'watering' ? 'ring-2 ring-sky-500 ring-opacity-30' : pulse.type === 'GROWTH' ? 'ring-2 ring-emerald-500 ring-opacity-20' : ''} ${pulse.type === 'event' ? 'ring-2 ring-sky-500 ring-opacity-20' : ''}`}
        >
             <div className="relative h-36 bg-slate-100 overflow-hidden group">
                 <div className="absolute top-2 right-2 z-20 flex gap-1">
                    {pulse.care === 'watering'
                        ? <span title={pulse.wateringConfirmation?.note || ''} className="bg-sky-100 text-sky-700 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">💧 {pulse.wateringConfirmedBy === 'ai' ? 'AI' : pulse.wateringConfirmedBy === 'guardian' ? 'CONFIRMED' : 'PENDING'}</span>
                        : badge && <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm ${pulse.type === 'event' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-600'}`}>{badge}</span>}
                    {images.length > 1 && <span className="bg-white/90 text-slate-600 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">{images.length} IMG</span>}
                    {pulse.isMatch && <span className="bg-sky-100 text-sky-600 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">MATCH</span>}
                 </div>
                {images.length > 0 ? (
                    <img src={images[0]} alt={pulse.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <DefaultCardImage />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent pointer-events-none"></div>
                <div className="absolute bottom-2 left-3 right-3 text-white pointer-events-none">
                     <h3 dir="auto" className="text-sm font-bold tracking-wide truncate">{pulse.title}</h3>
                </div>
            </div>
            <div className="p-3">
                <p dir="auto" className="text-slate-600 text-xs font-light leading-relaxed truncate">
                    {pulse.type === 'event' && pulse.eventDate ? `${new Date(pulse.eventDate).toLocaleDateString()} · ${pulse.eventLocation || pulse.body}` : pulse.body}
                </p>
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center">
                    <button onClick={handleLove} disabled={!lightseed} className="flex items-center gap-1 text-slate-500 hover:text-red-500 transition-colors">
                        <Icons.Heart filled={loved} />
                        <span className="text-xs">{count}</span>
                    </button>
                    {lightseed && lightseed.uid !== pulse.authorId && !pulse.isMatch && (
                        <button onClick={handleMatchClick} className="text-[10px] bg-slate-50 text-slate-500 hover:bg-sky-50 hover:text-sky-600 px-2 py-1 rounded transition-colors flex items-center gap-1">
                            <Icons.Link /> <span>Match</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
```

### ./components/PulseDetail.tsx
```
import React, { useState } from 'react';
import { Pulse, Lifetree } from '../types';
import { Icons } from './ui/Icons';
import { translatePulse } from '../services/gemini';
import { spendAiTokens, db } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
interface PulseDetailProps {
    pulse: Pulse;
    activeTree?: Lifetree | null;
    onClose: () => void;
    backLabel?: string;
    canEdit?: boolean;
    onEdit?: () => void;
}
export const PulseDetail = ({ pulse, activeTree, onClose, backLabel = "Back", canEdit, onEdit }: PulseDetailProps) => {
    const [depth, setDepth] = useState<number>(3);
    const [isTranslating, setIsTranslating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const images = pulse.imageUrls?.length ? pulse.imageUrls : (pulse.imageUrl ? [pulse.imageUrl] : []);
    const handleTranslate = async () => {
        if (!activeTree) {
            setError("You must have an active Lifetree to translate.");
            return;
        }
        setIsTranslating(true);
        setError(null);
        try {
            const tokenCost = depth;
            await spendAiTokens(activeTree.id, tokenCost);
            const response = await translatePulse({
                senderTreeName: pulse.authorName,
                receiverTreeName: activeTree.name,
                message: pulse.content || pulse.body,
                depth,
            });
            const interpretationData = {
                depth,
                interpretation: response.interpretation,
                confidence: response.confidence,
                alternatives: response.alternatives,
                growthSuggestion: response.growthSuggestion
            };
            await updateDoc(doc(db, 'pulses', pulse.id), {
                aiInterpretation: interpretationData
            });
            pulse.aiInterpretation = interpretationData; // optimistic update
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsTranslating(false);
        }
    };
    return (
        <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300 pb-20 bg-slate-50">
             {/* Header */}
             <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4 flex items-center justify-between">
                <button onClick={onClose} className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-medium">
                    <Icons.ArrowLeft />
                    <span>{backLabel}</span>
                </button>
                <div className="flex items-center gap-2">
                    {pulse.type === 'event' && canEdit && onEdit && (
                        <button onClick={onEdit} className="flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-sky-700">
                            <Icons.Pencil /> Edit
                        </button>
                    )}
                    {pulse.care === 'watering' && (
                        <span className="bg-sky-100 text-sky-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            💧 {pulse.wateringConfirmedBy === 'ai' ? 'Confirmed by AI' : pulse.wateringConfirmedBy === 'guardian' ? 'Confirmed by guardian' : 'Awaiting confirmation'}
                        </span>
                    )}
                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <Icons.Hash /> {pulse.type}
                    </span>
                </div>
            </div>
            <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* Left Column: Visuals & Raw Pulse */}
                 <div className="space-y-6">
                    {images.length > 0 && (
                        <div className="relative h-96 w-full rounded-2xl overflow-hidden shadow-2xl bg-white border border-slate-100 group">
                            <img src={images[activeImageIndex]} alt={pulse.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            {images.length > 1 && (
                                <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto rounded-2xl bg-black/30 p-2 backdrop-blur-md">
                                    {images.map((url, index) => (
                                        <button
                                            key={url}
                                            onClick={() => setActiveImageIndex(index)}
                                            className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 ${activeImageIndex === index ? 'border-white' : 'border-white/30'}`}
                                        >
                                            <img src={url} className="h-full w-full object-cover" alt="" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {/* Metadata Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h1 dir="auto" className="text-2xl font-bold text-slate-800 mb-2">{pulse.title}</h1>
                        <div className="flex items-center space-x-2 text-sm text-slate-500 mb-4">
                             <span>By {pulse.authorName}</span>
                             <span>•</span>
                             <span>{new Date(pulse.createdAt?.toMillis()).toLocaleDateString()}</span>
                        </div>
                        {pulse.type === 'event' && (
                            <div className="mb-4 grid gap-2 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
                                {pulse.eventDate && <div><span className="font-bold">When:</span> {new Date(pulse.eventDate).toLocaleString()}</div>}
                                {pulse.eventLocation && <div><span className="font-bold">Where:</span> {pulse.eventLocation}</div>}
                            </div>
                        )}
                        {pulse.care === 'watering' && (
                            <div className="mb-4 grid gap-1 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
                                <div className="flex items-center gap-2 font-bold">
                                    <Icons.Droplet size={16} />
                                    <span>Watering {pulse.wateringConfirmedBy === 'ai' ? '· confirmed by AI' : pulse.wateringConfirmedBy === 'guardian' ? '· confirmed by a guardian' : '· awaiting confirmation'}</span>
                                </div>
                                {pulse.wateringConfirmation?.note && <div className="italic text-sky-800/90">"{pulse.wateringConfirmation.note}"</div>}
                                {pulse.wateringConfirmedBy === 'ai' && typeof pulse.wateringConfirmation?.confidence === 'number' && (
                                    <div className="text-xs text-sky-700/70">AI confidence: {pulse.wateringConfirmation.confidence}%</div>
                                )}
                            </div>
                        )}
                        <p dir="auto" className="text-slate-600 leading-relaxed whitespace-pre-wrap font-serif text-lg">
                            {pulse.content || pulse.body}
                        </p>
                    </div>
                 </div>
                 {/* Right Column: AI Translation & Network Coherence */}
                 <div className="space-y-6">
                     <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h2 className="text-lg font-bold text-sky-400 uppercase tracking-wider mb-6 flex items-center">
                                <Icons.Sparkles />
                                <span className="ml-2">Translation Depth System</span>
                            </h2>
                            {pulse.aiInterpretation ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="bg-white/10 p-4 rounded-xl border border-white/20">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs uppercase tracking-widest text-indigo-300 font-bold">Interpretation (Depth {pulse.aiInterpretation.depth})</span>
                                            <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-1 rounded font-mono">
                                                {pulse.aiInterpretation.confidence}% Match
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium leading-relaxed">
                                            {pulse.aiInterpretation.interpretation}
                                        </p>
                                    </div>
                                    {pulse.aiInterpretation.alternatives && pulse.aiInterpretation.alternatives.length > 0 && (
                                        <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-2">Alternative Angles</span>
                                            <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside pl-4">
                                                {pulse.aiInterpretation.alternatives.map((alt, i) => (
                                                    <li key={i}>{alt}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {pulse.aiInterpretation.growthSuggestion && (
                                        <div className="bg-emerald-900/40 p-4 rounded-xl border border-emerald-500/30">
                                            <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold block mb-2 flex items-center gap-1">
                                                <Icons.Leaf /> Growth Suggestion
                                            </span>
                                            <p className="text-xs text-emerald-100">
                                                {pulse.aiInterpretation.growthSuggestion}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <p className="text-sm text-indigo-200 font-light">
                                        Use AI tokens (Attention-Energy) to translate this pulse and reveal deeper underlying intent, emotion, or systemic context.
                                    </p>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
                                            <span>Depth Level</span>
                                            <span>{depth} / 7</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="1" max="7" 
                                            value={depth} 
                                            onChange={(e) => setDepth(Number(e.target.value))}
                                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                        />
                                        <div className="text-[10px] text-slate-400 flex justify-between">
                                            <span>1: Summary</span>
                                            <span>7: Initiation</span>
                                        </div>
                                    </div>
                                    <div className="bg-black/20 p-4 rounded-xl border border-white/10 flex items-center justify-between">
                                        <div>
                                            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Energy Cost</div>
                                            <div className="text-lg font-mono font-bold text-amber-400">{depth} AI Tokens</div>
                                        </div>
                                        {activeTree && (
                                            <div className="text-right">
                                                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Your Balance</div>
                                                <div className="text-lg font-mono font-bold text-white">{activeTree.aiTokenBalance || 0}</div>
                                            </div>
                                        )}
                                    </div>
                                    {error && <div className="text-xs text-red-400 bg-red-900/30 border border-red-500/50 p-3 rounded-lg">{error}</div>}
                                    <button 
                                        disabled={isTranslating || !activeTree || (activeTree.aiTokenBalance || 0) < depth}
                                        onClick={handleTranslate}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-indigo-900/50 transition-all active:scale-95 flex justify-center items-center gap-2"
                                    >
                                        {isTranslating ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <Icons.Sparkles />}
                                        {isTranslating ? "Translating..." : "Translate Pulse"}
                                    </button>
                                    {!activeTree && <p className="text-[10px] text-center text-rose-400">You need an active Lifetree to perform translations.</p>}
                                    {activeTree && (activeTree.aiTokenBalance || 0) < depth && <p className="text-[10px] text-center text-amber-400">Not enough AI tokens. Validate observations to earn more.</p>}
                                </div>
                            )}
                        </div>
                     </div>
```

### ./components/VisionCard.tsx
```
import React from 'react';
import { type Vision } from '../types';
import { Icons } from './ui/Icons';
import { DefaultCardImage } from './ui/DefaultCardImage';
export const VisionCard = ({ vision }: { vision: Vision }) => {
    const isRoot = (vision.title || '').trim().toLowerCase() === 'root vision';
    const heading = (isRoot ? (vision.body || vision.description) : vision.title) || 'Vision';
    const subtext = isRoot ? (vision.description || '') : (vision.body || '');
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300 group">
            <div className="relative h-36 bg-amber-50 overflow-hidden">
                {vision.imageUrl ? (
                    <img src={vision.imageUrl} alt={heading} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                    <DefaultCardImage />
                )}
                {/* Title Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none"></div>
                <div className="absolute bottom-2 left-3 right-3 text-white pointer-events-none">
                     <h3 dir="auto" className="text-lg font-light tracking-wide line-clamp-2">{heading}</h3>
                </div>
                {vision.link && (
                    <a href={vision.link} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-amber-600 hover:text-amber-800 hover:scale-110 transition-all shadow-sm z-10">
                        <Icons.Globe />
                    </a>
                )}
            </div>
            <div className="p-3">
                <p dir="auto" className="text-slate-600 text-xs font-light italic leading-relaxed truncate">
                    {subtext ? `"${subtext}"` : ' '}
                </p>
                {/* Matches layout height roughly by having same p-3 */}
            </div>
        </div>
    );
}
```

### ./components/VisionDetail.tsx
```
import React, { useState, useEffect } from 'react';
import { showAlert } from "./ui/Dialog";
import { Vision } from '../types';
import { Icons } from './ui/Icons';
import { useLanguage } from '../contexts/LanguageContext';
import { canJoinVision } from '../src/domain/policy';
import { firestoreStore } from '../src/adapters/firestore';
import { participants, isParticipant } from '../src/domain/views/participation';
interface VisionDetailProps {
    vision: Vision;
    onClose: () => void;
    currentUserId?: string;
    onDelete?: (id: string) => void;
}
export const VisionDetail = ({ vision, onClose, currentUserId, onDelete }: VisionDetailProps) => {
    const { t } = useLanguage();
    const isAuthor = currentUserId === vision.authorId;
    const isRoot = vision.title.toLowerCase() === 'root vision';
    const [isJoined, setIsJoined] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [participantCount, setParticipantCount] = useState(0);
    useEffect(() => {
        let alive = true;
        firestoreStore.linksTo(vision.id, 'joined').then(links => {
            if (!alive) return;
            setIsJoined(isParticipant(links, currentUserId));
            setParticipantCount(participants(links).length);
        }).catch(() => {});
        return () => { alive = false; };
    }, [vision.id, currentUserId]);
    const handleJoinToggle = async () => {
        if (!canJoinVision(currentUserId) || isUpdating) return;
        setIsUpdating(true);
        try {
            if (isJoined) {
                await firestoreStore.unlink(currentUserId, 'joined', vision.id);
                setIsJoined(false);
                setParticipantCount(prev => Math.max(0, prev - 1));
            } else {
                await firestoreStore.link(currentUserId, 'joined', vision.id);
                setIsJoined(true);
                setParticipantCount(prev => prev + 1);
            }
        } catch (e: any) {
            showAlert("Action failed: " + e.message);
        }
        setIsUpdating(false);
    }
    return (
        <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300 pb-20">
             {/* Header */}
             <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4 flex items-center justify-between">
                <button onClick={onClose} className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-medium">
                    <Icons.ArrowLeft />
                    <span>{t('back')}</span>
                </button>
                <div className="flex gap-2">
                    {currentUserId && !isAuthor && (
                        <button 
                            onClick={handleJoinToggle}
                            disabled={isUpdating}
                            className={`px-4 py-2 rounded-full font-bold text-xs shadow-sm transition-all border flex items-center gap-1 active:scale-95 ${isJoined ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600'}`}
                        >
                            <Icons.SparkleFill />
                            <span>{isJoined ? 'Joined' : 'Join Vision'}</span>
                        </button>
                    )}
                    {isAuthor && !isRoot && onDelete && (
                        <button 
                            onClick={() => onDelete(vision.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-full font-bold text-xs shadow-sm transition-all border border-red-200 flex items-center gap-1 active:scale-95"
                        >
                            <Icons.Trash />
                            <span>Delete Vision</span>
                        </button>
                    )}
                </div>
                {isAuthor && isRoot && (
                    <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-[10px] font-bold border border-emerald-100 flex items-center gap-1">
                        <Icons.ShieldCheck />
                        <span>ROOT ANCHOR</span>
                    </div>
                )}
            </div>
            <div className="max-w-3xl mx-auto p-6 space-y-6">
                 <div className="relative h-96 w-full rounded-2xl overflow-hidden shadow-2xl bg-amber-50">
                     {vision.imageUrl ? (
                         <img src={vision.imageUrl} alt={vision.title} className="w-full h-full object-cover" />
                     ) : (
                         <div className="w-full h-full flex items-center justify-center text-amber-200">
                             <Icons.Eye />
                         </div>
                     )}
                     <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                     <div className="absolute bottom-6 left-6 right-6 text-white">
                         <h1 dir="auto" className="text-4xl md:text-5xl font-light tracking-tight mb-2">{vision.title}</h1>
                         <div className="flex items-center space-x-4 text-white/80 text-sm">
                             <span>Created by {vision.authorId.substring(0,6)}...</span>
                             {participantCount > 0 && (
                                <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-xs backdrop-blur-sm">
                                    <Icons.Globe /> {participantCount} joined
                                </span>
                             )}
                         </div>
                     </div>
                 </div>
                 <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100">
                     <h2 className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-4 flex items-center">
                         <Icons.FingerPrint /> 
                         <span className="ml-2">{t('vision')}</span>
                     </h2>
                     <p dir="auto" className="text-xl font-serif text-slate-700 leading-relaxed whitespace-pre-wrap">
                         {vision.body}
                     </p>
                     {vision.link && (
                         <div className="mt-8 pt-6 border-t border-slate-100">
                             <a 
                                 href={vision.link} 
                                 target="_blank" 
                                 rel="noopener noreferrer" 
                                 className="inline-flex items-center space-x-2 text-amber-600 hover:text-amber-800 font-medium transition-colors"
                             >
                                 <Icons.Globe />
                                 <span>{vision.link}</span>
                             </a>
                         </div>
                     )}
                 </div>
            </div>
        </div>
    );
}
```

### ./components/modals/CreateVisionModal.tsx
```
import React, { useState, FormEvent } from 'react';
import { showAlert } from "../ui/Dialog";
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { ImagePicker } from '../ui/ImagePicker';
import { Lightseed, Lifetree } from '../../types';
import { generateVisionImage } from '../../services/gemini';
import { checkAndIncrementAiUsage } from '../../services/firebase';
interface CreateVisionModalProps {
  lightseed: Lightseed | null;
  activeTree: Lifetree | null;
  onClose: () => void;
  onCreate: (data: any) => Promise<void>;
  uploading: boolean;
  handleImageUpload: (file: File, path: string) => Promise<string>;
  uploadBase64Image: (base64: string, path: string) => Promise<string>;
}
export const CreateVisionModal: React.FC<CreateVisionModalProps> = ({
  lightseed,
  activeTree,
  onClose,
  onCreate,
  uploading,
  handleImageUpload,
  uploadBase64Image
}) => {
  const { t } = useLanguage();
  const [visionTitle, setVisionTitle] = useState('');
  const [visionBody, setVisionBody] = useState('');
  const [visionLink, setVisionLink] = useState('');
  const [visionImageUrl, setVisionImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localUploading, setLocalUploading] = useState(false);
  const handleGenerateImage = async () => {
    if (!visionBody) { showAlert("Please enter a vision description first."); return; }
    setLocalUploading(true);
    try {
        const allowed = await checkAndIncrementAiUsage('image');
        if (!allowed) {
            showAlert(t('ai_login_required'));
            setLocalUploading(false);
            return;
        }
        const url = await generateVisionImage(visionBody);
        if (url) {
            setVisionImageUrl(url);
        } else {
            throw new Error("No image data returned from AI service.");
        }
    } catch (e: any) {
         showAlert(`Image generation failed: ${e.message || t('daily_limit_image')}`);
    } finally { setLocalUploading(true); }
    setLocalUploading(false);
  }
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!lightseed || !activeTree || isSubmitting) return;
    setIsSubmitting(true);
    try {
        let finalImageUrl = visionImageUrl;
        if (visionImageUrl.startsWith('data:')) {
            finalImageUrl = await uploadBase64Image(visionImageUrl, `users/${lightseed.uid}/visions/ai/${Date.now()}`);
        }
        await onCreate({
            lifetreeId: activeTree.id,
            authorId: lightseed.uid,
            title: visionTitle,
            body: visionBody,
            link: visionLink,
            imageUrl: finalImageUrl
        });
        onClose();
    } catch(e:any) { 
        showAlert(e.message); 
    } finally { setIsSubmitting(false); }
  }
  return (
    <Modal title={t('create_vision')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <ImagePicker 
            onImageSelect={(file) => handleImageUpload(file, `users/${lightseed?.uid}/visions/${Date.now()}`).then(setVisionImageUrl)} 
            previewUrl={visionImageUrl} 
            loading={uploading || localUploading} 
        />
        <div className="flex justify-end">
             <button 
                type="button" 
                onClick={handleGenerateImage}
                disabled={uploading || localUploading || !visionBody}
                className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold hover:bg-amber-200 disabled:opacity-50 flex items-center gap-1"
             >
                 <Icons.Sparkles /> 
                 <span>{t('generate_image')}</span>
             </button>
        </div>
        <input 
            dir="auto" 
            className="block w-full border border-slate-300 p-2 rounded-lg" 
            placeholder={t('title')} 
            value={visionTitle} 
            onChange={e=>setVisionTitle(e.target.value)} 
            required 
        />
        <textarea 
            dir="auto" 
            rows={3}
            className="block w-full resize-none overflow-hidden border border-slate-300 p-2 rounded-lg min-h-[76px]" 
            placeholder={t('body')} 
            value={visionBody} 
            onChange={e=>setVisionBody(e.target.value)}
            onInput={(e) => {
                const target = e.currentTarget;
                target.style.height = '0px';
                target.style.height = `${target.scrollHeight}px`;
            }}
            required 
        />
        <input 
            dir="ltr" 
            className="block w-full border border-slate-300 p-2 rounded-lg" 
            placeholder={t('webpage')} 
            value={visionLink} 
            onChange={e=>setVisionLink(e.target.value)} 
        />
        <button 
            type="submit" 
            disabled={uploading || localUploading || isSubmitting} 
            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold shadow-md disabled:opacity-50"
        >
            {isSubmitting ? t('creating') : t('create_vision')}
        </button>
      </form>
    </Modal>
  );
};
```

### ./components/modals/EmitPulseModal.tsx
```
import React, { useState, useEffect, FormEvent } from 'react';
import { showAlert } from "../ui/Dialog";
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { ImagePicker } from '../ui/ImagePicker';
import { Pulse, Lightseed, Lifetree, Vision } from '../../types';
import { getMyVisions } from '../../services/firebase';
interface EmitPulseModalProps {
  lightseed: Lightseed | null;
  activeTree: Lifetree | null;
  matchCandidate: Pulse | null;
  targetTree?: Lifetree | null;
  onClose: () => void;
  onMint: (data: any) => Promise<void>;
  onProposeAlignment: (data: any) => Promise<void>;
  onGrown?: (treeId: string, imageUrl?: string) => void;
  uploading: boolean;
  handleImageUpload: (file: File, path: string) => Promise<string>;
  uploadBase64Image: (base64: string, path: string) => Promise<string>;
}
type GrowthKind = 'tree' | 'vision';
const GrowthCard = ({ onClick, disabled, image, icon, title, desc, note, gradient }: {
  onClick: () => void; disabled?: boolean; image?: string; icon: React.ReactNode;
  title: string; desc: string; note?: string; gradient: string;
}) => (
  <button
    type="button"
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    className={`group relative min-h-[170px] overflow-hidden rounded-2xl border border-white/10 text-left shadow-lg transition-transform ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:scale-[1.02]'}`}
  >
    {image
      ? <img src={image} alt={title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
      : <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />}
    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
    <div className="relative flex h-full flex-col justify-end p-4 text-white">
      <span className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur">{icon}</span>
      <div className="text-sm font-bold uppercase tracking-widest">{title}</div>
      <div className="mt-1 text-xs opacity-80">{desc}</div>
      {note && <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">{note}</div>}
    </div>
  </button>
);
export const EmitPulseModal: React.FC<EmitPulseModalProps> = ({
  lightseed,
  activeTree,
  matchCandidate,
  targetTree = null,
  onClose,
  onMint,
  onProposeAlignment,
  onGrown,
  uploading,
  handleImageUpload,
  uploadBase64Image
}) => {
  const { t } = useLanguage();
  const growthTree = targetTree || activeTree;
  const [growthKind, setGrowthKind] = useState<GrowthKind | null>(targetTree ? 'tree' : null);
  const [myVisions, setMyVisions] = useState<Vision[]>([]);
  const [selectedVision, setSelectedVision] = useState<Vision | null>(null);
  const [growthCategory, setGrowthCategory] = useState<string>('');
  const [pulseTitle, setPulseTitle] = useState('');
  const [pulseBody, setPulseBody] = useState('');
  const [pulseImageUrl, setPulseImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => {
    if (lightseed?.uid) getMyVisions(lightseed.uid).then(setMyVisions).catch(() => {});
  }, [lightseed?.uid]);
  const treeImage = growthTree?.latestGrowthUrl || growthTree?.imageUrl || '';
  const chooseTree = () => { setGrowthKind('tree'); setPulseImageUrl(''); };
  const chooseVision = () => {
    setGrowthKind('vision');
    if (myVisions.length === 1) pickVision(myVisions[0]);
  };
  const pickVision = (v: Vision) => { setSelectedVision(v); setPulseImageUrl(v.imageUrl || ''); };
  const backToChoice = () => { setGrowthKind(null); setSelectedVision(null); setGrowthCategory(''); setPulseImageUrl(''); };
  const handleMint = async (e: FormEvent) => {
    e.preventDefault();
    if (!lightseed || isSubmitting) return;
    const lifetreeId = growthKind === 'tree'
      ? (growthTree?.id || '')
      : (selectedVision?.lifetreeId || growthTree?.id || '');
    if (!lifetreeId) {
      showAlert(growthKind === 'vision' ? 'This vision is not rooted in a tree yet, so it cannot grow.' : 'Plant a lifetree before emitting growth.');
      return;
    }
    setIsSubmitting(true);
    try {
      let finalImageUrl = pulseImageUrl;
      if (pulseImageUrl.startsWith('data:')) {
        finalImageUrl = await uploadBase64Image(pulseImageUrl, `users/${lightseed.uid}/pulses/ai/${Date.now()}`);
      }
      await onMint({
        lifetreeId,
        type: growthKind === 'tree' ? 'GROWTH' : 'growth',
        ...(growthKind === 'vision' && selectedVision
          ? { visionId: selectedVision.id, visionTitle: selectedVision.title, growthCategory }
          : {}),
        title: pulseTitle.trim() || (growthKind === 'tree'
          ? `${growthTree?.name || 'Tree'} growth`
          : (selectedVision?.title ? `${selectedVision.title} growth` : 'Vision growth')),
        body: pulseBody,
        imageUrl: finalImageUrl,
        authorId: lightseed.uid,
        authorName: lightseed.displayName || "Soul",
        authorPhoto: lightseed.photoURL || undefined,
      });
      if (growthKind === 'tree' && lifetreeId) onGrown?.(lifetreeId, finalImageUrl || undefined);
      onClose();
    } catch (e: any) {
      showAlert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleAlignment = async (e: FormEvent) => {
    e.preventDefault();
    if (!lightseed || !activeTree || !matchCandidate || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onProposeAlignment({
        initiatorPulseId: "PENDING_CREATION",
        initiatorTreeId: activeTree.id,
        initiatorUid: lightseed.uid,
        targetPulseId: matchCandidate.id,
        targetTreeId: matchCandidate.lifetreeId,
        targetUid: matchCandidate.authorId
      });
      showAlert("Alignment Proposed! Waiting for resonance.");
      onClose();
    } catch (e: any) {
      showAlert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <Modal title={matchCandidate ? t('propose_alignment') : (targetTree ? `Grow ${targetTree.name}` : t('emit_pulse'))} onClose={onClose}>
      {matchCandidate ? (
        <form onSubmit={handleAlignment} className="flex flex-col gap-4">
          <div className="bg-sky-50 p-4 rounded text-sky-800">
            {t('alignment_with')} <strong>{matchCandidate.title}</strong>.
            <br /><span className="text-xs">{t('alignment_request_desc')}</span>
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 text-white py-2 rounded disabled:opacity-50 font-bold uppercase tracking-wider shadow-md">
            {isSubmitting ? t('minting') : t('send_request')}
          </button>
        </form>
      ) : growthKind === null ? (
        <div className="space-y-3">
          <p className="text-center text-sm text-slate-500">A pulse is a moment of growth. What is growing?</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <GrowthCard
              onClick={chooseTree}
              disabled={!activeTree}
              image={treeImage}
              gradient="from-emerald-500 to-emerald-800"
              icon={<Icons.Tree />}
              title="Tree Growth"
              desc="New leaves, photos, milestones — observe your tree growing."
              note={!activeTree ? 'Plant a lifetree first' : undefined}
            />
            <GrowthCard
              onClick={chooseVision}
              disabled={myVisions.length === 0}
              image={myVisions[0]?.imageUrl}
              gradient="from-amber-500 to-purple-700"
              icon={<Icons.Sparkles />}
              title="Vision Growth"
              desc="Inspiration, funding, collaboration — observe a vision growing."
              note={myVisions.length === 0 ? 'Create a vision first' : undefined}
            />
          </div>
        </div>
      ) : (
        <form onSubmit={handleMint} className="flex flex-col gap-4">
          {!targetTree && (
            <button type="button" onClick={backToChoice} className="flex w-fit items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800">
              <Icons.ArrowLeft /> <span>Back</span>
            </button>
          )}
          {growthKind === 'tree' && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="text-xs leading-relaxed text-emerald-800/80">
                Upload a new photo of your tree. It becomes the tree's <span className="font-bold">latest image</span> and joins its growth timeline — played from the tree's profile.
              </p>
              {treeImage && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={treeImage} alt="Current tree" className="h-12 w-12 rounded-lg border border-emerald-200 object-cover" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Current latest</span>
                </div>
              )}
            </div>
          )}
          {growthKind === 'vision' && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Choose the vision</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {myVisions.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => pickVision(v)}
                    title={v.title}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${selectedVision?.id === v.id ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-transparent opacity-80 hover:opacity-100'}`}
                  >
                    {v.imageUrl
                      ? <img src={v.imageUrl} alt={v.title} className="h-full w-full object-cover" />
                      : <span className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-300"><Icons.Eye /></span>}
                  </button>
                ))}
              </div>
              {selectedVision && <p className="text-xs text-slate-500">Growing: <span className="font-bold text-slate-700">{selectedVision.title}</span></p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {['Inspiration', 'Funding', 'Collaboration', 'Other'].map(c => (
                  <button key={c} type="button" onClick={() => setGrowthCategory(c)} className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${growthCategory === c ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{c}</button>
                ))}
              </div>
```

### ./config/default.ts
```
import { AppConfig } from './types';
export const defaultConfig: AppConfig = {
  name: '.seed',
  logo: {
    backgroundFill: 'white',
    strokeColor: '#334155',
    seedFill: 'white',
  },
  theme: {
    primary: '#059669', // emerald-600
    secondary: '#0284c7', // sky-600
    accent: '#f59e0b', // amber-500
    neutral: '#334155', // slate-700
    background: '#ffffff',
    mode: 'light',
    surface: '#ffffff',
    text: '#0f172a',
  },
  domain: 'lightseed.online',
  model: 'gemini-3.5-flash',
  githubActionsEnabled: false,
  inviteOnly: true,
};
```

### ./config/types.ts
```
export interface ThemeConfig {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
  background: string;
  mode?: 'light' | 'dark';
  surface?: string;
  text?: string;
}
export interface AppConfig {
  name: string;
  logoUrl?: string;
  logo: {
    backgroundFill?: string;
    strokeColor?: string;
    seedFill?: string;
  };
  theme: ThemeConfig;
  domain: string;
  model: string;
  githubActionsEnabled: boolean;
  inviteOnly: boolean;
}
```

### ./firebase.json
```
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "predeploy": "npm run build",
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "comment": "Fingerprinted assets never change — cache them forever.",
        "source": "/assets/**",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
        ]
      },
      {
        "comment": "Always revalidate the HTML shell so a new deploy is picked up immediately.",
        "source": "/index.html",
        "headers": [
          { "key": "Cache-Control", "value": "no-cache, max-age=0, must-revalidate" }
        ]
      }
    ]
  },
  "storage": {
    "rules": "storage.rules"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": [
        "node_modules",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log"
      ]
    }
  ]
}```

### ./firestore.indexes.json
```
{
  "indexes": [
    {
      "collectionGroup": "lifetrees",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "ownerId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "isNature",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "pulses",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "lifetreeId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "type",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "pulses",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "authorId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "pulses",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "recipientUid", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "pulses",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "authorId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "pulses",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "authorId", "order": "ASCENDING" },
        { "fieldPath": "reachTreeId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "pulses",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "lifetreeId", "order": "ASCENDING" },
        { "fieldPath": "type", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "pulses",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "recipientUid", "order": "ASCENDING" },
        { "fieldPath": "lifetreeId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "networkInvites",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "invitedByUserId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "pulses",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "communityId", "order": "ASCENDING" },
        { "fieldPath": "visibility", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "pulses",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "domain", "order": "ASCENDING" },
        { "fieldPath": "visibility", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "pulses",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "visibility", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "links",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "to", "order": "ASCENDING" },
        { "fieldPath": "rel", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "links",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "from", "order": "ASCENDING" },
        { "fieldPath": "rel", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### ./functions/tsconfig.json
```
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "target": "es2022",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["es2022"]
  },
  "compileOnSave": true,
  "include": [
    "src"
  ]
}
```

### ./hooks/useConfig.ts
```
import { useMemo } from 'react';
import { Community } from '../types';
import { defaultConfig } from '../config/default';
import { normalizeTheme, oldEmeraldEarthTheme } from '../utils/theme';
export const isHubDomain = (domain?: string) => {
    if (!domain) return true;
    const d = domain.toLowerCase().replace(/^www\./, '');
    return d === 'lightseed.online' || d === 'lifeseed.online' || d === 'localhost' || d === '127.0.0.1' || d.startsWith('192.168.') || d.endsWith('.local');
};
const isPreviousLifeseedDefaultTheme = (theme: Community['theme']) =>
  theme?.primary === '#10b981' &&
  theme?.secondary === '#2563eb' &&
  theme?.accent === '#f59e0b' &&
  theme?.background === '#ffffff' &&
  (theme?.surface === undefined || theme.surface === '#ffffff') &&
  (theme?.text === undefined || theme.text === '#0f172a') &&
  (theme?.mode === undefined || theme.mode === 'light');
export const useConfig = (hostCommunity: Community | null) => {
  return useMemo(() => {
    const hostDomain = (hostCommunity?.domain || (typeof window !== 'undefined' ? window.location.hostname : defaultConfig.domain))
      .toLowerCase()
      .replace(/^www\./, '');
    const domainDefaultTheme = normalizeTheme(hostDomain === 'lifeseed.online' ? oldEmeraldEarthTheme : defaultConfig.theme);
    if (!hostCommunity) {
      return {
        ...defaultConfig,
        name: hostDomain === 'lifeseed.online' ? 'lifeseed' : defaultConfig.name,
        domain: hostDomain || defaultConfig.domain,
        theme: domainDefaultTheme,
      };
    }
    return {
      ...defaultConfig,
      name: hostCommunity.name || defaultConfig.name,
      logoUrl: hostCommunity.logoUrl,
      domain: hostCommunity.domain || defaultConfig.domain,
      theme: normalizeTheme(
        hostDomain === 'lifeseed.online' && isPreviousLifeseedDefaultTheme(hostCommunity.theme)
          ? undefined
          : hostCommunity.theme,
        domainDefaultTheme as any
      )
    };
  }, [hostCommunity]);
};
```

### ./lifeseed.config.json
```
{
  "model": "gemini-3.5-flash",
  "githubActionsEnabled": false
}
```

### ./services/firebase.ts
```
import '../utils/polyfill';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  type User as FirebaseUser,
  signOut as firebaseSignOut,
  deleteUser as firebaseDeleteUser
} from 'firebase/auth';
import { 
  initializeFirestore, 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  addDoc,
  setDoc,
  serverTimestamp,
  doc,
  runTransaction,
  getDoc,
  where,
  updateDoc,
  deleteDoc,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  arrayUnion,
  writeBatch,
  deleteField,
  onSnapshot,
  getCountFromServer,
  Timestamp
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  uploadString
} from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { type Pulse, type PulseType, type Lifetree, type Alignment, type Vision, type Community, type Sanctuary, type TreeOwnershipInvite, type InvitableRole, type Decision, type DecisionNature, votesRequired, type ReachAudience } from '../types';
import { createBlock } from '../utils/crypto';
import { uuidv7 } from '../utils/id';
import type { PulseVisibility } from '../src/domain/pulse';
import { daysOverdue, computeNextDueMillis, wateringAlertedToday, type WateringMode, type WateringAnalysis } from '../src/domain/watering';
import { oldEmeraldEarthThemeValues } from '../utils/theme';
import { isExplicitlyValidatedTree } from '../utils/validation';
import { buildThreadId, buildGroupThreadId, reachAudienceLabels } from '../utils/reachPermissions';
const toMillis = (value: any): number =>
    value?.toMillis ? value.toMillis() : (value instanceof Date ? value.getTime() : 0);
const SYSTEM_EMAIL_FROM = "lightseed <admin@lightseed.online>";
const getEnv = (key: string) => {
    return (window as any).process?.env?.[key] || (import.meta as any).env?.[key] || "";
};
const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID'),
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID')
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const storage = getStorage(app);
export const functions = getFunctions(app);
const googleProvider = new GoogleAuthProvider();
const mailCollection = collection(db, 'mail');
const subsCollection = collection(db, 'subscriptions');
const usersCollection = collection(db, 'users');
const lifetreesCollection = collection(db, 'lifetrees');
const visionsCollection = collection(db, 'visions');
const pulsesCollection = collection(db, 'pulses');
const alignmentsCollection = collection(db, 'alignments');
const communitiesCollection = collection(db, 'communities');
const sanctuariesCollection = collection(db, 'sanctuaries');
const networkInvitesCollection = collection(db, 'networkInvites');
const newsletterConfigRef = doc(db, 'config', 'newsletter');
export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => onAuthStateChanged(auth, callback);
const ensureUserProfile = async (user: FirebaseUser, extra: Record<string, any> = {}): Promise<boolean> => {
    const ref = doc(db, 'users', user.uid);
    if ((await getDoc(ref)).exists()) return false;
    await setDoc(ref, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || (extra as any).displayName || '',
        createdAt: serverTimestamp(),
        newsletterSubscribed: false,
        emailNotifications: { directMessages: true },
        invitesRemaining: 7,
        dailyAiText: 0,
        dailyAiImage: 0,
        lastAiReset: Date.now(),
        ...extra,
    });
    try {
        await triggerSystemEmail(user.email || "", "Welcome to lightseed",
            `Welcome to lightseed${user.displayName ? ", " + user.displayName : ""}. You have planted your intention. Now you may plant your tree.`, user.uid);
    } catch (e) { console.warn("Welcome email could not be sent:", e); }
    return true;
};
const resolveInviteOnSignup = async (email: string | null, opts: { inviteId?: string; inviteOnly?: boolean }): Promise<{ invitedBy?: string; consume?: string }> => {
    if (!opts.inviteOnly) {
        if (!opts.inviteId) return {};
        const invite = await getNetworkInvite(opts.inviteId);
        return invite && invite.status === 'pending' ? { invitedBy: invite.invitedByUserId, consume: invite.id } : {};
    }
    const invite = opts.inviteId ? await getNetworkInvite(opts.inviteId) : null;
    if (!invite || invite.status !== 'pending') throw new Error('INVITE_ONLY');
    return { invitedBy: invite.invitedByUserId, consume: invite.id };
};
export const signInWithGoogle = async (opts: { inviteId?: string; inviteOnly?: boolean } = {}) => {
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const existing = await getDoc(doc(db, 'users', user.uid));
    if (!existing.exists()) {
        let resolved;
        try {
            resolved = await resolveInviteOnSignup(user.email, opts);
        } catch (e) {
            await firebaseSignOut(auth); // new account blocked by invite-only
            throw e;
        }
        if (resolved.consume) await consumeNetworkInvite(resolved.consume, user.uid);
        await ensureUserProfile(user, { acceptedTerms: true, ...(resolved.invitedBy ? { invitedBy: resolved.invitedBy } : {}) });
    }
    return user;
};
export const signUpWithEmail = async (email: string, password: string, displayName: string, opts: { inviteId?: string; inviteOnly?: boolean } = {}) => {
    const resolved = await resolveInviteOnSignup(email, opts); // validate the invite before creating the account
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const user = cred.user;
    if (displayName.trim()) { try { await updateProfile(user, { displayName: displayName.trim() }); } catch {} }
    if (resolved.consume) await consumeNetworkInvite(resolved.consume, user.uid);
    await ensureUserProfile(user, { displayName: displayName.trim(), acceptedTerms: true, ...(resolved.invitedBy ? { invitedBy: resolved.invitedBy } : {}) });
    try { await sendEmailVerification(user); } catch (e) { console.warn("Verification email failed:", e); }
    return user;
};
export const signInWithEmail = (email: string, password: string) =>
    signInWithEmailAndPassword(auth, email.trim(), password).then(c => c.user);
export const sendVerificationEmail = () =>
    auth.currentUser ? sendEmailVerification(auth.currentUser) : Promise.reject(new Error('Not signed in'));
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email.trim());
export const createNetworkInvite = async (email: string, invitedByUserId: string, message = ''): Promise<{ id: string; link: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) throw new Error('Please enter a valid email.');
    await runTransaction(db, async (t) => {
        const ref = doc(db, 'users', invitedByUserId);
        const snap = await t.get(ref);
        if (!snap.exists()) throw new Error('User profile not found.');
        const remaining = snap.data().invitesRemaining || 0;
        if (remaining <= 0) throw new Error('No invites remaining.');
        t.update(ref, { invitesRemaining: remaining - 1 });
    });
    const ref = await addDoc(networkInvitesCollection, {
        email: cleanEmail, invitedByUserId, status: 'pending', message, createdAt: serverTimestamp(),
    });
    const link = `${window.location.origin}?invite=${ref.id}`;
    try {
        await triggerSystemEmail(cleanEmail, 'You are invited to lightseed',
            `${message ? `"${message}"\n\n` : ''}You have been invited to join the lightseed network. Accept your invitation here: ${link}`, invitedByUserId);
    } catch (e) { console.warn('Invite email failed:', e); }
    return { id: ref.id, link };
};
export const getNetworkInvite = async (inviteId: string): Promise<any | null> => {
    const snap = await getDoc(doc(db, 'networkInvites', inviteId));
    return snap.exists() ? { id: snap.id, ...(snap.data() as any) } : null;
};
const INVITE_PAGE = 12;
type Paged = { items: any[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean };
export const getSentInvites = async (userId: string, lastDoc?: QueryDocumentSnapshot): Promise<Paged> => {
    let q = query(networkInvitesCollection, where('invitedByUserId', '==', userId), orderBy('createdAt', 'desc'), limit(INVITE_PAGE));
    if (lastDoc) q = query(q, startAfter(lastDoc));
    const snap = await getDocs(q);
    return { items: snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })), lastDoc: snap.docs[snap.docs.length - 1] || null, hasMore: snap.docs.length === INVITE_PAGE };
};
export const consumeNetworkInvite = (inviteId: string, acceptedByUserId: string) =>
    updateDoc(doc(db, 'networkInvites', inviteId), { status: 'accepted', acceptedByUserId, acceptedAt: serverTimestamp() });
const inviteRequestsCollection = collection(db, 'inviteRequests');
export const createInviteRequest = async (email: string, reason: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) throw new Error('Please enter a valid email.');
    await addDoc(inviteRequestsCollection, {
        email: cleanEmail, reason: reason.trim(), status: 'pending', createdAt: serverTimestamp(),
    });
};
export const getInviteRequests = async (lastDoc?: QueryDocumentSnapshot): Promise<Paged> => {
    let q = query(inviteRequestsCollection, orderBy('createdAt', 'desc'), limit(INVITE_PAGE));
    if (lastDoc) q = query(q, startAfter(lastDoc));
    const snap = await getDocs(q);
    return { items: snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })), lastDoc: snap.docs[snap.docs.length - 1] || null, hasMore: snap.docs.length === INVITE_PAGE };
};
export const submitInviteRequest = async (email: string, reason: string): Promise<string> => {
    const callable = httpsCallable(functions, 'requestInvite');
    const res = await callable({ email, reason });
    return (res.data as any)?.status as string;
};
export const approveInviteRequest = async (requestId: string, adminUid: string) => {
    const reqRef = doc(db, 'inviteRequests', requestId);
    const snap = await getDoc(reqRef);
    if (!snap.exists()) throw new Error('Request not found.');
    const invite = await createNetworkInvite((snap.data() as any).email, adminUid);
    await updateDoc(reqRef, { status: 'approved', approvedBy: adminUid, approvedAt: serverTimestamp() });
    return invite;
};
export const declineInviteRequest = (requestId: string) =>
    updateDoc(doc(db, 'inviteRequests', requestId), { status: 'declined', declinedAt: serverTimestamp() });
export const logout = () => firebaseSignOut(auth);
```

### ./src/adapters/firestore.ts
```
import type { Store } from '../domain/store';
import type { Link, LinkRel } from '../domain/link';
import { db } from '../../services/firebase';
import { collection, doc, getDocs, query, where, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { uuidv7 } from '../../utils/id';
const linksCol = collection(db, 'links');
const linkId = (from: string, rel: LinkRel, to: string) => `${from}__${rel}__${to}`;
export const firestoreStore: Store = {
  async linksTo(toId: string, rel?: LinkRel): Promise<Link[]> {
    const q = rel
      ? query(linksCol, where('to', '==', toId), where('rel', '==', rel))
      : query(linksCol, where('to', '==', toId));
    return (await getDocs(q)).docs.map(d => d.data() as Link);
  },
  async linksFrom(from: string, rel?: LinkRel): Promise<Link[]> {
    const q = rel
      ? query(linksCol, where('from', '==', from), where('rel', '==', rel))
      : query(linksCol, where('from', '==', from));
    return (await getDocs(q)).docs.map(d => d.data() as Link);
  },
  async linksByRel(rel: LinkRel): Promise<Link[]> {
    return (await getDocs(query(linksCol, where('rel', '==', rel)))).docs.map(d => d.data() as Link);
  },
  async link(from: string, rel: LinkRel, to: string): Promise<void> {
    await setDoc(doc(db, 'links', linkId(from, rel, to)),
      { lid: uuidv7(), type: 'link', rel, from, to, createdAt: serverTimestamp() });
  },
  async unlink(from: string, rel: LinkRel, to: string): Promise<void> {
    await deleteDoc(doc(db, 'links', linkId(from, rel, to)));
  },
};
```

### ./src/domain/community.ts
```
import type { Timestamp } from 'firebase/firestore';
import type { Entity } from './entity';
export interface Community extends Entity {
  id: string;
  ownerId: string;
  name: string;
  domain: string; // The link to Lifetree
  vision: string; // Rich text
  imageUrls: string[]; // For carousel
  logoUrl?: string;       // Square brand mark (avatar) — shown in lists and the hero badge
  heroImageUrl?: string;  // Wide banner image shown behind the community page hero
  theme?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    neutral?: string;
    background?: string;
    mode?: 'light' | 'dark';
    surface?: string;
    text?: string;
  };
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  defaultIntelligenceId?: string;
  availableIntelligenceIds?: string[];
  memoryIds?: string[];
  rootLifetreeId?: string;       // the living anchor this community grew from
  founderUserId?: string;
  memberIds?: string[];
  formation?: 'tree_co_ownership' | 'project' | 'organization' | 'manual';
  visibility?: 'private' | 'invited' | 'public';
}
```

### ./src/domain/decision.ts
```
import type { Timestamp } from 'firebase/firestore';
export type DecisionNature = 'intention' | 'purchase' | 'use_grant' | 'admission' | 'stewardship' | 'charter';
export const DECISION_NATURES: { id: DecisionNature; votes: number }[] = [
  { id: 'intention', votes: 1 },    // a shared note / intention — one voice carries it
  { id: 'purchase', votes: 2 },     // spending from the commons — needs two
  { id: 'use_grant', votes: 2 },    // granting the USE of an item (ownership stays fluid)
  { id: 'admission', votes: 3 },    // welcoming a new member
  { id: 'stewardship', votes: 3 },  // appointing or changing a steward
  { id: 'charter', votes: 7 },      // changing the charter — the full circle (odd, decidable)
];
export const votesRequired = (nature: DecisionNature): number =>
  DECISION_NATURES.find(n => n.id === nature)?.votes ?? 1;
export interface Decision {
  id: string;
  lid?: string; // Lightseed ID — the decision's portable, time-ordered true name (UUIDv7).
  communityId: string;
  domain?: string;
  nature: DecisionNature;
  title: string;
  body?: string;        // the proposal — a contract of use & care, not ownership
  subject?: string;     // what it concerns (an item, a person, a use)
  proposedBy: string;   // uid — counts as the first voice
  votes: string[];      // uids who have voiced yes
  votesRequired: number;
  status: 'open' | 'passed';
  previousHash: string;
  hash: string;
  enactedHash?: string; // the block written when the circle reaches the threshold
  createdAt: Timestamp;
  passedAt?: Timestamp;
}
```

### ./src/domain/entity.ts
```
import type { Timestamp } from 'firebase/firestore';
export interface Entity {
  lid?: string;         // Lightseed ID — portable, time-ordered UUIDv7 true-name (utils/id.ts).
  createdAt?: Timestamp; // optional on the base: derived/transient entities (e.g. links an
}
```

### ./src/domain/intelligence.ts
```
import type { Timestamp } from 'firebase/firestore';
export type IntelligenceProviderId =
  | 'google'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'local';
export interface Intelligence {
  id: string;
  lid?: string; // Lightseed ID — the object's portable, time-ordered true name (UUIDv7).
  name: string;
  description?: string;
  provider: IntelligenceProviderId;
  model: string;
  enabled: boolean;
  public: boolean;
  ownerId?: string;
  communityIds?: string[];
  memoryIds?: string[];
  personaId?: string;
  connected?: boolean;
  keyHint?: string;                                  // e.g. "…aB3z"
  credentialScope?: 'user' | 'community' | 'node';   // which key this intelligence draws on
  credentialOwnerId?: string;                        // uid or communityId for that key
  createdAt: Timestamp;
}
export interface Persona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  createdAt: Timestamp;
}
export type MemoryVisibility = 'private' | 'community' | 'public';
export interface Memory {
  id: string;
  lid?: string; // Lightseed ID — durable memory's portable, time-ordered true name (UUIDv7).
  name: string;
  description?: string;
  visibility: MemoryVisibility;
  communityId?: string;
  text?: string;
  sourceIds: string[];
  createdAt: Timestamp;
}
export interface IntelligenceMessage {
  role: 'user' | 'model';
  text: string;
}
export interface MemoryContext {
  text?: string;
  sourceIds?: string[];
}
export type IntelligenceRef = Pick<Intelligence, 'provider' | 'model' | 'credentialScope' | 'credentialOwnerId'>;
export interface IntelligenceProvider {
  id: IntelligenceProviderId;
  sendMessage(
    intelligence: IntelligenceRef,
    messages: IntelligenceMessage[],
    options?: { persona?: Persona | null; memory?: MemoryContext | null }
  ): Promise<string>;
}
```

### ./src/domain/lifetree.ts
```
import type { Timestamp } from 'firebase/firestore';
import type { Entity } from './entity';
import type { WateringSchedule } from './watering';
export type LifetreeType = "human" | "ai" | "community" | "project" | "LIFETREE" | "GUARDED" | "FAMILY";
export interface Lifetree extends Entity {
  id: string;
  ownerId: string; // canonical owner — load-bearing (rules + queries)
  name: string;
  shortTitle?: string;
  body: string; // the tree's vision text (canonical)
  imageUrl?: string;
  latestGrowthUrl?: string; // URL of the most recent growth pulse image
  visionIds?: string[];
  pulseIds?: string[];
  coOwnerIds?: string[];
  observerIds?: string[];
  stewardIds?: string[];
  communityId?: string; // The Tree Circle community rooted in this tree, once formed.
  updatedAt?: Timestamp;
  aiTokenBalance?: number;
  coherenceScore?: number;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  domain?: string; // Associated website domain, e.g. "example.com"
  createdAt: Timestamp;
  onlyValidatedCanReach?: boolean;
  validated: boolean;
  validatorId?: string | null;
  lastTendedAt?: Timestamp;
  isNature?: boolean;
  treeType?: LifetreeType;
  guardians?: string[]; // guardianship (user ids); → links in Phase 2
  status?: 'HEALTHY' | 'DANGER';
  watering?: WateringSchedule;
  genesisHash: string;
  latestHash: string; 
  blockHeight: number;
}
```

### ./src/domain/link.ts
```
import type { Entity } from './entity';
export type LinkRel = 'guardian' | 'co_owner' | 'steward' | 'observer' | 'member' | 'joined';
export interface Link extends Entity {
  type: 'link';
  rel: LinkRel;
  from: string;    // the actor's id (uid)
  to: string;      // the target entity's id (lifetree / community / vision)
  weight?: number; // attention / heat — the energy carried on the edge
}
export const linkId = (from: string, rel: LinkRel, to: string) => `${from}__${rel}__${to}`;
```

### ./src/domain/policy.ts
```
export const canTendTree = (viewerUid?: string | null): viewerUid is string => !!viewerUid;
export const canJoinVision = (viewerUid?: string | null): viewerUid is string => !!viewerUid;
```

### ./src/domain/pulse.ts
```
import type { Timestamp } from 'firebase/firestore';
import type { Entity } from './entity';
import type { ReachAudience } from './reach';
export type LegacyPulseType = 'STANDARD' | 'GROWTH';
export type PulseType = 'observation' | 'dream' | 'offering' | 'request' | 'translation' | 'validation' | 'event' | 'growth' | 'reach' | LegacyPulseType;
export type PulseVisibility = 'public' | 'node' | 'community' | 'circle' | 'private';
export interface PulseInterpretation {
    depth: number;
    interpretation: string;
    confidence: number;
    alternatives?: string[];
    growthSuggestion?: string;
}
export interface Pulse extends Entity {
  id: string;
  lifetreeId?: string; // canonical — the tree this pulse belongs to
  visionId?: string;
  communityId?: string; // Set on community-scoped pulses (community events, decisions).
  type: PulseType;
  visibility?: PulseVisibility;
  title: string; // canonical
  body: string;  // canonical
  content?: string;
  imageUrl?: string;
  imageUrls?: string[];
  eventDate?: string;
  eventLocation?: string;
  reachTreeId?: string;
  reachTreeName?: string;
  reachResponse?: string; // The reached tree's reply, kept so reach threads persist.
  recipientUid?: string | null; // Owner of the reached tree — drives 1:1 inbox routing + email delivery.
  recipientName?: string;
  seenBy?: string[];
  threadId?: string; // Deterministic id for a reach thread: [fromTreeId, toTreeId].sort().join('__') (1:1) or grp__<treeId>__<audience>__<initiator> (group).
  participantUids?: string[];
  audience?: ReachAudience; // For group reaches: which slice of the tree's circle was addressed.
  threadName?: string;      // Display name for a group thread, e.g. "Oak · Guardians".
  isGroup?: boolean;        // True for circle/group reaches (a shared, multi-person thread).
  mintNotice?: boolean;     // A system line in a thread announcing someone minted the conversation.
  aiInterpretation?: PulseInterpretation;
  validationScore?: number;
  care?: 'watering';
  careAlert?: 'watering';
  wateringConfirmedBy?: 'ai' | 'guardian' | 'pending';
  wateringConfirmation?: {
    note: string;          // the witness's one-line reading of the photo
    confidence?: number;   // 0-100 for an AI reading
    model?: string;        // the model that read it
    provider?: string;     // 'google' | 'anthropic' | …
    confirmedByUid?: string; // the guardian, when confirmed by a human
    confirmedAt?: Timestamp;
  };
  isMatch?: boolean;
  matchedLifetreeId?: string;
  matchId?: string; // Link to the handshake
  authorId: string;
  authorName: string;        // for reaches this is the sender's TREE name (the conversation face)
  authorPersonName?: string; // the human behind it — shown under the tree name in DMs
  authorPhoto?: string;
  createdAt: Timestamp;
  loveCount: number;
  commentCount: number;
  previousHash: string;
  hash: string;
}
```

### ./src/domain/pulseVisibility.ts
```
import type { Pulse, PulseVisibility } from './pulse';
import type { Community } from './community';
export type PulseScope = 'tree' | 'community' | 'node';
export const PULSE_VISIBILITIES: PulseVisibility[] = ['public', 'node', 'community', 'circle', 'private'];
type ScopedPulse = Pick<Pulse, 'lifetreeId' | 'communityId' | 'authorId' | 'visibility'>;
const treeIdOf = (p: ScopedPulse): string | undefined => p.lifetreeId;
const visOf = (p: ScopedPulse): PulseVisibility => p.visibility || 'public';
export function pulseScope(p: ScopedPulse): PulseScope {
  if (treeIdOf(p)) return 'tree';
  if (p.communityId) return 'community';
  return 'node';
}
export function visibilitiesForScope(scope: PulseScope): PulseVisibility[] {
  switch (scope) {
    case 'tree': return ['public', 'circle', 'private'];
    case 'community': return ['public', 'community', 'private'];
    case 'node': return ['public', 'node', 'private'];
  }
}
export function defaultVisibility(_scope: PulseScope): PulseVisibility {
  return 'public';
}
export interface Viewer {
  uid?: string | null;
  isStaff?: boolean;
  communityIds?: string[];   // communities the viewer belongs to (member or owner)
  guardedTreeIds?: string[]; // trees the viewer guards, owns or stewards
}
export function canView(pulse: ScopedPulse, viewer: Viewer): boolean {
  if (viewer.isStaff) return true;
  if (viewer.uid && pulse.authorId === viewer.uid) return true; // the author always sees their own
  switch (visOf(pulse)) {
    case 'public': return true;
    case 'node': return !!viewer.uid;
    case 'community': return !!pulse.communityId && (viewer.communityIds || []).includes(pulse.communityId);
    case 'circle': { const t = treeIdOf(pulse); return !!t && (viewer.guardedTreeIds || []).includes(t); }
    case 'private': return false; // author/staff already handled above
    default: return true;
  }
}
export function queryableLevels(viewer: Viewer, ctx?: { communityId?: string; treeId?: string }): PulseVisibility[] {
  if (viewer.isStaff) return PULSE_VISIBILITIES.filter(v => v !== 'private');
  const levels: PulseVisibility[] = ['public'];
  if (viewer.uid) levels.push('node');
  if (ctx?.communityId && (viewer.communityIds || []).includes(ctx.communityId)) levels.push('community');
  if (ctx?.treeId && (viewer.guardedTreeIds || []).includes(ctx.treeId)) levels.push('circle');
  return levels;
}
export function canEditEvent(
  event: Pick<Pulse, 'authorId' | 'communityId'>,
  viewer: Viewer,
  ctx?: { hostCommunity?: Community | null; community?: Community | null },
): boolean {
  if (!viewer.uid) return false;
  if (viewer.isStaff) return true;
  if (event.authorId === viewer.uid) return true;                  // the creator
  if (event.communityId) return ctx?.community?.ownerId === viewer.uid; // community admin
  return ctx?.hostCommunity?.ownerId === viewer.uid;               // node owner
}
```

### ./src/domain/reach.ts
```
import type { Timestamp } from 'firebase/firestore';
export type ReachAudience = 'owners' | 'guardians' | 'everyone';
export interface Reach {
  id: string;
  fromTreeId: string;
  toTreeId: string;
  pulseId: string;
  intent: "witness" | "learn" | "offer" | "request" | "align";
  status: "offered" | "accepted" | "declined";
  createdAt: Timestamp;
}
```

### ./src/domain/sanctuary.ts
```
import type { Timestamp } from 'firebase/firestore';
export interface Sanctuary {
  id: string;
  name: string;
  shortTitle?: string;
  body: string;
  imageUrl?: string;
  domain?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  createdAt: Timestamp;
}
```

### ./src/domain/store.ts
```
import type { Link, LinkRel } from './link';
export interface Store {
  linksTo(toId: string, rel?: LinkRel): Promise<Link[]>;
  linksFrom(from: string, rel?: LinkRel): Promise<Link[]>;
  linksByRel(rel: LinkRel): Promise<Link[]>;
  link(from: string, rel: LinkRel, to: string): Promise<void>;
  unlink(from: string, rel: LinkRel, to: string): Promise<void>;
}
```

### ./src/domain/treeCircle.ts
```
import type { Timestamp } from 'firebase/firestore';
export type TreeRelationRole = 'owner' | 'co_owner' | 'guardian' | 'observer' | 'steward';
export type TreeRelationStatus = 'pending' | 'accepted' | 'declined' | 'revoked';
export type InvitableRole = Exclude<TreeRelationRole, 'owner'>;
export interface TreeOwnershipInvite {
  id: string;
  lifetreeId: string;
  lifetreeName?: string;        // denormalised so the invitee's inbox can read it
  invitedByUserId: string;
  invitedByName?: string;
  invitedUserId: string;
  role: InvitableRole;
  status: TreeRelationStatus;
  message?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  acceptedAt?: Timestamp;
  declinedAt?: Timestamp;
  revokedAt?: Timestamp;
}
export const treeRelationLabels: Record<TreeRelationRole, string> = {
  owner: 'Owner',
  co_owner: 'Co-guardian',
  guardian: 'Guardian',
  steward: 'Steward',
  observer: 'Observer',
};
```

### ./src/domain/views/circle.ts
```
import type { Link } from '../link';
import type { TreeRelationRole } from '../treeCircle';
export interface CircleGroup {
  role: TreeRelationRole;
  members: string[]; // uids
}
const ROLE_ORDER: TreeRelationRole[] = ['owner', 'co_owner', 'guardian', 'steward', 'observer'];
const LINK_ROLES = new Set<string>(['co_owner', 'guardian', 'steward', 'observer']);
export function treeCircle(ownerId: string, links: Link[]): { groups: CircleGroup[]; size: number } {
  const byRole = new Map<TreeRelationRole, string[]>(ROLE_ORDER.map(r => [r, []]));
  if (ownerId) byRole.get('owner')!.push(ownerId);
  for (const l of links) {
    if (LINK_ROLES.has(l.rel)) byRole.get(l.rel as TreeRelationRole)!.push(l.from);
  }
  const groups = ROLE_ORDER
    .map(role => ({ role, members: byRole.get(role)! }))
    .filter(g => g.members.length > 0);
  const size = new Set(groups.flatMap(g => g.members).filter(Boolean)).size;
  return { groups, size };
}
```

### ./src/domain/views/council.ts
```
import type { Decision } from '../decision';
export interface CouncilItem {
  id: string;
  title: string;
  nature: Decision['nature'];
  body?: string;
  passed: boolean;
  voted: boolean;        // the viewer has added their voice
  voiceCount: number;    // voices cast
  voicesRequired: number;
}
export function councilView(decisions: Decision[], viewerUid?: string | null): CouncilItem[] {
  return decisions.map(d => ({
    id: d.id,
    title: d.title,
    nature: d.nature,
    body: d.body,
    passed: d.status === 'passed',
    voted: !!viewerUid && (d.votes || []).includes(viewerUid),
    voiceCount: (d.votes || []).length,
    voicesRequired: d.votesRequired,
  }));
}
```

### ./src/domain/views/forest.ts
```
import type { Lifetree } from '../lifetree';
export interface ForestMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status?: 'HEALTHY' | 'DANGER';
  kind: 'nature' | 'tree';
  imageUrl: string;
  growthUrl: string;
  guardianCount: number; // an edge-count: how many guardians tend this tree
  validated: boolean;
}
export function treeCoordinates(tree: Pick<Lifetree, 'latitude' | 'longitude'>): { lat: number; lng: number } | null {
  const t = tree as any;
  const lat = Number(t.latitude ?? t.lat);
  const lng = Number(t.longitude ?? t.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
export function forestMarkers(trees: Lifetree[], guardianCounts?: Map<string, number>): ForestMarker[] {
  const out: ForestMarker[] = [];
  for (const t of trees) {
    const c = treeCoordinates(t);
    if (!c) continue;
    out.push({
      id: t.id,
      name: t.name || '',
      lat: c.lat,
      lng: c.lng,
      status: t.status,
      kind: t.isNature ? 'nature' : 'tree',
      imageUrl: t.imageUrl || '',
      growthUrl: t.latestGrowthUrl || '',
      guardianCount: guardianCounts?.get(t.id) || 0,
      validated: !!t.validated,
    });
  }
  return out;
}
```

### ./src/domain/views/participation.ts
```
import type { Link } from '../link';
export const participants = (links: Link[]): string[] =>
  Array.from(new Set(links.map(l => l.from).filter(Boolean)));
export const isParticipant = (links: Link[], uid?: string | null): boolean =>
  !!uid && links.some(l => l.from === uid);
```

### ./src/domain/views/threads.ts
```
import type { Pulse } from '../pulse';
import type { ReachAudience } from '../reach';
export interface ReachThread {
  key: string;          // unique per thread: threadId for groups, partner tree id for 1:1
  threadId?: string;    // present for group threads (and new 1:1 reaches) — how to open them
  isGroup: boolean;
  partnerId: string;    // the other tree (1:1) or the subject tree the group is about
  partnerName: string;
  partnerPersonName?: string; // the human behind the partner tree (1:1), if they've written
  partnerPhoto?: string;
  audience?: ReachAudience; // for group threads, which slice of the circle
  participantCount?: number;
  lastMessage: string;
  lastAt: number;
  unread: number;
  careAlert?: 'watering';
}
export interface ThreadViewer {
  uid?: string | null;
  treeIds: string[]; // the viewer's own tree ids — a reach from one of these is "outgoing"
}
export function reachThreads(pulses: Pulse[], viewer: ThreadViewer): ReachThread[] {
  const myIds = new Set(viewer.treeIds);
  const uid = viewer.uid || undefined;
  const map = new Map<string, ReachThread>();
  for (const p of pulses) {
    const at = p.createdAt?.toMillis?.() || 0;
    const text = p.reachResponse || p.content || p.body || '';
    const participantUids = p.participantUids || [];
    const addressedToMe = !!uid && (p.recipientUid === uid || participantUids.includes(uid));
    const isUnread = addressedToMe && p.authorId !== uid && !(p.seenBy || []).includes(uid);
    const isGroup = p.isGroup === true || participantUids.length > 2;
    let key: string;
    let partnerId: string | undefined;
    let partnerName: string | undefined;
    let partnerPhoto: string | undefined;
    let partnerPersonName: string | undefined;
    if (isGroup) {
      key = p.threadId || `${p.reachTreeId || ''}__group`;
      partnerId = p.reachTreeId || (p as any).chatTreeId;
      partnerName = p.threadName || p.reachTreeName;
    } else {
      const outgoing = (!!uid && p.authorId === uid) || myIds.has(p.lifetreeId || '');
      if (outgoing) {
        partnerId = p.reachTreeId || (p as any).chatTreeId;
        partnerName = p.reachTreeName || (p as any).chatTreeName;
      } else {
        partnerId = p.lifetreeId;
        partnerName = p.authorName;
        partnerPhoto = p.authorPhoto;
        partnerPersonName = p.authorPersonName; // the human behind the partner tree
      }
      key = partnerId || '';
    }
    if (!partnerId || !key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        threadId: p.threadId,
        isGroup,
        partnerId,
        partnerName: partnerName || (isGroup ? 'Circle' : 'Lifetree'),
        partnerPersonName,
        partnerPhoto,
        audience: p.audience,
        participantCount: isGroup ? participantUids.length : undefined,
        lastMessage: text,
        lastAt: at,
        unread: isUnread ? 1 : 0,
        careAlert: (p as any).careAlert,
      });
    } else {
      if (isUnread) existing.unread += 1;
      if (partnerPersonName) existing.partnerPersonName = partnerPersonName;
      if (at >= existing.lastAt) {
        existing.lastAt = at;
        existing.lastMessage = text;
        existing.careAlert = (p as any).careAlert; // newest message wins → alert auto-clears
        if (p.threadId) existing.threadId = p.threadId;
        if (isGroup) existing.participantCount = participantUids.length;
      }
      if (!existing.partnerPhoto && partnerPhoto) existing.partnerPhoto = partnerPhoto;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastAt - a.lastAt);
}
```

### ./src/domain/watering.ts
```
import type { Timestamp } from 'firebase/firestore';
import type { Lifetree } from './lifetree';
export type WateringMode = 'scheduled' | 'self_sustaining';
export interface WateringSchedule {
  mode: WateringMode;
  intervalDays?: number;      // for 'scheduled' — how many days between waterings
  lastWateredAt?: Timestamp;  // last confirmed watering (or when the schedule was set)
  nextDueAt?: Timestamp;      // denormalised lastWateredAt + intervalDays (for display)
  overdue?: boolean;          // raised by the daily sweep / client check, cleared on watering
  lastAlertAt?: Timestamp;    // idempotency: when guardians were last pinged about it
  alertThreadId?: string;     // the guardians group thread the "water me" reach lives in
}
export interface WateringAnalysis {
  watering: boolean;
  confidence: number;
  note: string;
  model?: string;
  provider?: string;
}
export const AI_CONFIRM_THRESHOLD = 70;
export const DAY_MS = 24 * 60 * 60 * 1000;
const toMs = (t: any): number =>
  t?.toMillis ? t.toMillis() : (t instanceof Date ? t.getTime() : (typeof t === 'number' ? t : 0));
type TreeLike = Pick<Lifetree, 'watering' | 'createdAt'> | null | undefined;
export const wateringOf = (tree: TreeLike): WateringSchedule | undefined =>
  (tree as any)?.watering as WateringSchedule | undefined;
export const isOnWateringSchedule = (tree: TreeLike): boolean => {
  const w = wateringOf(tree);
  return !!w && w.mode === 'scheduled' && !!w.intervalDays && w.intervalDays > 0;
};
export const lastWateredMillis = (tree: TreeLike): number => {
  const w = wateringOf(tree);
  return toMs(w?.lastWateredAt) || toMs((tree as any)?.createdAt) || 0;
};
export const computeNextDueMillis = (lastWateredMs: number, intervalDays: number): number =>
  lastWateredMs + Math.max(1, intervalDays) * DAY_MS;
export const nextDueMillis = (tree: TreeLike): number => {
  const w = wateringOf(tree);
  if (!w || w.mode !== 'scheduled' || !w.intervalDays) return 0;
  return toMs(w.nextDueAt) || computeNextDueMillis(lastWateredMillis(tree), w.intervalDays);
};
export const isWateringOverdue = (tree: TreeLike, now: number = Date.now()): boolean =>
  isOnWateringSchedule(tree) && now >= nextDueMillis(tree);
export const daysUntilWatering = (tree: TreeLike, now: number = Date.now()): number => {
  if (!isOnWateringSchedule(tree)) return 0;
  return Math.ceil((nextDueMillis(tree) - now) / DAY_MS);
};
export const daysOverdue = (tree: TreeLike, now: number = Date.now()): number =>
  isWateringOverdue(tree, now) ? Math.max(0, Math.floor((now - nextDueMillis(tree)) / DAY_MS)) : 0;
const sameUtcDay = (a: number, b: number): boolean => {
  if (!a || !b) return false;
  const da = new Date(a), dbb = new Date(b);
  return da.getUTCFullYear() === dbb.getUTCFullYear()
    && da.getUTCMonth() === dbb.getUTCMonth()
    && da.getUTCDate() === dbb.getUTCDate();
};
export const wateringAlertedToday = (tree: TreeLike, now: number = Date.now()): boolean => {
  const w = wateringOf(tree);
  return !!w && sameUtcDay(toMs(w.lastAlertAt), now);
};
export const shouldAlertForWatering = (tree: TreeLike, now: number = Date.now()): boolean =>
  isWateringOverdue(tree, now) && !wateringAlertedToday(tree, now);
```

### ./tsconfig.json
```
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "skipLibCheck": true,
    "types": [
      "node",
      "vite/client"
    ],
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": [
        "./*"
      ]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}```

### ./types.ts
```
import type { User as FirebaseUser } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';
import type { Entity } from './src/domain/entity';
export * from './src/domain/entity';
export * from './src/domain/lifetree';
export * from './src/domain/pulse';
export * from './src/domain/reach';
export * from './src/domain/link';
export * from './src/domain/community';
export * from './src/domain/decision';
export * from './src/domain/intelligence';
export * from './src/domain/sanctuary';
export * from './src/domain/treeCircle';
export type Lightseed = Pick<FirebaseUser, 'uid' | 'email' | 'displayName' | 'photoURL'>;
export type VisionStatus = "seed" | "growing" | "flowering" | "dormant";
export interface Vision extends Entity {
  id: string;
  lifetreeId?: string; // canonical — the tree this vision belongs to
  authorId: string;    // canonical author — load-bearing (rules + query)
  title: string;
  body: string;        // the vision text (canonical)
  description?: string;
  link?: string;
  imageUrl?: string;
  createdAt: Timestamp;
  joinedUserIds?: string[]; // List of users who joined this vision
  status?: VisionStatus;
  resonanceScore?: number;
}
export interface Alignment {
  id: string;
  initiatorPulseId: string;
  initiatorTreeId: string;
  initiatorUid: string;
  targetPulseId: string; // The pulse being matched WITH
  targetTreeId: string;
  targetUid: string; // The owner who needs to accept
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: Timestamp;
}
export interface Comment {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
}
export interface VisionSynergy {
    vision1Title: string;
    vision2Title: string;
    reasoning: string;
    score: number;
    tree1Id?: string;
    tree2Id?: string;
}
```

### ./vite.config.ts
```
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
    const cwd = (process as any).cwd();
    const envFileVars = loadEnv(mode, cwd, '');
    const combinedEnv = { ...process.env, ...envFileVars };
    const clientEnv = {
        MODE: mode,
        API_KEY: combinedEnv.API_KEY,
        VITE_FIREBASE_API_KEY: combinedEnv.VITE_FIREBASE_API_KEY,
        VITE_FIREBASE_AUTH_DOMAIN: combinedEnv.VITE_FIREBASE_AUTH_DOMAIN,
        VITE_FIREBASE_PROJECT_ID: combinedEnv.VITE_FIREBASE_PROJECT_ID,
        VITE_FIREBASE_STORAGE_BUCKET: combinedEnv.VITE_FIREBASE_STORAGE_BUCKET,
        VITE_FIREBASE_MESSAGING_SENDER_ID: combinedEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
        VITE_FIREBASE_APP_ID: combinedEnv.VITE_FIREBASE_APP_ID,
        VITE_FIREBASE_MEASUREMENT_ID: combinedEnv.VITE_FIREBASE_MEASUREMENT_ID,
    };
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        '__STATIC_ENV__': JSON.stringify(clientEnv),
      },
      resolve: {
        alias: {
          '@': path.resolve(cwd, '.'),
        }
      }
    };
});
```

### config/default.ts
```
import { AppConfig } from './types';
export const defaultConfig: AppConfig = {
  name: '.seed',
  logo: {
    backgroundFill: 'white',
    strokeColor: '#334155',
    seedFill: 'white',
  },
  theme: {
    primary: '#059669', // emerald-600
    secondary: '#0284c7', // sky-600
    accent: '#f59e0b', // amber-500
    neutral: '#334155', // slate-700
    background: '#ffffff',
    mode: 'light',
    surface: '#ffffff',
    text: '#0f172a',
  },
  domain: 'lightseed.online',
  model: 'gemini-3.5-flash',
  githubActionsEnabled: false,
  inviteOnly: true,
};
```

### config/types.ts
```
export interface ThemeConfig {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
  background: string;
  mode?: 'light' | 'dark';
  surface?: string;
  text?: string;
}
export interface AppConfig {
  name: string;
  logoUrl?: string;
  logo: {
    backgroundFill?: string;
    strokeColor?: string;
    seedFill?: string;
  };
  theme: ThemeConfig;
  domain: string;
  model: string;
  githubActionsEnabled: boolean;
  inviteOnly: boolean;
}
```

### src/adapters/firestore.ts
```
import type { Store } from '../domain/store';
import type { Link, LinkRel } from '../domain/link';
import { db } from '../../services/firebase';
import { collection, doc, getDocs, query, where, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { uuidv7 } from '../../utils/id';
const linksCol = collection(db, 'links');
const linkId = (from: string, rel: LinkRel, to: string) => `${from}__${rel}__${to}`;
export const firestoreStore: Store = {
  async linksTo(toId: string, rel?: LinkRel): Promise<Link[]> {
    const q = rel
      ? query(linksCol, where('to', '==', toId), where('rel', '==', rel))
      : query(linksCol, where('to', '==', toId));
    return (await getDocs(q)).docs.map(d => d.data() as Link);
  },
  async linksFrom(from: string, rel?: LinkRel): Promise<Link[]> {
    const q = rel
      ? query(linksCol, where('from', '==', from), where('rel', '==', rel))
      : query(linksCol, where('from', '==', from));
    return (await getDocs(q)).docs.map(d => d.data() as Link);
  },
  async linksByRel(rel: LinkRel): Promise<Link[]> {
    return (await getDocs(query(linksCol, where('rel', '==', rel)))).docs.map(d => d.data() as Link);
  },
  async link(from: string, rel: LinkRel, to: string): Promise<void> {
    await setDoc(doc(db, 'links', linkId(from, rel, to)),
      { lid: uuidv7(), type: 'link', rel, from, to, createdAt: serverTimestamp() });
  },
  async unlink(from: string, rel: LinkRel, to: string): Promise<void> {
    await deleteDoc(doc(db, 'links', linkId(from, rel, to)));
  },
};
```

### src/domain/community.ts
```
import type { Timestamp } from 'firebase/firestore';
import type { Entity } from './entity';
export interface Community extends Entity {
  id: string;
  ownerId: string;
  name: string;
  domain: string; // The link to Lifetree
  vision: string; // Rich text
  imageUrls: string[]; // For carousel
  logoUrl?: string;       // Square brand mark (avatar) — shown in lists and the hero badge
  heroImageUrl?: string;  // Wide banner image shown behind the community page hero
  theme?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    neutral?: string;
    background?: string;
    mode?: 'light' | 'dark';
    surface?: string;
    text?: string;
  };
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  defaultIntelligenceId?: string;
  availableIntelligenceIds?: string[];
  memoryIds?: string[];
  rootLifetreeId?: string;       // the living anchor this community grew from
  founderUserId?: string;
  memberIds?: string[];
  formation?: 'tree_co_ownership' | 'project' | 'organization' | 'manual';
  visibility?: 'private' | 'invited' | 'public';
}
```

### src/domain/decision.ts
```
import type { Timestamp } from 'firebase/firestore';
export type DecisionNature = 'intention' | 'purchase' | 'use_grant' | 'admission' | 'stewardship' | 'charter';
export const DECISION_NATURES: { id: DecisionNature; votes: number }[] = [
  { id: 'intention', votes: 1 },    // a shared note / intention — one voice carries it
  { id: 'purchase', votes: 2 },     // spending from the commons — needs two
  { id: 'use_grant', votes: 2 },    // granting the USE of an item (ownership stays fluid)
  { id: 'admission', votes: 3 },    // welcoming a new member
  { id: 'stewardship', votes: 3 },  // appointing or changing a steward
  { id: 'charter', votes: 7 },      // changing the charter — the full circle (odd, decidable)
];
export const votesRequired = (nature: DecisionNature): number =>
  DECISION_NATURES.find(n => n.id === nature)?.votes ?? 1;
export interface Decision {
  id: string;
  lid?: string; // Lightseed ID — the decision's portable, time-ordered true name (UUIDv7).
  communityId: string;
  domain?: string;
  nature: DecisionNature;
  title: string;
  body?: string;        // the proposal — a contract of use & care, not ownership
  subject?: string;     // what it concerns (an item, a person, a use)
  proposedBy: string;   // uid — counts as the first voice
  votes: string[];      // uids who have voiced yes
  votesRequired: number;
  status: 'open' | 'passed';
  previousHash: string;
  hash: string;
  enactedHash?: string; // the block written when the circle reaches the threshold
  createdAt: Timestamp;
  passedAt?: Timestamp;
}
```

### src/domain/entity.ts
```
import type { Timestamp } from 'firebase/firestore';
export interface Entity {
  lid?: string;         // Lightseed ID — portable, time-ordered UUIDv7 true-name (utils/id.ts).
  createdAt?: Timestamp; // optional on the base: derived/transient entities (e.g. links an
}
```

### src/domain/intelligence.ts
```
import type { Timestamp } from 'firebase/firestore';
export type IntelligenceProviderId =
  | 'google'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'local';
export interface Intelligence {
  id: string;
  lid?: string; // Lightseed ID — the object's portable, time-ordered true name (UUIDv7).
  name: string;
  description?: string;
  provider: IntelligenceProviderId;
  model: string;
  enabled: boolean;
  public: boolean;
  ownerId?: string;
  communityIds?: string[];
  memoryIds?: string[];
  personaId?: string;
  connected?: boolean;
  keyHint?: string;                                  // e.g. "…aB3z"
  credentialScope?: 'user' | 'community' | 'node';   // which key this intelligence draws on
  credentialOwnerId?: string;                        // uid or communityId for that key
  createdAt: Timestamp;
}
export interface Persona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  createdAt: Timestamp;
}
export type MemoryVisibility = 'private' | 'community' | 'public';
export interface Memory {
  id: string;
  lid?: string; // Lightseed ID — durable memory's portable, time-ordered true name (UUIDv7).
  name: string;
  description?: string;
  visibility: MemoryVisibility;
  communityId?: string;
  text?: string;
  sourceIds: string[];
  createdAt: Timestamp;
}
export interface IntelligenceMessage {
  role: 'user' | 'model';
  text: string;
}
export interface MemoryContext {
  text?: string;
  sourceIds?: string[];
}
export type IntelligenceRef = Pick<Intelligence, 'provider' | 'model' | 'credentialScope' | 'credentialOwnerId'>;
export interface IntelligenceProvider {
  id: IntelligenceProviderId;
  sendMessage(
    intelligence: IntelligenceRef,
    messages: IntelligenceMessage[],
    options?: { persona?: Persona | null; memory?: MemoryContext | null }
  ): Promise<string>;
}
```

### src/domain/lifetree.ts
```
import type { Timestamp } from 'firebase/firestore';
import type { Entity } from './entity';
import type { WateringSchedule } from './watering';
export type LifetreeType = "human" | "ai" | "community" | "project" | "LIFETREE" | "GUARDED" | "FAMILY";
export interface Lifetree extends Entity {
  id: string;
  ownerId: string; // canonical owner — load-bearing (rules + queries)
  name: string;
  shortTitle?: string;
  body: string; // the tree's vision text (canonical)
  imageUrl?: string;
  latestGrowthUrl?: string; // URL of the most recent growth pulse image
  visionIds?: string[];
  pulseIds?: string[];
  coOwnerIds?: string[];
  observerIds?: string[];
  stewardIds?: string[];
  communityId?: string; // The Tree Circle community rooted in this tree, once formed.
  updatedAt?: Timestamp;
  aiTokenBalance?: number;
  coherenceScore?: number;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  domain?: string; // Associated website domain, e.g. "example.com"
  createdAt: Timestamp;
  onlyValidatedCanReach?: boolean;
  validated: boolean;
  validatorId?: string | null;
  lastTendedAt?: Timestamp;
  isNature?: boolean;
  treeType?: LifetreeType;
  guardians?: string[]; // guardianship (user ids); → links in Phase 2
  status?: 'HEALTHY' | 'DANGER';
  watering?: WateringSchedule;
  genesisHash: string;
  latestHash: string; 
  blockHeight: number;
}
```

### src/domain/link.ts
```
import type { Entity } from './entity';
export type LinkRel = 'guardian' | 'co_owner' | 'steward' | 'observer' | 'member' | 'joined';
export interface Link extends Entity {
  type: 'link';
  rel: LinkRel;
  from: string;    // the actor's id (uid)
  to: string;      // the target entity's id (lifetree / community / vision)
  weight?: number; // attention / heat — the energy carried on the edge
}
export const linkId = (from: string, rel: LinkRel, to: string) => `${from}__${rel}__${to}`;
```

### src/domain/policy.ts
```
export const canTendTree = (viewerUid?: string | null): viewerUid is string => !!viewerUid;
export const canJoinVision = (viewerUid?: string | null): viewerUid is string => !!viewerUid;
```

### src/domain/pulse.ts
```
import type { Timestamp } from 'firebase/firestore';
import type { Entity } from './entity';
import type { ReachAudience } from './reach';
export type LegacyPulseType = 'STANDARD' | 'GROWTH';
export type PulseType = 'observation' | 'dream' | 'offering' | 'request' | 'translation' | 'validation' | 'event' | 'growth' | 'reach' | LegacyPulseType;
export type PulseVisibility = 'public' | 'node' | 'community' | 'circle' | 'private';
export interface PulseInterpretation {
    depth: number;
    interpretation: string;
    confidence: number;
    alternatives?: string[];
    growthSuggestion?: string;
}
export interface Pulse extends Entity {
  id: string;
  lifetreeId?: string; // canonical — the tree this pulse belongs to
  visionId?: string;
  communityId?: string; // Set on community-scoped pulses (community events, decisions).
  type: PulseType;
  visibility?: PulseVisibility;
  title: string; // canonical
  body: string;  // canonical
  content?: string;
  imageUrl?: string;
  imageUrls?: string[];
  eventDate?: string;
  eventLocation?: string;
  reachTreeId?: string;
  reachTreeName?: string;
  reachResponse?: string; // The reached tree's reply, kept so reach threads persist.
  recipientUid?: string | null; // Owner of the reached tree — drives 1:1 inbox routing + email delivery.
  recipientName?: string;
  seenBy?: string[];
  threadId?: string; // Deterministic id for a reach thread: [fromTreeId, toTreeId].sort().join('__') (1:1) or grp__<treeId>__<audience>__<initiator> (group).
  participantUids?: string[];
  audience?: ReachAudience; // For group reaches: which slice of the tree's circle was addressed.
  threadName?: string;      // Display name for a group thread, e.g. "Oak · Guardians".
  isGroup?: boolean;        // True for circle/group reaches (a shared, multi-person thread).
  mintNotice?: boolean;     // A system line in a thread announcing someone minted the conversation.
  aiInterpretation?: PulseInterpretation;
  validationScore?: number;
  care?: 'watering';
  careAlert?: 'watering';
  wateringConfirmedBy?: 'ai' | 'guardian' | 'pending';
  wateringConfirmation?: {
    note: string;          // the witness's one-line reading of the photo
    confidence?: number;   // 0-100 for an AI reading
    model?: string;        // the model that read it
    provider?: string;     // 'google' | 'anthropic' | …
    confirmedByUid?: string; // the guardian, when confirmed by a human
    confirmedAt?: Timestamp;
  };
  isMatch?: boolean;
  matchedLifetreeId?: string;
  matchId?: string; // Link to the handshake
  authorId: string;
  authorName: string;        // for reaches this is the sender's TREE name (the conversation face)
  authorPersonName?: string; // the human behind it — shown under the tree name in DMs
  authorPhoto?: string;
  createdAt: Timestamp;
  loveCount: number;
  commentCount: number;
  previousHash: string;
  hash: string;
}
```

### src/domain/pulseVisibility.ts
```
import type { Pulse, PulseVisibility } from './pulse';
import type { Community } from './community';
export type PulseScope = 'tree' | 'community' | 'node';
export const PULSE_VISIBILITIES: PulseVisibility[] = ['public', 'node', 'community', 'circle', 'private'];
type ScopedPulse = Pick<Pulse, 'lifetreeId' | 'communityId' | 'authorId' | 'visibility'>;
const treeIdOf = (p: ScopedPulse): string | undefined => p.lifetreeId;
const visOf = (p: ScopedPulse): PulseVisibility => p.visibility || 'public';
export function pulseScope(p: ScopedPulse): PulseScope {
  if (treeIdOf(p)) return 'tree';
  if (p.communityId) return 'community';
  return 'node';
}
export function visibilitiesForScope(scope: PulseScope): PulseVisibility[] {
  switch (scope) {
    case 'tree': return ['public', 'circle', 'private'];
    case 'community': return ['public', 'community', 'private'];
    case 'node': return ['public', 'node', 'private'];
  }
}
export function defaultVisibility(_scope: PulseScope): PulseVisibility {
  return 'public';
}
export interface Viewer {
  uid?: string | null;
  isStaff?: boolean;
  communityIds?: string[];   // communities the viewer belongs to (member or owner)
  guardedTreeIds?: string[]; // trees the viewer guards, owns or stewards
}
export function canView(pulse: ScopedPulse, viewer: Viewer): boolean {
  if (viewer.isStaff) return true;
  if (viewer.uid && pulse.authorId === viewer.uid) return true; // the author always sees their own
  switch (visOf(pulse)) {
    case 'public': return true;
    case 'node': return !!viewer.uid;
    case 'community': return !!pulse.communityId && (viewer.communityIds || []).includes(pulse.communityId);
    case 'circle': { const t = treeIdOf(pulse); return !!t && (viewer.guardedTreeIds || []).includes(t); }
    case 'private': return false; // author/staff already handled above
    default: return true;
  }
}
export function queryableLevels(viewer: Viewer, ctx?: { communityId?: string; treeId?: string }): PulseVisibility[] {
  if (viewer.isStaff) return PULSE_VISIBILITIES.filter(v => v !== 'private');
  const levels: PulseVisibility[] = ['public'];
  if (viewer.uid) levels.push('node');
  if (ctx?.communityId && (viewer.communityIds || []).includes(ctx.communityId)) levels.push('community');
  if (ctx?.treeId && (viewer.guardedTreeIds || []).includes(ctx.treeId)) levels.push('circle');
  return levels;
}
export function canEditEvent(
  event: Pick<Pulse, 'authorId' | 'communityId'>,
  viewer: Viewer,
  ctx?: { hostCommunity?: Community | null; community?: Community | null },
): boolean {
  if (!viewer.uid) return false;
  if (viewer.isStaff) return true;
  if (event.authorId === viewer.uid) return true;                  // the creator
  if (event.communityId) return ctx?.community?.ownerId === viewer.uid; // community admin
  return ctx?.hostCommunity?.ownerId === viewer.uid;               // node owner
}
```

### src/domain/reach.ts
```
import type { Timestamp } from 'firebase/firestore';
export type ReachAudience = 'owners' | 'guardians' | 'everyone';
export interface Reach {
  id: string;
  fromTreeId: string;
  toTreeId: string;
  pulseId: string;
  intent: "witness" | "learn" | "offer" | "request" | "align";
  status: "offered" | "accepted" | "declined";
  createdAt: Timestamp;
}
```

### src/domain/sanctuary.ts
```
import type { Timestamp } from 'firebase/firestore';
export interface Sanctuary {
  id: string;
  name: string;
  shortTitle?: string;
  body: string;
  imageUrl?: string;
  domain?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  createdAt: Timestamp;
}
```

### src/domain/store.ts
```
import type { Link, LinkRel } from './link';
export interface Store {
  linksTo(toId: string, rel?: LinkRel): Promise<Link[]>;
  linksFrom(from: string, rel?: LinkRel): Promise<Link[]>;
  linksByRel(rel: LinkRel): Promise<Link[]>;
  link(from: string, rel: LinkRel, to: string): Promise<void>;
  unlink(from: string, rel: LinkRel, to: string): Promise<void>;
}
```

### src/domain/treeCircle.ts
```
import type { Timestamp } from 'firebase/firestore';
export type TreeRelationRole = 'owner' | 'co_owner' | 'guardian' | 'observer' | 'steward';
export type TreeRelationStatus = 'pending' | 'accepted' | 'declined' | 'revoked';
export type InvitableRole = Exclude<TreeRelationRole, 'owner'>;
export interface TreeOwnershipInvite {
  id: string;
  lifetreeId: string;
  lifetreeName?: string;        // denormalised so the invitee's inbox can read it
  invitedByUserId: string;
  invitedByName?: string;
  invitedUserId: string;
  role: InvitableRole;
  status: TreeRelationStatus;
  message?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  acceptedAt?: Timestamp;
  declinedAt?: Timestamp;
  revokedAt?: Timestamp;
}
export const treeRelationLabels: Record<TreeRelationRole, string> = {
  owner: 'Owner',
  co_owner: 'Co-guardian',
  guardian: 'Guardian',
  steward: 'Steward',
  observer: 'Observer',
};
```

### src/domain/views/circle.ts
```
import type { Link } from '../link';
import type { TreeRelationRole } from '../treeCircle';
export interface CircleGroup {
  role: TreeRelationRole;
  members: string[]; // uids
}
const ROLE_ORDER: TreeRelationRole[] = ['owner', 'co_owner', 'guardian', 'steward', 'observer'];
const LINK_ROLES = new Set<string>(['co_owner', 'guardian', 'steward', 'observer']);
export function treeCircle(ownerId: string, links: Link[]): { groups: CircleGroup[]; size: number } {
  const byRole = new Map<TreeRelationRole, string[]>(ROLE_ORDER.map(r => [r, []]));
  if (ownerId) byRole.get('owner')!.push(ownerId);
  for (const l of links) {
    if (LINK_ROLES.has(l.rel)) byRole.get(l.rel as TreeRelationRole)!.push(l.from);
  }
  const groups = ROLE_ORDER
    .map(role => ({ role, members: byRole.get(role)! }))
    .filter(g => g.members.length > 0);
  const size = new Set(groups.flatMap(g => g.members).filter(Boolean)).size;
  return { groups, size };
}
```

### src/domain/views/council.ts
```
import type { Decision } from '../decision';
export interface CouncilItem {
  id: string;
  title: string;
  nature: Decision['nature'];
  body?: string;
  passed: boolean;
  voted: boolean;        // the viewer has added their voice
  voiceCount: number;    // voices cast
  voicesRequired: number;
}
export function councilView(decisions: Decision[], viewerUid?: string | null): CouncilItem[] {
  return decisions.map(d => ({
    id: d.id,
    title: d.title,
    nature: d.nature,
    body: d.body,
    passed: d.status === 'passed',
    voted: !!viewerUid && (d.votes || []).includes(viewerUid),
    voiceCount: (d.votes || []).length,
    voicesRequired: d.votesRequired,
  }));
}
```

### src/domain/views/forest.ts
```
import type { Lifetree } from '../lifetree';
export interface ForestMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status?: 'HEALTHY' | 'DANGER';
  kind: 'nature' | 'tree';
  imageUrl: string;
  growthUrl: string;
  guardianCount: number; // an edge-count: how many guardians tend this tree
  validated: boolean;
}
export function treeCoordinates(tree: Pick<Lifetree, 'latitude' | 'longitude'>): { lat: number; lng: number } | null {
  const t = tree as any;
  const lat = Number(t.latitude ?? t.lat);
  const lng = Number(t.longitude ?? t.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
export function forestMarkers(trees: Lifetree[], guardianCounts?: Map<string, number>): ForestMarker[] {
  const out: ForestMarker[] = [];
  for (const t of trees) {
    const c = treeCoordinates(t);
    if (!c) continue;
    out.push({
      id: t.id,
      name: t.name || '',
      lat: c.lat,
      lng: c.lng,
      status: t.status,
      kind: t.isNature ? 'nature' : 'tree',
      imageUrl: t.imageUrl || '',
      growthUrl: t.latestGrowthUrl || '',
      guardianCount: guardianCounts?.get(t.id) || 0,
      validated: !!t.validated,
    });
  }
  return out;
}
```

### src/domain/views/participation.ts
```
import type { Link } from '../link';
export const participants = (links: Link[]): string[] =>
  Array.from(new Set(links.map(l => l.from).filter(Boolean)));
export const isParticipant = (links: Link[], uid?: string | null): boolean =>
  !!uid && links.some(l => l.from === uid);
```

### src/domain/views/threads.ts
```
import type { Pulse } from '../pulse';
import type { ReachAudience } from '../reach';
export interface ReachThread {
  key: string;          // unique per thread: threadId for groups, partner tree id for 1:1
  threadId?: string;    // present for group threads (and new 1:1 reaches) — how to open them
  isGroup: boolean;
  partnerId: string;    // the other tree (1:1) or the subject tree the group is about
  partnerName: string;
  partnerPersonName?: string; // the human behind the partner tree (1:1), if they've written
  partnerPhoto?: string;
  audience?: ReachAudience; // for group threads, which slice of the circle
  participantCount?: number;
  lastMessage: string;
  lastAt: number;
  unread: number;
  careAlert?: 'watering';
}
export interface ThreadViewer {
  uid?: string | null;
  treeIds: string[]; // the viewer's own tree ids — a reach from one of these is "outgoing"
}
export function reachThreads(pulses: Pulse[], viewer: ThreadViewer): ReachThread[] {
  const myIds = new Set(viewer.treeIds);
  const uid = viewer.uid || undefined;
  const map = new Map<string, ReachThread>();
  for (const p of pulses) {
    const at = p.createdAt?.toMillis?.() || 0;
    const text = p.reachResponse || p.content || p.body || '';
    const participantUids = p.participantUids || [];
    const addressedToMe = !!uid && (p.recipientUid === uid || participantUids.includes(uid));
    const isUnread = addressedToMe && p.authorId !== uid && !(p.seenBy || []).includes(uid);
    const isGroup = p.isGroup === true || participantUids.length > 2;
    let key: string;
    let partnerId: string | undefined;
    let partnerName: string | undefined;
    let partnerPhoto: string | undefined;
    let partnerPersonName: string | undefined;
    if (isGroup) {
      key = p.threadId || `${p.reachTreeId || ''}__group`;
      partnerId = p.reachTreeId || (p as any).chatTreeId;
      partnerName = p.threadName || p.reachTreeName;
    } else {
      const outgoing = (!!uid && p.authorId === uid) || myIds.has(p.lifetreeId || '');
      if (outgoing) {
        partnerId = p.reachTreeId || (p as any).chatTreeId;
        partnerName = p.reachTreeName || (p as any).chatTreeName;
      } else {
        partnerId = p.lifetreeId;
        partnerName = p.authorName;
        partnerPhoto = p.authorPhoto;
        partnerPersonName = p.authorPersonName; // the human behind the partner tree
      }
      key = partnerId || '';
    }
    if (!partnerId || !key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        threadId: p.threadId,
        isGroup,
        partnerId,
        partnerName: partnerName || (isGroup ? 'Circle' : 'Lifetree'),
        partnerPersonName,
        partnerPhoto,
        audience: p.audience,
        participantCount: isGroup ? participantUids.length : undefined,
        lastMessage: text,
        lastAt: at,
        unread: isUnread ? 1 : 0,
        careAlert: (p as any).careAlert,
      });
    } else {
      if (isUnread) existing.unread += 1;
      if (partnerPersonName) existing.partnerPersonName = partnerPersonName;
      if (at >= existing.lastAt) {
        existing.lastAt = at;
        existing.lastMessage = text;
        existing.careAlert = (p as any).careAlert; // newest message wins → alert auto-clears
        if (p.threadId) existing.threadId = p.threadId;
        if (isGroup) existing.participantCount = participantUids.length;
      }
      if (!existing.partnerPhoto && partnerPhoto) existing.partnerPhoto = partnerPhoto;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastAt - a.lastAt);
}
```

### src/domain/watering.ts
```
import type { Timestamp } from 'firebase/firestore';
import type { Lifetree } from './lifetree';
export type WateringMode = 'scheduled' | 'self_sustaining';
export interface WateringSchedule {
  mode: WateringMode;
  intervalDays?: number;      // for 'scheduled' — how many days between waterings
  lastWateredAt?: Timestamp;  // last confirmed watering (or when the schedule was set)
  nextDueAt?: Timestamp;      // denormalised lastWateredAt + intervalDays (for display)
  overdue?: boolean;          // raised by the daily sweep / client check, cleared on watering
  lastAlertAt?: Timestamp;    // idempotency: when guardians were last pinged about it
  alertThreadId?: string;     // the guardians group thread the "water me" reach lives in
}
export interface WateringAnalysis {
  watering: boolean;
  confidence: number;
  note: string;
  model?: string;
  provider?: string;
}
export const AI_CONFIRM_THRESHOLD = 70;
export const DAY_MS = 24 * 60 * 60 * 1000;
const toMs = (t: any): number =>
  t?.toMillis ? t.toMillis() : (t instanceof Date ? t.getTime() : (typeof t === 'number' ? t : 0));
type TreeLike = Pick<Lifetree, 'watering' | 'createdAt'> | null | undefined;
export const wateringOf = (tree: TreeLike): WateringSchedule | undefined =>
  (tree as any)?.watering as WateringSchedule | undefined;
export const isOnWateringSchedule = (tree: TreeLike): boolean => {
  const w = wateringOf(tree);
  return !!w && w.mode === 'scheduled' && !!w.intervalDays && w.intervalDays > 0;
};
export const lastWateredMillis = (tree: TreeLike): number => {
  const w = wateringOf(tree);
  return toMs(w?.lastWateredAt) || toMs((tree as any)?.createdAt) || 0;
};
export const computeNextDueMillis = (lastWateredMs: number, intervalDays: number): number =>
  lastWateredMs + Math.max(1, intervalDays) * DAY_MS;
export const nextDueMillis = (tree: TreeLike): number => {
  const w = wateringOf(tree);
  if (!w || w.mode !== 'scheduled' || !w.intervalDays) return 0;
  return toMs(w.nextDueAt) || computeNextDueMillis(lastWateredMillis(tree), w.intervalDays);
};
export const isWateringOverdue = (tree: TreeLike, now: number = Date.now()): boolean =>
  isOnWateringSchedule(tree) && now >= nextDueMillis(tree);
export const daysUntilWatering = (tree: TreeLike, now: number = Date.now()): number => {
  if (!isOnWateringSchedule(tree)) return 0;
  return Math.ceil((nextDueMillis(tree) - now) / DAY_MS);
};
export const daysOverdue = (tree: TreeLike, now: number = Date.now()): number =>
  isWateringOverdue(tree, now) ? Math.max(0, Math.floor((now - nextDueMillis(tree)) / DAY_MS)) : 0;
const sameUtcDay = (a: number, b: number): boolean => {
  if (!a || !b) return false;
  const da = new Date(a), dbb = new Date(b);
  return da.getUTCFullYear() === dbb.getUTCFullYear()
    && da.getUTCMonth() === dbb.getUTCMonth()
    && da.getUTCDate() === dbb.getUTCDate();
};
export const wateringAlertedToday = (tree: TreeLike, now: number = Date.now()): boolean => {
  const w = wateringOf(tree);
  return !!w && sameUtcDay(toMs(w.lastAlertAt), now);
};
export const shouldAlertForWatering = (tree: TreeLike, now: number = Date.now()): boolean =>
  isWateringOverdue(tree, now) && !wateringAlertedToday(tree, now);
```
