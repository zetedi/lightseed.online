
import React, { useState, useEffect, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { showAlert, showConfirm } from "./ui/Dialog";
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { Icons } from './ui/Icons';
import Logo from './Logo';
import { ValidationBadge } from './ValidationBadge';
import { AutocompleteInput } from './ui/AutocompleteInput';
import { updateLifetree, setTreeStatus, getPulsesByTreeId, createTreeInvite, setWateringSchedule, recordWatering, markWateredOffChain, confirmWateringPulse, sendWateringAlert, fileToWebpBase64 } from '../services/firebase';
import { analyzeWateringPhoto } from '../services/gemini';
import { Pulse, type InvitableRole, treeRelationLabels } from '../types';
import { canToggleValidation, isExplicitlyValidatedTree } from '../utils/validation';
import { canReachTree } from '../utils/reachPermissions';
import { isOnWateringSchedule, isWateringOverdue, daysUntilWatering, daysOverdue, lastWateredMillis, wateringAlertedToday, treeStage, computeNextDueMillis, type TreeStage } from '../domain/watering';
import { treeCircle } from '../domain/views/circle';
import { firestoreStore } from '../adapters/firestore';
import { canTendTree } from '../domain/policy';
import { SectionMenu } from './ui/SectionMenu';
import { ProfileHero } from './ui/ProfileHero';
import { ProfileLayout } from './ui/ProfileLayout';
import { SectionCard } from './ui/SectionCard';

// The three growth stages, in growing order — a seed in its pot, in the ground but still
// tended, and finally self-sustaining. The first two are watered on a schedule.
const STAGE_META: { key: TreeStage; label: string; hint: string; icon: React.ReactNode }[] = [
    { key: 'potted', label: 'Seed in a pot', hint: 'A seed growing in its pot — the most fragile stage.', icon: <Icons.Sprout /> },
    { key: 'planted', label: 'In the ground', hint: 'Planted out, but still needs regular care.', icon: <Icons.Leaf /> },
    { key: 'self_sustaining', label: 'Self-sustaining', hint: 'Established — no scheduled watering.', icon: <Icons.Tree /> },
];

export const LifetreeDetail = ({ tree, onClose, onPlayGrowth, onValidate, onUpdate, onDelete, onCreatePulse, onReachTree, onViewPulse, onAlertGuardians, isDefaultTree, onSetDefault, targetUserProfile, initialSection }: any) => {
   const { t } = useLanguage();
   // Session-derived values from context (were prop-drilled from App).
   const { lightseed, activeTree, isAdmin, isSuperAdmin, isInitiate } = useSession();
   const currentUser = lightseed;
   const currentUserId = lightseed?.uid;
   const myActiveTree = activeTree;
   const isOwner = currentUserId === tree.ownerId;
   const isNature = tree.isNature;
   // Guardianship is a prism over the LIN: read this tree's incoming 'guardian' links. A guardian
   // link is a LIGHTWEIGHT public follow and grants no powers — tending vests in the invited roles
   // (co_owner/steward), tracked separately as `isTender` (see the circle effect below).
   const [localIsGuardian, setLocalIsGuardian] = useState(false);
   const [guardianCount, setGuardianCount] = useState(0);
   const [guardianUids, setGuardianUids] = useState<string[]>([]);
   const [guardianNonce, setGuardianNonce] = useState(0);
   const [isTender, setIsTender] = useState(false);
   useEffect(() => {
       let alive = true;
       firestoreStore.linksTo(tree.id, 'guardian').then(links => {
           if (!alive) return;
           setLocalIsGuardian(!!currentUserId && links.some(l => l.from === currentUserId));
           setGuardianCount(links.length);
           setGuardianUids(links.map(l => l.from));
       }).catch(() => {});
       return () => { alive = false; };
   }, [tree.id, currentUserId, guardianNonce]);
   const canDelete = isOwner || isAdmin || isSuperAdmin;
   // Tending powers vest in the owner, invited co_owners/stewards, or staff — not lightweight
   // guardians (mirrors isTreeTender in firestore.rules).
   const canEdit = isOwner || isTender || isAdmin || isSuperAdmin;
   const hasValidationBadge = isExplicitlyValidatedTree(tree);
   const showValidateAction = canToggleValidation({ tree, myActiveTree, isAdmin, isSuperAdmin, isInitiate });
   // Owner privacy flag is mirrored onto the (world-readable) tree, so we read it here.
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
   const [editVisibility, setEditVisibility] = useState<'public' | 'node' | 'private'>(tree.visibility || 'public');
   const [isSaving, setIsSaving] = useState(false);
   
   // Immutable chain Visualization State
   const [, setChain] = useState<Pulse[]>([]);
   const [genesisBlock, setGenesisBlock] = useState<Pulse | null>(null);
   const [growthBlocks, setGrowthBlocks] = useState<Pulse[]>([]);
   const [loadingChain, setLoadingChain] = useState(false);
   
   // Local state for immediate UI feedback on actions
   const [localStatus, setLocalStatus] = useState(tree.status || 'HEALTHY');
   const [isLocating, setIsLocating] = useState(false);

   // Profile-like sections: the tree is a being with a digital body, details, guardians, care
   // and a circle. Everything can be a lifetree, so this reads like a profile.
   type TreeSection = 'digital' | 'details' | 'guardians' | 'care' | 'circle';
   const [section, setSection] = useState<TreeSection>(initialSection || 'digital');
   // A caller can steer the opening section (e.g. the profile droplet opens Care).
   useEffect(() => { if (initialSection) setSection(initialSection); }, [initialSection, tree?.id]);
   // The growth chain can be long, so the middle collapses into a clickable line.
   const [chainExpanded, setChainExpanded] = useState(false);

   // Tree Circle invite form
   const [showInvite, setShowInvite] = useState(false);
   const [inviteUserId, setInviteUserId] = useState('');
   const [inviteRole, setInviteRole] = useState<InvitableRole>('co_owner');
   const [inviteMessage, setInviteMessage] = useState('');
   const [inviteBusy, setInviteBusy] = useState(false);
   const [inviteStatus, setInviteStatus] = useState<string | null>(null);

   // Watering — scheduled tending of this (guarded) tree, keyed to its growth stage.
   const [waterStage, setWaterStage] = useState<TreeStage>(treeStage(tree));
   const [waterInterval, setWaterInterval] = useState<number>(tree.watering?.intervalDays || 7);
   const [waterBusy, setWaterBusy] = useState(false);
   const [waterMsg, setWaterMsg] = useState<string | null>(null);
   // On-chain watering is the opt-in: a photo mints a growth block. The default just ticks the
   // cadence off-chain — a photo at every routine watering would flood the chain with images.
   const [waterOnChain, setWaterOnChain] = useState(false);
   const [confirmingId, setConfirmingId] = useState<string | null>(null);
   const waterFileRef = useRef<HTMLInputElement>(null);
   // The component instance is reused across trees, so reset the panel when the tree changes
   // (useState initialisers only run on mount).
   useEffect(() => {
       setWaterMsg(null);
       setWaterOnChain(false);
       setEditVisibility(tree.visibility || 'public');
   }, [tree.id]);
   // Re-seed the schedule editor whenever the watering data itself changes — including a remote
   // edit by another tender — so Save never silently reverts someone else's schedule.
   useEffect(() => {
       setWaterStage(treeStage(tree));
       setWaterInterval(tree.watering?.intervalDays || 7);
   }, [tree.id, tree.watering]);

   // Note: getPulsesByTreeId returns Descending order (Newest First). Extracted so a fresh
   // watering can refresh the chain in place.
   const loadChain = () => {
        setLoadingChain(true);
        getPulsesByTreeId(tree.id).then(pulses => {
            // A genesis PULSE exists only for special trees (e.g. GENESIS_TREE); normal trees are
            // planted with no pulse. The planting/root card is rendered from the tree itself, so
            // here we only pull any genesis pulse out of the growth leaves.
            const isGenesis = (p: Pulse) => p.previousHash === "0" || p.title === "Genesis Pulse";
            setGenesisBlock(pulses.find(isGenesis) || null);
            setGrowthBlocks(pulses.filter(p => !isGenesis(p)));
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
               visibility: editVisibility,
               ...(editCreatedAt && { createdAt: new Date(editCreatedAt) })
           };
           await updateLifetree(tree.id, updates);
           if (onUpdate) onUpdate(updates);
           setIsEditing(false);
       } catch (e) {
           console.error(e);
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
           // The guardian link is the source of truth — reflect it immediately, then re-read.
           setLocalIsGuardian(isJoining);
           setGuardianCount(c => Math.max(0, c + (isJoining ? 1 : -1)));
           setGuardianNonce(n => n + 1);
       } catch(e: any) { showAlert(e.message); }
       setIsSaving(false);
   }

   const handleToggleDanger = async () => {
       if (!canEdit) return; // reporting danger writes the tree's status — a tender power, not a follow
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
        <SectionCard title="Guardians" icon={<Icons.Shield />}>
            <p className="text-sm mb-6 text-slate-500">
                This tree is protected by the community. Join the guardians to monitor its health and add memories.
            </p>

            {/* The circle of guardians, shown as cards (like My Trees in the profile). */}
            {guardianUids.length > 0 && (
                <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {guardianUids.map(uid => (
                        <div key={uid} className="flex items-center gap-3 rounded-xl border border-sky-100 bg-white/70 p-3 shadow-sm">
                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(uid.slice(0, 2))}&background=0ea5e9&color=fff`} className="h-10 w-10 shrink-0 rounded-full" alt="" />
                            <div className="min-w-0">
                                <p dir="ltr" className="truncate font-mono text-xs text-sky-900" title={uid}>{uid === currentUserId ? 'You' : `${uid.slice(0, 8)}…`}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-500">Guardian</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

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

                {canEdit && (
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
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 font-mono">
                Guardians: {guardianCount}
            </div>
        </SectionCard>
   );

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
       } catch (err: any) {
           setInviteStatus(err?.message || 'Failed to send invitation.');
       }
       setInviteBusy(false);
   };

   const TreeCirclePanel = () => (
       <SectionCard title="Tree Circle" icon={<Icons.Venn />}>
           {circle.size <= 1 ? (
               <p className="mb-4 text-sm text-emerald-800/80">This tree does not have a circle yet. Invite someone to care for it with you — when they accept, a community grows around the tree.</p>
           ) : (
               <div className="mb-4">
                   <p className="mb-3 text-sm text-emerald-800/80">This tree is cared for by:</p>
                   <div className="space-y-1.5">
                       {circle.groups.map(g => (
                           <div key={g.role} className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-1.5 text-sm">
                               <span className="font-medium">{treeRelationLabels[g.role]}{g.members.length > 1 ? 's' : ''}</span>
                               <span className="font-bold text-emerald-700">{g.members.length}</span>
                           </div>
                       ))}
                   </div>
               </div>
           )}

           {canInviteToCircle && (showInvite ? (
               <form onSubmit={handleSendInvite} className="space-y-2 rounded-xl border border-emerald-200 bg-white p-4">
                   <p className="text-xs text-emerald-700/80">Invite someone into shared care of this Lifetree.</p>
                   <input value={inviteUserId} onChange={e => setInviteUserId(e.target.value)} placeholder="Their user ID" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
                   <div className="grid grid-cols-2 gap-2">
                       <select value={inviteRole} onChange={e => setInviteRole(e.target.value as InvitableRole)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                           <option value="co_owner">Co-guardian</option>
                           <option value="guardian">Guardian</option>
                           <option value="steward">Steward</option>
                           <option value="observer">Observer</option>
                       </select>
                       <button type="submit" disabled={inviteBusy} className="h-10 rounded-lg bg-emerald-600 text-sm font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50">{inviteBusy ? 'Sending…' : 'Send'}</button>
                   </div>
                   <input value={inviteMessage} onChange={e => setInviteMessage(e.target.value)} placeholder="A short message (optional)" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                   <button type="button" onClick={() => setShowInvite(false)} className="text-xs font-medium text-slate-500 hover:text-slate-700">Cancel</button>
               </form>
           ) : (
               <button onClick={() => setShowInvite(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:bg-emerald-700 active:scale-95">
                   <Icons.UserPlus /> <span>Invite to Tree Circle</span>
               </button>
           ))}
           {inviteStatus && <p className="mt-3 text-xs text-emerald-700">{inviteStatus}</p>}
       </SectionCard>
   );

   // --- Watering — scheduled tending of this (guarded) tree ---------------------------
   const sender = { uid: currentUserId as string, displayName: currentUser?.displayName, photoURL: currentUser?.photoURL };
   const scheduled = isOnWateringSchedule(tree);
   const stage = treeStage(tree);
   const selfSustaining = stage === 'self_sustaining';
   const overdue = isWateringOverdue(tree);
   const dueInDays = daysUntilWatering(tree);
   const overByDays = daysOverdue(tree);
   const lastWateredMs = tree.watering?.lastWateredAt ? lastWateredMillis(tree) : 0;
   const canWater = !!currentUserId && (isTender || isOwner || isAdmin || isSuperAdmin);
   const canManageSchedule = canEdit; // owner / co-owner / steward / staff (rules allow the same set)
   const pendingWaterings = growthBlocks.filter((p: any) => p.care === 'watering' && p.wateringConfirmedBy === 'pending');

   const handleSaveSchedule = async () => {
       setWaterBusy(true); setWaterMsg(null);
       try {
           // Mirror exactly what was written — the service builds (and returns) the schedule.
           const watering = await setWateringSchedule(tree.id, { stage: waterStage, intervalDays: waterInterval, prev: tree.watering });
           onUpdate?.({ watering });
           const iv = watering.intervalDays || 0;
           setWaterMsg(waterStage === 'self_sustaining'
               ? 'Marked self-sustaining — it grows on its own now.'
               : `${waterStage === 'potted' ? 'Seed in its pot' : 'In the ground'} — watering every ${iv} day${iv > 1 ? 's' : ''}.`);
       } catch (e: any) { setWaterMsg(e?.message || 'Could not save the schedule.'); }
       setWaterBusy(false);
   };

   const handleWaterPick = () => waterFileRef.current?.click();

   // Off-chain watering (the default): reset the cadence + tending clock, no photo / no growth block.
   const handleWaterBypass = async () => {
       if (!currentUserId) return;
       setWaterBusy(true); setWaterMsg(null);
       try {
           await markWateredOffChain(tree, sender);
           const now = Date.now();
           const iv = tree.watering?.mode === 'scheduled' ? tree.watering?.intervalDays : undefined;
           onUpdate?.({ watering: {
               ...(tree.watering || {}),
               overdue: false,
               lastWateredAt: Timestamp.fromMillis(now),
               ...(iv ? { nextDueAt: Timestamp.fromMillis(computeNextDueMillis(now, iv)) } : {}),
           } });
           setWaterMsg('Watered today 💧 — kept off the chain.');
       } catch (e: any) { setWaterMsg(e?.message || 'Could not mark watered.'); }
       setWaterBusy(false);
   };
   const handleWaterFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
       const file = e.target.files?.[0];
       e.target.value = '';
       if (!file || !currentUserId) return;
       setWaterBusy(true);
       try {
           setWaterMsg('Reading your photo…');
           const img = await fileToWebpBase64(file);
           setWaterMsg('The witness is looking…');
           const analysis = await analyzeWateringPhoto(img, tree);
           const auto = analysis.watering && (analysis.confidence || 0) >= 70;
           setWaterMsg(auto ? 'Confirmed by AI — recording 💧' : 'Recording — a guardian can confirm…');
           const { confirmedBy } = await recordWatering({ tree, sender, imageFile: file, analysis });
           const now = Date.now();
           const iv = tree.watering?.intervalDays;
           onUpdate?.({ watering: {
               ...(tree.watering || {}),
               overdue: false,
               lastWateredAt: Timestamp.fromMillis(now),
               ...(iv ? { nextDueAt: Timestamp.fromMillis(computeNextDueMillis(now, iv)) } : {}),
           } });
           loadChain();
           setWaterMsg(confirmedBy === 'ai'
               ? `Watered 💧 — confirmed by AI. ${analysis.note}`
               : `Watered 💧 — awaiting a guardian to confirm. ${analysis.note}`);
       } catch (e: any) { setWaterMsg(e?.message || 'Could not record the watering.'); }
       setWaterBusy(false);
   };

   const handleConfirmWatering = async (pulseId: string) => {
       if (!currentUserId) return;
       setConfirmingId(pulseId);
       try { await confirmWateringPulse(pulseId, currentUserId); loadChain(); }
       catch (e: any) { showAlert(e?.message || 'Could not confirm.'); }
       setConfirmingId(null);
   };

   const handleRemindGuardians = async () => {
       if (!currentUserId) return;
       setWaterBusy(true); setWaterMsg(null);
       try {
           const ok = await sendWateringAlert(tree, sender);
           setWaterMsg(ok ? 'The guardians have been asked to water 💧' : 'No guardians to notify yet — invite some to the circle.');
           if (ok) onUpdate?.({ watering: { ...(tree.watering || {}), overdue: true } });
       } catch (e: any) { setWaterMsg(e?.message || 'Could not send the reminder.'); }
       setWaterBusy(false);
   };

   // The stage's droplet: a potted seed shows the sprout story, the rest the plain drop.
   const stageEmoji = stage === 'potted' ? '🌱' : '💧';

   const WateringPanel = () => (
       <SectionCard title="Watering" icon={<Icons.Droplet />} className={overdue ? 'ring-2 ring-sky-300' : ''}>
           <div className="mb-4 text-sm text-sky-800/90">
               {selfSustaining ? (
                   <p>🌳 Self-sustaining — this tree needs no scheduled watering.</p>
               ) : scheduled ? (
                   overdue ? (
                       <p className="font-semibold text-sky-700">{stageEmoji} Thirsty — {overByDays > 0 ? `${overByDays} day${overByDays > 1 ? 's' : ''} overdue` : 'watering due today'}.</p>
                   ) : (
                       <p>{stageEmoji} {stage === 'potted' ? 'A seed in its pot — next' : 'Next'} watering in {dueInDays} day{dueInDays !== 1 ? 's' : ''}.</p>
                   )
               ) : (
                   <p>No watering schedule yet.</p>
               )}
               {lastWateredMs > 0 && <p className="mt-1 text-xs text-sky-700/70">Last watered {new Date(lastWateredMs).toLocaleDateString()}.</p>}
           </div>

           {canManageSchedule && (
               <div className="mb-4 space-y-3 rounded-xl border border-sky-200 bg-white p-4">
                   {/* The growth journey: pot → ground → self-sustaining. Pick where the tree is. */}
                   <div role="radiogroup" aria-label="Growth stage" className="grid grid-cols-3 gap-2">
                       {STAGE_META.map(s => (
                           <button
                               key={s.key}
                               type="button"
                               role="radio"
                               aria-checked={waterStage === s.key}
                               title={s.hint}
                               onClick={() => setWaterStage(s.key)}
                               className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center transition-all ${waterStage === s.key
                                   ? (s.key === 'self_sustaining' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-sky-500 bg-sky-50 text-sky-700')
                                   : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:text-slate-500'}`}
                           >
                               {s.icon}
                               <span className="text-[10px] font-bold uppercase tracking-wide leading-tight">{s.label}</span>
                           </button>
                       ))}
                   </div>
                   <p className="text-center text-xs text-slate-500">{STAGE_META.find(s => s.key === waterStage)?.hint}</p>
                   {waterStage !== 'self_sustaining' && (
                       <div className="flex items-center justify-center gap-2 text-sm text-sky-800">
                           <span>Water every</span>
                           <div className="inline-flex items-center overflow-hidden rounded-lg border border-sky-200">
                               <button type="button" aria-label="Fewer days" onClick={() => setWaterInterval(v => Math.max(1, v - 1))} className="px-3 py-1.5 font-bold text-sky-700 hover:bg-sky-50">−</button>
                               <span className="w-10 text-center font-bold tabular-nums">{waterInterval}</span>
                               <button type="button" aria-label="More days" onClick={() => setWaterInterval(v => Math.min(365, v + 1))} className="px-3 py-1.5 font-bold text-sky-700 hover:bg-sky-50">+</button>
                           </div>
                           <span>day{waterInterval !== 1 ? 's' : ''}</span>
                       </div>
                   )}
                   <button type="button" onClick={handleSaveSchedule} disabled={waterBusy} className="w-full rounded-lg bg-sky-600 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50">{waterBusy ? 'Saving…' : 'Save'}</button>
               </div>
           )}

           {canWater && (
               <div className="space-y-2">
                   <input ref={waterFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleWaterFile} />
                   <div className="flex flex-wrap items-center gap-2">
                       <button type="button" onClick={waterOnChain ? handleWaterPick : handleWaterBypass} disabled={waterBusy} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow transition-all hover:bg-sky-700 active:scale-95 disabled:opacity-50">
                           <Icons.Droplet /> <span>I Watered Today</span>
                       </button>
                       {isOwner && overdue && !wateringAlertedToday(tree) && (
                           <button type="button" onClick={handleRemindGuardians} disabled={waterBusy} className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-white px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-50">Remind guardians 💧</button>
                       )}
                   </div>
                   {/* Off-chain by default: routine waterings just tick the cadence. Opting in takes a
                       photo and mints a growth block on the tree's immutable chain. */}
                   <label className="flex cursor-pointer items-start gap-2 text-xs text-sky-700/80">
                       <input type="checkbox" checked={waterOnChain} onChange={e => setWaterOnChain(e.target.checked)} className="mt-0.5 accent-sky-600" />
                       <span>Add photo proof — mint a growth block on the tree's chain (for waterings worth remembering).</span>
                   </label>
               </div>
           )}

           {canWater && pendingWaterings.length > 0 && (
               <div className="mt-4 border-t border-sky-200 pt-3">
                   <p className="mb-2 text-xs font-bold uppercase tracking-wider text-sky-600">Awaiting confirmation</p>
                   <div className="space-y-2">
                       {pendingWaterings.map((p: any) => (
                           <div key={p.id} className="flex items-center gap-2 rounded-lg bg-white/70 p-2">
                               {p.imageUrl && <img src={p.imageUrl} className="h-10 w-10 rounded object-cover" alt="watering" />}
                               <span className="flex-1 truncate text-xs text-sky-800">{new Date(p.createdAt?.toMillis?.() || Date.now()).toLocaleDateString()} · {p.wateringConfirmation?.note || 'Watering'}</span>
                               <button type="button" onClick={() => handleConfirmWatering(p.id)} disabled={confirmingId === p.id} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50">{confirmingId === p.id ? '…' : 'Confirm'}</button>
                           </div>
                       ))}
                   </div>
               </div>
           )}

           {waterMsg && <p className="mt-3 text-xs text-sky-700">{waterMsg}</p>}
       </SectionCard>
   );

   // Collapse the middle of a long growth chain into one clickable line.
   const COLLAPSE_AT = 6, CHAIN_HEAD = 3, CHAIN_TAIL = 2;
   const chainCollapsible = growthBlocks.length > COLLAPSE_AT;
   const hiddenChainCount = chainCollapsible && !chainExpanded ? growthBlocks.length - CHAIN_HEAD - CHAIN_TAIL : 0;
   const COLLAPSED_MARKER = { _collapsed: true } as any;
   const visibleChain: any[] = (chainCollapsible && !chainExpanded)
       ? [...growthBlocks.slice(0, CHAIN_HEAD), COLLAPSED_MARKER, ...growthBlocks.slice(growthBlocks.length - CHAIN_TAIL)]
       : growthBlocks;

   // The profile menu: each entry is a card that reveals a section. Digital Tree first.
   const sections: { key: TreeSection; label: string; icon: React.ReactNode }[] = [
       { key: 'digital', label: 'Digital Tree', icon: <Icons.Tree /> },
       { key: 'details', label: t('tree_details'), icon: <Icons.Info /> },
       { key: 'guardians', label: 'Guardians', icon: <Icons.Shield /> },
       { key: 'care', label: 'Care', icon: <Icons.Droplet /> },
       { key: 'circle', label: 'Tree Circle', icon: <Icons.Venn /> },
   ];
   // The tree's avatar/banner image — its latest growth (or its planting image).
   const heroImg = tree.latestGrowthUrl || tree.imageUrl || '';
   const [shared, setShared] = useState(false);
   const handleShare = async () => {
       const url = `${window.location.origin}/?tree=${tree.id}`;
       try {
           if ((navigator as any).share) await (navigator as any).share({ title: tree.name, url });
           else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 1500); }
       } catch { /* user cancelled the share sheet */ }
   };
   // One uniform action button: icon + label on desktop, icon-only on mobile; coloured per action.
   const ActionBtn = ({ onClick, disabled, title, color, icon, label }: { onClick?: () => void; disabled?: boolean; title?: string; color: string; icon: React.ReactNode; label?: string }) => (
       <button type="button" onClick={onClick} disabled={disabled} title={title}
           className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold shadow-sm transition-colors disabled:opacity-50 ${color}`}>
           <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
           {label && <span className="hidden md:inline">{label}</span>}
       </button>
   );

    return (
        <>
        <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300">
            {/* Danger Banner — click to message this tree's guardians. */}
            {localStatus === 'DANGER' && (
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
            )}

            {/* Profile hero — a wide banner of the latest growth image with a circular avatar. */}
            <ProfileHero
                heroImageUrl={heroImg}
                imageClassName="opacity-70"
                alwaysOverlay
                overlayClassName="bg-gradient-to-b from-slate-900/45 via-slate-900/55 to-slate-900/85"
                maxWidth="max-w-5xl"
                padding="pt-5 pb-5 px-4"
            >
                    <div className="flex items-center gap-3 sm:gap-4">
                    {/* Back — left of the avatar; returns to wherever you came from. */}
                    <button onClick={onClose} title={t('back_forest')} className="shrink-0 rounded-full bg-white/15 p-2.5 text-white transition-colors hover:bg-white/25">
                        <Icons.ArrowLeft />
                    </button>
                    {/* Avatar — the latest growth image. */}
                    <div className="relative shrink-0">
                        {heroImg
                            ? <img src={heroImg} alt={tree.name} className="h-16 w-16 rounded-full border-4 border-white bg-white object-cover shadow-xl md:h-24 md:w-24" />
                            : <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-emerald-700 shadow-xl md:h-24 md:w-24"><Logo width={36} height={36} /></div>}
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
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <h1 dir="auto" className="break-words text-2xl font-light tracking-wide md:text-3xl">{tree.name}</h1>
                                    {isNature && <span className="inline-flex items-center gap-1 rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-bold"><Icons.Shield /> NATURE</span>}
                                    {tree.visibility && tree.visibility !== 'public' && <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{tree.visibility}</span>}
                                </div>
                                {tree.shortTitle && <p dir="auto" className="mt-0.5 text-xs font-bold uppercase tracking-widest text-emerald-200">{tree.shortTitle}</p>}
                                <div className="mt-1.5 flex items-center gap-2">
                                    <span dir="ltr" className="truncate font-mono text-xs text-slate-300" title={tree.id}>{tree.id}</span>
                                    <button onClick={handleShare} title="Share this tree" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white transition-colors hover:bg-white/25">
                                        <Icons.Link /> <span>{shared ? 'Copied' : 'Share'}</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                    </div>
                    {/* Actions — in the tree header; icon+label on desktop, icon-only on mobile; coloured. */}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <ActionBtn onClick={() => onPlayGrowth(tree.id)} title="Play growth" color="bg-emerald-600 text-white hover:bg-emerald-700" icon={<Icons.Play />} label="Play" />
                        {canReach
                            ? <ActionBtn onClick={() => onReachTree?.(tree)} title="Reach" color="bg-amber-500 text-white hover:bg-amber-600" icon={<Icons.Lightning />} label="Reach" />
                            : <ActionBtn disabled title={t('only_if_validated')} color="bg-white/20 text-white/70" icon={<Icons.Eye />} label={t('only_if_validated')} />}
                        {showValidateAction && <ActionBtn onClick={async () => { const nv = !hasValidationBadge; if (await showConfirm(nv ? 'Validate this tree?' : 'Remove validation from this tree?', { title: 'Validation' })) onValidate(tree.id, nv); }} title={hasValidationBadge ? 'Remove validation' : t('validate_action')} color="bg-emerald-600 text-white hover:bg-emerald-700" icon={<Icons.ShieldCheck />} label={hasValidationBadge ? 'Validated' : t('validate_action')} />}
                        {isOwner && !isEditing && <ActionBtn onClick={onCreatePulse} title="Tend this tree — a pulse of care (we both grow)" color="bg-white text-emerald-700 hover:bg-emerald-50" icon={<Icons.HandLeaf />} label="Tend" />}
                        {isOwner && !isEditing && onSetDefault && <ActionBtn onClick={() => { if (!isDefaultTree) onSetDefault(); }} disabled={isDefaultTree} title={isDefaultTree ? 'Your default tree' : 'Set as default tree'} color={isDefaultTree ? 'bg-amber-400 text-amber-950' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'} icon={<Icons.Star filled={isDefaultTree} />} label="Favourite" />}
                        {canEdit && !isEditing && <ActionBtn onClick={() => { setIsEditing(true); setSection('details'); }} title={t('edit')} color="bg-slate-100 text-slate-700 hover:bg-slate-200" icon={<Icons.Pencil />} label={t('edit')} />}
                        {canDelete && !isEditing && <ActionBtn onClick={() => setShowDeleteModal(true)} title="Delete tree" color="bg-red-500 text-white hover:bg-red-600" icon={<Icons.Trash />} label="Delete" />}
                    </div>
            </ProfileHero>

            {/* Body — section menu on the left (desktop), a strip on mobile; profile-style. */}
            <ProfileLayout
                maxWidth="max-w-5xl"
                overlap={false}
                asideClassName="rounded-2xl border border-slate-100 bg-white p-2 shadow-sm lg:sticky lg:top-24"
                mainClassName="min-w-0 space-y-6"
                menu={<SectionMenu items={sections} active={section} onSelect={(k) => setSection(k as TreeSection)} />}
            >

                {section === 'details' && (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                                <Icons.Eye />
                                <span className="ml-2">{t('vision')}</span>
                            </h3>
                            {isEditing ? (
                                <textarea 
                                    dir="auto"
                                    className="w-full h-40 border border-slate-300 rounded p-2 text-lg font-serif italic text-slate-700 leading-relaxed focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={editBody}
                                    onChange={(e) => setEditBody(e.target.value)}
                                />
                            ) : (
                                <p dir="auto" className="text-lg font-serif italic text-slate-700 leading-relaxed">
                                    "{tree.body}"
                                </p>
                            )}
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{t('tree_details')}</h3>
                            
                            <div className="flex items-start gap-4 py-2 border-b border-slate-50">
                                <span className="w-24 shrink-0 text-slate-500 text-sm">{t('steward')}</span>
                                <span dir="ltr" className="flex-1 text-left text-slate-800 font-mono text-sm">{isNature ? "Nature (System)" : tree.ownerId.substring(0, 10) + "..."}</span>
                            </div>
                            <div className="flex items-center gap-4 py-2 border-b border-slate-50">
                                <span className="w-24 shrink-0 text-slate-500 text-sm">{t('location')}</span>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        className={fieldClassName}
                                        value={editLocationName}
                                        onChange={e => setEditLocationName(e.target.value)}
                                        placeholder="Location name"
                                    />
                                ) : (
                                    <span dir="auto" className="flex-1 text-left text-slate-800 font-mono text-sm">{tree.locationName}</span>
                                )}
                            </div>
                            <div className="py-2 border-b border-slate-50">
                                <div className="flex items-start gap-4">
                                <span className="w-24 shrink-0 pt-2 text-slate-500 text-sm">GPS</span>
                                {isEditing ? (
                                    <div className="flex w-full max-w-sm space-x-2 items-center">
                                        <div className="flex-1 flex space-x-2">
                                            <input 
                                                type="number" step="any"
                                                className={fieldClassName}
                                                value={editLat} 
                                                onChange={e => setEditLat(e.target.value)}
                                                placeholder="Lat"
                                            />
                                            <input 
                                                type="number" step="any"
                                                className={fieldClassName}
                                                value={editLng} 
                                                onChange={e => setEditLng(e.target.value)}
                                                placeholder="Lng"
                                            />
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={handleLocateMe} 
                                            disabled={isLocating}
                                            className="bg-emerald-100 text-emerald-600 p-2 rounded hover:bg-emerald-200 disabled:opacity-50"
                                            title="Use My Location"
                                        >
                                            {isLocating ? <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div> : <Icons.Loc />}
                                        </button>
                                    </div>
                                ) : (
                                    <span className="flex-1 pt-2 text-left text-slate-800 font-mono text-sm">{tree.latitude?.toFixed(4)}, {tree.longitude?.toFixed(4)}</span>
                                )}
                                </div>
                            </div>
                            <div className="flex items-center gap-4 py-2 border-b border-slate-50">
                                <span className="w-24 shrink-0 text-slate-500 text-sm">Planted</span>
                                {isEditing ? (
                                    <input
                                        type="datetime-local"
                                        className={fieldClassName}
                                        value={editCreatedAt}
                                        onChange={e => setEditCreatedAt(e.target.value)}
                                    />
                                ) : (
                                    <span className="flex-1 text-left text-slate-800 font-mono text-sm">
                                        {tree.createdAt?.toDate ? tree.createdAt.toDate().toLocaleString() : '—'}
                                    </span>
                                )}
                            </div>
                             <div className="flex items-start gap-4 py-2">
                                <span className="w-24 shrink-0 text-slate-500 text-sm">Validator</span>
                                <span className="flex-1 text-left text-slate-800 font-mono text-sm">
                                    {isNature ? 'Nature' : hasValidationBadge && tree.validatorId ? `${tree.validatorId.substring(0, 8)}...` : t('unvalidated')}
                                </span>
                            </div>
                             <div className="flex items-center gap-4 py-2">
                                <span className="w-24 shrink-0 text-slate-500 text-sm">Website</span>
                                {isEditing ? (
                                    <AutocompleteInput
                                        label="Community Hub"
                                        value={editDomain}
                                        onChange={setEditDomain}
                                        placeholder="e.g. mycommunity.com"
                                        className={fieldClassName}
                                    />
                                ) : (
                                    tree.domain
                                        ? <a href={`https://${tree.domain}`} target="_blank" rel="noreferrer" className="flex-1 text-left text-emerald-600 text-sm hover:underline font-mono">{tree.domain}</a>
                                        : <span className="flex-1 text-left text-slate-400 text-sm">—</span>
                                )}
                            </div>
                            <div className="flex items-center gap-4 py-2 border-t border-slate-50">
                                <span className="w-24 shrink-0 text-slate-500 text-sm">{t('visibility')}</span>
                                {isEditing && canEdit ? (
                                    <select value={editVisibility} onChange={e => setEditVisibility(e.target.value as 'public' | 'node' | 'private')} className={fieldClassName}>
                                        <option value="public">{t('vis_public')}</option>
                                        <option value="node">{t('vis_node')}</option>
                                        <option value="private">{t('vis_private')}</option>
                                    </select>
                                ) : (
                                    <span className="flex-1 text-left text-slate-800 text-sm capitalize">{tree.visibility || 'public'}</span>
                                )}
                            </div>

                            {isEditing && (
                                <div className="flex space-x-2 mt-4 pt-4 border-t border-slate-100">
                                    <button onClick={handleSave} disabled={isSaving} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-emerald-700">
                                        {isSaving ? "Saving..." : "Save Changes"}
                                    </button>
                                    <button onClick={() => {
                                        setIsEditing(false);
                                        setEditName(tree.name);
                                        setEditShortTitle(tree.shortTitle || '');
                                        setEditBody(tree.body);
                                        setEditLat(tree.latitude);
                                        setEditLng(tree.longitude);
                                        setEditLocationName(tree.locationName || '');
                                        setEditDomain(tree.domain || '');
                                        if (tree.createdAt) {
                                            const d = tree.createdAt.toDate ? tree.createdAt.toDate() : new Date(tree.createdAt);
                                            setEditCreatedAt(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
                                        }
                                    }} disabled={isSaving} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-bold hover:bg-slate-300">
                                        Cancel
                                    </button>
                                </div>
                            )}
                            {isEditing && canDelete && (
                                <button type="button" onClick={() => setShowDeleteModal(true)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-100">
                                    <Icons.Trash />
                                    <span>Delete this Lifetree</span>
                                </button>
                            )}
                        </div>

                        {hasCoordinates && (
                            <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                                <div className="mb-2 flex items-center justify-between">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Map</h4>
                                    {tree.locationName && <span dir="auto" className="text-xs text-emerald-700">{tree.locationName}</span>}
                                </div>
                                <div className="overflow-hidden rounded-xl border border-slate-200">
                                    <iframe
                                        title={`Map of ${tree.name}`}
                                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(tree.longitude) - 0.01}%2C${Number(tree.latitude) - 0.01}%2C${Number(tree.longitude) + 0.01}%2C${Number(tree.latitude) + 0.01}&layer=mapnik&marker=${Number(tree.latitude)}%2C${Number(tree.longitude)}`}
                                        className="h-40 w-full"
                                        loading="lazy"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* The panels are render helpers, CALLED (not mounted as <Panel />): their function
                    identity changes every render, and as JSX component types React would unmount
                    and remount the whole subtree on each keystroke — dropping focus mid-form. */}
                {section === 'guardians' && GuardianshipPanel()}

                {section === 'care' && (
                    (isOwner || isTender || isAdmin || isSuperAdmin)
                        ? WateringPanel()
                        : <p className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-sm text-slate-400">Only the tree's circle can tend its care.</p>
                )}

                {section === 'circle' && TreeCirclePanel()}

                {/* Digital Tree — the immutable growth chain (collapsible). */}
                {section === 'digital' && loadingChain && (
                    <p className="py-10 text-center text-sm text-slate-400">Growing the digital tree…</p>
                )}
                {section === 'digital' && !loadingChain && (
                    <div className="rounded-2xl bg-slate-900 p-5 text-slate-200 shadow-sm md:p-8">
                        {chainCollapsible && (
                            <div className="mb-4 flex justify-center">
                                <button onClick={() => setChainExpanded(e => !e)} className="text-xs font-bold text-emerald-300 hover:text-emerald-200">
                                    {chainExpanded ? 'Collapse the middle' : `Expand all ${growthBlocks.length} pulses`}
                                </button>
                            </div>
                        )}

                        <div className="relative flex flex-col items-start md:items-center">
                            {/* Central Tree Trunk — a rounded cylinder with vertical bark grain. */}
                            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-4 md:w-8 -ml-2 md:-ml-4 rounded-t-full rounded-b-2xl shadow-inner overflow-hidden z-0"
                                 style={{ background: 'linear-gradient(90deg, #3E2723 0%, #6D4C41 45%, #8D6E63 55%, #4E342E 100%)' }}>
                                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 5px)' }}></div>
                            </div>

                            <div className="w-full space-y-12 md:space-y-24 pb-24 relative z-10">
                                {/* Tend CTA — the crown at the top of the trunk. We don't grow it; it grows
                                    naturally. Tending (our breath, our presence) is the care that lets it. */}
                                {isOwner && (
                                    <div className="flex w-full justify-start pl-12 md:justify-center md:pl-0">
                                        <button onClick={onCreatePulse} title="Tend this tree — a pulse of care (we both grow)"
                                            className="relative z-10 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-7 py-3 font-bold uppercase tracking-widest text-white ring-2 ring-yellow-300/60 shadow-[0_0_22px_rgba(250,204,21,0.55)] transition-all hover:bg-emerald-700 hover:shadow-[0_0_32px_rgba(250,204,21,0.85)] active:scale-95">
                                            <Icons.HandLeaf /> <span>Tend</span>
                                        </button>
                                    </div>
                                )}
                                {visibleChain.map((pulse, index) => {
                                    // The collapsed middle renders as one clickable horizontal line.
                                    if ((pulse as any)._collapsed) {
                                        return (
                                            <div key="chain-collapsed" className="flex w-full justify-start pl-12 md:justify-center md:pl-0">
                                                <button onClick={() => setChainExpanded(true)}
                                                    className="relative z-10 flex w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-emerald-300 bg-emerald-50/80 py-2.5 text-xs font-bold text-emerald-700 backdrop-blur-sm transition-colors hover:bg-emerald-100 md:max-w-md">
                                                    <Icons.List />
                                                    <span>{hiddenChainCount} more pulse{hiddenChainCount !== 1 ? 's' : ''} hidden — tap to expand</span>
                                                </button>
                                            </div>
                                        );
                                    }
                                    // Visual positioning logic:
                                    // index 0, 2, 4 (Even) -> Right Side (Desktop)
                                    // index 1, 3, 5 (Odd) -> Left Side (Desktop)
                                    const isRightSide = index % 2 === 0;
                                    const pulseImages = pulse.imageUrls?.length ? pulse.imageUrls : (pulse.imageUrl ? [pulse.imageUrl] : []);
                                    const pulseBadge = pulse.type === 'event' ? 'EVENT' : pulse.type === 'tree_growth' ? 'GROWTH' : 'PULSE';
                                    
                                    return (
                                        <div key={pulse.id} className={`flex w-full relative ${isRightSide ? 'md:justify-end' : 'md:justify-start'} justify-start`}>
                                            
                                            {/* Container Wrapper */}
                                            {/* Mobile: Padded left to avoid trunk. Desktop: Half width. */}
                                            <div className={`
                                                w-full md:w-1/2 relative flex items-center
                                                pl-12 md:pl-0
                                                ${isRightSide ? 'md:pl-16' : 'md:pr-16 md:flex-row-reverse'}
                                            `}>
                                                
                                                {/* Mobile Branch (Always Left Trunk to Card) */}
                                                <svg className="md:hidden absolute top-1/2 -mt-6 left-[1.15rem] w-12 h-12 text-[#5D4037] pointer-events-none z-0" viewBox="0 0 50 50" preserveAspectRatio="none">
                                                    {/* Curve from left (trunk) to right (card) */}
                                                    <path d="M0,25 Q25,25 50,25" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" />
                                                </svg>

                                                {/* Desktop Branch */}
                                                <svg className={`hidden md:block absolute top-1/2 -mt-4 w-20 h-12 text-[#5D4037] pointer-events-none z-0 ${isRightSide ? 'left-0 -ml-2' : 'right-0 -mr-2'}`} viewBox="0 0 80 40" preserveAspectRatio="none">
                                                    {isRightSide ? (
                                                        // From Left (Trunk) to Right (Card)
                                                        <path d="M0,20 C40,20 40,20 80,20" stroke="currentColor" strokeWidth="8" fill="none" strokeLinecap="round" />
                                                    ) : (
                                                        // From Right (Trunk) to Left (Card)
                                                        <path d="M80,20 C40,20 40,20 0,20" stroke="currentColor" strokeWidth="8" fill="none" strokeLinecap="round" />
                                                    )}
                                                </svg>

                                                {/* Leaf Card */}
                                                <div 
                                                    onClick={() => onViewPulse(pulse)}
                                                    className={`
                                                        relative bg-white border-2 border-emerald-100 shadow-md shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-500/30 hover:border-emerald-300
                                                        transition-all cursor-pointer group w-full md:max-w-sm rounded-xl
                                                        ${isRightSide 
                                                            ? 'md:rounded-tl-[0] md:rounded-bl-[3rem] md:rounded-tr-[2rem] md:rounded-br-[2rem] md:text-left' 
                                                            : 'md:rounded-tr-[0] md:rounded-br-[3rem] md:rounded-tl-[2rem] md:rounded-bl-[2rem] md:text-right'}
                                                        text-left z-10
                                                    `}
                                                >
                                                    {/* Decorative Vein SVG */}
                                                    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-5 text-emerald-500" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                        <path d={isRightSide ? "M0,50 Q50,25 100,0" : "M100,50 Q50,25 0,0"} stroke="currentColor" strokeWidth="1" fill="none" />
                                                    </svg>

                                                    <div className="p-4 md:p-6 relative z-10">
                                                        <div className={`flex items-center gap-2 mb-3 ${isRightSide ? '' : 'md:flex-row-reverse'} flex-row`}>
                                                            {pulseBadge === 'GROWTH' ? (
                                                                <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold">GROWTH</span>
                                                            ) : pulseBadge === 'EVENT' ? (
                                                                <span className="bg-sky-100 text-sky-700 text-[10px] px-2 py-0.5 rounded-full font-bold">EVENT</span>
                                                            ) : (
                                                                <span className="bg-sky-100 text-sky-700 text-[10px] px-2 py-0.5 rounded-full font-bold">PULSE</span>
                                                            )}
                                                            {(pulse as any).care === 'watering' && (
                                                                <span className="bg-sky-100 text-sky-700 text-[10px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1" title={(pulse as any).wateringConfirmation?.note || ''}>💧 {typeof (pulse as any).wateringConfirmation?.confidence === 'number' ? `${(pulse as any).wateringConfirmation.confidence}%` : ''}{(pulse as any).wateringConfirmedBy === 'guardian' ? ' ✓' : ''}</span>
                                                            )}
                                                            <span className="text-xs text-slate-400 font-mono">{new Date(pulse.createdAt?.toMillis()).toLocaleDateString()}</span>
                                                        </div>

                                                        <div className={`flex gap-4 ${isRightSide ? '' : 'md:flex-row-reverse'} flex-row items-start`}>
                                                            {pulseImages.length > 0 && (
                                                                <div className="relative shrink-0">
                                                                    <img src={pulseImages[0]} className="w-16 h-16 rounded-lg object-cover bg-slate-50 border border-slate-100" />
                                                                    {pulseImages.length > 1 && (
                                                                        <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-600 shadow">{pulseImages.length}</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            <div>
                                                                <h4 dir="auto" className="font-bold text-slate-800 text-base md:text-lg leading-tight mb-1 md:mb-2">{pulse.title}</h4>
                                                                <p dir="auto" className="text-xs text-slate-500 line-clamp-3">{pulse.body}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className={`mt-4 pt-2 border-t border-slate-50 text-[9px] font-mono text-slate-300 truncate ${isRightSide ? 'md:text-left' : 'md:text-right'} text-left`}>
                                                            Hash: {pulse.hash.substring(0, 16)}...
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Genesis / planting card — the ROOT of the chain. Always shown,
                                    drawn from the tree itself (normal trees have no genesis pulse). */}
                                {tree && (
                                    <div className="flex w-full justify-start md:justify-center pt-8 md:pt-12 relative pl-12 md:pl-0">
                                         {/* Root Connection SVG */}
                                         <svg className="md:hidden absolute top-0 left-[1.15rem] w-8 h-12 text-[#5D4037] pointer-events-none z-0" viewBox="0 0 20 40" preserveAspectRatio="none">
                                             <path d="M0,0 L0,40" stroke="currentColor" strokeWidth="6" />
                                         </svg>
                                         
                                         {/* The base is the PLANTING card: the genesis block (root) carrying the vision. */}
                                         <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border-4 border-[#3E2723] bg-[#5D4037] text-amber-100 shadow-xl ring-4 ring-emerald-600/25 md:w-auto">
                                             {tree.imageUrl && (
                                                 <div className="relative h-40 w-full">
                                                     <img src={tree.imageUrl} alt={tree.name} className="h-full w-full object-cover opacity-90" />
                                                     <div className="absolute inset-0 bg-gradient-to-t from-[#5D4037] via-[#5D4037]/40 to-transparent" />
                                                     <span className="absolute left-3 top-3 rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] font-bold text-amber-900 shadow">🌱 PLANTING</span>
                                                 </div>
                                             )}
                                             <div className="p-6 text-center">
                                                 <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/30 bg-amber-900/50 text-amber-200">
                                                     <Logo width={22} height={22} />
                                                 </div>
                                                 <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-200">Root · Planted · Genesis</h4>
                                                 {tree.body && <p dir="auto" className="mx-auto mb-2 max-w-xs text-sm italic leading-relaxed text-amber-50/90">"{tree.body}"</p>}
                                                 <p className="text-[11px] text-amber-200/70">
                                                     {tree.createdAt?.toDate ? tree.createdAt.toDate().toLocaleDateString() : (tree.createdAt ? new Date(tree.createdAt?.toMillis?.() ?? tree.createdAt).toLocaleDateString() : '')}
                                                     {tree.locationName ? ` · ${tree.locationName}` : ''}
                                                 </p>
                                                 <p className="mt-3 break-all px-2 font-mono text-[10px] text-amber-100/50">{genesisBlock?.hash || tree.genesisHash}</p>
                                             </div>
                                         </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Immutable chain stats — the root-to-latest ledger, at the foot of the chain. */}
                        <div className="relative mt-4 overflow-hidden rounded-2xl bg-slate-900 p-6 font-mono text-xs text-slate-300 shadow-inner">
                            <div className="absolute top-0 right-0 p-4 opacity-10"><Logo width={100} height={100} /></div>
                            <h3 className="mb-6 flex items-center font-bold uppercase tracking-wider text-emerald-400">
                                <Icons.Hash /><span className="ml-2">Immutable Chain</span>
                            </h3>
                            <div className="relative z-10 grid gap-4 sm:grid-cols-3">
                                <div>
                                    <p className="mb-1 text-[10px] uppercase text-slate-500">Block Height</p>
                                    <p className="text-2xl text-white">{tree.blockHeight}</p>
                                </div>
                                <div className="break-all">
                                    <p className="mb-1 text-[10px] uppercase text-slate-500">{t('genesis')} · root</p>
                                    <p className="text-emerald-500/80" dir="ltr">{tree.genesisHash}</p>
                                </div>
                                <div className="break-all">
                                    <p className="mb-1 text-[10px] uppercase text-slate-500">{t('latest_hash')}</p>
                                    <p className="text-emerald-300" dir="ltr">{tree.latestHash}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </ProfileLayout>
        </div>

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
