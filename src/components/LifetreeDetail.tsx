
import React, { useState, useEffect, useCallback } from 'react';
import { showAlert, showConfirm } from "./ui/Dialog";
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { Icons } from './ui/Icons';
import { SuperDot } from './ui/SuperDot';
import { BeingQr } from './ui/BeingQr';
import { mintBeingQr } from '../services/firebase/beings';
import { getSanctuaryById } from '../services/firebase';
import type { Sanctuary } from '../domain/sanctuary';
import { ValidationBadge } from './ValidationBadge';
import { updateLifetree, setTreeStatus, getPulsesByTreeId } from '../services/firebase';
import { Pulse, type Lifetree } from '../types';
import { canToggleValidation, isExplicitlyValidatedTree } from '../utils/validation';
import { canReachTree, type ReachTargetProfile } from '../utils/reachPermissions';
import { treeCircle } from '../domain/views/circle';
import { firestoreStore } from '../adapters/firestore';
import { BeingProfile, type BeingSection } from './BeingProfile';
import { ChainTree } from './sections/ChainTree';
import { TreeCare } from './lifetree/TreeCare';
import { TreeCircle } from './lifetree/TreeCircle';
import { TreeGuardians } from './lifetree/TreeGuardians';
import { TreeDetails, type TreeDetailsUpdates } from './lifetree/TreeDetails';

interface LifetreeDetailProps {
    tree: Lifetree;
    onClose: () => void;
    onPlayGrowth: (treeId: string) => void;
    onValidate: (treeId: string, nextValidated: boolean) => void;
    onUpdate?: (updates: Partial<Lifetree>) => void;
    onDelete?: () => void;
    onCreatePulse: () => void;
    onReachTree?: (tree: Lifetree) => void;
    onViewPulse: (pulse: Pulse) => void;
    onAlertGuardians?: () => void;
    isDefaultTree?: boolean;
    onSetDefault?: () => void;
    targetUserProfile?: ReachTargetProfile | null;
    initialSection?: string;
    // Superadmin voice-bridge: "carry this being's voice" (AI beings like Aspen/Lumo, until
    // they hold their own auth). Impersonation hides the bridge; carrying reveals it. Toggling
    // passes the tree (or null) up; while active, pulses on this tree wear the being's name in
    // display fields and name the carrier (carriedByName/disclosure) — authorId stays the real uid.
    carrying?: boolean;
    onCarry?: (tree: Lifetree | null) => void;
}

