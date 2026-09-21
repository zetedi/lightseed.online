
import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import {
  logout,
  mintPulse,
  growVision,
  getVisionById,
  getLifetreeById,
  getPulseById,
  deleteLifetree,
  deleteVision,
  acceptAlignment,
  rejectAlignment,
  signAlignmentCovenant,
  getCovenantForAlignment,
  getAlignmentById,
} from './services/firebase';
import { SigningKeyNeedsRestoreError } from './services/keys';
import { type Pulse, type Lifetree, type Alignment, type Vision, type ReachAudience } from './types';
import Logo from './components/Logo';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { SessionProvider, useSession } from './contexts/SessionContext';
import { isSeedShellHost, useConfig } from './hooks/useConfig';
import { useSiteTheme } from './hooks/useSiteTheme';
import { useReaches } from './hooks/useReaches';
import { useResonance } from './hooks/useResonance';
import { useHistoryLayers } from './hooks/useHistoryLayers';
import { useForestFeed } from './hooks/useForestFeed';
import { useOrderedEvents } from './hooks/useOrderedEvents';
import { useAlignmentCards } from './hooks/useAlignmentCards';
import { useAppRouting, topLevelRoute } from './hooks/useAppRouting';
import { useImageUpload } from './hooks/useImageUpload';
import { useForestFilters } from './hooks/useForestFilters';
import { useDashboardStats } from './hooks/useDashboardStats';
import { useObservatoryQuote } from './hooks/useObservatoryQuote';
import { useSuperAdminConsole } from './hooks/useSuperAdminConsole';
// The shell's own seams (ring 2026-09-16): each owns one family of state the conductor composes.
import { useBeingOverlays } from './hooks/useBeingOverlays';
import { useModalDoors } from './hooks/useModalDoors';
import { usePersonalSite } from './hooks/usePersonalSite';
import { useHostNode } from './hooks/useHostNode';
import { useDoorArrivals } from './hooks/useDoorArrivals';
import { useCarrying } from './hooks/useCarrying';
import { useHeroEvents } from './hooks/useHeroEvents';
import { usePathwayInput } from './hooks/usePathwayInput';
import { setActiveCoin } from './hooks/useCoin';
import { useHostStanding } from './hooks/useHostStanding';
import { memberEventsPlace } from './domain/pulseVisibility';
import { coinOf } from './domain/coin';
import { GDPRBanner } from './components/GDPRBanner';

// Components — the always-present shell (nav, footer, loaders, dialogs) stays statically imported.
import { Icons } from './components/ui/Icons';
import { Navigation } from './components/Navigation';
import { eventsOnView } from './domain/pulseVisibility';
import { passesForestFilter, canViewTree } from './domain/views/forest';
import { isWateringOverdue } from './domain/watering';
import { Loading } from './components/ui/Loading';
import { NetworkStatus } from './components/ui/NetworkStatus';
import { OutwardLink } from './components/ui/OutwardLink';
import { Picture } from './components/ui/Picture';
import { ScrollChevrons } from './components/ui/ScrollChevrons';
import { UpdateToast } from './components/ui/UpdateToast';
import { SilentUpdate } from './components/ui/SilentUpdate';
import { ToastHost, notify } from './components/ui/Toast';
import { onRefresh as onBusRefresh } from './services/refreshBus';
import { lidFromPath, beingPath } from './domain/beingLink';
import { motherDoorUrl } from './domain/communityDoor';
import { CustomLandingPage } from './pages/CustomLandingPage';
import { Footer } from './components/ui/Footer';
import { PathwayCTA } from './components/PathwayCTA';
import type { PathwayStepKey } from './domain/pathway';
import { derivePathway } from './domain/pathway';
import { deriveCrownRole } from './domain/dataAuthority';
import { PathOverview } from './components/PathOverview';
import { Modal } from './components/ui/Modal';
import { LifeseedWidget } from './components/LifeseedWidget';
import { DialogHost, showAlert, showConfirm } from './components/ui/Dialog';
import { isExplicitlyValidatedTree } from './utils/validation';
import { speak } from './utils/translations';
import { DetailWrapper } from './components/app/DetailWrapper';
import { ShellBanners } from './components/app/ShellBanners';
import { CareCorner } from './components/app/CareCorner';
import { BeingDetail, isBeingDetailOpen } from './components/app/BeingDetail';
import { AppOverlays } from './components/app/AppOverlays';
import { MainContent, type OfferingsSub } from './components/app/MainContent';

// Detail overlays and modals are code-split: each becomes its own chunk that loads only when
// first shown, so the initial bundle no longer ships them on first paint.
const EventProfile = lazy(() => import('./components/EventProfile').then(m => ({ default: m.EventProfile })));
const PulseDetail = lazy(() => import('./components/PulseDetail').then(m => ({ default: m.PulseDetail })));
const AuthModal = lazy(() => import('./components/modals/AuthModal').then(m => ({ default: m.AuthModal })));
const DataModelCrystal = lazy(() => import('./components/about/DataModelCrystal').then(m => ({ default: m.DataModelCrystal })));

// The message a thrown thing carries, if any — for the alerts the shell shows on failure.
const messageOf = (e: unknown): string | undefined => (e instanceof Error && e.message ? e.message : undefined);

