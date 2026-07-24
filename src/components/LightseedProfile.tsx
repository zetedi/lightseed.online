
import { useState, useEffect, useMemo } from 'react';
import { showAlert } from "./ui/Dialog";
import { type Lifetree, type Alignment, type Vision, type Pulse, type ReachAudience } from '../types';
import { getLifetreeById, listenToUserProfile, updateUserProfile, tendTree, auth } from '../services/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { Icons } from './ui/Icons';
import { ValidationBadge } from './ValidationBadge';
import { Modal } from './ui/Modal';
import { isExplicitlyValidatedTree, isValidationLive, isValidationFading } from '../utils/validation';
import { normalizeTheme, type CommunityThemePreset } from '../utils/theme';
import { IntelligencePanel } from './intelligence/IntelligencePanel';
import { DEFAULT_INTELLIGENCE_ID } from '../services/intelligence';
import { BeingProfile, type BeingSection } from './BeingProfile';
import { ProfileInviteBanners } from './profile/ProfileInviteBanners';
import { ProfileTrees } from './profile/ProfileTrees';
import { ProfileLight } from './profile/ProfileLight';
import { ProfilePulses } from './profile/ProfilePulses';
import { ProfileVisions } from './profile/ProfileVisions';
import { ProfileHistory } from './profile/ProfileHistory';
import { ProfileStays } from './profile/ProfileStays';
import { ProfileReaches } from './profile/ProfileReaches';
import { ProfileInvites } from './profile/ProfileInvites';
import { ProfileSettings } from './profile/ProfileSettings';
import { ProfileAppearance } from './profile/ProfileAppearance';
import { ProfileAdmin } from './profile/ProfileAdmin';

interface LightseedProfileProps {
    onViewTree: (tree: Lifetree, section?: string) => void;
    onDeleteTree: (treeId: string) => void;
    defaultTreeId?: string;
    onSetDefaultTree?: (treeId: string) => void;
    onViewVision: (vision: Vision) => void;
    onViewPulse?: (pulse: Pulse) => void;
    onViewAlignment?: (alignment: Alignment) => void;
    onPlant: () => void;
    onCreateVision?: () => void;
    onEmitPulse?: () => void;   // the manual "emit a pulse" entry, now homed on the My Pulses tab
    onClaimSuperAdmin: () => void;
    onGrantAdmin: (uid: string) => Promise<void>;
    onRevokeAdmin: (uid: string) => Promise<void>;
    onOpenNewsletterAdmin: () => void;
    reachPartner?: Lifetree | null;
    reachAudience?: ReachAudience;
    reachOpenSignal?: number;
    onConsumeReach?: () => void;
    onReachTree?: (tree: Lifetree) => void;
    nodeTheme?: Partial<CommunityThemePreset>;
}