// One uniform action button: icon + label on desktop, icon-only on mobile; coloured per action.
const ActionBtn = ({ onClick, disabled, title, color, icon, label }: { onClick?: () => void; disabled?: boolean; title?: string; color: string; icon: React.ReactNode; label?: string }) => (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
        className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold shadow-sm transition-colors disabled:opacity-50 ${color}`}>
        <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        {label && <span className="hidden md:inline">{label}</span>}
    </button>
);

export const LifetreeDetail = ({ tree, onClose, onPlayGrowth, onValidate, onUpdate, onDelete, onCreatePulse, onReachTree, onViewPulse, onAlertGuardians, isDefaultTree, onSetDefault, targetUserProfile, initialSection, carrying, onCarry }: LifetreeDetailProps) => {
   const { t } = useLanguage();
   // Session-derived values from context (were prop-drilled from App).
   const { lightseed, activeTree, isAdmin, isSuperAdmin, isInitiate } = useSession();
   const currentUser = lightseed;
   const currentUserId = lightseed?.uid;
   const myActiveTree = activeTree;
   const isOwner = currentUserId === tree.ownerId;

   // Sanctuaries rooted IN this tree (sanctuary __rooted__ tree): holding even one makes
   // this a MOTHER TREE. Read-only here — rooting is done from the sanctuary's page.
   const [holdingSanctuaries, setHoldingSanctuaries] = useState<Sanctuary[]>([]);
   useEffect(() => {
       let alive = true;
       firestoreStore.linksTo(tree.id, 'rooted')
           .then(links => Promise.all(links.map(l => getSanctuaryById(l.from).catch(() => null))))
           .then(list => { if (alive) setHoldingSanctuaries((list || []).filter(Boolean) as Sanctuary[]); })
           .catch(() => {});
       return () => { alive = false; };
   }, [tree.id]);
   const isMotherTree = holdingSanctuaries.length > 0;
   const isNature = tree.isNature;
   // Guardianship is a lightweight public follow with no powers — tending vests in the invited
   // roles (co_owner/steward), tracked as `isTender` (see the circle effect below). The guardian
   // list itself lives in TreeGuardians; the nonce re-reads the circle when it changes there.
   const [guardianNonce, setGuardianNonce] = useState(0);
   const [isTender, setIsTender] = useState(false);
   const canDelete = isOwner || isAdmin || isSuperAdmin;
   // The amber dot: this viewer may delete ONLY through staff privilege, not ownership.
   const deleteIsStaffOnly = !isOwner && (isAdmin || isSuperAdmin);
   // Tending powers vest in the owner, invited co_owners/stewards, or staff — not lightweight
   // guardians (mirrors isTreeTender in firestore.rules).
   const canEdit = isOwner || isTender || isAdmin || isSuperAdmin;
   const hasValidationBadge = isExplicitlyValidatedTree(tree);
   const showValidateAction = canToggleValidation({ tree, myActiveTree, isAdmin, isSuperAdmin, isInitiate });
   // Owner privacy flag is mirrored onto the (world-readable) tree, so we read it here.
   const targetProfile = targetUserProfile ?? { onlyValidatedCanReach: tree.onlyValidatedCanReach };
   const canReach = canReachTree({ targetTree: tree, targetUserProfile: targetProfile, myActiveTree, currentUserId, isAdmin, isSuperAdmin });
   const [isEditing, setIsEditing] = useState(false);
   const [showDeleteModal, setShowDeleteModal] = useState(false);
   // The hero owns the name/title edits; TreeDetails owns the rest and one Save writes both.
   const [editName, setEditName] = useState(tree.name);
   const [editShortTitle, setEditShortTitle] = useState(tree.shortTitle || '');
   const [isSaving, setIsSaving] = useState(false);

   // Immutable chain Visualization State
   const [genesisBlock, setGenesisBlock] = useState<Pulse | null>(null);
   const [growthBlocks, setGrowthBlocks] = useState<Pulse[]>([]);
   const [loadingChain, setLoadingChain] = useState(false);

   // Local state for immediate UI feedback on actions
   const [localStatus, setLocalStatus] = useState(tree.status || 'HEALTHY');

   // Profile-like sections: the tree is a being with a digital body, details, guardians, care
   // and a circle. Everything can be a lifetree, so this reads like a profile.
   type TreeSection = 'digital' | 'details' | 'guardians' | 'care' | 'circle';
   const [section, setSection] = useState<TreeSection>((initialSection as TreeSection) || 'digital');
   // A caller can steer the opening section (e.g. the profile droplet opens Care).
   // eslint-disable-next-line react-hooks/set-state-in-effect -- prop→state sync: re-steers the section when the caller changes initialSection/tree; a lazy initializer only covers first mount
   useEffect(() => { if (initialSection) setSection(initialSection as TreeSection); }, [initialSection, tree?.id]);

   // Note: getPulsesByTreeId returns Descending order (Newest First). Extracted (and kept
   // referentially stable) so a fresh watering can refresh the chain in place.
   const loadChain = useCallback(() => {
        setLoadingChain(true);
        getPulsesByTreeId(tree.id).then(pulses => {
            // A genesis PULSE exists only for special trees (e.g. GENESIS_TREE); normal trees are
            // planted with no pulse. The planting/root card is rendered from the tree itself, so
            // here we only pull any genesis pulse out of the growth leaves.
            const isGenesis = (p: Pulse) => p.previousHash === "0" || p.title === "Genesis Pulse";
            setGenesisBlock(pulses.find(isGenesis) || null);
            setGrowthBlocks(pulses.filter(p => !isGenesis(p)));
        }).finally(() => setLoadingChain(false));
   }, [tree.id]);
   // eslint-disable-next-line react-hooks/set-state-in-effect -- async chain fetch kickoff; the sync setLoadingChain(true) marks the fetch in flight and must re-run per tree.id
   useEffect(() => { loadChain(); }, [loadChain]);

   const handleSave = async (details: TreeDetailsUpdates) => {
       setIsSaving(true);
       try {
           // `createdAt` arrives as a JS Date (Firestore stores it as a Timestamp on write) and
           // null clears locationName/domain — hence the cast to the tree's shape.
           const updates = { name: editName, shortTitle: editShortTitle, ...details } as unknown as Partial<Lifetree>;
           await updateLifetree(tree.id, updates);
           if (onUpdate) onUpdate(updates);
           setIsEditing(false);
       } catch (e) {
           console.error(e);
           showAlert("Failed to save changes.");
       }
       setIsSaving(false);
   };

   // TreeDetails resets its own fields; the shell resets the hero's pair and leaves edit mode.
   const handleCancelEdit = () => {
       setIsEditing(false);
       setEditName(tree.name);
       setEditShortTitle(tree.shortTitle || '');
   };

   const handleToggleDanger = async () => {
       if (!canEdit) return; // reporting danger writes the tree's status — a tender power, not a follow
       const newStatus = localStatus === 'DANGER' ? 'HEALTHY' : 'DANGER';
       if (newStatus === "DANGER" && !(await showConfirm("Are you sure you want to report this tree is in DANGER? This will alert all guardians.", { title: "Report Danger", confirmText: "Report", danger: true }))) return;

       setIsSaving(true);
       try {
           await setTreeStatus(tree.id, newStatus);
           setLocalStatus(newStatus);
           if (onUpdate) onUpdate({ status: newStatus });
       } catch (e) { showAlert(e instanceof Error ? e.message : String(e)); }
       setIsSaving(false);
   }

   // Tree Circle — shared care of this Lifetree. When someone accepts an invite a
   // community circle forms around the tree (see acceptTreeInvite Cloud Function).
   const canInviteToCircle = isOwner || isSuperAdmin;
   // The Tree Circle is now a prism over the LIN: fetch the tree's incoming links through the
   // Store port: the circle is a prism over this tree's incoming links. Re-reads when a
   // guardian joins/leaves (guardianNonce) so the circle stays in step with the toggle.
   const [circle, setCircle] = useState<ReturnType<typeof treeCircle>>({ groups: [], size: 0 });
   useEffect(() => {
       let alive = true;
       firestoreStore.linksTo(tree.id)
           .then(links => {
               if (!alive) return;
               setCircle(treeCircle(tree.ownerId, links));
               // A tender holds an invited co_owner/steward role link (guardian/observer don't tend).
               setIsTender(!!currentUserId && links.some(l => l.from === currentUserId && (l.rel === 'co_owner' || l.rel === 'steward')));
           })
           .catch(() => {});
       return () => { alive = false; };
   }, [tree.id, tree.ownerId, currentUserId, guardianNonce]);

   // Watering powers vest in the circle (owner / co-owner / steward / staff — rules allow
   // the same set); the schedule editor is gated exactly like editing.
   const canWater = !!currentUserId && (isTender || isOwner || isAdmin || isSuperAdmin);
   const canManageSchedule = canEdit;

   // The root card of the chain — drawn from the tree itself (normal trees have no genesis
   // pulse), pre-formatted for the entity-generic ChainTree renderer.
   const chainRoot = {
       imageUrl: tree.imageUrl,
       name: tree.name,
       body: tree.body,
       plantedLabel: `${tree.createdAt?.toDate ? tree.createdAt.toDate().toLocaleDateString() : (tree.createdAt ? new Date((tree.createdAt?.toMillis?.() ?? tree.createdAt) as unknown as string | number).toLocaleDateString() : '')}${tree.locationName ? ` · ${tree.locationName}` : ''}`,
       hash: tree.genesisHash,
   };

   // The tree's avatar/banner image — its latest growth (or its planting image).
   const heroImg = tree.latestGrowthUrl || tree.imageUrl || '';
   const [shared, setShared] = useState(false);
   // The tree's action row — one definition, two homes (desktop name-column / mobile footer).
   // One calm green for every action: the icon differentiates, the tree stays forward.
   const ACTION_GREEN = 'bg-emerald-600 text-white hover:bg-emerald-700';
   const actionRow = (
                    <>
                        <ActionBtn onClick={() => onPlayGrowth(tree.id)} title="Play growth" color={ACTION_GREEN} icon={<Icons.Play />} label="Play" />
                        {canReach
                            ? <ActionBtn onClick={() => onReachTree?.(tree)} title="Reach" color={ACTION_GREEN} icon={<Icons.Lightning />} label="Reach" />
                            : <ActionBtn disabled title={t('only_if_validated')} color="bg-white/20 text-white/70" icon={<Icons.Eye />} label={t('only_if_validated')} />}
                        {isOwner && !isEditing && <ActionBtn onClick={onCreatePulse} title="Tend this tree — a pulse of care (we both grow)" color={ACTION_GREEN} icon={<Icons.Drop />} label="Tend" />}
                        {/* Carry this being's voice — superadmin voice-bridge, on trees they tend
                            (owner/co_owner/steward). Impersonation hides the bridge; carrying
                            reveals it: the display author becomes the being, the carrier is named,
                            and the block stays signed by the real uid until beings sign themselves. */}
                        {isSuperAdmin && (isOwner || isTender) && onCarry && !isEditing && (
                            <ActionBtn
                                onClick={() => onCarry(carrying ? null : tree)}
                                title={carrying ? 'Stop carrying this being\'s voice' : "Carry this being's voice — pulses name you as the carrier"}
                                color={carrying ? `${ACTION_GREEN} ring-2 ring-white/70` : ACTION_GREEN}
                                icon={<Icons.Wizard />}
                                label={carrying ? 'Carrying' : 'Carry a pulse'}
                            />
                        )}
                        {isOwner && !isEditing && onSetDefault && <ActionBtn onClick={() => { if (!isDefaultTree) onSetDefault(); }} disabled={isDefaultTree} title={isDefaultTree ? 'Your default tree' : 'Set as default tree'} color={isDefaultTree ? `${ACTION_GREEN} ring-2 ring-white/70` : ACTION_GREEN} icon={<Icons.Star filled={isDefaultTree} />} label="Favourite" />}
                        {canEdit && !isEditing && <ActionBtn onClick={() => { setIsEditing(true); setSection('details'); }} title={t('edit')} color="bg-slate-100 text-slate-700 hover:bg-slate-200" icon={<Icons.Pencil />} label={t('edit')} />}
                    </>
   );

   const handleShare = async () => {
       const url = `${window.location.origin}/?tree=${tree.id}`;
       try {
           if (navigator.share) await navigator.share({ title: tree.name, url });
           else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 1500); }
       } catch { /* user cancelled the share sheet */ }
   };
   // The tree's sections — each `render` closes over this shell's state and handlers.
   const sections: BeingSection[] = [
       {
           // Digital Tree — the immutable growth chain, rendered by the universal
           // chain renderer (ChainTree). Chain loading stays here so Care can see the
           // growth blocks (pending waterings) and refresh them in place.
           key: 'digital', label: 'Digital Tree', icon: <Icons.Tree />, render: () => (
               <ChainTree
                   genesisBlock={genesisBlock}
                   blocks={growthBlocks}
                   loading={loadingChain}
                   onViewPulse={onViewPulse}
                   canTend={isOwner}
                   onTend={onCreatePulse}
                   root={chainRoot}
                   stats={{ blockHeight: tree.blockHeight, genesisHash: tree.genesisHash, latestHash: tree.latestHash }}
               />
           ),
       },
       {
           key: 'details', label: t('tree_details'), icon: <Icons.Info />, render: () => (
               <TreeDetails
                   tree={tree}
                   isEditing={isEditing}
                   canEdit={canEdit}
                   canDelete={canDelete}
                   deleteIsStaffOnly={deleteIsStaffOnly}
                   isSaving={isSaving}
                   onSave={handleSave}
                   onCancelEdit={handleCancelEdit}
                   onRequestDelete={() => setShowDeleteModal(true)}
                   onVisibilityChange={async (visibility) => {
                       try {
                           await updateLifetree(tree.id, { visibility });
                           onUpdate?.({ visibility });
                       } catch (e) {
                           console.error(e);
                           showAlert('Could not change the visibility.');
                       }
                   }}
                   // Staff-only kind conversion — rescues trees planted with the wrong kind
                   // while testing. treeType + isNature flip together (the pair every view
                   // and the planting-limit gate read).
                   onConvertType={(isAdmin || isSuperAdmin) ? async () => {
                       const toGuarded = !(tree.treeType === 'GUARDED' || tree.isNature);
                       if (!(await showConfirm(
                           toGuarded
                               ? `Convert ${tree.name} into a GUARDED (nature) tree?`
                               : `Convert ${tree.name} into a personal LIFETREE?`,
                           { title: 'Convert tree kind', confirmText: 'Convert' },
                       ))) return;
                       try {
                           const updates = { treeType: toGuarded ? 'GUARDED' : 'LIFETREE', isNature: toGuarded } as Partial<Lifetree>;
                           await updateLifetree(tree.id, updates);
                           onUpdate?.(updates);
                           showAlert(toGuarded ? `${tree.name} now stands as a guarded tree.` : `${tree.name} is a lifetree again.`);
                       } catch (e: any) {
                           console.error(e);
                           showAlert(e?.message || 'Could not convert the tree.');
                       }
                   } : undefined}
               />
           ),
       },
       {
           key: 'guardians', label: 'Guardians', icon: <Icons.Shield />, render: () => (
               <TreeGuardians
                   treeId={tree.id}
                   currentUserId={currentUserId}
                   canEdit={canEdit}
                   status={localStatus}
                   busy={isSaving}
                   onToggleDanger={handleToggleDanger}
                   onGuardianChange={() => setGuardianNonce(n => n + 1)}
               />
           ),
       },
       {
           key: 'care', label: 'Care', icon: <Icons.Droplet />, render: () => (
               (isOwner || isTender || isAdmin || isSuperAdmin)
                   ? <TreeCare
                       tree={tree}
                       growthBlocks={growthBlocks}
                       currentUserId={currentUserId}
                       currentUserName={currentUser?.displayName}
                       currentUserPhoto={currentUser?.photoURL}
                       isOwner={isOwner}
                       canWater={canWater}
                       canManageSchedule={canManageSchedule}
                       onUpdate={onUpdate}
                       onChainRefresh={loadChain}
                   />
                   : <p className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-sm text-slate-400">Only the tree's circle can tend its care.</p>
           ),
       },
       {
           key: 'circle', label: 'Tree Circle', icon: <Icons.Venn />, render: () => (
               <TreeCircle tree={tree} currentUserId={currentUserId} canInvite={canInviteToCircle} circle={circle} />
           ),
       },
   ];

    return (
        <>
        <BeingProfile
            className="min-h-screen animate-in fade-in zoom-in-95 duration-300"
            sections={sections}
            activeSection={section}
            onSectionChange={(k) => setSection(k as TreeSection)}
            hero={{
                // Profile hero — a wide banner of the latest growth image with a circular avatar.
                imageUrl: heroImg,
                heroProps: {
                    imageClassName: 'opacity-70',
                    alwaysOverlay: true,
                    overlayClassName: 'bg-gradient-to-b from-slate-900/45 via-slate-900/55 to-slate-900/85',
                    maxWidth: 'max-w-5xl',
                    padding: 'pt-5 pb-5 px-4',
                    // Danger Banner — click to message this tree's guardians.
                    banner: localStatus === 'DANGER' && (
                        <button
                            type="button"
                            onClick={() => onAlertGuardians?.()}
                            disabled={!onAlertGuardians}
                            title="Message this tree's guardians"
                            className="w-full bg-red-600 text-white text-center py-2 font-bold animate-pulse sticky top-0 z-40 transition-colors hover:bg-red-700 disabled:cursor-default"
                        >
                            <div className="flex items-center justify-center space-x-2">
                                <Icons.Siren />
                                <span>ALERT: THIS TREE IS IN DANGER{onAlertGuardians ? ' — message guardians' : ''}</span>
                                <Icons.Siren />
                            </div>
                        </button>
                    ),
                },
                body: (
                    <div className="flex items-center gap-3 sm:gap-4">
                    {/* Back — left of the avatar; returns to wherever you came from. */}
                    <button onClick={onClose} title={t('back_forest')} className="shrink-0 rounded-full bg-white/15 p-2.5 text-white transition-colors hover:bg-white/25">
                        <Icons.ArrowLeft />
                    </button>
                    {/* Avatar — the latest growth image. */}
                    <div className="relative shrink-0">
                        {heroImg
                            ? <img src={heroImg} alt={tree.name} className="h-16 w-16 rounded-full border-4 border-white bg-white object-cover shadow-xl md:h-24 md:w-24" />
                            /* Mahameru wears the starry sky (Orion); every other imageless tree
                               a plain tree glyph. */
                            : tree.id === 'GENESIS_TREE'
                                ? <img src="/mahameru.svg" alt="Mahameru" className="h-16 w-16 rounded-full border-4 border-white object-cover shadow-xl md:h-24 md:w-24" />
                                : <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-emerald-700 text-white shadow-xl md:h-24 md:w-24"><Icons.Tree /></div>}
                        {hasValidationBadge && <div className="absolute -bottom-1 -right-1"><ValidationBadge compact /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                        {isEditing ? (
                            <div className="max-w-md space-y-2">
                                <input dir="auto" className="w-full border-b border-white/40 bg-white/10 p-1 text-2xl font-thin tracking-tight text-white focus:outline-none md:text-3xl" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Tree Name" />
                                <input dir="auto" className="w-full border-b border-white/40 bg-white/10 p-1 text-xs font-bold uppercase tracking-widest text-white focus:outline-none" value={editShortTitle} onChange={e => setEditShortTitle(e.target.value)} placeholder="SHORT TITLE" />
                            </div>
                        ) : (
                            <>
                                {/* Share rides beside the name; Delete waits at the section's far
                                    right — the header stays one compact block, no extra rows. */}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <h1 dir="auto" className="break-words text-2xl font-light tracking-wide md:text-3xl">{tree.name}</h1>
                                    <button onClick={handleShare} title="Share this tree" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white transition-colors hover:bg-white/25">
                                        <Icons.Link /> <span>{shared ? 'Copied' : 'Share'}</span>
                                    </button>
                                    <BeingQr lid={tree.lid} name={tree.name} savedHref={tree.qr?.href}
                                        canMint={canEdit}
                                        onMint={(href) => mintBeingQr('lifetrees', tree.id, href)}
                                        className="h-7 w-7 bg-white/15 text-white hover:bg-white/25" />
                                    {isNature && <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-sky-500 px-2 py-0.5 text-[10px] font-bold"><Icons.Shield /> NATURE</span>}
                                    {isMotherTree && <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-amber-950" title={`Holds ${holdingSanctuaries.map(x => x.name).join(', ')}`}><Icons.Sun /> MOTHER TREE</span>}
                                    {/* Validation, as one icon: grey = not yet, green = validated.
                                        For those who may act, the icon itself opens the modal. */}
                                    <span className="relative inline-flex shrink-0">
                                        <button
                                            type="button"
                                            disabled={!showValidateAction}
                                            onClick={async () => {
                                                if (!showValidateAction) return;
                                                const nv = !hasValidationBadge;
                                                if (await showConfirm(nv ? 'Validate this tree?' : 'Remove validation from this tree?', { title: 'Validation' })) onValidate(tree.id, nv);
                                            }}
                                            title={hasValidationBadge ? (showValidateAction ? 'Validated — remove (staff)' : 'Validated') : (showValidateAction ? t('validate_action') : 'Not validated yet')}
                                            aria-label={hasValidationBadge ? 'Validated' : 'Not validated'}
                                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/60 shadow-md transition-transform ${hasValidationBadge ? 'bg-emerald-500 text-white' : 'bg-slate-500/90 text-white/85'} ${showValidateAction ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
                                        >
                                            <Icons.ShieldCheck className="h-4 w-4 text-current" />
                                        </button>
                                        {hasValidationBadge && showValidateAction && <SuperDot />}
                                    </span>
                                    {tree.visibility && tree.visibility !== 'public' && <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{tree.visibility}</span>}
                                </div>
                                {tree.shortTitle && <p dir="auto" className="mt-0.5 text-xs font-bold uppercase tracking-widest text-emerald-200">{tree.shortTitle}</p>}
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <span dir="ltr" className="truncate font-mono text-xs text-slate-300" title={tree.id}>{tree.id}</span>
                                    {tree.plantedAt && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200"
                                              title={Number.isFinite(tree.plantedLatitude) ? `Planted at ${tree.plantedLatitude?.toFixed(5)}, ${tree.plantedLongitude?.toFixed(5)}${Number.isFinite(tree.plantedAltitudeM) ? ` · ${Math.round(tree.plantedAltitudeM!)} m` : ''}` : 'The real planting moment'}>
                                            🌱 Planted {new Date(tree.plantedAt.toMillis()).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
                                        </span>
                                    )}
                                </div>
                                <div className="mt-3 hidden flex-wrap gap-2 md:flex">{actionRow}</div>
                            </>
                        )}
                    </div>
                    {canDelete && !isEditing && (
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            title="Delete tree"
                            aria-label="Delete tree"
                            className="relative ml-auto shrink-0 self-start rounded-full border border-red-400/30 bg-red-500/15 p-2 text-red-300 transition-colors hover:bg-red-500 hover:text-white"
                        >
                            <Icons.Trash />
                            {deleteIsStaffOnly && <SuperDot />}
                        </button>
                    )}
                    </div>
                ),
                // Actions — desktop: under the hash in the name column; mobile: the footer row.
                footer: (
                    <div className="mt-4 flex flex-wrap justify-center gap-2 md:hidden">{actionRow}</div>
                ),
            }}
            // Body — section menu on the left (desktop), a strip on mobile; profile-style.
            layoutProps={{
                maxWidth: 'max-w-5xl',
                overlap: false,
                asideClassName: 'rounded-2xl border border-slate-100 bg-white p-2 shadow-sm lg:sticky lg:top-24',
                mainClassName: 'min-w-0 space-y-6',
            }}
        />

        {/* Delete confirmation modal */}
        {showDeleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                            <Icons.Trash />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Delete Lifetree</h3>
                            <p className="text-xs text-slate-500">This action cannot be undone.</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-6">
                        You are about to permanently delete <span className="font-semibold text-slate-800">"{tree.name}"</span>.
                        All associated data will be lost.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowDeleteModal(false)}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => { setShowDeleteModal(false); onDelete?.(); }}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-colors text-sm"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    )
};