const AppContent = () => {
    const { t, language, setLanguage } = useLanguage();
    const { lightseed, myTrees, guardedTrees, activeTree, defaultVisionId, publicName, isAdmin, isSuperAdmin, loading: authLoading, refreshTrees } = useSession();
    // The set of trees the signed-in user guards (the LIN, via guardian links) — passed to cards
    // so a card can show its guardian affordance without a per-card read.
    const guardedTreeIds = useMemo(() => new Set(guardedTrees.map(t => t.id)), [guardedTrees]);
    // The open beings — declared before useAppRouting so its deep-link callback opens through them.
    const beings = useBeingOverlays();
    // Routing (tab + forest view mode + ?tree/?invite deep-links) lives in useAppRouting.
    const { tab, setTab, viewMode, setViewMode, inviteParam } = useAppRouting(beings.openTreeById);
    const [alignments, setAlignments] = useState<Alignment[]>([]);
    // The Observatory's oracle quote (moved out of the dashboard card into the page header).
    const observatory = useObservatoryQuote(tab);
    const doors = useModalDoors();
    const personal = usePersonalSite(lightseed?.uid);
    // THE TONGUE FOLLOWS THE BEING (ring 2026-09-18; domain/desires): the desire on the person
    // wins over what this browser remembered, the moment the profile arrives.
    const desiredTongue = personal.desiredTongue;
    useEffect(() => {
        if (desiredTongue && desiredTongue !== language) setLanguage(desiredTongue);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to the DESIRE arriving or changing; the current tongue is compared, not depended on (a local choice must not re-trigger the desire)
    }, [desiredTongue]);
    const host = useHostNode({ uid: lightseed?.uid, isSuperAdmin, selectedCommunity: beings.selectedCommunity });
    const { hostCommunity, impersonatedCommunity, defaultCommunity, activeCommunity, activeDataDomain, hostResolved, hostCommunityResolved } = host;
    const [searchTerm, setSearchTerm] = useState('');
    // The Offerings page holds two full-width sub-tabs: the offering pulses, and beds (a bed IS an offering).
    const [offeringsSub, setOfferingsSub] = useState<OfferingsSub>('offerings');

    // Stats State for Dashboard
    const stats = useDashboardStats(lightseed, tab);
    const { uploading, handleImageUpload } = useImageUpload();
    const filters = useForestFilters();

    const config = useConfig(activeCommunity);
    // WHERE THE VIEWER STANDS AT THE HOST (ring 2026-09-21): decides whether the face may ask for
    // the host's members-only events and whether an event born here is born in the community.
    const hostStanding = useHostStanding(lightseed?.uid, activeCommunity);
    const memberEventsOf = memberEventsPlace({ uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin }, hostStanding, activeCommunity?.id);
    // THE ACTIVE COIN (ring 2026-09-19): the face the light wears where the viewer stands.
    useEffect(() => { setActiveCoin(coinOf(activeCommunity)); }, [activeCommunity]);
    const { effectiveTheme, effectiveIsDark, configuredLogoUrl, toggleNightMode, backgroundStyle } =
        useSiteTheme({ config, impersonatedCommunity, lightseed, personalSiteTheme: personal.personalSiteTheme, personalSiteLogoUrl: personal.personalSiteLogoUrl, personalSiteInherit: personal.personalSiteInherit });

    // Live unread-reach count powering the nav's red envelope indicator (see useReaches).
    const unreadReaches = useReaches(lightseed, myTrees);

    // Pending alignments, hydrated with the two trees + matched pulses for the Observatory cards.
    const alignmentCards = useAlignmentCards(alignments, myTrees);

    // The paginated forest / pulse / vision / event / reach feed + infinite scroll (see useForestFeed).
    const feed = useForestFeed({
        tab, viewMode, lightseed, isSuperAdmin, isAdmin, setAlignments,
        hostReflectsPublic: activeCommunity?.reflectsPublic,
        hostDomain: activeCommunity?.domain,
        hostStrictScope: activeCommunity?.strictScope,
        hostCommunityId: activeCommunity?.id,
        memberEventsOf,
    });
    const { data, setData, loadContent, loadingMore } = feed;

    // The refresh bus, heard by the live feed: when an event/pulse is deleted anywhere
    // (its profile page, a community tab), prune it from the loaded list — no reload.
    useEffect(() => onBusRefresh(e => {
        if (!e.id) return;
        // An edit carries its patch — merge it into the loaded copy, whatever the tab shows
        // (events, pulses, offerings, trees, visions all ride the same whisper). A patchless
        // announce with an id stays what it always was: a removal to prune.
        if (e.patch) {
            const patch = e.patch;
            setData(prev => prev.some(item => item.id === e.id) ? prev.map(item => item.id === e.id ? { ...item, ...patch } : item) : prev);
            // The open tree page follows the same whisper: a mint moves the head (latestHash,
            // blockHeight, the latest face) and the profile's chain reloads from it.
            if (e.topic === 'trees') beings.setSelectedTree(prev => (prev && prev.id === e.id ? { ...prev, ...patch } : prev));
        } else if (e.topic === 'events' || e.topic === 'pulses') {
            setData(prev => prev.some(item => item.id === e.id) ? prev.filter(item => item.id !== e.id) : prev);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setData and setSelectedTree are stable setters
    }), []);

    // Load the tab's content when the view changes — or when the active node's commons/domain
    // changes (flipping "reflect the commons" re-scopes the feed live, no refresh needed).
    // The first load waits until the feed knows WHERE it stands and WHO is looking: the host
    // community (its domain, its reflection choice) and the auth state. Loading earlier meant
    // three passes on every mount — signed-out, then signed-in, then re-scoped — each showing
    // a different set, items appearing and vanishing as the narrower pass landed.
    useEffect(() => {
        if (tab !== 'dashboard' && hostCommunityResolved && !authLoading) loadContent(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadContent is recreated per render; adding it would refetch the feed on every render (loop). It already closes over tab/viewMode/lightseed.
    }, [tab, lightseed?.uid, isSuperAdmin, isAdmin, viewMode, hostCommunityResolved, authLoading, activeCommunity?.reflectsPublic, activeCommunity?.domain, activeCommunity?.strictScope]);

    const carrying = useCarrying({ isSuperAdmin, carrierName: lightseed?.displayName });
    const { arrivedInvite, setArrivedInvite, pendingTreeInvites } = useDoorArrivals({
        authLoading, lightseed, isStaff: isSuperAdmin || isAdmin, tab, inviteParam, beings,
        openAuth: () => doors.setShowAuthModal(true),
    });

    // Seed the Intelligence Commons (default personas + Gemini Oracle) once a super-admin
    // is known. Idempotent and gated by Firestore rules.
    useSuperAdminConsole(isSuperAdmin, lightseed?.uid);

    // With the header visible above the community profile, a tab click should land on that
    // tab — not stay hidden behind the overlay. Navigating closes the community.
    useEffect(() => {
        beings.setSelectedCommunity(null);
        beings.setSelectedPulse(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the tab alone; the two setters are stable
    }, [tab]);

    const dashboardEvents = useHeroEvents({ hostCommunityResolved, authLoading, lightseed, isSuperAdmin, isAdmin, activeCommunity, activeDataDomain, memberEventsOf });

    // Browser back closes overlays LAYER BY LAYER instead of leaving the app. Ordered base-first;
    // the last open layer is topmost (closed first on Back). See useHistoryLayers.
    const openKeys = useHistoryLayers([
        { key: 'tree', open: !!beings.selectedTree, close: () => beings.setSelectedTree(null) },
        { key: 'lightHouse', open: !!beings.viewingLightHouse, close: () => beings.setViewingLightHouse(null) },
        { key: 'community', open: !!beings.selectedCommunity, close: () => beings.setSelectedCommunity(null) },
        { key: 'vision', open: !!beings.selectedVision, close: () => beings.setSelectedVision(null) },
        { key: 'alignment', open: !!beings.selectedAlignment, close: () => beings.setSelectedAlignment(null) },
        { key: 'covenant', open: !!beings.selectedCovenantId, close: () => beings.setSelectedCovenantId(null) },
        { key: 'pulse', open: !!beings.selectedPulse, close: () => beings.setSelectedPulse(null) },
        { key: 'auth', open: doors.showAuthModal, close: () => doors.setShowAuthModal(false) },
        { key: 'plant', open: doors.showPlantModal, close: () => doors.setShowPlantModal(false) },
        { key: 'pulseModal', open: doors.showPulseModal, close: () => doors.setShowPulseModal(false) },
        { key: 'eventModal', open: doors.showEventModal, close: () => doors.setShowEventModal(false) },
        { key: 'offerModal', open: doors.showOfferModal, close: () => doors.setShowOfferModal(false) },
        { key: 'editingOffering', open: !!doors.editingOffering, close: () => doors.setEditingOffering(null) }, // nested on an offering
        { key: 'visionModal', open: doors.showVisionModal, close: () => doors.setShowVisionModal(false) },
        { key: 'reachModal', open: doors.showReachModal, close: () => doors.setShowReachModal(false) },
        { key: 'editingEvent', open: !!doors.editingEvent, close: () => doors.setEditingEvent(null) },      // nested on a pulse detail
        { key: 'growthPlayer', open: !!doors.showGrowthPlayer, close: () => doors.setShowGrowthPlayer(null) }, // nested on a tree detail (or standalone)
    ]);

    // The address bar mirrors the open being: while a tree / light house / vision with a lid
    // stands on screen, the bar wears its /b/<lid> address — copyable and refreshable (a refresh
    // hits the /b/** hosting rewrite, the shell boots, and the arrival effect re-opens it).
    // replaceState ONLY, and declared AFTER useHistoryLayers so its pushState (same commit, on
    // open) runs first and this write lands on the armed entry: the entry COUNT never changes,
    // so the back-button machinery's pushState/back() arithmetic is untouched. A being without
    // a lid leaves the bar alone; when the last of the three closes, the bar returns to '/'.
    const beingWasOpenRef = useRef(false);
    useEffect(() => {
        const top = beings.selectedTree || beings.viewingLightHouse || beings.selectedVision;
        if (top) {
            beingWasOpenRef.current = true;
            if (top.lid) window.history.replaceState(window.history.state, '', beingPath(top.lid));
        } else if (beingWasOpenRef.current) {
            beingWasOpenRef.current = false;
            if (lidFromPath(window.location.pathname)) window.history.replaceState(window.history.state, '', '/');
        }
    }, [beings.selectedTree, beings.viewingLightHouse, beings.selectedVision]);

    const handleTreeUpdate = (treeId: string, updates: Partial<Lifetree>) => {
        setData(prev => prev.map(item => item.id === treeId ? { ...item, ...updates } : item));
        if (beings.selectedTree?.id === treeId) {
            beings.setSelectedTree(prev => prev ? { ...prev, ...updates } : null);
        }
        refreshTrees();
    };

    // THE TWO DOORS TO THE SAME ROOM: the envelope beside the profile and the Messages menu
    // both mount ProfileReaches → ReachInbox → ReachThread with EXACTLY these handlers — one
    // definition, so the mycelium behaves identically whichever door a being walks through.
    const openTreeFromReaches = (id: string, opts?: { closeReachModal?: boolean }) => {
        if (opts?.closeReachModal) doors.setShowReachModal(false); // the modal must step aside, or it covers the tree it opened
        beings.openTreeById(id);
    };
    const openCareFromReaches = (id: string) => {
        // Care floats OVER the conversation — after the watering, you are still where the tree asked for you.
        getLifetreeById(id).then(tr => { if (tr) { doors.setCareOverride(tr); doors.setCareModalOpen(true); } }).catch(() => {});
    };

    const openReach = (tree: Lifetree | null, audience?: ReachAudience) => {
        // You reach FROM your own tree, so reaching needs a signed-in hand. Rather than open
        // a modal that cannot send, say so and offer the door (ring 2026-08-25).
        if (!lightseed?.uid) { notify(speak('reach_needs_signin')); doors.setShowAuthModal(true); return; }
        beings.setSelectedTree(null);
        doors.setReachTree(tree);
        doors.setReachAudience(audience);
        doors.setShowReachModal(true);
    };

    // AI vision-resonance — the weekly-gated synergy analysis + favourites (see useResonance).
    const resonance = useResonance({
        data,
        preferredIntelligenceId: personal.preferredIntelligenceId,
        isStaff: isSuperAdmin || isAdmin,
        viewerUid: lightseed?.uid,
        openReach,
    });

    // Open the Direct Messages inbox as a large overlay (the envelope in the nav). The
    // profile keeps its own Reaches tab for direct visits; this no longer steers there.
    const openDirectMessages = () => {
        doors.setReachTree(null);
        doors.setReachAudience(undefined);
        doors.setShowReachModal(true);
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
                authorName: publicName || t('someone'),
                authorPhoto: lightseed.photoURL || undefined,
            });
            loadContent(true);
        } catch (e: unknown) {
            console.error("Quick Snap Error:", e);
            showAlert(messageOf(e) || 'err_picture');
        }
    }

    // After a tree growth mints: the open tree page and its forest card already followed the
    // head through the refresh bus (mintPulse announces the exact latestHash / blockHeight /
    // latest face); here only the session's tree lists and the feed catch up.
    const handleTreeGrown = () => {
        refreshTrees();
        loadContent(true);
    };

    const handleDeleteTree = async (treeId: string) => {
        if (!(await showConfirm('tree_delete_confirm', { title: 'delete_lifetree_title', confirmText: 'delete', danger: true }))) return;
        try {
            await deleteLifetree(treeId);
            await refreshTrees();
            loadContent(true);
        } catch (e: unknown) {
            console.error("Delete Tree Error:", e);
            showAlert(messageOf(e) || 'err_tree_delete');
        }
    }

    const handleDeleteTreeConfirmed = async (treeId: string) => {
        try {
            await deleteLifetree(treeId);
            await refreshTrees();
            loadContent(true);
        } catch (e: unknown) {
            showAlert(messageOf(e) || 'err_tree_delete');
        }
    }

    // A contribution sealed onto the vision's own chain. After it commits, refresh the open vision
    // so its chain head (blockHeight/latestHash) and the Contributions view reflect the new leaf.
    const handleGrowVision = async (vision: Vision, data: { title?: string; body?: string; imageUrl?: string; growthCategory?: string }) => {
        if (!lightseed) return;
        await growVision(vision, {
            ...data,
            authorId: lightseed.uid,
            authorName: publicName || t('someone'),
            authorPhoto: lightseed.photoURL || undefined,
        });
        try {
            const fresh = await getVisionById(vision.id);
            if (fresh) beings.setSelectedVision(prev => (prev && prev.id === fresh.id ? fresh : prev));
        } catch { /* the view simply keeps its prior head until reopened */ }
    };

    const handleDeleteVisionInApp = async (visionId: string) => {
        if (!(await showConfirm('vision_delete_confirm', { title: 'delete_vision', confirmText: 'delete', danger: true }))) return;
        doors.setBusyLabel(t('vision_releasing'));
        try {
            await deleteVision(visionId);
            beings.setSelectedVision(null);
            loadContent(true);
            doors.setBusyLabel(null);
            notify(t('vision_released_toast'));
        } catch (e: unknown) {
            doors.setBusyLabel(null);
            showAlert(messageOf(e) || 'err_delete');
        }
    }

    const onAcceptAlignment = async (id: string) => {
        try {
            const res = await acceptAlignment(id);
            setAlignments(prev => prev.filter(a => a.id !== id)); // drop the accepted request
            notify(speak('aligned_toast'));
            // Accepting an alignment also SIGNS its covenant (the canonical 2-party form) — additive:
            // the sync-block above stays, and the alignment gains a cryptographic twin the accepting
            // party signs in their own hand. Best-effort: a missing/unavailable signing key must never
            // block the accept (the alignment already succeeded). The covenant is minted lazily on the
            // first party to sign; when the initiator later opens it and signs, quorum 2 seals it.
            const alignment = await getAlignmentById(id).catch(() => null);
            let openedCovenant = false;
            if (alignment && lightseed?.uid) {
                try {
                    const signed = await signAlignmentCovenant(alignment);
                    // Clear any open alignment first: the overlay chain prefers it, and a covenant
                    // opened behind it would silently never show (the dead-button bug's root).
                    if (signed?.covenantId) { beings.setSelectedAlignment(null); beings.setSelectedCovenantId(signed.covenantId); openedCovenant = true; }
                } catch (covErr) {
                    // A key-custody conflict (no device key / stale device) must not stay silent:
                    // the covenant already exists (minted before signing), so open its profile —
                    // its Sign button routes the being through the SigningKeyModal properly.
                    if (covErr instanceof SigningKeyNeedsRestoreError) {
                        const cov = await getCovenantForAlignment(alignment.id).catch(() => null);
                        if (cov) { beings.setSelectedAlignment(null); beings.setSelectedCovenantId(cov.id); openedCovenant = true; }
                    } else {
                        console.warn('Covenant co-sign skipped:', covErr);
                    }
                }
            }
            // Open the resulting block on your chain — through the unified router, so the
            // freshly minted sync-block lands on the alignment view like everywhere else. If the
            // covenant profile opened (the co-sign landed), let it stand instead.
            const pulse = await getPulseById(res.targetPulseId).catch(() => null);
            if (pulse && !openedCovenant) await beings.onViewPulseOrAlignment(pulse);
            loadContent(true);
        }
        catch (e: unknown) {
            console.error("Accept Alignment Error:", e);
            showAlert(messageOf(e) || 'err_alignment_complete');
        }
    }
    const onRejectAlignment = async (id: string) => {
        // Optimistically drop the declined card, then persist.
        setAlignments(prev => prev.filter(a => a.id !== id));
        try { await rejectAlignment(id); } catch (e) { console.error("Reject Alignment Error:", e); loadContent(true); }
    };

    const filteredData = useMemo(() => data.filter((item) => {
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const text = (item.title || item.name || "") + " " + (item.body || "") + " " + (item.locationName || "") + " " + (item.eventLocation || "") + " " + (item.reachTreeName || "");
            if (!text.toLowerCase().includes(term)) return false;
        }
        if (tab === 'forest') {
            if (!canViewTree(item, { uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin, guardedIds: guardedTreeIds })) return false;
            if (!passesForestFilter(item, { showNature: filters.showNatureTrees, showUser: filters.showUserTrees, showValidated: filters.showValidatedTrees }, isExplicitlyValidatedTree)) return false;
        }
        return true;
    }), [data, searchTerm, tab, filters.showNatureTrees, filters.showUserTrees, filters.showValidatedTrees, lightseed?.uid, isSuperAdmin, isAdmin, guardedTreeIds]);

    // --- The Pathway — the plain facts derivePathway reads (domain/pathway) ----------------
    const { wateringNeededCount, pathwayFacts, pathwayInput } = usePathwayInput({
        lightseed, myTrees, guardedTrees, statsAlignments: stats.alignments, pendingAlignments: alignments.length,
    });
    // Every step's click routes into a flow that already exists — the CTA never invents one.
    const openTreeSection = (tree: Lifetree | undefined, section: string) => {
        if (tree) beings.openTreeSection(tree, section);
        else doors.openPlant();
    };
    const pathwayActions: Record<PathwayStepKey, () => void> = {
        signUp: () => doors.setShowAuthModal(true),
        plant: () => doors.openPlant(),
        care: () => openTreeSection(myTrees[0] || guardedTrees[0], 'care'),
        connect: () => setTab('forest'),
        join: () => setTab('communities'),
        followVision: () => setTab('visions'),
        formCircle: () => openTreeSection(myTrees[0], 'circle'),
        plantSeven: () => setTab('profile'),
        nameCommunity: () => setTab('communities'),
        rootDomain: () => setTab('communities'),
        tailorTheme: () => setTab('communities'),
    };

    // The shared viewer cut (domain/pulseVisibility eventsOnView): signed-out visitors see
    // only the node's own happenings; past events rest behind the toggle. nowMs is a snapshot,
    // refreshed when the toggle is touched, so the memo stays pure of the live clock.
    const [showPastEvents, setShowPastEvents] = useState(false);
    const [eventsNowMs, setEventsNowMs] = useState(() => Date.now());
    const eventsForViewer = useMemo(
        () => eventsOnView(filteredData as Pulse[], { signedIn: !!lightseed, showPast: showPastEvents, nowMs: eventsNowMs }),
        [filteredData, lightseed, showPastEvents, eventsNowMs]
    );
    // From my ground (domain/eventOrder): my domain first, then nearness to my default
    // tree (free-text places geocoded best-effort), then soonness. The hero banner and the
    // events page order through the SAME hook (shared geocode cache), so they never diverge.
    const orderedEvents = useOrderedEvents(eventsForViewer, activeTree, activeCommunity?.domain);
    const orderedDashboardEvents = useOrderedEvents(dashboardEvents, activeTree, activeCommunity?.domain);

    const searchSuggestions = useMemo(() => (
        Array.from(new Set(data.map((item) => item.title || item.name).filter(Boolean)))
    ), [data]);

    if (authLoading) return (
        <div className="h-screen w-full flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 z-0" style={backgroundStyle}></div>
            <div className="relative z-10"><Loading /></div>
        </div>
    );

    // Custom-domain visitors wait a breath on neutral ground instead of seeing the seed flash
    // before the organisation's page takes over.
    if (!hostResolved) return (
        <div className="flex h-screen w-full items-center justify-center bg-[#faf6ec]">
            <Loading />
        </div>
    );

    // A custom-landing domain (e.g. Per Auset) greets with the organisation's own page — the
    // seed shell waits behind the corner logo. Staff previewing a community (community view on
    // the hub) reach the same landing through the same corner switcher. Overlays still render.
    const landingCommunity = impersonatedCommunity?.customLanding
        ? impersonatedCommunity
        : (hostCommunity?.customLanding && !impersonatedCommunity ? hostCommunity : null);
    // An arrival overlay (a scanned /b/ being, or an /i/ invitation) sets state that the landing
    // page never draws — and the URL is already consumed — so a QR scan or invite link on a
    // custom-landing domain would dead-end. When any arrival is pending, fall through to the full
    // seed shell so its overlay renders.
    const arrivalPending = [beings.selectedCommunity, beings.viewingLightHouse, beings.selectedTree, beings.selectedVision].some(Boolean);
    if (landingCommunity && !host.seedView && !arrivalPending) {
        const { selectedPulse, setSelectedPulse, selectedTree } = beings;
        return (
            <>
                <CustomLandingPage
                    community={landingCommunity}
                    lightseed={lightseed}
                    onSignIn={() => doors.setShowAuthModal(true)}
                    onSignOut={() => { logout(); carrying.setCarryingTree(null); setTab('dashboard'); }}
                    onEnterSeed={() => host.setSeedView(true)}
                    onViewEvent={(p: Pulse) => { void beings.onViewPulseOrAlignment(p); }}
                />
                <Suspense fallback={null}>
                    {selectedPulse && (
                        <DetailWrapper>
                            {selectedPulse.type === 'event' ? (
                                <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
                                    <EventProfile
                                        theme={effectiveTheme}
                                        pulse={selectedPulse}
                                        activeTree={activeTree}
                                        onClose={() => setSelectedPulse(null)}
                                        currentUserId={lightseed?.uid}
                                        myTrees={myTrees}
                                        hostStrictScope={activeCommunity?.strictScope}
                                    />
                                </div>
                            ) : (
                                <PulseDetail pulse={selectedPulse} activeTree={activeTree} onClose={() => setSelectedPulse(null)} backLabel={selectedTree && selectedPulse.lifetreeId === selectedTree.id ? t('back_to_name').replace('{name}', selectedTree.name) : t('back')} />
                            )}
                        </DetailWrapper>
                    )}
                </Suspense>
                {doors.showAuthModal && !lightseed && (
                    <AuthModal onClose={() => doors.setShowAuthModal(false)} inviteId={inviteParam} inviteOnly={config.inviteOnly} theme={effectiveTheme} />
                )}
            </>
        );
    }

    // The care corner's target: an open tree, else the default tree, else the first of mine.
    const careTarget = doors.careOverride || beings.selectedTree || activeTree || myTrees[0] || null;

    return (
        <div className={`min-h-screen relative font-sans flex flex-col ${effectiveIsDark ? 'text-slate-100' : 'text-slate-800 dark:text-slate-100'}`}>
            <div className="fixed inset-0 z-0 pointer-events-none" style={backgroundStyle}></div>
            {/* New-deploy prompt — the service worker waits for consent instead of silent swap. */}
            <UpdateToast />
            <ToastHost />
            {/* Blocking busy overlay — a darkened backdrop + the spinner while an operation runs
                (e.g. a vision's cascade delete). Above modals (z-100); the snackbar confirms after. */}
            {doors.busyLabel && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm" role="status" aria-live="polite">
                    <Loading size={56} />
                    <p className="text-sm font-medium text-white/90">{doors.busyLabel}</p>
                </div>
            )}
            {/* Page-level scroll affordance — only on the main page (hidden while a detail/modal is open). */}
            {openKeys.length === 0 && <ScrollChevrons axis="y" fixed />}

            {/* THE CARE CORNER (Zoltán, 2026-07-22) — care, one thumb-tap from anywhere; and the
                droplet's modal, a small care sheet for the target tree. */}
            {lightseed && (
                <CareCorner
                    careTarget={careTarget}
                    thirsty={!!careTarget && (isWateringOverdue(careTarget) || wateringNeededCount > 0)}
                    open={doors.careModalOpen}
                    onOpen={() => doors.setCareModalOpen(true)}
                    onClose={() => { doors.setCareModalOpen(false); doors.setCareOverride(null); }}
                    sender={{ uid: lightseed.uid, displayName: lightseed.displayName, photoURL: lightseed.photoURL }}
                    hasVision={!!defaultVisionId}
                    onOpenCare={() => {
                        doors.setCareModalOpen(false);
                        // The care sheet floats OVER a reach conversation, but the FULL care
                        // view is a whole overlay — the reach modal must step aside, or it
                        // covers the very care it opened (the openTreeFromReaches lesson).
                        doors.setShowReachModal(false);
                        beings.setTreeSectionHint('care');
                        if (careTarget && (!beings.selectedTree || beings.selectedTree.id !== careTarget.id)) beings.setSelectedTree(careTarget);
                    }}
                    onOpenVision={defaultVisionId ? async () => {
                        doors.setCareModalOpen(false);
                        doors.setShowReachModal(false); // same step-aside: the vision opens in front
                        const vision = await getVisionById(defaultVisionId).catch(() => null);
                        if (vision) { beings.setSelectedTree(null); beings.setSelectedVision(vision); }
                    } : undefined}
                    onOffer={() => {
                        doors.setCareModalOpen(false);
                        doors.setShowReachModal(false);
                        if (careTarget) doors.openOffer({ kind: 'tree', id: careTarget.id, lid: careTarget.lid, name: careTarget.name, keeperUid: careTarget.ownerId });
                    }}
                />
            )}

            {/* The corner switcher back to the organisation's page — on its own domain, and for
                staff standing in community view on the hub. It MIRRORS the care bead: the same
                max-w-7xl content container, but right-anchored, its centre 20px from the container's
                right edge and on the SAME horizontal line as the bead's centre (bead centre = bottom-4
                + 29px = 45px; this 48px avatar sits at bottom-[21px] so its centre is 45px too). So the
                logo (top-left), the bead (bottom-left) and this community avatar (bottom-right) read as
                three aligned corners of the content, not one pinned to the raw viewport edge. */}
            {landingCommunity && host.seedView && (
                <div className="pointer-events-none fixed inset-x-0 bottom-[21px] z-40">
                    <div className="mx-auto max-w-7xl px-4 text-right sm:px-6 lg:px-8">
                        <button
                            onClick={() => host.setSeedView(false)}
                            title={t('back_to_name').replace('{name}', landingCommunity.name)}
                            aria-label={t('back_to_name').replace('{name}', landingCommunity.name)}
                            className="pointer-events-auto relative inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-xl ring-2 ring-amber-300/70 transition-transform hover:scale-110 active:scale-95 dark:bg-slate-900"
                            style={{ transform: 'translateX(calc(50% - 20px))' }}
                        >
                            {landingCommunity.logoUrl
                                ? <Picture src={landingCommunity.logoUrl} alt="" className="h-full w-full object-cover" />
                                : landingCommunity.heroImageUrl
                                    ? <Picture src={landingCommunity.heroImageUrl} alt="" className="h-full w-full object-cover" />
                                    : <Icons.ArrowLeft />}
                        </button>
                    </div>
                </div>
            )}

            <div className="relative z-20 flex-1">
                <ShellBanners
                    impersonatedCommunity={impersonatedCommunity}
                    onExitCommunity={() => { host.setImpersonatedCommunity(null); setTab('dashboard'); window.scrollTo(0, 0); }}
                    carryingTree={isSuperAdmin ? carrying.carryingTree : null}
                    carrierName={lightseed?.displayName}
                    onStopCarrying={() => carrying.setCarryingTree(null)}
                />
                <Navigation
                    activeTab={tab}
                    // A menu tab ALWAYS lands on its tab: close EVERY being-detail overlay first.
                    // The Light House renders in a FIXED wrapper, so without this the tab
                    // changed underneath while the house stayed on top (a dead-looking menu).
                    setTab={(next: string) => { beings.closeAll(); setTab(next); }}
                    onLogin={() => doors.setShowAuthModal(true)}
                    onLogout={() => { logout(); carrying.setCarryingTree(null); setTab('dashboard'); }}
                    onProfile={() => {
                        // The profile avatar ALWAYS lands on the profile — close any being-detail
                        // overlay sitting on top (a tree opened from the profile would otherwise stay).
                        beings.closeAll();
                        setTab('profile');
                    }}
                    pendingAlignmentsCount={alignments.length}
                    reachNotificationsCount={unreadReaches}
                    treeInviteCount={pendingTreeInvites}
                    careAlertCount={wateringNeededCount}
                    onOpenReachInbox={openDirectMessages}
                    logoUrl={configuredLogoUrl}
                    // The header's name follows the community being viewed AS, like its logo does:
                    // in community view the community's name; else .seed on the node's own hosts,
                    // the face's name elsewhere.
                    appName={impersonatedCommunity?.name || (isSeedShellHost(window.location.hostname) ? '.seed' : config.name)}
                    crownRole={deriveCrownRole(activeCommunity, host.dataAuthority)}
                    // An open event names itself in the header (mobile label + tablet centre).
                    pageLabel={beings.selectedPulse?.type === 'event' ? t('event_chip') : undefined}
                    isNightMode={effectiveIsDark}
                    theme={effectiveTheme}
                    onToggleNightMode={toggleNightMode}
                />

                {/* The Pathway — THE ONE next step on the trail, for visitors and members alike.
                    Gated on pathwayFacts.loaded so the wrong stage never flashes while the
                    link-borne facts are still in flight. Dismissable per step (localStorage). */}
                {/* PathwayCTA owns its own wrapper spacing: when the Light Path is off or the
                    step is dismissed it renders null — no phantom padding left behind. */}
                {!beings.selectedTree && !beings.selectedVision && !beings.selectedPulse && pathwayFacts.loaded && tab === 'dashboard' && (
                    <PathwayCTA
                        input={pathwayInput}
                        actions={pathwayActions}
                        theme={effectiveTheme}
                        isDark={effectiveIsDark}
                        onOpenOverview={() => doors.setShowPathOverview(true)}
                    />
                )}
                <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><Loading /></div>}>
                {isBeingDetailOpen(beings) ? (
                    <BeingDetail
                        beings={beings}
                        doors={doors}
                        hostCommunity={hostCommunity}
                        impersonatedCommunity={impersonatedCommunity}
                        theme={effectiveTheme}
                        carryingTree={carrying.carryingTree}
                        setCarryingTree={carrying.setCarryingTree}
                        handleTreeUpdate={handleTreeUpdate}
                        handleDeleteTreeConfirmed={handleDeleteTreeConfirmed}
                        handleDeleteVision={handleDeleteVisionInApp}
                        openReach={openReach}
                        loadContent={loadContent}
                    />
                ) : (
                    <MainContent
                        tab={tab} setTab={setTab} viewMode={viewMode} setViewMode={setViewMode}
                        beings={beings} doors={doors} host={host} config={config}
                        theme={effectiveTheme} isDark={effectiveIsDark}
                        stats={stats}
                        feed={{ data, loadContent, loadingMore, forestSentinelRef: feed.forestSentinelRef }}
                        filteredData={filteredData}
                        filters={filters}
                        resonance={resonance}
                        observatory={observatory}
                        alignmentCards={alignmentCards}
                        onAcceptAlignment={onAcceptAlignment}
                        onRejectAlignment={onRejectAlignment}
                        search={{ term: searchTerm, setTerm: setSearchTerm, suggestions: searchSuggestions }}
                        events={{ ordered: orderedEvents, orderedDashboard: orderedDashboardEvents, showPast: showPastEvents, togglePast: () => { setEventsNowMs(Date.now()); setShowPastEvents(v => !v); } }}
                        offeringsSub={offeringsSub} setOfferingsSub={setOfferingsSub}
                        guardedTreeIds={guardedTreeIds}
                        handleDeleteTree={handleDeleteTree}
                        handleQuickSnap={handleQuickSnap}
                        openReach={openReach}
                        openTreeFromReaches={openTreeFromReaches}
                        openCareFromReaches={openCareFromReaches}
                    />
                )}
                </Suspense>
                <GDPRBanner />

                {/* THE MOTHER DOOR (ring 2026-08-22) — a seed-cradle portal wears a corner door
                    back to the community's own site; the landing's corner seed, mirrored. */}
                {(() => {
                    const home = motherDoorUrl(activeCommunity, window.location.hostname);
                    if (!home) return null;
                    const c = activeCommunity;
                    return (
                        <OutwardLink href={home} title={c?.domain}
                            className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white shadow-2xl transition-transform hover:scale-110 active:scale-95 dark:bg-slate-900">
                            {c?.logoUrl
                                ? <Picture src={c.logoUrl} alt={c?.name || ''} className="h-full w-full object-cover" />
                                : <span className="text-slate-600 dark:text-slate-300"><Icons.Globe /></span>}
                        </OutwardLink>
                    );
                })()}

                {doors.showAuthModal && !lightseed && (
                    <AuthModal onClose={() => doors.setShowAuthModal(false)} inviteId={inviteParam} inviteOnly={config.inviteOnly} theme={effectiveTheme}
                        startMode={arrivedInvite ? 'signup' : undefined}
                        greetName={arrivedInvite ? beings.selectedCommunity?.name : undefined} />
                )}

                {/* The Path, whole — the Light Path's ruleset with the walker's position lit. */}
                {doors.showPathOverview && (
                    <Modal title={t('the_path')} onClose={() => doors.setShowPathOverview(false)}>
                        <div className="max-h-[70vh] overflow-y-auto p-1 pr-2">
                            <PathOverview current={derivePathway(pathwayInput).stage} />
                        </div>
                    </Modal>
                )}
            </div>

            <Footer community={activeCommunity || defaultCommunity} theme={effectiveTheme} isDark={effectiveIsDark} />

            <AppOverlays
                beings={beings} doors={doors} host={host} hostStanding={hostStanding}
                tab={tab} setTab={setTab}
                arrivedInvite={arrivedInvite} setArrivedInvite={setArrivedInvite}
                loadContent={loadContent}
                uploading={uploading} handleImageUpload={handleImageUpload}
                mintCarrying={carrying.mintCarrying}
                handleGrowVision={handleGrowVision}
                handleTreeGrown={handleTreeGrown}
                openTreeFromReaches={openTreeFromReaches}
                openCareFromReaches={openCareFromReaches}
            />

            {/* Alerts/confirms must be the TOP layer. At the root — outside the `relative z-20`
                content wrapper — so its z-[100] competes at root level and beats every overlay
                (DetailWrapper z-40, Modal z-50); inside the wrapper it was trapped in a z-20
                stacking context and errors hid behind open detail views. */}
            <DialogHost />
        </div>
    );
}

