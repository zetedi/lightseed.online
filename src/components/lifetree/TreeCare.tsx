import React, { useState, useEffect, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { showAlert } from '../ui/Dialog';
import { Icons } from '../ui/Icons';
import { setWateringSchedule, recordWatering, markWateredOffChain, confirmWateringPulse, sendWateringAlert, fileToWebpBase64 } from '../../services/firebase';
import { analyzeWateringPhoto } from '../../services/gemini';
import { Pulse, type Lifetree } from '../../types';
import { isOnWateringSchedule, isWateringOverdue, daysUntilWatering, daysOverdue, lastWateredMillis, wateringAlertedToday, treeStage, computeNextDueMillis, type TreeStage } from '../../domain/watering';
import { SectionCard } from '../ui/SectionCard';

// The three growth stages, in growing order — a seed in its pot, in the ground but still
// tended, and finally self-sustaining. The first two are watered on a schedule.
const STAGE_META: { key: TreeStage; label: string; hint: string; icon: React.ReactNode }[] = [
    { key: 'potted', label: 'Seed in a pot', hint: 'A seed growing in its pot — the most fragile stage.', icon: <Icons.Pot /> },
    { key: 'planted', label: 'In the ground', hint: 'Planted out, but still needs regular care.', icon: <Icons.Sprout /> },
    { key: 'self_sustaining', label: 'Self-sustaining', hint: 'Established — no scheduled watering.', icon: <Icons.Tree /> },
];

// The tree's or the thrown error's message, falling back when there is none.
const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

interface TreeCareProps {
    tree: Lifetree;
    // The tree's growth blocks (newest first) — pending waterings are read from these; the
    // chain itself is loaded (and refreshed) by the shell, shared with the Digital Tree.
    growthBlocks: Pulse[];
    currentUserId?: string;
    currentUserName?: string | null;
    currentUserPhoto?: string | null;
    isOwner: boolean;
    canWater: boolean;
    canManageSchedule: boolean;
    onUpdate?: (updates: Partial<Lifetree>) => void;
    // Reload the shell's chain after a watering minted (or confirmed) a growth block.
    onChainRefresh: () => void;
}

// Care section — watering: scheduled tending of this (guarded) tree, keyed to its growth stage.
export const TreeCare: React.FC<TreeCareProps> = ({
    tree,
    growthBlocks,
    currentUserId,
    currentUserName,
    currentUserPhoto,
    isOwner,
    canWater,
    canManageSchedule,
    onUpdate,
    onChainRefresh,
}) => {
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
        // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the reused panel instance when the tree changes (useState initialisers only run on mount)
        setWaterMsg(null);
        setWaterOnChain(false);
    }, [tree.id]);
    // Re-seed the schedule editor whenever the watering data itself changes — including a remote
    // edit by another tender — so Save never silently reverts someone else's schedule.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- prop→state re-seed of the schedule editor when watering data changes remotely; deriving would clobber in-flight edits
        setWaterStage(treeStage(tree));
        setWaterInterval(tree.watering?.intervalDays || 7);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed to identity + watering data on purpose; `tree` itself is a fresh object every parent render and would re-seed (and clobber) the editor mid-edit.
    }, [tree.id, tree.watering]);

    const sender = { uid: currentUserId as string, displayName: currentUserName, photoURL: currentUserPhoto };
    const scheduled = isOnWateringSchedule(tree);
    const stage = treeStage(tree);
    const selfSustaining = stage === 'self_sustaining';
    const overdue = isWateringOverdue(tree);
    const dueInDays = daysUntilWatering(tree);
    const overByDays = daysOverdue(tree);
    const lastWateredMs = tree.watering?.lastWateredAt ? lastWateredMillis(tree) : 0;
    const pendingWaterings = growthBlocks.filter((p: Pulse) => p.care === 'watering' && p.wateringConfirmedBy === 'pending');

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
        } catch (e) { setWaterMsg(errMsg(e, 'Could not save the schedule.')); }
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
        } catch (e) { setWaterMsg(errMsg(e, 'Could not mark watered.')); }
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
            onChainRefresh();
            setWaterMsg(confirmedBy === 'ai'
                ? `Watered 💧 — confirmed by AI. ${analysis.note}`
                : `Watered 💧 — awaiting a guardian to confirm. ${analysis.note}`);
        } catch (e) { setWaterMsg(errMsg(e, 'Could not record the watering.')); }
        setWaterBusy(false);
    };

    const handleConfirmWatering = async (pulseId: string) => {
        if (!currentUserId) return;
        setConfirmingId(pulseId);
        try { await confirmWateringPulse(pulseId, currentUserId); onChainRefresh(); }
        catch (e) { showAlert(errMsg(e, 'Could not confirm.')); }
        setConfirmingId(null);
    };

    const handleRemindGuardians = async () => {
        if (!currentUserId) return;
        setWaterBusy(true); setWaterMsg(null);
        try {
            const ok = await sendWateringAlert(tree, sender);
            setWaterMsg(ok ? 'The guardians have been asked to water 💧' : 'No guardians to notify yet — invite some to the circle.');
            if (ok) onUpdate?.({ watering: { ...(tree.watering || {}), overdue: true } });
        } catch (e) { setWaterMsg(errMsg(e, 'Could not send the reminder.')); }
        setWaterBusy(false);
    };

    // The stage's droplet: a potted seed shows the sprout story, the rest the plain drop.
    const stageEmoji = stage === 'potted' ? '🌱' : '💧';

    return (
        <SectionCard title="Watering" icon={<Icons.Droplet />} className={overdue ? 'ring-2 ring-sky-300' : ''}>
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="text-sm text-sky-800/90">
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
                {/* The primary action sits right beside the status — water this tree now. */}
                {canWater && !selfSustaining && (
                    <button type="button" onClick={waterOnChain ? handleWaterPick : handleWaterBypass} disabled={waterBusy} className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow transition-all hover:bg-sky-700 active:scale-95 disabled:opacity-50">
                        <Icons.Droplet /> <span className="whitespace-nowrap">I Watered Today</span>
                    </button>
                )}
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
                    <button type="button" onClick={handleSaveSchedule} disabled={waterBusy} className="ml-auto block rounded-lg bg-sky-600 px-8 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50">{waterBusy ? 'Saving…' : 'Save'}</button>
                </div>
            )}

            {canWater && (
                <div className="space-y-2">
                    <input ref={waterFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleWaterFile} />
                    <div className="flex flex-wrap items-center gap-3">
                        {/* The water action moved up beside the status; its options stay here —
                            off-chain by default; opting in takes a photo + mints a growth block. */}
                        <label className="flex cursor-pointer items-center gap-2 text-xs leading-tight text-sky-700/80" title="For waterings worth remembering.">
                            <input type="checkbox" checked={waterOnChain} onChange={e => setWaterOnChain(e.target.checked)} className="accent-sky-600" />
                            <span>
                                <span className="block">Add photo proof —</span>
                                <span className="block">mint a growth block on the tree's chain.</span>
                            </span>
                        </label>
                        {isOwner && overdue && !wateringAlertedToday(tree) && (
                            <button type="button" onClick={handleRemindGuardians} disabled={waterBusy} className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-white px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-50">Remind guardians 💧</button>
                        )}
                    </div>
                </div>
            )}

            {canWater && pendingWaterings.length > 0 && (
                <div className="mt-4 border-t border-sky-200 pt-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-sky-600">Awaiting confirmation</p>
                    <div className="space-y-2">
                        {pendingWaterings.map((p: Pulse) => (
                            <div key={p.id} className="flex items-center gap-2 rounded-lg bg-white/70 p-2">
                                {p.imageUrl && <img src={p.imageUrl} className="h-10 w-10 rounded object-cover" alt="watering" />}
                                {/* eslint-disable-next-line react-hooks/purity -- Date.now() is only the display fallback for a block still missing its server timestamp; it intentionally reads as "today" */}
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
};
