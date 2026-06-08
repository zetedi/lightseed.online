# Project Context Snapshot

Generated: Mon Jun  8 21:20:01 EEST 2026

## Git
main
83619cd Mycellial communication.

## Directory shape
```
```

## Key files detected
```
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
    "preview": "vite preview"
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
import React, { useState, useEffect, useRef } from 'react';
import {
  signInWithGoogle,
  logout,
  fetchPulses,
  fetchEventPulses,
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
  revokeAdmin,
  getCommunityByDomain,
  listenForTreeChatNotifications,
  listenToUserProfile,
  markTreeChatSeen
} from './services/firebase';
import { findVisionSynergies } from './services/gemini';
import { type Pulse, type Lifetree, type Alignment, type Vision, type Community, type VisionSynergy } from './types';
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
    const [oracleTree, setOracleTree] = useState<Lifetree | null>(null);
    const [hostCommunity, setHostCommunity] = useState<Community | null>(null);
    const [treeChatNotifications, setTreeChatNotifications] = useState<Pulse[]>([]);
    const [treeChatToast, setTreeChatToast] = useState<Pulse | null>(null);
    const [personalSiteTheme, setPersonalSiteTheme] = useState<any>(null);
    const [personalSiteLogoUrl, setPersonalSiteLogoUrl] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [stats, setStats] = useState({ pulses: 0, visions: 0, alignments: 0 });
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const forestSentinelRef = useRef<HTMLDivElement>(null);
    const treeChatNotificationCountRef = useRef(0);
    const treeChatNotificationsReadyRef = useRef(false);
    const [showPlantModal, setShowPlantModal] = useState(false);
    const [showPulseModal, setShowPulseModal] = useState(false);
    const [showVisionModal, setShowVisionModal] = useState(false);
    const [showGrowthPlayer, setShowGrowthPlayer] = useState<string | null>(null);
    const [matchCandidate, setMatchCandidate] = useState<Pulse | null>(null);
    const [uploading, setUploading] = useState(false);
    const [showNatureTrees, setShowNatureTrees] = useState(true);
    const [showUserTrees, setShowUserTrees] = useState(true);
    const [showValidatedTrees, setShowValidatedTrees] = useState(false);
    const [synergies, setSynergies] = useState<VisionSynergy[]>([]);
    const [isAnalyzingSynergy, setIsAnalyzingSynergy] = useState(false);
    const config = useConfig(hostCommunity);
    const [themeModePreference, setThemeModePreference] = useState<ThemeModePreference>(() => {
        const savedMode = localStorage.getItem('lifeseed_theme_mode');
        if (savedMode === 'light' || savedMode === 'dark') return savedMode;
        const legacyNightMode = localStorage.getItem('lifeseed_night_mode');
        if (legacyNightMode === 'true') return 'dark';
        if (legacyNightMode === 'false') return 'light';
        return null;
    });
    const configuredTheme = lightseed && personalSiteTheme
        ? normalizeTheme(personalSiteTheme, config.theme)
        : config.theme;
    const configuredLogoUrl = lightseed && personalSiteLogoUrl && isHubDomain(window.location.hostname)
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
```

### ./components/LifetreeCard.tsx
```
import React, { useRef, useState, ChangeEvent } from 'react';
import { type Lifetree } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import Logo from './Logo';
import { ValidationBadge } from './ValidationBadge';
import { colors } from '../utils/theme';
import { canToggleValidation, isExplicitlyValidatedTree } from '../utils/validation';
interface LifetreeCardProps {
    tree: Lifetree;
    myActiveTree: Lifetree | null;
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
    currentUserId?: string;
    onValidate: (id: string, nextValidated: boolean) => Promise<void>;
    onPlayGrowth: (id: string) => void;
    onQuickSnap: (id: string, file: File) => Promise<void>;
    onView: (tree: Lifetree) => void;
    onChat?: (tree: Lifetree) => void;
}
export const LifetreeCard = ({ tree, myActiveTree, isAdmin, isSuperAdmin, currentUserId, onValidate, onPlayGrowth, onQuickSnap, onView, onChat }: LifetreeCardProps) => {
    const { t } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const isGuardian = currentUserId && tree.guardians && tree.guardians.includes(currentUserId);
    const hasValidationBadge = isExplicitlyValidatedTree(tree);
    const showValidateAction = canToggleValidation({ tree, myActiveTree, isAdmin, isSuperAdmin });
    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploading(true);
            await onQuickSnap(tree.id, e.target.files[0]);
            setUploading(false);
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    }
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
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[3s] animate-[pulse_4s_ease-in-out_infinite]" 
                    />
                ) : (
                    <div className={`w-full h-full ${colors.sky} flex items-center justify-center`}>
                        <Logo width={50} height={50} className="opacity-20 text-white animate-pulse" />
                    </div>
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
                            <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold animate-pulse">DANGER</span>
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
                    {onChat && (
                        <button onClick={(e) => { e.stopPropagation(); onChat(tree); }} className="flex items-center gap-1 text-[10px] bg-sky-50 hover:bg-sky-100 text-sky-700 px-2 py-1 rounded transition-colors uppercase tracking-wider font-semibold">
                            <Icons.Mail />
                            <span>Chat</span>
                        </button>
                    )}
                    <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row">
                        {showValidateAction && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const nextValidated = !hasValidationBadge;
                                    const message = nextValidated ? 'Validate this tree?' : 'Remove validation from this tree?';
                                    if (window.confirm(message)) onValidate(tree.id, nextValidated);
                                }}
                                className="text-[10px] bg-primary text-white px-3 py-1.5 rounded-full shadow hover:opacity-90 transition-all uppercase font-bold tracking-wider"
                            >
                                {hasValidationBadge ? 'Remove Validation' : t('validate_action')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
```

