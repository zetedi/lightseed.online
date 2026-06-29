
import React, { useState, useEffect } from 'react';
import { showAlert, showConfirm } from "./ui/Dialog";
import { type Pulse, type Lifetree, type Alignment, type Vision, type VisionSynergy, type TreeOwnershipInvite, treeRelationLabels } from '../types';
import { getMyPulses, getMyVisions, getJoinedVisions, getMyAlignmentsHistory, deleteUserAccount, deleteUserAsAdmin, logout, triggerSystemEmail, createNetworkInvite, listenToUserProfile, deleteVision, getAdmins, setNewsletterSubscription, updateUserSiteTheme, updateUserProfile, uploadImage, fetchMyReaches, setOnlyValidatedCanReach, getPendingTreeInvites, acceptTreeInvite, declineTreeInvite, getInviteRequests, approveInviteRequest, declineInviteRequest, getSentInvites, getLifetreeById, tendTree } from '../services/firebase';
import { ReachInbox } from './inspiration/ReachInbox';
import { findVisionSynergies } from '../services/gemini';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { ValidationBadge } from './ValidationBadge';
import { isWateringOverdue } from '../src/domain/watering';
import { SectionMenu } from './ui/SectionMenu';
import { VisionCard } from './VisionCard';
import { Modal } from './ui/Modal';
import { Loading } from './ui/Loading';
import { isExplicitlyValidatedTree, isValidationLive, isValidationFading, daysUntilLapse } from '../utils/validation';
import { normalizeTheme } from '../utils/theme';
import { AppearanceEditor } from './ui/AppearanceEditor';
import { IntelligencePanel } from './intelligence/IntelligencePanel';
import { ResonanceCard, resonanceId } from './ResonancePanel';
import { DEFAULT_INTELLIGENCE_ID } from '../services/intelligence';

