
import React, { useState, useEffect } from 'react';
import { type Pulse, type Lifetree, type Alignment, type Vision, type VisionSynergy } from '../types';
import { getMyPulses, getMyVisions, getJoinedVisions, getMyAlignmentsHistory, deleteUserAccount, logout, triggerSystemEmail, sendInvite, listenToUserProfile, deleteVision, getAdmins, setNewsletterSubscription, updateUserSiteTheme, updateUserProfile, uploadImage, fetchMyReaches, setOnlyValidatedCanReach } from '../services/firebase';
import { ReachInbox } from './inspiration/ReachInbox';
import { findVisionSynergies } from '../services/gemini';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { ValidationBadge } from './ValidationBadge';
import { VisionCard } from './VisionCard';
import { Modal } from './ui/Modal';
import { Loading } from './ui/Loading';
import { isExplicitlyValidatedTree } from '../utils/validation';
import { ImagePicker } from './ui/ImagePicker';
import { communityThemePresets, normalizeTheme } from '../utils/theme';

export const LightseedProfile = ({ lightseed, myTrees, isAdmin, isSuperAdmin, superAdminExists, onViewTree, onDeleteTree, onViewVision, onPlant, onClaimSuperAdmin, onGrantAdmin, onRevokeAdmin, onOpenNewsletterAdmin, reachPartner, reachOpenSignal, onConsumeReach }: any) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'trees' | 'pulses' | 'visions' | 'history' | 'reaches' | 'invites' | 'appearance' | 'settings' | 'admin'>('trees');
    const [reaches, setReaches] = useState<Pulse[]>([]);
    const [pulses, setPulses] = useState<Pulse[]>([]);
    const [visions, setVisions] = useState<Vision[]>([]);
    const [joinedVisions, setJoinedVisions] = useState<Vision[]>([]);
    const [history, setHistory] = useState<Alignment[]>([]);
    const [loading, setLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
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
    const [sendThreadsToEmail, setSendThreadsToEmail] = useState(false);
    const [togglingThreadsEmail, setTogglingThreadsEmail] = useState(false);
    const [onlyValidatedCanReach, setOnlyValidatedCanReachState] = useState(false);
    const [togglingValidatedReach, setTogglingValidatedReach] = useState(false);
    const [dialogMessage, setDialogMessage] = useState<string | null>(null);
    const [siteTheme, setSiteTheme] = useState(normalizeTheme(undefined));
    const [siteLogoUrl, setSiteLogoUrl] = useState('');
    const [savingSiteTheme, setSavingSiteTheme] = useState(false);
    const [uploadingSiteLogo, setUploadingSiteLogo] = useState(false);

    // AI Alignment State
    const [synergies, setSynergies] = useState<VisionSynergy[]>([]);
    const [analyzing, setAnalyzing] = useState(false);

    // Admin management state (superadmin only)
    const [admins, setAdmins] = useState<{ uid: string }[]>([]);
    const [newAdminUid, setNewAdminUid] = useState('');
    const [adminActionLoading, setAdminActionLoading] = useState(false);
    const hasValidatedTree = myTrees.some((t: Lifetree) => isExplicitlyValidatedTree(t));
    const allValidated = myTrees.length > 0 && myTrees.every((t: Lifetree) => isExplicitlyValidatedTree(t));
    const inviteLink = `${window.location.origin}?invite=${lightseed.uid}`;

    useEffect(() => {
        if (isSuperAdmin) getAdmins().then(setAdmins);
    }, [isSuperAdmin]);

    useEffect(() => {
        if (!lightseed) return;
        
        // Listen to live user profile for invites
        const unsub = listenToUserProfile(lightseed.uid, (data) => {
            if (data && typeof data.invitesRemaining === 'number') {
                setInvitesRemaining(data.invitesRemaining);
            }
            setNewsletterSubscribed(Boolean(data?.newsletterSubscribed));
            setSendThreadsToEmail(Boolean(data?.sendThreadsToEmail));
            setOnlyValidatedCanReachState(Boolean(data?.onlyValidatedCanReach));
            setSiteTheme(normalizeTheme(data?.siteTheme));
            setSiteLogoUrl(data?.siteLogoUrl || '');
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

    const copyInvite = () => {
        navigator.clipboard.writeText(inviteLink);
        setDialogMessage("Invite link copied to clipboard!");
    }

    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;
        setSendingInvite(true);
        try {
            await sendInvite(inviteEmail, inviteMessage, lightseed.uid, inviteLink);
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
        if (!confirm("Are you sure you want to delete this vision?")) return;
        try {
            await deleteVision(visionId);
            setVisions(prev => prev.filter(v => v.id !== visionId));
        } catch (e: any) {
            alert("Delete failed: " + e.message);
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

    const handleThreadsEmailToggle = async () => {
        if (!lightseed?.uid || togglingThreadsEmail) return;
        setTogglingThreadsEmail(true);
        try {
            const nextValue = !sendThreadsToEmail;
            await updateUserProfile(lightseed.uid, { sendThreadsToEmail: nextValue });
            setSendThreadsToEmail(nextValue);
            setDialogMessage(nextValue
                ? 'Reaches sent to your trees will now also be delivered to your email.'
                : 'Email delivery of reaches turned off.');
        } catch (e: any) {
            setDialogMessage(e.message || 'Failed to update reach email preference.');
        }
        setTogglingThreadsEmail(false);
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
        } catch (e: any) {
            setDialogMessage(e.message || 'Failed to upload site logo.');
        }
        setUploadingSiteLogo(false);
    };

    const handleSaveSiteTheme = async () => {
        setSavingSiteTheme(true);
        try {
            await updateUserSiteTheme(lightseed.uid, {
                siteTheme: normalizeTheme(siteTheme),
                siteLogoUrl,
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
            await updateUserSiteTheme(lightseed.uid, {
                siteTheme: resetTheme,
                siteLogoUrl: '',
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
        { key: 'pulses', label: t('my_pulses'), icon: <Icons.HeartPulse /> },
        { key: 'visions', label: t('visions'), icon: <Icons.Eye /> },
        { key: 'reaches', label: t('direct_messages'), icon: <Icons.Chat /> },
        { key: 'history', label: t('alignments'), icon: <Icons.Venn /> },
        { key: 'invites', label: t('invitations'), icon: <Icons.SparkleFill /> },
        { key: 'appearance', label: 'Appearance', icon: <Icons.Image /> },
        { key: 'settings', label: 'Settings', icon: <Icons.Key /> },
        ...(showAdmin ? [{ key: 'admin', label: 'Admin', icon: <Icons.Shield /> }] : []),
    ];

    const Toggle = ({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) => (
        <button type="button" onClick={onClick} disabled={disabled} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
        </button>
    );

    const SectionTitle = ({ title, sub }: { title: string; sub?: string }) => (
        <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
        </div>
    );

    return (
        <div className="min-h-screen pb-20">
            {/* Hero */}
            <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 text-white pt-10 pb-16 px-4">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
                    <div className="relative">
                        <img
                            src={lightseed.photoURL || `https://ui-avatars.com/api/?name=${lightseed.displayName}`}
                            className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-white shadow-xl bg-white object-cover"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(lightseed.displayName || 'User')}&background=random&color=fff`;
                            }}
                        />
                        <div className="absolute bottom-1 right-1 bg-emerald-500 w-5 h-5 rounded-full border-4 border-slate-900"></div>
                    </div>
                    <div className="text-center md:text-left flex-1 min-w-0">
                        {/* One line on desktop: name · email · tree count */}
                        <div className="flex flex-col md:flex-row md:items-baseline md:flex-wrap gap-x-4 gap-y-1 justify-center md:justify-start">
                            <h1 className="text-3xl font-light tracking-wide">{lightseed.displayName}</h1>
                            <p className="text-slate-400 text-sm font-mono truncate">{lightseed.email}</p>
                            <p className="text-sm text-slate-300">
                                <span className="font-bold text-white">{myTrees.length}</span>{' '}
                                <span className="text-xs text-slate-400">{myTrees.length === 1 ? t('tree') : t('trees')}</span>
                            </p>
                        </div>
                        <div className="mt-3 flex items-center gap-2 flex-wrap justify-center md:justify-start">
                            {isSuperAdmin && (
                                <span className="bg-amber-400/20 border border-amber-400/50 text-amber-300 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">SuperAdmin</span>
                            )}
                            {isAdmin && !isSuperAdmin && (
                                <span className="flex items-center gap-1 bg-indigo-400/20 border border-indigo-400/50 text-indigo-300 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"><Icons.Shield /> Admin</span>
                            )}
                            {hasValidatedTree ? (
                                <ValidationBadge className="border-emerald-400/50 bg-emerald-400/20" compact />
                            ) : (!isSuperAdmin && !isAdmin && (
                                <span className="bg-slate-600/50 border border-slate-500/50 text-slate-400 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">User</span>
                            ))}
                            {allValidated && (
                                <button onClick={onPlant} className="ml-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg transition-transform active:scale-95 flex items-center gap-2">
                                    <Icons.Tree />
                                    <span>Plant a Tree</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {dialogMessage && (
                <Modal title="Notice" onClose={() => setDialogMessage(null)}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">{dialogMessage}</p>
                        <button onClick={() => setDialogMessage(null)} className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Close</button>
                    </div>
                </Modal>
            )}

            {/* Body: left sidebar + content (z-10 so the hero never covers the cards) */}
            <div className="relative z-10 max-w-6xl mx-auto px-4 -mt-8">
                <div className="lg:grid lg:grid-cols-[230px_1fr] lg:gap-6">
                    <aside className="mb-4 lg:mb-0">
                        <div className="rounded-2xl border border-slate-100 bg-white p-2.5 shadow-xl lg:sticky lg:top-24">
                            <nav className="flex gap-1.5 overflow-x-auto lg:flex-col">
                                {navSections.map(s => (
                                    <button
                                        key={s.key}
                                        onClick={() => setActiveTab(s.key as any)}
                                        className={`group flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all lg:w-full ${activeTab === s.key ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                                    >
                                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${activeTab === s.key ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'}`}>{s.icon}</span>
                                        <span className="truncate whitespace-nowrap">{s.label}</span>
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </aside>

                    <main className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-xl min-h-[520px]">
                        {activeTab === 'reaches' && (
                            loading ? <div className="flex justify-center py-10"><Loading /></div> : (
                                <ReachInbox
                                    pulses={reaches}
                                    myTrees={myTrees}
                                    lightseed={lightseed}
                                    title={t('direct_messages')}
                                    requestedPartner={reachPartner || null}
                                    onConsumeRequested={onConsumeReach}
                                />
                            )
                        )}

                        {activeTab === 'invites' && (
                            <div>
                                <SectionTitle title={t('invitations')} sub="Invite kindred spirits to plant their roots in the network." />
                                {myTrees.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
                                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100"><Icons.Tree /></div>
                                        <p className="text-sm">Plant your first tree to unlock invitations.</p>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-slate-100 p-5 space-y-4">
                                        <p className="text-sm text-slate-500">{t('invites_remaining')}: <span className="font-bold text-emerald-600">{invitesRemaining}</span></p>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <input readOnly value={inviteLink} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 text-slate-500" />
                                            <button onClick={copyInvite} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold text-xs hover:bg-slate-300 transition-colors whitespace-nowrap">{t('copy_invite')}</button>
                                            <button onClick={() => setShowInviteModal(true)} disabled={invitesRemaining <= 0} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-emerald-700 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">{t('send_invite')}</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div>
                                <SectionTitle title="Settings" sub="Privacy, email, notifications, and your account." />
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
                                            <p className="font-semibold text-slate-800 text-sm">Reach threads to email</p>
                                            <p className="text-xs text-slate-500">Get an email when someone reaches one of your trees.</p>
                                        </div>
                                        <Toggle on={sendThreadsToEmail} onClick={handleThreadsEmailToggle} disabled={togglingThreadsEmail || !lightseed.email} />
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
                                <SectionTitle title="Admin" sub="Network stewardship and roles." />
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
                                    <div className="rounded-2xl border border-slate-100 p-5 space-y-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider"><Icons.Shield /> Admin Management</h4>
                                            <button onClick={onOpenNewsletterAdmin} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center gap-2"><Icons.Send /><span>Send Newsletter</span></button>
                                        </div>
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
                                )}
                                {isAdmin && !isSuperAdmin && <p className="text-sm text-slate-500">You hold admin privileges in this network.</p>}
                            </div>
                        )}

                        {activeTab === 'trees' && (
                            <div>
                            <SectionTitle title={t('my_trees')} sub="Your living identities rooted in the network." />
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
                                    myTrees.map((tree: Lifetree) => (
                                        <div key={tree.id} onClick={() => onViewTree(tree)} className="border border-slate-200 rounded-lg p-4 hover:shadow-md cursor-pointer transition-all flex items-center justify-between group bg-white">
                                            <div className="flex items-center space-x-4">
                                                <img src={tree.imageUrl || 'https://via.placeholder.com/100'} className="w-16 h-16 rounded object-cover bg-slate-100" />
                                                <div>
                                                    <h3 className="font-bold text-slate-800">{tree.name}</h3>
                                                    <p className="text-xs text-slate-500">Block Height: {tree.blockHeight}</p>
                                                    {isExplicitlyValidatedTree(tree) ? (
                                                        <ValidationBadge compact />
                                                    ) : (
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Pending</span>
                                                    )}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onDeleteTree(tree.id); }} 
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                title="Delete Tree"
                                            >
                                                <Icons.Trash />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                            </div>
                        )}
                        {activeTab === 'pulses' && (
                            <div>
                            <SectionTitle title={t('my_pulses')} sub="Signals you've emitted into the network." />
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
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-2 transition-colors disabled:opacity-50"
                                         >
                                             {analyzing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Icons.Sparkles />}
                                             <span>AI Alignment Analysis</span>
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
                                                                title="Delete Vision"
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
                            <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">lightseed.online Theme</h3>
                                        <p className="mt-1 text-sm text-slate-500">
                                            This theme is personal to your login and takes precedence over community themes.
                                        </p>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2">
                                        {communityThemePresets.map((preset) => {
                                            const active = siteTheme.primary === preset.primary && siteTheme.surface === preset.surface && siteTheme.background === preset.background && siteTheme.mode === preset.mode;
                                            return (
                                                <button
                                                    key={preset.id}
                                                    type="button"
                                                    onClick={() => setSiteTheme(normalizeTheme(preset))}
                                                    className={`rounded-2xl border p-4 text-left transition-all ${active ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-100' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-800">{preset.name}</div>
                                                            <div className="text-xs text-slate-500">{preset.description}</div>
                                                        </div>
                                                        <div className="flex shrink-0 overflow-hidden rounded-full border border-white shadow-sm">
                                                            {[preset.surface, preset.primary, preset.accent, preset.background].map((color, index) => (
                                                                <span key={`${preset.id}-${index}`} className="h-7 w-7" style={{ backgroundColor: color }} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        {[
                                            ['surface', 'Header'],
                                            ['primary', 'Primary'],
                                            ['accent', 'Accent'],
                                            ['background', 'Background']
                                        ].map(([key, label]) => (
                                            <label key={key} className="space-y-1">
                                                <span className="text-[10px] font-bold uppercase text-slate-400">{label}</span>
                                                <input
                                                    type="color"
                                                    value={(siteTheme as any)[key]}
                                                    onChange={e => setSiteTheme(normalizeTheme({ ...siteTheme, [key]: e.target.value }))}
                                                    className="block h-11 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <aside className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50 p-5">
                                    <div>
                                        <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400">Site Logo</h4>
                                        <p className="mt-1 text-xs text-slate-500">Optional. Used in the header on hub domains.</p>
                                    </div>
                                    <ImagePicker
                                        onImageSelect={handleSiteLogoUpload}
                                        previewUrl={siteLogoUrl}
                                        loading={uploadingSiteLogo}
                                        className="mx-auto aspect-square w-32 rounded-2xl border-2 border-dashed border-slate-200 bg-white"
                                    />
                                    <div className="overflow-hidden rounded-2xl border border-white shadow-sm">
                                        {[siteTheme.surface, siteTheme.primary, siteTheme.accent, siteTheme.background].map((color, index) => (
                                            <span key={`site-theme-${index}`} className="inline-block h-8 w-1/4" style={{ backgroundColor: color }} />
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleSaveSiteTheme}
                                        disabled={savingSiteTheme || uploadingSiteLogo}
                                        className="w-full rounded-2xl bg-teal-600 py-3 text-sm font-bold text-white shadow-lg shadow-teal-600/20 transition-colors hover:bg-teal-700 disabled:opacity-50"
                                    >
                                        {savingSiteTheme ? 'Saving...' : 'Save Theme'}
                                    </button>
                                    <button
                                        onClick={handleResetSiteTheme}
                                        disabled={savingSiteTheme || uploadingSiteLogo}
                                        className="w-full rounded-2xl bg-slate-200 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-300 disabled:opacity-50"
                                    >
                                        Reset
                                    </button>
                                </aside>
                            </div>
                        )}
                        {activeTab === 'history' && (
                            <div>
                            <SectionTitle title={t('alignments')} sub="Resonances you've synced across the network." />
                            {loading ? <div className="flex justify-center py-10"><Loading /></div> : (
                                <div className="space-y-4">
                                    {history.length === 0 ? <p className="text-slate-400 text-center py-10">No history yet.</p> : history.map((h) => (
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