### ./components/LifetreeDetail.tsx
```
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import Logo from './Logo';
import { ValidationBadge } from './ValidationBadge';
import { AutocompleteInput } from './ui/AutocompleteInput';
import { updateLifetree, toggleGuardianship, setTreeStatus, getPulsesByTreeId } from '../services/firebase';
import { Pulse } from '../types';
import { canToggleValidation, isExplicitlyValidatedTree } from '../utils/validation';
export const LifetreeDetail = ({ tree, onClose, onPlayGrowth, onValidate, onUpdate, onDelete, onCreatePulse, onChatTree, onViewPulse, myActiveTree, currentUserId, isAdmin, isSuperAdmin }: any) => {
   const { t } = useLanguage();
   const isOwner = currentUserId === tree.ownerId;
   const isNature = tree.isNature;
   const isGuardian = tree.guardians && currentUserId && tree.guardians.includes(currentUserId);
   const canDelete = isOwner || isAdmin || isSuperAdmin;
   const canEdit = isOwner || isGuardian || isSuperAdmin;
   const hasValidationBadge = isExplicitlyValidatedTree(tree);
   const showValidateAction = canToggleValidation({ tree, myActiveTree, isAdmin, isSuperAdmin });
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
   const [localIsGuardian, setLocalIsGuardian] = useState(isGuardian);
   const [localStatus, setLocalStatus] = useState(tree.status || 'HEALTHY');
   const [isLocating, setIsLocating] = useState(false);
   useEffect(() => {
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
   }, [tree.id]);
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
           alert("Failed to save changes.");
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
           alert("Location failed: " + err.message);
           setIsLocating(false);
       });
   }
   const handleToggleGuardian = async () => {
       if (!currentUserId) return;
       setIsSaving(true);
       try {
           const isJoining = !localIsGuardian;
           await toggleGuardianship(tree.id, currentUserId, isJoining);
           setLocalIsGuardian(isJoining);
           if (onUpdate) {
               const currentGuardians = tree.guardians || [];
               const newGuardians = isJoining 
                   ? [...currentGuardians, currentUserId]
                   : currentGuardians.filter((id: string) => id !== currentUserId);
               onUpdate({ guardians: newGuardians });
           }
       } catch(e: any) { alert(e.message); }
       setIsSaving(false);
   }
   const handleToggleDanger = async () => {
       if (!localIsGuardian) return;
       const newStatus = localStatus === 'DANGER' ? 'HEALTHY' : 'DANGER';
       if (newStatus === 'DANGER' && !confirm("Are you sure you want to report this tree is in DANGER? This will alert all guardians.")) return;
       setIsSaving(true);
       try {
           await setTreeStatus(tree.id, newStatus);
           setLocalStatus(newStatus);
           if (onUpdate) onUpdate({ status: newStatus });
       } catch(e: any) { alert(e.message); }
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
                Guardians: {tree.guardians ? tree.guardians.length + (localIsGuardian && !tree.guardians.includes(currentUserId) ? 1 : 0) - (!localIsGuardian && tree.guardians.includes(currentUserId) ? 1 : 0) : (localIsGuardian ? 1 : 0)}
            </div>
        </div>
   );
    return (
        <>
        <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300">
            {/* Danger Banner */}
            {localStatus === 'DANGER' && (
                <div className="bg-red-600 text-white text-center py-2 font-bold animate-pulse sticky top-0 z-40">
                    <div className="flex items-center justify-center space-x-2">
                        <Icons.Siren />
                        <span>ALERT: THIS TREE IS IN DANGER</span>
                        <Icons.Siren />
                    </div>
                </div>
            )}
            {/* Header */}
            <div className={`sticky ${localStatus === 'DANGER' ? 'top-10' : 'top-0'} z-30 border-b border-emerald-200 bg-emerald-50/90 px-4 py-4 backdrop-blur-md flex items-center justify-between`}>
                <button onClick={onClose} className="flex items-center space-x-2 text-emerald-700 hover:text-emerald-900 font-medium">
                    <Icons.ArrowLeft />
                    <span>{t('back_forest')}</span>
                </button>
                <div className="hidden md:flex flex-col items-center">
                    <h2 dir="auto" className="text-xl font-light tracking-wide truncate max-w-[200px] text-emerald-950">{isEditing ? "Editing..." : tree.name}</h2>
                    {tree.shortTitle && !isEditing && <span dir="auto" className="text-xs text-emerald-600 font-bold uppercase tracking-widest">{tree.shortTitle}</span>}
                </div>
                <div className="min-w-[80px] flex justify-end gap-2">
                    {canDelete && !isEditing && (
                        <button onClick={() => setShowDeleteModal(true)} className="bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 p-2 rounded-full shadow-sm transition-colors border border-red-200" title="Delete tree">
                            <Icons.Trash />
                        </button>
                    )}
                    {/* EDIT Button: Allowed for Owner, Guardian, or SuperAdmin */}
                    {canEdit && !isEditing && (
                        <button onClick={() => setIsEditing(true)} className="bg-white hover:bg-emerald-100 text-emerald-700 hover:text-emerald-900 px-4 py-2 rounded-full font-bold text-sm shadow-sm transition-colors flex items-center gap-1 border border-emerald-200">
                            <Icons.Pencil />
                            <span>{t('edit')}</span>
                        </button>
                    )}
                </div> 
            </div>
            <div className="max-w-4xl mx-auto p-6 space-y-8">
                {/* Hero */}
                <div className="relative h-64 md:h-96 w-full rounded-2xl overflow-hidden shadow-xl">
                    <img 
                        src={tree.latestGrowthUrl || tree.imageUrl || 'https://via.placeholder.com/800x400'} 
                        className="w-full h-full object-cover" 
                        alt={tree.name}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    {hasValidationBadge && (
                        <div className="absolute bottom-4 right-4 z-20">
                            <ValidationBadge />
                        </div>
                    )}
                    <div className="absolute bottom-6 left-6 text-white w-full pr-12">
                        <div className="mb-2 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                            {isNature ? (
                                <span className="bg-sky-500 text-white text-xs px-2 py-0.5 rounded-full font-bold flex items-center">
                                    <Icons.Shield />
                                    <span className="ml-1">NATURE</span>
                                </span>
```