export const LightseedProfile = ({ lightseed, myTrees, guardedTrees = [], isAdmin, isSuperAdmin, superAdminExists, onViewTree, onDeleteTree, defaultTreeId, onSetDefaultTree, onViewVision, onPlant, onClaimSuperAdmin, onGrantAdmin, onRevokeAdmin, onOpenNewsletterAdmin, reachPartner, reachAudience, reachOpenSignal, onConsumeReach, onReachTree }: any) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'trees' | 'pulses' | 'visions' | 'history' | 'reaches' | 'invites' | 'appearance' | 'intelligence' | 'settings' | 'admin'>('trees');
    const [preferredIntelligenceId, setPreferredIntelligenceId] = useState<string>('');
    // Resonances the user starred in the Observatory (kept in localStorage).
    const [savedResonances, setSavedResonances] = useState<VisionSynergy[]>([]);
    const unsaveResonance = (s: VisionSynergy) => {
        setSavedResonances(prev => {
            const next = prev.filter(f => resonanceId(f) !== resonanceId(s));
            try { localStorage.setItem('resonance_favorites_v1', JSON.stringify(next)); } catch {}
            return next;
        });
    };
    const reachResonantTree = async (treeId: string) => {
        try { const tree = await getLifetreeById(treeId); if (tree && onReachTree) onReachTree(tree); }
        catch { showAlert('Could not open a conversation with that tree.'); }
    };
    const [reaches, setReaches] = useState<Pulse[]>([]);
    const [pulses, setPulses] = useState<Pulse[]>([]);
    const [visions, setVisions] = useState<Vision[]>([]);
    const [joinedVisions, setJoinedVisions] = useState<Vision[]>([]);
    const [history, setHistory] = useState<Alignment[]>([]);
    const [loading, setLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [treeInvites, setTreeInvites] = useState<TreeOwnershipInvite[]>([]);
    const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);

    const refreshTreeInvites = () => { if (lightseed?.uid) getPendingTreeInvites(lightseed.uid).then(setTreeInvites).catch(() => {}); };
    useEffect(() => { refreshTreeInvites(); }, [lightseed?.uid]);

    const handleAcceptInvite = async (id: string) => {
        setInviteBusyId(id);
        try { await acceptTreeInvite(id); refreshTreeInvites(); }
        catch (e: any) { showAlert(e?.message || 'Failed to accept invitation.'); }
        setInviteBusyId(null);
    };
    const handleDeclineInvite = async (id: string) => {
        setInviteBusyId(id);
        try { await declineTreeInvite(id); refreshTreeInvites(); }
        catch (e: any) { showAlert(e?.message || 'Failed to decline invitation.'); }
        setInviteBusyId(null);
    };
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);
    const [mailStatus, setMailStatus] = useState<string | null>(null);
    const [testEmailAddress, setTestEmailAddress] = useState('');
    
    // Invite System
    const [invitesRemaining, setInvitesRemaining] = useState(7);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteMessage, setInviteMessage] = useState('');
    const [sendingInvite, setSendingInvite] = useState(false);
    const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
    const [togglingNewsletter, setTogglingNewsletter] = useState(false);
    const [dmEmailNotifications, setDmEmailNotifications] = useState(true);
    const [togglingDmEmail, setTogglingDmEmail] = useState(false);
    const [onlyValidatedCanReach, setOnlyValidatedCanReachState] = useState(false);
    const [togglingValidatedReach, setTogglingValidatedReach] = useState(false);
    const [dialogMessage, setDialogMessage] = useState<string | null>(null);
    const [siteTheme, setSiteTheme] = useState(normalizeTheme(undefined));
    const [siteLogoUrl, setSiteLogoUrl] = useState('');
    const [siteHeroUrl, setSiteHeroUrl] = useState('');
    const [savingSiteTheme, setSavingSiteTheme] = useState(false);
    const [uploadingSiteLogo, setUploadingSiteLogo] = useState(false);
    const [uploadingSiteHero, setUploadingSiteHero] = useState(false);

    // AI Alignment State
    const [synergies, setSynergies] = useState<VisionSynergy[]>([]);
    const [analyzing, setAnalyzing] = useState(false);

    // Admin management state (superadmin only)
    const [admins, setAdmins] = useState<{ uid: string }[]>([]);
    const [newAdminUid, setNewAdminUid] = useState('');
    const [deleteUserUid, setDeleteUserUid] = useState('');
    const [deletingUser, setDeletingUser] = useState(false);
    const handleDeleteUser = async () => {
        const uid = deleteUserUid.trim();
        if (!uid) return;
        if (!(await showConfirm(`Permanently delete user ${uid} and all their trees, pulses, visions and account? This cannot be undone.`, { title: 'Delete user', confirmText: 'Delete user', danger: true }))) return;
        setDeletingUser(true);
        try { await deleteUserAsAdmin(uid); setDeleteUserUid(''); showAlert('User deleted.'); }
        catch (e: any) { showAlert(e?.message || 'Could not delete the user.'); }
        setDeletingUser(false);
    };
    const [adminActionLoading, setAdminActionLoading] = useState(false);
    const [inviteRequests, setInviteRequests] = useState<any[]>([]);
    const [requestBusyId, setRequestBusyId] = useState<string | null>(null);
    const [sentInvites, setSentInvites] = useState<any[]>([]);
    const [sentCursor, setSentCursor] = useState<any>(null);
    const [sentHasMore, setSentHasMore] = useState(false);
    const [reqCursor, setReqCursor] = useState<any>(null);
    const [reqHasMore, setReqHasMore] = useState(false);
    const [showDeclinedRequests, setShowDeclinedRequests] = useState(false);

    const refreshSentInvites = () => {
        if (!lightseed?.uid) return;
        getSentInvites(lightseed.uid).then(res => { setSentInvites(res.items); setSentCursor(res.lastDoc); setSentHasMore(res.hasMore); }).catch(() => {});
    };
    const loadMoreSentInvites = () => {
        if (!lightseed?.uid || !sentCursor) return;
        getSentInvites(lightseed.uid, sentCursor).then(res => { setSentInvites(prev => [...prev, ...res.items]); setSentCursor(res.lastDoc); setSentHasMore(res.hasMore); }).catch(() => {});
    };
    useEffect(() => { if (activeTab === 'invites') refreshSentInvites(); }, [activeTab, lightseed?.uid]);
    useEffect(() => {
        if (activeTab !== 'history') return;
        try { const f = JSON.parse(localStorage.getItem('resonance_favorites_v1') || 'null'); if (Array.isArray(f)) setSavedResonances(f); } catch {}
    }, [activeTab]);
    // Validation is living care: a tree counts only while it's tended (live). `tendedIds`
    // holds trees just re-tended this session so they re-light immediately.
    const [tendedIds, setTendedIds] = useState<Set<string>>(new Set());
    const [tendingId, setTendingId] = useState<string | null>(null);
    const liveValidated = (tree: Lifetree) => tendedIds.has(tree.id) || isValidationLive(tree);
    const lapsedValidated = (tree: Lifetree) => isExplicitlyValidatedTree(tree) && !liveValidated(tree);
    const fadingValidated = (tree: Lifetree) => !tendedIds.has(tree.id) && isValidationFading(tree);
    const handleTend = async (tree: Lifetree) => {
        setTendingId(tree.id);
        try { await tendTree(tree); setTendedIds(prev => new Set(prev).add(tree.id)); }
        catch (e: any) { showAlert(e?.message || 'Could not tend the tree.'); }
        setTendingId(null);
    };
    const treesNeedingCare = myTrees.filter((t: Lifetree) => lapsedValidated(t) || fadingValidated(t));

    const hasValidatedTree = myTrees.some((t: Lifetree) => liveValidated(t));
    const allValidated = myTrees.length > 0 && myTrees.every((t: Lifetree) => liveValidated(t));
    // Trees I guard but don't own — shown separately from my planted trees.
    const guardedOnly = (guardedTrees as Lifetree[]).filter((tree: Lifetree) => tree.ownerId !== lightseed?.uid);

    const refreshInviteRequests = () => {
        if (!isSuperAdmin) return;
        getInviteRequests().then(res => { setInviteRequests(res.items); setReqCursor(res.lastDoc); setReqHasMore(res.hasMore); }).catch(() => {});
    };
    const loadMoreInviteRequests = () => {
        if (!isSuperAdmin || !reqCursor) return;
        getInviteRequests(reqCursor).then(res => { setInviteRequests(prev => [...prev, ...res.items]); setReqCursor(res.lastDoc); setReqHasMore(res.hasMore); }).catch(() => {});
    };
    useEffect(() => {
        if (isSuperAdmin) { getAdmins().then(setAdmins); refreshInviteRequests(); }
    }, [isSuperAdmin]);

    const setRequestStatusLocal = (id: string, status: string) =>
        setInviteRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));

    const handleApproveRequest = async (id: string) => {
        setRequestBusyId(id);
        try { await approveInviteRequest(id, lightseed.uid); setRequestStatusLocal(id, 'approved'); setDialogMessage('Invitation sent.'); }
        catch (e: any) { setDialogMessage(e?.message || 'Failed to approve.'); }
        setRequestBusyId(null);
    };
    const handleDeclineRequest = async (req: any) => {
        setRequestBusyId(req.id);
        try {
            // A kind rejection — they're welcome to ask again with more context.
            try {
                await triggerSystemEmail(req.email, 'About your lightseed invitation request',
                    "Thank you for your interest in lightseed. For now, the reason to join wasn't yet clear to us, or didn't feel aligned with the spirit of the network. You are warmly welcome to request again, with a little more about your intention.\n\nWith care,\nthe lightseed stewards", lightseed.uid);
            } catch (mailErr) { console.warn('Kind rejection email failed', mailErr); }
            await declineInviteRequest(req.id);
            setRequestStatusLocal(req.id, 'declined');
        } catch (e: any) { setDialogMessage(e?.message || 'Failed to decline.'); }
        setRequestBusyId(null);
    };

    useEffect(() => {
        if (!lightseed) return;
        
        // Listen to live user profile for invites
        const unsub = listenToUserProfile(lightseed.uid, (data) => {
            if (data && typeof data.invitesRemaining === 'number') {
                setInvitesRemaining(data.invitesRemaining);
            }
            setNewsletterSubscribed(Boolean(data?.newsletterSubscribed));
            // Direct-message email notifications are enabled unless explicitly turned off.
            setDmEmailNotifications(data?.emailNotifications?.directMessages !== false);
            setOnlyValidatedCanReachState(Boolean(data?.onlyValidatedCanReach));
            setSiteTheme(normalizeTheme(data?.siteTheme));
            setSiteLogoUrl(data?.siteLogoUrl || '');
            setSiteHeroUrl(data?.siteHeroUrl || '');
            setPreferredIntelligenceId(data?.preferredIntelligenceId || DEFAULT_INTELLIGENCE_ID);
        });

        const fetchData = async () => {
            setLoading(true);
            try {
                if (activeTab === 'pulses') {
                    const data = await getMyPulses(lightseed.uid);
                    // My Pulses excludes mycelial reach/chat messages — those live under Reaches.
                    setPulses(data.filter((p: any) => p.type !== 'reach' && p.type !== 'tree_chat'));
                } else if (activeTab === 'reaches') {
                    const res = await fetchMyReaches(lightseed.uid);
                    setReaches(res.items);
                } else if (activeTab === 'visions') {
                    const [created, joined] = await Promise.all([
                        getMyVisions(lightseed.uid),
                        getJoinedVisions(lightseed.uid)
                    ]);
                    setVisions(created);
                    setJoinedVisions(joined);
                } else if (activeTab === 'history') {
                    const data = await getMyAlignmentsHistory(lightseed.uid);
                    setHistory(data);
                }
            } catch (e) {
                console.error("Fetch profile data error", e);
            }
            setLoading(false);
        };
        fetchData();
        return () => unsub();
    }, [activeTab, lightseed]);

    // Opening the inbox (red envelope) or a specific reach jumps to the Reaches tab.
    useEffect(() => {
        if (reachOpenSignal) setActiveTab('reaches');
    }, [reachOpenSignal]);
    useEffect(() => {
        if (reachPartner) setActiveTab('reaches');
    }, [reachPartner]);

    const handleAlignmentAnalysis = async () => {
        if (visions.length < 2) {
             const data = await getMyVisions(lightseed.uid);
             if (data.length < 2) {
                 setDialogMessage("You need at least 2 visions to find alignments.");
                 return;
             }
             setVisions(data);
             performAnalysis(data);
        } else {
            performAnalysis(visions);
        }
    }

    const performAnalysis = async (vs: Vision[]) => {
        setAnalyzing(true);
        setSynergies([]);
        try {
            const results = await findVisionSynergies(vs);
            setSynergies(results);
        } catch (e: any) {
            console.error("AI Analysis Error:", e);
            setDialogMessage("Analysis failed: " + e.message);
        }
        setAnalyzing(false);
    }

    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;
        setSendingInvite(true);
        try {
            await createNetworkInvite(inviteEmail, lightseed.uid, inviteMessage, { unlimited: isSuperAdmin });
            refreshSentInvites();
            setDialogMessage(t('invite_sent'));
            setShowInviteModal(false);
            setInviteEmail('');
            setInviteMessage('');
        } catch (e: any) {
            setDialogMessage(e.message || "Failed to send invite");
        }
        setSendingInvite(false);
    }

    const handleDeleteVision = async (e: React.MouseEvent, visionId: string) => {
        e.stopPropagation();
        if (!(await showConfirm("Are you sure you want to delete this vision?", { title: "Delete Vision", confirmText: "Delete", danger: true }))) return;
        try {
            await deleteVision(visionId);
            setVisions(prev => prev.filter(v => v.id !== visionId));
        } catch (e: any) {
            showAlert("Delete failed: " + e.message);
        }
    }

    const handleNewsletterToggle = async () => {
        if (!lightseed?.email || togglingNewsletter) return;
        setTogglingNewsletter(true);
        try {
            const nextValue = !newsletterSubscribed;
            await setNewsletterSubscription(lightseed.uid, lightseed.email, nextValue);
            setNewsletterSubscribed(nextValue);
            setDialogMessage(nextValue ? 'Newsletter subscribed.' : 'Newsletter unsubscribed.');
        } catch (e: any) {
            setDialogMessage(e.message || 'Failed to update newsletter preference.');
        }
        setTogglingNewsletter(false);
    };

    const handleDmEmailToggle = async () => {
        if (!lightseed?.uid || togglingDmEmail) return;
        setTogglingDmEmail(true);
        try {
            const nextValue = !dmEmailNotifications;
            await updateUserProfile(lightseed.uid, { emailNotifications: { directMessages: nextValue } });
            setDmEmailNotifications(nextValue);
            setDialogMessage(nextValue
                ? 'You will be emailed when someone sends you a direct message.'
                : 'Direct message email notifications turned off.');
        } catch (e: any) {
            setDialogMessage(e.message || 'Failed to update email notification preference.');
        }
        setTogglingDmEmail(false);
    };

    const handleOnlyValidatedToggle = async () => {
        if (!lightseed?.uid || togglingValidatedReach) return;
        setTogglingValidatedReach(true);
        try {
            const nextValue = !onlyValidatedCanReach;
            await setOnlyValidatedCanReach(lightseed.uid, nextValue);
            setOnlyValidatedCanReachState(nextValue);
            setDialogMessage(nextValue
                ? 'Only validated trees can now send you direct messages.'
                : 'Anyone can now send you direct messages.');
        } catch (e: any) {
            setDialogMessage(e.message || 'Failed to update contact privacy.');
        }
        setTogglingValidatedReach(false);
    };

    const handleSiteLogoUpload = async (file: File) => {
        setUploadingSiteLogo(true);
        try {
            const url = await uploadImage(file, `users/${lightseed.uid}/site-theme/logo_${Date.now()}`);
            setSiteLogoUrl(url);
            // Persist immediately so an upload can't be lost before the next Save.
            await updateUserSiteTheme(lightseed.uid, { siteTheme: normalizeTheme(siteTheme), siteLogoUrl: url, siteHeroUrl });
        } catch (e: any) {
            setDialogMessage(e.message || 'Failed to upload site logo.');
        }
        setUploadingSiteLogo(false);
    };

    const handleSiteHeroUpload = async (file: File) => {
        setUploadingSiteHero(true);
        try {
            const url = await uploadImage(file, `users/${lightseed.uid}/site-theme/hero_${Date.now()}`);
            setSiteHeroUrl(url);
            await updateUserSiteTheme(lightseed.uid, { siteTheme: normalizeTheme(siteTheme), siteLogoUrl, siteHeroUrl: url });
        } catch (e: any) {
            setDialogMessage(e.message || 'Failed to upload hero image.');
        }
        setUploadingSiteHero(false);
    };

    const handleSaveSiteTheme = async () => {
        setSavingSiteTheme(true);
        try {
            await updateUserSiteTheme(lightseed.uid, {
                siteTheme: normalizeTheme(siteTheme),
                siteLogoUrl,
                siteHeroUrl,
            });
            setDialogMessage('Your lightseed.online theme has been saved.');
        } catch (e: any) {
            setDialogMessage(e.message || 'Failed to save theme.');
        }
        setSavingSiteTheme(false);
    };

    const handleResetSiteTheme = async () => {
        const resetTheme = normalizeTheme(undefined);
        setSavingSiteTheme(true);
        try {
            setSiteTheme(resetTheme);
            setSiteLogoUrl('');
            setSiteHeroUrl('');
            await updateUserSiteTheme(lightseed.uid, {
                siteTheme: resetTheme,
                siteLogoUrl: '',
                siteHeroUrl: '',
            });
            setDialogMessage('Your lightseed.online theme has been reset.');
        } catch (e: any) {
            setDialogMessage(e.message || 'Failed to reset theme.');
        }
        setSavingSiteTheme(false);
    };

    const handleTestEmail = async () => {
        const targetEmail = prompt("Enter the email address to send test to:", lightseed.email);
        if (!targetEmail) return;

        setTestEmailAddress(targetEmail);
        setSendingTest(true);
        setMailStatus("SENDING...");
        
        try {
            await triggerSystemEmail(
                targetEmail,
                "Debug Test: lightseed Network",
                `This is a test email sent at ${new Date().toLocaleTimeString()} to verify the SMTP pipeline. If you see this, the system is working.`,
                lightseed.uid 
            );
            
            setMailStatus(`SUCCESS! Sent to ${targetEmail}`);
            setTimeout(() => { setSendingTest(false); setMailStatus(null); }, 5000);

        } catch (e: any) {
            setDialogMessage("Failed to write to database: " + e.message);
            setSendingTest(false);
            setMailStatus(null);
        }
    }

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            await deleteUserAccount();
            await logout();
            setDialogMessage(t('delete_goodbye'));
            window.location.reload();
        } catch (e: any) {
            console.error("Delete Account Error:", e);
            if (e.message && (e.message.includes("log out") || e.message.includes("recent-login"))) {
                setDialogMessage("Security Check: Please sign in again to confirm deletion.");
                await logout();
                window.location.reload();
                return;
            }
            setDialogMessage(e.message);
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    }

    if (!lightseed) return null;

    const showAdmin = isAdmin || isSuperAdmin || !superAdminExists;

    const navSections: { key: string; label: string; icon: React.ReactNode }[] = [
        { key: 'trees', label: t('my_trees'), icon: <Icons.Tree /> },
        { key: 'reaches', label: t('direct_messages'), icon: <Icons.Chat /> },
        { key: 'pulses', label: t('my_pulses'), icon: <Icons.Pulse /> },
        { key: 'visions', label: t('visions'), icon: <Icons.Eye /> },
        { key: 'history', label: t('alignments'), icon: <Icons.Venn /> },
        { key: 'invites', label: t('invitations'), icon: <Icons.UserPlus /> },
        { key: 'appearance', label: t('appearance'), icon: <Icons.Image /> },
        { key: 'intelligence', label: t('intelligence'), icon: <Icons.Sparkles /> },
        { key: 'settings', label: t('settings_title'), icon: <Icons.Cog /> },
        ...(showAdmin ? [{ key: 'admin', label: t('admin_title'), icon: <Icons.Shield /> }] : []),
    ];

    const Toggle = ({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) => (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={onClick}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
        >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    );

    const SectionTitle = ({ title, sub }: { title: string; sub?: string }) => (
        <div className="mb-6">
            <h2 className="text-base sm:text-xl font-bold text-slate-900">{title}</h2>
            {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
        </div>
    );

    return (
        <div className="min-h-screen pb-20">
            {/* Hero — compact: avatar, name and all the meta sit on one wrapping row */}
            <div className="relative overflow-hidden bg-gradient-to-b from-slate-800 to-slate-900 text-white pt-6 pb-16 px-4">
                {siteHeroUrl && (
                    <>
                        <img src={siteHeroUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/55 via-slate-900/65 to-slate-900/85" />
                    </>
                )}
                <div className="relative max-w-6xl mx-auto flex flex-row items-center gap-3 sm:gap-5">
                    <div className="relative shrink-0">
                        <img
                            src={lightseed.photoURL || `https://ui-avatars.com/api/?name=${lightseed.displayName}`}
                            className="w-14 h-14 md:w-20 md:h-20 rounded-full border-4 border-white shadow-xl bg-white object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(lightseed.displayName || 'Visitor')}&background=random&color=fff`;
                            }}
                        />
                        <div className="absolute bottom-0.5 right-0.5 bg-emerald-500 w-4 h-4 rounded-full border-[3px] border-slate-900"></div>
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 justify-start">
                            <h1 className="text-2xl font-light tracking-wide break-words">{lightseed.displayName}</h1>
                            <p className="text-slate-400 text-xs font-mono truncate max-w-full">{lightseed.email}</p>
                            {isSuperAdmin && (
                                <span className="bg-amber-400/20 border border-amber-400/50 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">SuperAdmin</span>
                            )}
                            {isAdmin && !isSuperAdmin && (
                                <span className="flex items-center gap-1 bg-indigo-400/20 border border-indigo-400/50 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"><Icons.Shield /> Admin</span>
                            )}
                            {/* The domain owner / super admin is a trusted validator, so always carry the badge. */}
                            {(hasValidatedTree || isSuperAdmin) ? (
                                <ValidationBadge className="border-emerald-400/50 bg-emerald-400/20" compact />
                            ) : myTrees.some((t: Lifetree) => lapsedValidated(t)) ? (
                                <ValidationBadge className="border-amber-400/40 bg-amber-400/20" compact lapsed />
                            ) : (!isAdmin && (
                                <span className="bg-slate-600/50 border border-slate-500/50 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Visitor</span>
                            ))}
                            <span className="inline-flex items-baseline gap-1 text-slate-300">
                                <span className="text-base font-bold text-white">{myTrees.length}</span>
                                <span className="text-xs text-slate-400">{myTrees.length === 1 ? t('tree') : t('trees')}</span>
                            </span>
                            {allValidated && (
                                <button onClick={onPlant} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-full text-[11px] font-bold shadow-lg transition-transform active:scale-95 flex items-center gap-1.5">
                                    <Icons.Tree />
                                    <span>Plant a Tree</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tree Circle invitations — someone has invited you into shared care of a tree */}
            {treeInvites.length > 0 && (
                <div className="max-w-6xl mx-auto px-4 mt-6 space-y-3">
                    {treeInvites.map(inv => (
                        <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-emerald-900">
                                    <span className="font-bold">{inv.invitedByName || 'Someone'}</span> invited you to become a{' '}
                                    <span className="font-bold">{(treeRelationLabels[inv.role] || inv.role).toLowerCase()}</span> of{' '}
                                    <span className="font-bold">{inv.lifetreeName || 'a Lifetree'}</span>.
                                </p>
                                {inv.message && <p className="mt-1 text-xs italic text-emerald-700/80">“{inv.message}”</p>}
                            </div>
                            <div className="flex shrink-0 gap-2">
                                <button onClick={() => handleAcceptInvite(inv.id)} disabled={inviteBusyId === inv.id} className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50">{inviteBusyId === inv.id ? '…' : 'Accept'}</button>
                                <button onClick={() => handleDeclineInvite(inv.id)} disabled={inviteBusyId === inv.id} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Decline</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {dialogMessage && (
                <Modal title={t('notice')} onClose={() => setDialogMessage(null)}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">{dialogMessage}</p>
                        <button onClick={() => setDialogMessage(null)} className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Close</button>
                    </div>
                </Modal>
            )}

            {/* Body: the menu + content boxes sit ON the hero — the blue extends behind them.
                The gap from the avatar down to these boxes matches the gap above the avatar. */}
            <div className="relative z-10 max-w-6xl mx-auto px-4 -mt-10">
                <div className="lg:grid lg:grid-cols-[230px_1fr] lg:gap-6">
                    <aside className="mb-4 lg:mb-0">
                        <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-lg lg:sticky lg:top-24">
                            <SectionMenu items={navSections} active={activeTab} onSelect={(k) => setActiveTab(k as any)} />
                        </div>
                    </aside>

                    <main className="rounded-xl border border-slate-100 bg-white p-4 sm:p-6 shadow-lg min-h-[520px]">
                        {activeTab === 'reaches' && (
                            // Rendered unconditionally (no loading gate) so opening a reach from a tree
                            // keeps the requested thread — remounting on load would drop the selection.
                            <ReachInbox
                                pulses={reaches}
                                myTrees={myTrees}
                                lightseed={lightseed}
                                title={t('direct_messages')}
                                requestedPartner={reachPartner || null}
                                requestedAudience={reachAudience}
                                onConsumeRequested={onConsumeReach}
                            />
                        )}

                        {activeTab === 'invites' && (
                            <div className="space-y-6">
                                <div>
                                    <SectionTitle title={t('invitations')} sub={t('invites_sub')} />
                                    {(myTrees.length === 0 && !isSuperAdmin) ? (
                                        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
                                            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100"><Icons.Tree /></div>
                                            <p className="text-sm">Plant your first tree to unlock invitations.</p>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-slate-100 p-5 space-y-3">
                                            <p className="text-sm text-slate-500">{t('invites_remaining')}: <span className="font-bold text-emerald-600">{isSuperAdmin ? 'Unlimited' : invitesRemaining}</span></p>
                                            <p className="text-xs text-slate-400">Invite someone by email — they'll receive a link that opens the join page with their email locked in.</p>
                                            <button onClick={() => setShowInviteModal(true)} disabled={!isSuperAdmin && invitesRemaining <= 0} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-emerald-700 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"><Icons.UserPlus /> <span>{t('send_invite')}</span></button>
                                        </div>
                                    )}
                                </div>

                                {/* Invitations you've sent */}
                                {(myTrees.length > 0 || isSuperAdmin) && (
                                    <div>
                                        <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Sent Invitations</h4>
                                        {sentInvites.length === 0 ? (
                                            <p className="text-xs text-slate-400">You haven't sent any invitations yet.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {sentInvites.map(inv => (
                                                    <div key={inv.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                                                        <span className="truncate text-sm font-medium text-slate-800">{inv.email}</span>
                                                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${inv.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{inv.status === 'accepted' ? 'Joined' : 'Pending'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {sentHasMore && (
                                            <button onClick={loadMoreSentInvites} className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50">Load more</button>
                                        )}
                                    </div>
                                )}

                                {/* Invite requests — people asking to join (super-admin) */}
                                {isSuperAdmin && (
                                    <div>
                                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">Invite Requests</h4>
                                            <div className="flex items-center gap-3">
                                                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                                                    <input type="checkbox" checked={showDeclinedRequests} onChange={e => setShowDeclinedRequests(e.target.checked)} className="h-3.5 w-3.5 rounded text-emerald-600 focus:ring-emerald-500" />
                                                    Show declined
                                                </label>
                                                <button onClick={refreshInviteRequests} className="text-xs font-bold text-slate-400 hover:text-slate-700">Refresh</button>
                                            </div>
                                        </div>
                                        {(() => {
                                            const visible = inviteRequests.filter(r => r.status !== 'declined' || showDeclinedRequests);
                                            return visible.length === 0 ? (
                                                <p className="text-xs text-slate-400">No requests{showDeclinedRequests ? '' : ' to review'}.</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {visible.map(req => (
                                                        <div key={req.id} className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-bold text-slate-800">{req.email}</p>
                                                                {req.reason && <p className="mt-0.5 line-clamp-3 text-xs italic text-slate-500">“{req.reason}”</p>}
                                                            </div>
                                                            <div className="flex shrink-0 items-center gap-2">
                                                                {req.status === 'pending' ? (
                                                                    <>
                                                                        <button onClick={() => handleApproveRequest(req.id)} disabled={requestBusyId === req.id} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{requestBusyId === req.id ? '…' : 'Invite'}</button>
                                                                        <button onClick={() => handleDeclineRequest(req)} disabled={requestBusyId === req.id} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Decline</button>
                                                                    </>
                                                                ) : (
                                                                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{req.status === 'approved' ? 'Invited' : 'Declined'}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                        {reqHasMore && (
                                            <button onClick={loadMoreInviteRequests} className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50">Load more</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div>
                                <SectionTitle title={t('settings_title')} sub={t('settings_sub')} />
                                <div className="rounded-2xl border border-slate-100 divide-y divide-slate-100">
                                    <div className="p-4 flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-800 text-sm">{t('only_validated_can_reach')}</p>
                                            <p className="text-xs text-slate-500">{t('only_validated_can_reach_help')}</p>
                                        </div>
                                        <Toggle on={onlyValidatedCanReach} onClick={handleOnlyValidatedToggle} disabled={togglingValidatedReach} />
                                    </div>
                                    <div className="p-4 flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-800 text-sm">Newsletter</p>
                                            <p className="text-xs text-slate-500">A gentle update from the network every few weeks.</p>
                                        </div>
                                        <Toggle on={newsletterSubscribed} onClick={handleNewsletterToggle} disabled={togglingNewsletter || !lightseed.email} />
                                    </div>
                                    <div className="p-4 flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-800 text-sm">Email me when someone sends me a direct message</p>
                                            <p className="text-xs text-slate-500">You can turn this off anytime.</p>
                                        </div>
                                        <Toggle on={dmEmailNotifications} onClick={handleDmEmailToggle} disabled={togglingDmEmail || !lightseed.email} />
                                    </div>
                                    <div className="p-4 flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-800 text-sm">Email delivery test</p>
                                            <p className="text-xs text-slate-500">Send yourself a test message to verify delivery.</p>
                                        </div>
                                        <button onClick={handleTestEmail} className="rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 whitespace-nowrap transition-colors">{mailStatus || 'Send test'}</button>
                                    </div>
                                </div>
                                <div className="mt-6 rounded-2xl border border-red-100 bg-red-50/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-red-700 text-sm">{t('delete_account')}</p>
                                        <p className="text-xs text-red-500/80">Permanently remove your trees, pulses, visions and profile.</p>
                                    </div>
                                    <button onClick={() => setShowDeleteConfirm(true)} className="rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-600 hover:text-white text-xs font-bold px-4 py-2 transition-colors whitespace-nowrap self-start sm:self-auto">{t('delete_account')}</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'admin' && (
                            <div>
                                <SectionTitle title={t('admin_title')} sub={t('admin_sub')} />
                                {!superAdminExists && (
                                    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 flex items-center justify-between gap-4">
                                        <div>
                                            <h4 className="font-bold text-amber-800 text-sm">Genesis SuperAdmin unclaimed</h4>
                                            <p className="text-xs text-amber-700/80">Be the first to claim the SuperAdmin role.</p>
                                        </div>
                                        <button onClick={onClaimSuperAdmin} className="bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold px-4 py-2 rounded-full shadow whitespace-nowrap">Claim</button>
                                    </div>
                                )}
                                {isSuperAdmin && (
                                    <>
                                        <div className="rounded-2xl border border-slate-100 p-5 space-y-4">
                                            <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider"><Icons.Shield /> Admin Management</h4>
                                            <div className="flex gap-2">
                                                <input value={newAdminUid} onChange={e => setNewAdminUid(e.target.value)} placeholder="User UID" className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-indigo-400" />
                                                <button disabled={!newAdminUid || adminActionLoading} onClick={async () => { setAdminActionLoading(true); await onGrantAdmin(newAdminUid.trim()); setNewAdminUid(''); const updated = await getAdmins(); setAdmins(updated); setAdminActionLoading(false); }} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors">Grant</button>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                {admins.length === 0 && <p className="text-xs text-slate-400">No admins yet.</p>}
                                                {admins.map(a => (
                                                    <div key={a.uid} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                                                        <span className="text-xs font-mono text-slate-600">{a.uid}</span>
                                                        <button onClick={async () => { setAdminActionLoading(true); await onRevokeAdmin(a.uid); setAdmins(prev => prev.filter(x => x.uid !== a.uid)); setAdminActionLoading(false); }} className="text-red-500 hover:text-red-600 text-xs font-bold ml-3 transition-colors">Revoke</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Delete a user — for re-testing onboarding. Removes their data + Auth account. */}
                                        <div className="mt-4 rounded-2xl border border-red-100 bg-red-50/40 p-5 space-y-3">
                                            <h4 className="font-bold text-red-700 flex items-center gap-2 text-sm uppercase tracking-wider"><Icons.Trash /> Delete a user</h4>
                                            <p className="text-xs text-slate-500">Permanently removes a user's trees, pulses, visions and account. Use for re-testing onboarding.</p>
                                            <div className="flex gap-2">
                                                <input value={deleteUserUid} onChange={e => setDeleteUserUid(e.target.value)} placeholder="User UID" className="flex-1 bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-red-400" />
                                                <button disabled={!deleteUserUid.trim() || deletingUser} onClick={handleDeleteUser} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors whitespace-nowrap">{deletingUser ? 'Deleting…' : 'Delete user'}</button>
                                            </div>
                                        </div>

                                        {/* Newsletter — unrelated to admin management, so it lives in its own section */}
                                        <div className="mt-4 rounded-2xl border border-slate-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div>
                                                <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider"><Icons.Send /> Newsletter</h4>
                                                <p className="text-xs text-slate-500 mt-1">Send a network update to all subscribers.</p>
                                            </div>
                                            <button onClick={onOpenNewsletterAdmin} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"><Icons.Send /><span>Send Newsletter</span></button>
                                        </div>
                                    </>
                                )}
                                {isAdmin && !isSuperAdmin && <p className="text-sm text-slate-500">You hold admin privileges in this network.</p>}
                            </div>
                        )}

                        {activeTab === 'trees' && (
                            <div className="space-y-8">
                                {/* Planted — trees you own and steward */}
                                <div>
                                    <SectionTitle title={t('planted_trees')} sub={t('planted_trees_sub')} />
                                    {treesNeedingCare.length > 0 && (
                                        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                            <span className="mt-0.5 text-amber-500"><Icons.Eye /></span>
                                            <p className="text-xs leading-relaxed text-amber-800">{t('care_nudge')}</p>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {allValidated && (
                                             <div onClick={onPlant} className="border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-slate-50 min-h-[100px] text-slate-400 hover:text-emerald-600 transition-all group">
                                                <div className="bg-slate-100 p-3 rounded-full group-hover:bg-emerald-100 transition-colors">
                                                     <Icons.Tree />
                                                </div>
                                                <span className="font-bold mt-2 text-sm">Plant New Tree</span>
                                            </div>
                                        )}

                                        {myTrees.length === 0 ? (
                                            !allValidated && <p className="text-slate-400 text-center py-10 col-span-full">No trees planted yet.</p>
                                        ) : (
                                            [...myTrees].sort((a: Lifetree, b: Lifetree) => (b.id === defaultTreeId ? 1 : 0) - (a.id === defaultTreeId ? 1 : 0)).map((tree: Lifetree) => (
                                                <div key={tree.id} onClick={() => onViewTree(tree)} className={`border rounded-lg p-4 hover:shadow-md cursor-pointer transition-all flex items-center justify-between group bg-white ${defaultTreeId === tree.id ? 'border-amber-300 ring-1 ring-amber-100' : 'border-emerald-100'}`}>
                                                    <div className="flex items-center space-x-4">
                                                        <img src={tree.latestGrowthUrl || tree.imageUrl || 'https://via.placeholder.com/100'} className="w-16 h-16 rounded object-cover bg-slate-100" />
                                                        <div>
                                                            <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                                                                {tree.name}
                                                                {defaultTreeId === tree.id && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700"><Icons.Star filled size={10} /> Default</span>}
                                                                {isWateringOverdue(tree) && <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-700">💧 Needs water</span>}
                                                            </h3>
                                                            <p className="text-xs text-slate-500">Block Height: {tree.blockHeight}</p>
                                                            {isExplicitlyValidatedTree(tree) ? (
                                                                <div className="mt-1 flex items-center gap-2">
                                                                    <ValidationBadge compact lapsed={lapsedValidated(tree)} />
                                                                    {(lapsedValidated(tree) || fadingValidated(tree)) && (
                                                                        <button onClick={(e) => { e.stopPropagation(); handleTend(tree); }} disabled={tendingId === tree.id} className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                                                                            {tendingId === tree.id ? '…' : t('tend')}
                                                                        </button>
                                                                    )}
                                                                    {fadingValidated(tree) && !lapsedValidated(tree) && (
                                                                        <span className="text-[10px] font-bold text-amber-600">{daysUntilLapse(tree)}d</span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t('pending')}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {onSetDefaultTree && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); if (defaultTreeId !== tree.id) onSetDefaultTree(tree.id); }}
                                                                disabled={defaultTreeId === tree.id}
                                                                className={`p-2 rounded-full transition-colors ${defaultTreeId === tree.id ? 'text-amber-500 cursor-default' : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50 opacity-0 group-hover:opacity-100'}`}
                                                                title={defaultTreeId === tree.id ? 'Your default tree' : 'Set as my default tree'}
                                                            >
                                                                <Icons.Star filled={defaultTreeId === tree.id} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onDeleteTree(tree.id); }}
                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                            title={t('delete_tree_title')}
                                                        >
                                                            <Icons.Trash />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Guarded — trees you protect as a guardian (you don't own these) */}
                                <div>
                                    <SectionTitle title={t('guarded_trees')} sub={t('guarded_trees_sub')} />
                                    {guardedOnly.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
                                            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-500"><Icons.Shield /></div>
                                            <p className="text-sm">You are not guarding any trees yet.</p>
                                            <p className="mt-1 text-xs">Open a Nature tree on the map and join its guardians to help protect it.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {guardedOnly.map((tree: Lifetree) => (
                                                <div key={tree.id} onClick={() => onViewTree(tree)} className="border border-sky-100 rounded-lg p-4 hover:shadow-md cursor-pointer transition-all flex items-center justify-between group bg-sky-50/40">
                                                    <div className="flex items-center space-x-4">
                                                        <img src={tree.latestGrowthUrl || tree.imageUrl || 'https://via.placeholder.com/100'} className="w-16 h-16 rounded object-cover bg-slate-100" />
                                                        <div>
                                                            <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                                                                {tree.name}
                                                                {isWateringOverdue(tree) && <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-700">💧 Needs water</span>}
                                                            </h3>
                                                            <p className="text-xs text-slate-500">Block Height: {tree.blockHeight}</p>
                                                            <span className="mt-1 inline-flex items-center gap-1 text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-bold"><Icons.Shield /> Guardian</span>
                                                        </div>
                                                    </div>
                                                    {tree.status === 'DANGER' && (
                                                        <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold">DANGER</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {activeTab === 'pulses' && (
                            <div>
                            <SectionTitle title={t('my_pulses')} sub={t('my_pulses_sub')} />
                            {loading ? <div className="flex justify-center py-10"><Loading /></div> : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {pulses.length === 0 ? <p className="col-span-full text-slate-400 text-center py-10">No pulses emitted yet.</p> : pulses.map((pulse) => (
                                        <div key={pulse.id} className="border border-slate-100 rounded-lg overflow-hidden group">
                                            <div className="h-24 bg-slate-100 relative">
                                                {pulse.imageUrl ? (
                                                    <img src={pulse.imageUrl} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-300"><Icons.Hash /></div>
                                                )}
                                            </div>
                                            <div className="p-3">
                                                <h4 className="font-bold text-sm text-slate-800 line-clamp-1">{pulse.title}</h4>
                                                <div className="mt-1 flex items-center space-x-3 text-[10px] text-slate-400">
                                                    <span>{pulse.loveCount} Loves</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            </div>
                        )}
                         {activeTab === 'visions' && (
                             loading ? <div className="flex justify-center py-10"><Loading /></div> : (
                                <div>
                                    <div className="flex justify-between items-center mb-6">
                                         <h3 className="text-lg font-bold">My Visions</h3>
                                         <button
                                            onClick={handleAlignmentAnalysis}
                                            disabled={analyzing}
                                            className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 border border-amber-400/30 active:scale-95 disabled:opacity-50"
                                         >
                                             {analyzing ? <Loading /> : <Icons.Venn />}
                                             <span>{analyzing ? 'Analyzing...' : 'Analyze Alignments'}</span>
                                         </button>
                                    </div>
                                    
                                    {synergies.length > 0 && (
                                        <div className="mb-8 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                                            <h4 className="font-bold text-indigo-900 mb-3 flex items-center"><Icons.SparkleFill /> <span className="ml-2">Alignment Report</span></h4>
                                            <div className="space-y-3">
                                                {synergies.map((s, i) => (
                                                    <div key={i} className="bg-white p-3 rounded-lg shadow-sm border border-indigo-100/50">
                                                        <div className="flex justify-between items-start">
                                                            <div className="font-medium text-slate-800 text-sm">
                                                                <span className="text-indigo-600">{s.vision1Title}</span> + <span className="text-indigo-600">{s.vision2Title}</span>
                                                            </div>
                                                            <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold">{s.score}%</span>
                                                        </div>
                                                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">{s.reasoning}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-8">
                                        {/* Created Visions */}
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {visions.length === 0 && joinedVisions.length === 0 ? <p className="col-span-full text-slate-400 text-center py-10">No visions created yet.</p> : visions.map((vision) => (
                                                <div key={vision.id} className="relative group">
                                                    <div onClick={() => onViewVision(vision)} className="cursor-pointer h-full">
                                                        <VisionCard vision={vision} />
                                                    </div>
                                                    <div className="absolute top-2 left-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                        {vision.title === "Root Vision" ? (
                                                            <div className="bg-white/95 backdrop-blur-sm px-2 py-1.5 rounded-lg text-[9px] text-emerald-700 font-bold border border-emerald-200 shadow-sm flex flex-col">
                                                                <span>ANCHOR (ROOT)</span>
                                                                <span className="text-[8px] text-slate-400 font-normal leading-tight mt-0.5">This vision is the foundation of your tree and cannot be deleted.</span>
                                                            </div>
                                                        ) : (
                                                            <button 
                                                                onClick={(e) => handleDeleteVision(e, vision.id)}
                                                                className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg border border-red-400 transition-all hover:scale-110 active:scale-95"
                                                                title={t('delete_vision_title')}
                                                            >
                                                                <Icons.Trash />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Joined Visions Section */}
                                        {joinedVisions.length > 0 && (
                                            <div className="border-t border-slate-100 pt-6">
                                                <h4 className="text-sm font-bold text-amber-600 uppercase tracking-widest mb-4 flex items-center">
                                                    <Icons.Globe /> <span className="ml-2">Joined Visions</span>
                                                </h4>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                    {joinedVisions.map((vision) => (
                                                        <div key={vision.id} className="relative group">
                                                            <div onClick={() => onViewVision(vision)} className="cursor-pointer h-full">
                                                                <VisionCard vision={vision} />
                                                            </div>
                                                            <div className="absolute top-2 right-2 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md">
                                                                JOINED
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                             )
                        )}
                        {activeTab === 'appearance' && (
                            <div className="space-y-6">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">{t('appearance_theme_title')}</h3>
                                        <p className="mt-1 text-sm text-slate-500">{t('appearance_theme_desc')}</p>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                        <button
                                            onClick={handleSaveSiteTheme}
                                            disabled={savingSiteTheme || uploadingSiteLogo || uploadingSiteHero}
                                            className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-teal-600/20 transition-colors hover:bg-teal-700 disabled:opacity-50"
                                        >
                                            {savingSiteTheme ? t('saving') : t('save_theme')}
                                        </button>
                                        <button
                                            onClick={handleResetSiteTheme}
                                            disabled={savingSiteTheme || uploadingSiteLogo || uploadingSiteHero}
                                            className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-300 disabled:opacity-50"
                                        >
                                            {t('reset')}
                                        </button>
                                    </div>
                                </div>

                                <AppearanceEditor
                                    theme={siteTheme}
                                    onThemeChange={setSiteTheme}
                                    logoUrl={siteLogoUrl}
                                    onLogoUpload={handleSiteLogoUpload}
                                    uploadingLogo={uploadingSiteLogo}
                                    logoLabel={t('site_logo')}
                                    logoHint={t('site_logo_desc')}
                                    heroUrl={siteHeroUrl}
                                    onHeroUpload={handleSiteHeroUpload}
                                    uploadingHero={uploadingSiteHero}
                                    onRemoveHero={() => setSiteHeroUrl('')}
                                />
                            </div>
                        )}
                        {activeTab === 'intelligence' && lightseed?.uid && (
                            <IntelligencePanel
                                scope="user"
                                credentialOwnerId={lightseed.uid}
                                intelligenceOwnerUid={lightseed.uid}
                                viewerUid={lightseed.uid}
                                canManageAll={isSuperAdmin}
                                selectedIntelligenceId={preferredIntelligenceId}
                                onSelect={(id) => {
                                    setPreferredIntelligenceId(id);
                                    updateUserProfile(lightseed.uid, { preferredIntelligenceId: id }).catch(() => {});
                                }}
                            />
                        )}
                        {activeTab === 'history' && (
                            <div>
                            <SectionTitle title={t('alignments')} sub={t('alignments_sub')} />

                            {savedResonances.length > 0 && (
                                <div className="mb-8">
                                    <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-slate-500"><span className="text-amber-500">★</span> {t('saved_resonances')}</h4>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {savedResonances.map((s, i) => (
                                            <ResonanceCard key={i} s={s} isFavorite onToggleFavorite={() => unsaveResonance(s)} onReach={reachResonantTree} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {loading ? <div className="flex justify-center py-10"><Loading /></div> : (
                                <div className="space-y-4">
                                    {history.length === 0 ? <p className="text-slate-400 text-center py-10">{t('no_history')}</p> : history.map((h) => (
                                        <div key={h.id} className="border border-slate-200 p-4 rounded-lg bg-slate-50 flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-sm text-slate-700">{h.status}</p>
                                                <p className="text-xs text-slate-500">{new Date(h.createdAt?.toMillis()).toLocaleDateString()}</p>
                                            </div>
                                            <div className="text-xs font-mono text-slate-400">{h.id.substring(0,8)}...</div>
                                        </div>
                                    ))}
                                </div>
                             )}
                            </div>
                        )}
                    </main>
                </div>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <Modal title={t('send_invite')} onClose={() => setShowInviteModal(false)}>
                    <form onSubmit={handleSendInvite} className="space-y-4">
                        <p className="text-xs text-slate-500 mb-4">{t('invites_remaining')}: {invitesRemaining}</p>
                        <input 
                            required
                            type="email"
                            placeholder={t('invite_email_placeholder')}
                            className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                        />
                        <textarea 
                            placeholder={t('invite_message_placeholder')}
                            className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none h-24"
                            value={inviteMessage}
                            onChange={e => setInviteMessage(e.target.value)}
                        />
                        <button 
                            disabled={sendingInvite}
                            type="submit" 
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg transition-colors shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            {sendingInvite ? t('loading') : t('send_invite')}
                        </button>
                    </form>
                </Modal>
            )}

            {/* Delete Confirm Modal */}
            {showDeleteConfirm && (
                <Modal title={t('delete_confirm_title')} onClose={() => setShowDeleteConfirm(false)}>
                    <div className="space-y-6">
                        <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-red-800 text-sm">
                            <p className="font-bold mb-1">{t('delete_confirm_desc')}</p>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button 
                                onClick={handleDeleteAccount}
                                disabled={isDeleting}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-50"
                            >
                                {isDeleting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Icons.Trash />}
                                <span>{t('delete_account')}</span>
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