const App = () => {
  const route = topLevelRoute();

  // The widget is an early return and must carry its OWN LanguageProvider: the i18n sweep
  // taught LifeseedWidget to speak (useLanguage), and a speaker without a provider throws —
  // the seed button on partner domains rendered blank white until this wrap (2026-08-15).
  if (route.kind === 'widget') return <LanguageProvider><SilentUpdate /><LifeseedWidget domain={route.domain} /></LanguageProvider>;

  // The data model — a hidden, full-screen /model route. Not linked anywhere (need-to-know);
  // reach it by typing the URL. Logo top-left (the usual place) returns to the app.
  // (Trailing slash tolerated.)
  if (route.kind === 'model') {
    return (
      <div className="min-h-screen bg-[#05080a] p-3 sm:p-6">
        <SilentUpdate />
        <a href="/" title="Back to lightseed" aria-label="Back to lightseed"
           className="fixed left-4 top-4 z-50 rounded-full bg-white/10 p-1.5 shadow-lg backdrop-blur transition-colors hover:bg-white/20 dark:bg-slate-900/10">
          <Logo width={38} height={38} />
        </a>
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loading /></div>}>
          {/* pt-14 keeps the card header clear of the fixed logo. */}
          <div className="mx-auto max-w-[1440px] pt-14"><DataModelCrystal /></div>
        </Suspense>
      </div>
    );
  }

  return (
    <LanguageProvider>
      <SessionProvider>
        <AppContent />
        {/* The network's face: slow-wire loader, upload progress, offline snackbar. */}
        <NetworkStatus />
      </SessionProvider>
    </LanguageProvider>
  );
};

export default App;