// The profile shell: hero + section menu, rendered through BeingProfile (the one face for every
// being). Session state (the lightseed), the active tab and the live-profile-listener state live
// here; each tab's own data and handlers live in its component under ./profile (mirroring the
// CommunityProfile split).
export const LightseedProfile = ({ onViewTree, onDeleteTree, defaultTreeId, onSetDefaultTree, onViewVision, onViewPulse, onViewAlignment, onPlant, onCreateVision, onEmitPulse, onClaimSuperAdmin, onGrantAdmin, onRevokeAdmin, onOpenNewsletterAdmin, reachPartner, reachAudience, reachOpenSignal, onConsumeReach, onReachTree, nodeTheme }: LightseedProfileProps) => {
    const { t } = useLanguage();
    // Session state comes from context now (was prop-drilled from App).
    const { lightseed, myTrees, guardedTrees, isAdmin, isSuperAdmin, superAdminExists } = useSession();
    const [activeTab, setActiveTab] = useState<'trees' | 'light' | 'pulses' | 'visions' | 'stays' | 'history' | 'reaches' | 'invites' | 'appearance' | 'intelligence' | 'settings' | 'admin'>('trees');
    const [dialogMessage, setDialogMessage] = useState<string | null>(null);

    // Live profile state — written by the listenToUserProfile listener below, read across
    // tabs (invites allotment, settings toggles, the appearance draft, intelligence choice).
    const [invitesRemaining, setInvitesRemaining] = useState(7);
    const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
    const [dmEmailNotifications, setDmEmailNotifications] = useState(true);
    const [onlyValidatedCanReach, setOnlyValidatedCanReachState] = useState(false);
    const [siteTheme, setSiteTheme] = useState(normalizeTheme(undefined));
    const [siteLogoUrl, setSiteLogoUrl] = useState('');
    const [siteHeroUrl, setSiteHeroUrl] = useState('');
    const [preferredIntelligenceId, setPreferredIntelligenceId] = useState<string>('');

    useEffect(() => {
        if (!lightseed) return;
        // Listen to live user profile for invites, settings and theme.
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
        return () => unsub();
    }, [lightseed]);

    // Opening the inbox (red envelope) or a specific reach jumps to the Reaches tab.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to the parent's open-inbox signal; the tab is otherwise user-driven, so it can't be derived
        if (reachOpenSignal) setActiveTab('reaches');
    }, [reachOpenSignal]);
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to the parent's open-thread signal; the tab is otherwise user-driven, so it can't be derived
        if (reachPartner) setActiveTab('reaches');
    }, [reachPartner]);

    // Validation is living care: a tree counts only while it's tended (live). `tendedIds`
    // holds trees just re-tended this session so they re-light immediately. This stays in
    // the shell because the hero badge derives from the same state as the trees tab.
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
    // Guarded = every tree in the guarded list that isn't already shown as a personal
    // avatar. Owned NATURE trees belong here (their planter is their first guardian) —
    // filtering by ownership made them vanish from both sections.
    const myTreeIds = new Set((myTrees as Lifetree[]).map((t: Lifetree) => t.id));
    const guardedOnly = (guardedTrees as Lifetree[]).filter((tree: Lifetree) => !myTreeIds.has(tree.id));

    // The join date is the FIRST ROOT, not the login record: the earlier of the account's
    // creation and the birth of the oldest tree this being keeps. For the genesis keeper the
    // genesis tree itself sets it (zetedi joined when the tree began, not when the login did).
    const joinedMs = useMemo(() => {
        const created = auth.currentUser?.metadata?.creationTime;
        const authMs = created ? Date.parse(created) : null;
        const treeMs = (myTrees as Lifetree[]).reduce<number | null>((min, tr) => {
            const ms = tr.createdAt?.toMillis ? tr.createdAt.toMillis() : null;
            return ms !== null && (min === null || ms < min) ? ms : min;
        }, null);
        if (authMs === null) return treeMs;
        if (treeMs === null) return authMs;
        return Math.min(authMs, treeMs);
    }, [myTrees]);

    // The Original Tree — Mahameru, everyone's last section: indestructible, dissolved
    // into Nature, part of every tree planted since.
    const [originalTree, setOriginalTree] = useState<Lifetree | null>(null);
    useEffect(() => {
        let alive = true;
        getLifetreeById('GENESIS_TREE').then(t => { if (alive) setOriginalTree(t); }).catch(() => {});
        return () => { alive = false; };
    }, []);

    if (!lightseed) return null;

    const showAdmin = isAdmin || isSuperAdmin || !superAdminExists;

    // The lightseed's sections — each `render` closes over this shell's state and handlers.
    const sections: BeingSection[] = [
        {
            key: 'trees', label: t('my_trees'), icon: <Icons.Tree />, render: () => (
                <ProfileTrees
                    myTrees={myTrees}
                    guardedOnly={guardedOnly}
                    originalTree={originalTree}
                    defaultTreeId={defaultTreeId}
                    onSetDefaultTree={onSetDefaultTree}
                    onViewTree={onViewTree}
                    onDeleteTree={onDeleteTree}
                    onPlant={onPlant}
                    allValidated={allValidated}
                    treesNeedingCare={treesNeedingCare}
                    lapsedValidated={lapsedValidated}
                    fadingValidated={fadingValidated}
                    tendingId={tendingId}
                    onTend={handleTend}
                />
            ),
        },
        {
            // The light face: what witnessed care has kindled. Holder-private by rule, so it
            // lives only on the OWN profile shell (there is no public balance to show anyone).
            key: 'light', label: 'Light', icon: <Icons.Sun />, render: () => (
                <ProfileLight uid={lightseed.uid} />
            ),
        },
        {
            key: 'reaches', label: t('direct_messages'), icon: <Icons.Chat />, render: () => (
                <ProfileReaches
                    lightseed={lightseed}
                    myTrees={myTrees}
                    reachPartner={reachPartner}
                    reachAudience={reachAudience}
                    onConsumeReach={onConsumeReach}
                />
            ),
        },
        {
            key: 'pulses', label: t('my_pulses'), icon: <Icons.Pulse />, render: () => (
                <ProfilePulses uid={lightseed.uid} onViewPulse={onViewPulse} onEmit={onEmitPulse} />
            ),
        },
        {
            key: 'visions', label: t('visions'), icon: <Icons.Eye />, render: () => (
                <ProfileVisions
                    uid={lightseed.uid}
                    onViewVision={onViewVision}
                    onCreateVision={onCreateVision}
                    notify={setDialogMessage}
                />
            ),
        },
        {
            key: 'stays', label: t('my_stays'), icon: <Icons.Moon />, render: () => (
                <ProfileStays uid={lightseed.uid} onViewTree={onViewTree} />
            ),
        },
        {
            key: 'history', label: t('alignments'), icon: <Icons.Venn />, render: () => (
                <ProfileHistory
                    uid={lightseed.uid}
                    onViewAlignment={onViewAlignment}
                    onReachTree={onReachTree}
                />
            ),
        },
        {
            key: 'invites', label: t('invitations'), icon: <Icons.UserPlus />, render: () => (
                <ProfileInvites
                    uid={lightseed.uid}
                    isSuperAdmin={isSuperAdmin}
                    hasTrees={myTrees.length > 0}
                    invitesRemaining={invitesRemaining}
                    notify={setDialogMessage}
                />
            ),
        },
        {
            key: 'appearance', label: t('appearance'), icon: <Icons.Image />, render: () => (
                <ProfileAppearance
                    uid={lightseed.uid}
                    nodeTheme={nodeTheme}
                    siteTheme={siteTheme}
                    onSiteThemeChange={setSiteTheme}
                    siteLogoUrl={siteLogoUrl}
                    onSiteLogoUrlChange={setSiteLogoUrl}
                    siteHeroUrl={siteHeroUrl}
                    onSiteHeroUrlChange={setSiteHeroUrl}
                    notify={setDialogMessage}
                />
            ),
        },
        {
            key: 'intelligence', label: t('intelligence'), icon: <Icons.Intelligence />, render: () => (
                lightseed?.uid ? (
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
                ) : null
            ),
        },
        {
            key: 'settings', label: t('settings_title'), icon: <Icons.Cog />, render: () => (
                <ProfileSettings
                    uid={lightseed.uid}
                    email={lightseed.email}
                    onlyValidatedCanReach={onlyValidatedCanReach}
                    onOnlyValidatedChange={setOnlyValidatedCanReachState}
                    newsletterSubscribed={newsletterSubscribed}
                    onNewsletterChange={setNewsletterSubscribed}
                    dmEmailNotifications={dmEmailNotifications}
                    onDmEmailChange={setDmEmailNotifications}
                    notify={setDialogMessage}
                />
            ),
        },
        ...(showAdmin ? [{
            key: 'admin', label: t('admin_title'), icon: <Icons.Shield />, render: () => (
                <ProfileAdmin
                    uid={lightseed.uid}
                    email={lightseed.email}
                    isAdmin={isAdmin}
                    isSuperAdmin={isSuperAdmin}
                    superAdminExists={superAdminExists}
                    onClaimSuperAdmin={onClaimSuperAdmin}
                    onGrantAdmin={onGrantAdmin}
                    onRevokeAdmin={onRevokeAdmin}
                    onOpenNewsletterAdmin={onOpenNewsletterAdmin}
                    notify={setDialogMessage}
                />
            ),
        } satisfies BeingSection] : []),
    ];

    return (
        <BeingProfile
            activeSection={activeTab}
            onSectionChange={(k) => setActiveTab(k as typeof activeTab)}
            sections={sections}
            hero={{
                // Hero — compact: avatar, name and all the meta sit on one wrapping row.
                imageUrl: siteHeroUrl,
                avatarRowClassName: 'flex flex-row items-center gap-3 sm:gap-5',
                titleRowClassName: 'flex flex-wrap items-center gap-x-3 gap-y-1.5 justify-start',
                avatar: (
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
                        {/* The validation shield — top-left of the avatar when this being keeps a
                            live validated tree (or is the node's own trusted validator). */}
                        {(hasValidatedTree || isSuperAdmin) && (
                            <span className="absolute -top-1 -left-1 flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white shadow-md" title="Validated">
                                <Icons.ShieldCheck className="h-3 w-3 md:h-3.5 md:w-3.5" />
                            </span>
                        )}
                    </div>
                ),
                title: lightseed.displayName,
                chips: (
                    <>
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
                        {joinedMs !== null && (
                            <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs text-slate-300">
                                Since {new Date(joinedMs).toLocaleDateString()}
                            </span>
                        )}
                        {allValidated && (
                            <button onClick={onPlant} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-full text-[11px] font-bold shadow-lg transition-transform active:scale-95 flex items-center gap-1.5">
                                <Icons.Tree />
                                <span>Plant a Tree</span>
                            </button>
                        )}
                    </>
                ),
            }}
            banner={
                <>
                    {/* Pending invitations (tree circle + community) shown above the tabs */}
                    <ProfileInviteBanners uid={lightseed.uid} notify={setDialogMessage} />

                    {dialogMessage && (
                        <Modal title={t('notice')} onClose={() => setDialogMessage(null)}>
                            <div className="space-y-4">
                                <p className="text-sm text-slate-600">{dialogMessage}</p>
                                <button onClick={() => setDialogMessage(null)} className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Close</button>
                            </div>
                        </Modal>
                    )}
                </>
            }
            // The menu + content boxes sit ON the hero — the blue extends behind them.
            layoutProps={{ overlapClassName: '-mt-10' }}
        />
    );
}