### ./components/OracleChat.tsx
```
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { sendMessageToOracle, generateImage } from '../services/gemini';
import { checkAndIncrementAiUsage, mintPulse, uploadBase64Image, listenToUserProfile } from '../services/firebase';
import { useLifeseed } from '../hooks/useLifeseed';
import { Icons } from './ui/Icons';
import { Lifetree } from '../types';
const SunAvatar = () => (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-50 text-amber-500 shadow-inner">
        <div className="pointer-events-none absolute -inset-1 rounded-full bg-amber-300/20 blur-sm"></div>
        <span className="relative z-10"><Icons.Sun /></span>
    </div>
);
const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> =>
    new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
        promise
            .then((value) => {
                window.clearTimeout(timer);
                resolve(value);
            })
            .catch((error) => {
                window.clearTimeout(timer);
                reject(error);
            });
    });
export const OracleChat = ({ initialTree = null }: { initialTree?: Lifetree | null }) => {
    const { t } = useLanguage();
    const { lightseed, activeTree, myTrees } = useLifeseed();
    const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isMinting, setIsMinting] = useState(false);
    const [usage, setUsage] = useState(0);
    const [mode, setMode] = useState<'oracle' | 'tree'>(initialTree ? 'tree' : 'oracle');
    const [selectedTree, setSelectedTree] = useState<Lifetree | null>(initialTree);
    const bottomRef = useRef<HTMLDivElement>(null);
    const treeChoices = [initialTree, ...myTrees].filter((tree): tree is Lifetree => !!tree)
        .filter((tree, index, all) => all.findIndex(t => t.id === tree.id) === index);
    useEffect(() => {
        if (initialTree) {
            setSelectedTree(initialTree);
            setMode('tree');
        }
    }, [initialTree?.id]);
    useEffect(() => {
        if (mode === 'tree' && selectedTree) {
            setMessages([{role: 'model', text: `Mycelial communication ready. Messages here travel between your active tree and ${selectedTree.name}.`}]);
        } else {
            setMessages([{role: 'model', text: t('oracle_greeting')}]);
        }
    }, [mode, selectedTree?.id]);
    useEffect(() => {
        if (mode === 'tree' && !selectedTree && activeTree) {
            setSelectedTree(activeTree);
        }
    }, [mode, selectedTree?.id, activeTree?.id]);
    useEffect(() => {
        if (lightseed) {
            const unsub = listenToUserProfile(lightseed.uid, (data) => {
                setUsage(data?.dailyAiText || 0);
            });
            return () => unsub();
        }
    }, [lightseed]);
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        if (mode === 'tree') {
            if (!lightseed || !activeTree || !selectedTree) {
                setMessages(prev => [...prev, {role: 'model', text: "Choose your active tree and a receiving tree before sending a mycelial message."}]);
                return;
            }
            const mycelialText = input.trim();
            setInput('');
            setMessages([{role: 'model', text: `Mycelial communication moving between ${activeTree.name} and ${selectedTree.name}.`}]);
            setIsTyping(true);
            try {
                await mintPulse({
                    lifetreeId: activeTree.id,
                    type: 'tree_chat',
                    title: `Mycelial message: ${activeTree.name} -> ${selectedTree.name}`,
                    body: mycelialText,
                    content: mycelialText,
                    chatTreeId: selectedTree.id,
                    chatTreeName: selectedTree.name,
                    authorId: lightseed.uid,
                    authorName: activeTree.name,
                    authorPhoto: activeTree.imageUrl || lightseed.photoURL || undefined,
                });
                setMessages([{
                    role: 'model',
                    text: `Mycelial communication sent between ${activeTree.name} and ${selectedTree.name}.`
                }]);
            } catch (error: any) {
                setMessages([{
                    role: 'model',
                    text: error.message || "The mycelial message could not be sent."
                }]);
            }
            setIsTyping(false);
            return;
        }
        try {
            const allowed = await checkAndIncrementAiUsage('text');
            if (!allowed) {
                setMessages(prev => [...prev, {role: 'user', text: input}, {role: 'model', text: t('ai_login_required')}]);
                setInput('');
                return;
            }
        } catch (error: any) {
            setMessages(prev => [...prev, {role: 'user', text: input}, {role: 'model', text: error.message || t('daily_limit_text')}]);
            setInput('');
            return;
        }
        const userMsg = input;
        const history = [...messages];
        setInput('');
        setMessages(prev => [...prev, {role: 'user', text: userMsg}]);
        setIsTyping(true);
        try {
            const responsePromise = sendMessageToOracle(userMsg, history);
            const responseText = await withTimeout(responsePromise, 30000, "The reply took too long. Please try again.");
            setMessages(prev => [...prev, {role: 'model', text: responseText || "..."}]);
        } catch(e: any) {
            let msg = "The wind is too strong (Error connecting to AI).";
            if (e.message?.includes("403")) {
                msg = "Forbidden (403): The Oracle cannot hear you. Please ensure your API Key is valid.";
            } else if (e.message?.includes("429") || e.code === 'resource-exhausted') {
                msg = "The spirits are overwhelmed (Rate Limit). Please wait a moment.";
            } else if (e.message) {
                msg = `Error: ${e.message}`;
            }
            setMessages(prev => [...prev, {role: 'model', text: msg}]);
        }
        setIsTyping(false);
    }
    const handleMint = async () => {
        if (!lightseed || !activeTree) {
            alert("You need a planted Lifetree to mint this conversation.");
            return;
        }
        if (mode === 'tree' && !selectedTree) {
            alert("Choose a tree before minting this conversation.");
            return;
        }
        if (messages.length <= 1) return; // Only greeting
        setIsMinting(true);
        try {
            const modelName = mode === 'tree' && selectedTree ? selectedTree.name : 'Oracle';
            const conversationText = messages.map(m => `${m.role === 'user' ? 'Seeker' : modelName}: ${m.text}`).join('\n\n');
            const summaryPrompt = conversationText.substring(0, 1000); // Limit context for generation
            await checkAndIncrementAiUsage('image');
            const prompt = `Create an abstract, artistic image representing the essence of this conversation: ${summaryPrompt}. Do not contain any text, words, letters, or typography in the image.`;
            const imageUrl = await withTimeout(
                generateImage(prompt),
                45000,
                "The pulse image took too long to generate. Please try minting again."
            );
            let finalImageUrl = "";
            if (imageUrl && imageUrl.startsWith('data:')) {
                 finalImageUrl = await uploadBase64Image(imageUrl, `users/${lightseed.uid}/pulses/ai/${Date.now()}`);
            }
            await mintPulse({
                lifetreeId: activeTree.id,
                type: mode === 'tree' ? 'tree_chat' : 'STANDARD',
                title: mode === 'tree' && selectedTree ? `Tree Chat: ${selectedTree.name}` : 'Oracle Wisdom',
                body: conversationText,
                imageUrl: finalImageUrl,
                chatTreeId: mode === 'tree' ? selectedTree?.id : undefined,
                chatTreeName: mode === 'tree' ? selectedTree?.name : undefined,
                authorId: lightseed.uid,
                authorName: lightseed.displayName || "Soul",
                authorPhoto: lightseed.photoURL,
            });
            alert("Conversation minted as a Pulse!");
        } catch (e: any) {
            alert("Minting failed: " + e.message);
        }
        setIsMinting(false);
    }
    return (
        <div className="max-w-2xl mx-auto h-[70vh] flex flex-col bg-white rounded-3xl shadow-xl border border-emerald-100 overflow-hidden relative">
            <div className="border-b border-slate-100 bg-white/95 p-4 backdrop-blur-md">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-800">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span>{mode === 'tree' ? 'Mycelial Communication' : 'Osiris Wisdom'}{mode === 'oracle' ? `: ${usage}/21` : ''}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="rounded-full border border-slate-200 bg-slate-50 p-1">
                            <button
                                type="button"
                                onClick={() => setMode('oracle')}
                                className={`rounded-full px-3 py-1 text-[10px] font-bold transition-colors ${mode === 'oracle' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Oracle
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('tree')}
                                className={`rounded-full px-3 py-1 text-[10px] font-bold transition-colors ${mode === 'tree' ? 'bg-sky-600 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Tree
                            </button>
                        </div>
                        {mode === 'tree' && (
                            <select
                                value={selectedTree?.id || ''}
                                onChange={(e) => setSelectedTree(treeChoices.find(tree => tree.id === e.target.value) || null)}
                                className="h-8 max-w-[180px] rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="">Choose tree</option>
                                {treeChoices.map(tree => (
                                    <option key={tree.id} value={tree.id}>{tree.name}</option>
                                ))}
                            </select>
```

### ./components/PulseCard.tsx
```
import React, { useState, useEffect } from 'react';
import { type Pulse, type Lightseed } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { isPulseLoved, lovePulse } from '../services/firebase';
import { Icons } from './ui/Icons';
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
    const badge = pulse.type === 'event' ? 'EVENT' : pulse.type === 'tree_chat' ? 'TREE CHAT' : pulse.type === 'GROWTH' ? 'GROWTH' : '';
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
            className={`bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 group cursor-pointer ${pulse.type === 'GROWTH' ? 'ring-2 ring-emerald-500 ring-opacity-20' : ''} ${pulse.type === 'event' ? 'ring-2 ring-sky-500 ring-opacity-20' : ''}`}
        >
             <div className="relative h-36 bg-slate-100 overflow-hidden group">
                 <div className="absolute top-2 right-2 z-20 flex gap-1">
                    {badge && <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm ${pulse.type === 'event' ? 'bg-sky-100 text-sky-700' : pulse.type === 'tree_chat' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-600'}`}>{badge}</span>}
                    {images.length > 1 && <span className="bg-white/90 text-slate-600 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">{images.length} IMG</span>}
                    {pulse.isMatch && <span className="bg-sky-100 text-sky-600 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">MATCH</span>}
                 </div>
                {images.length > 0 ? (
                    <img src={images[0]} alt={pulse.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-50">
                        <Icons.Hash />
                    </div>
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
}
export const PulseDetail = ({ pulse, activeTree, onClose, backLabel = "Back" }: PulseDetailProps) => {
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
                <div className="flex gap-2">
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
                        {pulse.type === 'tree_chat' && pulse.chatTreeName && (
                            <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
                                Conversation with <span className="font-bold">{pulse.chatTreeName}</span>
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
                     {/* Blockchain Ledger info - Repurposed for Memory / Validation */}
                     <div className="bg-white border border-slate-200 p-6 rounded-2xl">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                            <Icons.ShieldCheck />
                            <span className="ml-2">Network Memory</span>
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <span className="text-sm text-slate-600">Validation Score</span>
                                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{pulse.validationScore || pulse.loveCount || 0}</span>
                            </div>
                            <p className="text-xs text-slate-500 italic">
                                Only validated understanding becomes memory. When you validate this pulse, you contribute to community coherence and earn AI tokens.
                            </p>
                        </div>
                     </div>
                 </div>
            </div>
        </div>
```

### ./components/VisionCard.tsx
```
import React from 'react';
import { type Vision } from '../types';
import { Icons } from './ui/Icons';
export const VisionCard = ({ vision }: { vision: Vision }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300 group">
            <div className="relative h-36 bg-amber-50 overflow-hidden">
                {vision.imageUrl ? (
                    <img src={vision.imageUrl} alt={vision.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-amber-300">
                        <Icons.Sparkles />
                    </div>
                )}
                {/* Title Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none"></div>
                <div className="absolute bottom-2 left-3 right-3 text-white pointer-events-none">
                     <h3 dir="auto" className="text-lg font-light tracking-wide truncate">{vision.title}</h3>
                </div>
                {vision.link && (
                    <a href={vision.link} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-amber-600 hover:text-amber-800 hover:scale-110 transition-all shadow-sm z-10">
                        <Icons.Globe />
                    </a>
                )}
            </div>
            <div className="p-3">
                <p dir="auto" className="text-slate-600 text-xs font-light italic leading-relaxed truncate">
                    "{vision.body}"
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
import { Vision } from '../types';
import { Icons } from './ui/Icons';
import { useLanguage } from '../contexts/LanguageContext';
import { joinVision, leaveVision } from '../services/firebase';
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
        if (currentUserId && vision.joinedUserIds) {
            setIsJoined(vision.joinedUserIds.includes(currentUserId));
            setParticipantCount(vision.joinedUserIds.length);
        }
    }, [vision, currentUserId]);
    const handleJoinToggle = async () => {
        if (!currentUserId || isUpdating) return;
        setIsUpdating(true);
        try {
            if (isJoined) {
                await leaveVision(vision.id, currentUserId);
                setIsJoined(false);
                setParticipantCount(prev => Math.max(0, prev - 1));
            } else {
                await joinVision(vision.id, currentUserId);
                setIsJoined(true);
                setParticipantCount(prev => prev + 1);
            }
        } catch (e: any) {
            alert("Action failed: " + e.message);
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
                             <Icons.Sparkles />
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
    if (!visionBody) { alert("Please enter a vision description first."); return; }
    setLocalUploading(true);
    try {
        const allowed = await checkAndIncrementAiUsage('image');
        if (!allowed) {
            alert(t('ai_login_required'));
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
         alert(`Image generation failed: ${e.message || t('daily_limit_image')}`);
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
        alert(e.message); 
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
import React, { useState, FormEvent } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { ImagePicker } from '../ui/ImagePicker';
import { Pulse, Lightseed, Lifetree } from '../../types';
interface EmitPulseModalProps {
  lightseed: Lightseed | null;
  activeTree: Lifetree | null;
  matchCandidate: Pulse | null;
  onClose: () => void;
  onMint: (data: any) => Promise<void>;
  onProposeAlignment: (data: any) => Promise<void>;
  uploading: boolean;
  handleImageUpload: (file: File, path: string) => Promise<string>;
  uploadBase64Image: (base64: string, path: string) => Promise<string>;
}
export const EmitPulseModal: React.FC<EmitPulseModalProps> = ({
  lightseed,
  activeTree,
  matchCandidate,
  onClose,
  onMint,
  onProposeAlignment,
  uploading,
  handleImageUpload,
  uploadBase64Image
}) => {
  const { t } = useLanguage();
  const [pulseTitle, setPulseTitle] = useState('');
  const [pulseBody, setPulseBody] = useState('');
  const [pulseImageUrl, setPulseImageUrl] = useState('');
  const [isGrowth, setIsGrowth] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleMint = async (e: FormEvent) => {
    e.preventDefault();
    if (!lightseed || !activeTree || isSubmitting) return;
    setIsSubmitting(true);
    try {
      let finalImageUrl = pulseImageUrl;
      if (pulseImageUrl.startsWith('data:')) {
        finalImageUrl = await uploadBase64Image(pulseImageUrl, `users/${lightseed.uid}/pulses/ai/${Date.now()}`);
      }
      await onMint({
        lifetreeId: activeTree.id,
        type: isGrowth ? 'GROWTH' : 'STANDARD',
        title: pulseTitle,
        body: pulseBody,
        imageUrl: finalImageUrl,
        authorId: lightseed.uid,
        authorName: lightseed.displayName || "Soul",
        authorPhoto: lightseed.photoURL || undefined,
      });
      onClose();
    } catch(e: any) { 
        alert(e.message); 
    } finally { setIsSubmitting(false); }
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
         alert("Alignment Proposed! Waiting for resonance.");
         onClose();
    } catch(e:any) { 
        alert(e.message); 
    } finally { setIsSubmitting(false); }
  }
  return (
    <Modal title={matchCandidate ? t('propose_alignment') : t('emit_pulse')} onClose={onClose}>
      <form onSubmit={matchCandidate ? handleAlignment : handleMint} className="flex flex-col gap-4">
        {matchCandidate ? (
          <div className="bg-sky-50 p-4 rounded text-sky-800">
            {t('alignment_with')} <strong>{matchCandidate.title}</strong>. 
            <br/><span className="text-xs">{t('alignment_request_desc')}</span>
          </div>
        ) : (
          <>
            <ImagePicker 
                onImageSelect={(file) => handleImageUpload(file, `users/${lightseed?.uid}/pulses/${Date.now()}`).then(setPulseImageUrl)} 
                previewUrl={pulseImageUrl} 
                loading={uploading} 
            />
            <div className="flex items-center gap-2">
              <input type="checkbox" id="growth" checked={isGrowth} onChange={e => setIsGrowth(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
              <label htmlFor="growth" className="text-sm font-medium text-slate-700">{t('internal_pulse')}</label>
            </div>
            <input dir="auto" className="block w-full border p-2 rounded" placeholder={t('title')} value={pulseTitle} onChange={e=>setPulseTitle(e.target.value)} required />
            <textarea dir="auto" className="block w-full border p-2 rounded" placeholder={t('body')} value={pulseBody} onChange={e=>setPulseBody(e.target.value)} required />
          </>
        )}
        <button type="submit" disabled={uploading || isSubmitting} className="w-full bg-emerald-600 text-white py-2 rounded disabled:opacity-50 font-bold uppercase tracking-wider shadow-md">
          {isSubmitting ? t('minting') : (matchCandidate ? t('send_request') : t('mint'))}
        </button>
      </form>
    </Modal>
  );
};
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
        domainDefaultTheme
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
  arrayRemove,
  writeBatch,
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
import { type Pulse, type PulseType, type Lifetree, type Alignment, type Vision, type Community } from '../types';
import { createBlock } from '../utils/crypto';
import { oldEmeraldEarthThemeValues } from '../utils/theme';
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
const newsletterConfigRef = doc(db, 'config', 'newsletter');
export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => onAuthStateChanged(auth, callback);
export const signInWithGoogle = async () => {
  try { 
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
          await setDoc(userDocRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              createdAt: serverTimestamp(),
              newsletterSubscribed: false,
              invitesRemaining: 7,
              dailyAiText: 0,
              dailyAiImage: 0,
              lastAiReset: Date.now()
          });
          try {
              await triggerSystemEmail(
                  user.email || "", 
                  "Welcome to lightseed", 
                  `Welcome to lightseed, ${user.displayName}. You have planted your intention. Now you may plant your tree.`,
                  user.uid
              );
          } catch (emailError) {
          }
      }
      return user; 
  } catch (error: any) { 
      alert("Sign-in failed: " + (error.message || "Unknown error"));
      throw error; 
  }
};
export const logout = () => firebaseSignOut(auth);
export const listenToUserProfile = (userId: string, callback: (data: any) => void) => {
    return onSnapshot(doc(db, 'users', userId), (docSnap) => {
        if (docSnap.exists()) callback(docSnap.data());
    });
}
export const updateUserSiteTheme = (userId: string, data: any) =>
    setDoc(doc(db, 'users', userId), { ...data, updatedAt: serverTimestamp() }, { merge: true });
export const deleteUserAccount = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("No user signed in");
    const uid = user.uid;
    const email = user.email;
    try {
        const treesQ = query(collection(db, 'lifetrees'), where('ownerId', '==', uid));
        const treesSnap = await getDocs(treesQ);
        const batch = writeBatch(db);
        treesSnap.docs.forEach(d => batch.delete(d.ref));
        const pulsesQ = query(collection(db, 'pulses'), where('authorId', '==', uid));
        const pulsesSnap = await getDocs(pulsesQ);
        pulsesSnap.docs.forEach(d => batch.delete(d.ref));
        const visionsQ = query(collection(db, 'visions'), where('authorId', '==', uid));
        const visionsSnap = await getDocs(visionsQ);
        visionsSnap.docs.forEach(d => batch.delete(d.ref));
        const userRef = doc(db, 'users', uid);
        batch.delete(userRef);
        await batch.commit();
        if (email) await triggerSystemEmail(email, "Goodbye from lightseed", "It was wonderful to have you. See you!", uid);
        await firebaseDeleteUser(user);
    } catch (e: any) {
        if (e.code === 'auth/requires-recent-login') throw new Error("Please log out and log in again to confirm deletion security.");
        throw e;
    }
}
export const checkAndIncrementAiUsage = async (type: 'text' | 'image'): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;
    const userRef = doc(db, 'users', user.uid);
    try {
        await runTransaction(db, async (t) => {
            const docSnap = await t.get(userRef);
            if (!docSnap.exists()) throw new Error("User profile missing");
            const data = docSnap.data();
            const now = Date.now();
            const lastDate = new Date(data.lastAiReset || 0).getDate();
            const currentDate = new Date(now).getDate();
            let textCount = data.dailyAiText || 0;
            let imageCount = data.dailyAiImage || 0;
            if (lastDate !== currentDate) { textCount = 0; imageCount = 0; }
            if (type === 'text') {
                if (textCount >= 21) throw new Error("Daily Oracle limit reached (21/21).");
                textCount++;
            } else {
                if (imageCount >= 3) throw new Error("Daily Vision limit reached (3/3).");
                imageCount++;
            }
            t.update(userRef, { dailyAiText: textCount, dailyAiImage: imageCount, lastAiReset: now });
        });
        return true;
    } catch (e) { throw e; }
}
export const triggerSystemEmail = async (to: string, subject: string, text: string, userId?: string) => {
    const effectiveUid = userId || auth.currentUser?.uid;
    if (!effectiveUid) throw new Error("User ID required for email triggering.");
    try {
        const sendEmailFn = httpsCallable(functions, 'sendSystemEmail');
        return await sendEmailFn({
            to: [to],
            subject: subject,
            text: text,
            html: `<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;"><h2 style="color: #059669; font-weight: 300; letter-spacing: 1px; margin-bottom: 20px;">.seed</h2><div style="font-size: 16px; margin-bottom: 30px;">${text.replace(/\n/g, '<br>')}</div><hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" /><p style="font-size: 12px; color: #9ca3af; text-align: center;">Sent from the <a href="https://lightseed.online" style="color: #059669; text-decoration: none;">Lifetree Network</a></p></div>`
        });
    } catch (e) { 
        throw e; 
    }
}
export const sendInvite = async (targetEmail: string, customMessage: string, userId: string, inviteLink: string) => {
    const userRef = doc(db, 'users', userId);
    await runTransaction(db, async (t) => {
        const userDoc = await t.get(userRef);
        if (!userDoc.exists()) throw new Error("User profile not found");
        const currentInvites = userDoc.data().invitesRemaining || 0;
        if (currentInvites <= 0) throw new Error("No invites remaining.");
        t.update(userRef, { invitesRemaining: currentInvites - 1 });
    });
    await triggerSystemEmail(targetEmail, "You have been invited to lightseed", `${customMessage ? `"${customMessage}"\n\n` : ""}You have been invited to join the lightseed network. Join here: ${inviteLink}`, userId);
}
export const monitorMailStatus = (docId: string, onChange: (status: any) => void) => {
    return onSnapshot(doc(db, 'mail', docId), (docSnap) => {
        if (docSnap.exists()) onChange(docSnap.data().delivery);
    }, (error) => {
        if (error.code === 'permission-denied') onChange({ state: 'ERROR', error: 'Permission denied' });
    });
}
export const subscribeToNewsletter = async (email: string) => addDoc(subsCollection, { email, createdAt: serverTimestamp() });
const normalizeSubscriptionId = (email: string) => encodeURIComponent(email.trim().toLowerCase());
export const setNewsletterSubscription = async (uid: string, email: string, subscribe: boolean) => {
    const userRef = doc(db, 'users', uid);
    const subRef = doc(db, 'subscriptions', normalizeSubscriptionId(email));
    const normalizedEmail = email.trim().toLowerCase();
    await setDoc(userRef, { newsletterSubscribed: subscribe }, { merge: true });
    if (subscribe) {
        await setDoc(subRef, {
            uid,
            email: normalizedEmail,
            active: true,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
        }, { merge: true });
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
import type { Timestamp, GeoPoint } from 'firebase/firestore';
export type Lightseed = Pick<FirebaseUser, 'uid' | 'email' | 'displayName' | 'photoURL'>;
export type LegacyPulseType = 'STANDARD' | 'GROWTH';
export type PulseType = 'observation' | 'dream' | 'offering' | 'request' | 'translation' | 'validation' | 'event' | 'tree_chat' | LegacyPulseType;
export type LifetreeType = "human" | "ai" | "community" | "project" | "LIFETREE" | "GUARDED" | "FAMILY";
export type VisionStatus = "seed" | "growing" | "flowering" | "dormant";
export interface PulseInterpretation {
    depth: number;
    interpretation: string;
    confidence: number;
    alternatives?: string[];
    growthSuggestion?: string;
}
export interface Lifetree {
  id: string;
  ownerId: string; // Legacy
  name: string;
  shortTitle?: string; // Legacy
  body: string; // The Vision (Legacy)
  imageUrl?: string;
  latestGrowthUrl?: string; // URL of the most recent growth pulse image
  type?: LifetreeType;
  visionIds?: string[];
  pulseIds?: string[];
  guardianIds?: string[];
  parentTreeIds?: string[];
  childTreeIds?: string[];
  aiTokenBalance?: number;
  coherenceScore?: number;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  location?: GeoPoint;
  domain?: string; // Associated website domain, e.g. "example.com"
  createdAt: Timestamp;
  validated: boolean; 
  validatorId?: string | null;
  isNature?: boolean;
  treeType?: LifetreeType; // Legacy
  guardians?: string[]; // Array of User IDs (Legacy)
  status?: 'HEALTHY' | 'DANGER';
  genesisHash: string;
  latestHash: string; 
  blockHeight: number;
}
export interface Vision {
  id: string;
  lifetreeId?: string; // Legacy
  treeId?: string; // V2
  authorId: string; // Legacy
  title: string;
  body: string; // Legacy
  description?: string; // V2
  link?: string;
  imageUrl?: string;
  createdAt: Timestamp;
  joinedUserIds?: string[]; // List of users who joined this vision
  status?: VisionStatus;
  resonanceScore?: number;
}
export interface Pulse {
  id: string;
  lifetreeId?: string; // Legacy
  treeId?: string; // V2
  visionId?: string; // V2
  type: PulseType;
  title: string; // Legacy
  body: string; // Legacy
  content?: string; // V2
  imageUrl?: string;
  imageUrls?: string[];
  eventDate?: string;
  eventLocation?: string;
  chatTreeId?: string;
  chatTreeName?: string;
  seenBy?: string[];
  aiInterpretation?: PulseInterpretation;
  validationScore?: number;
  isMatch?: boolean;
  matchedLifetreeId?: string;
  matchId?: string; // Link to the handshake
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  createdAt: Timestamp;
  loveCount: number;
  commentCount: number;
  previousHash: string;
  hash: string;
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
}
export interface Community {
  id: string;
  ownerId: string;
  name: string;
  domain: string; // The link to Lifetree
  vision: string; // Rich text
  imageUrls: string[]; // For carousel
  logoUrl?: string;
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
}
```
