import React, { useState, useEffect, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Icons } from '../ui/Icons';
import { setWateringSchedule, recordWatering, markWateredOffChain, sendWateringAlert, requestStewardship, fileToWebpBase64 } from '../../services/firebase';
import { analyzeWateringPhoto } from '../../services/gemini';
import { Pulse, type Lifetree } from '../../types';
import { isOnWateringSchedule, isWateringOverdue, daysUntilWatering, daysOverdue, lastWateredMillis, wateringAlertedToday, treeStage, computeNextDueMillis, type TreeStage } from '../../domain/watering';
import { SectionCard } from '../ui/SectionCard';
import { useLanguage } from '../../contexts/LanguageContext';
import { speak, spokenLine } from '../../utils/translations';
import { WitnessWaterings, awaitingWitness } from './WitnessWaterings';

// The three growth stages, in growing order — a seed in its pot, in the ground but still
// caredFor, and finally self-sustaining. The first two are watered on a schedule. The words are
// KEYS: this table lives at module scope, where no hook speaks, so the view says them with t().
const STAGE_META: { key: TreeStage; labelKey: 'stage_potted' | 'stage_planted' | 'stage_self'; hintKey: 'stage_potted_hint' | 'stage_planted_hint' | 'stage_self_hint'; icon: React.ReactNode }[] = [
    { key: 'potted', labelKey: 'stage_potted', hintKey: 'stage_potted_hint', icon: <Icons.Pot /> },
    { key: 'planted', labelKey: 'stage_planted', hintKey: 'stage_planted_hint', icon: <Icons.Sprout /> },
    { key: 'self_sustaining', labelKey: 'stage_self', hintKey: 'stage_self_hint', icon: <Icons.Tree /> },
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
    // A guardian without caring powers: the card reads as the schedule's read-only face,
    // plus a door to ask the circle for stewardship (roles move only by invitation).
    canAskStewardship?: boolean;
    // The viewer stands in the circle (keeper / co-owner / steward / guardian) and may witness
    // another's watering — the sun ring's mint, judged on server ground.
    canWitness?: boolean;
    onUpdate?: (updates: Partial<Lifetree>) => void;
    // Reload the shell's chain after a watering minted (or confirmed) a growth block.
    onChainRefresh: () => void;
}

// Care section — watering: scheduled caring of this (guarded) tree, keyed to its growth stage.
export const TreeCare: React.FC<TreeCareProps> = ({
    tree,
    growthBlocks,
    currentUserId,
    currentUserName,
    currentUserPhoto,
    isOwner,
    canWater,
    canManageSchedule,
    canAskStewardship,
    canWitness = false,
    onUpdate,
    onChainRefresh,
}) => {
    const { t } = useLanguage();
    const [waterStage, setWaterStage] = useState<TreeStage>(treeStage(tree));
    const [waterInterval, setWaterInterval] = useState<number>(tree.watering?.intervalDays || 7);
    const [waterBusy, setWaterBusy] = useState(false);
    const [waterMsg, setWaterMsg] = useState<string | null>(null);
    // On-chain watering is the opt-in: a photo mints a growth block. The default just ticks the
    // cadence off-chain — a photo at every routine watering would flood the chain with images.
    const [waterOnChain, setWaterOnChain] = useState(false);
    const waterFileRef = useRef<HTMLInputElement>(null);
    // The component instance is reused across trees, so reset the panel when the tree changes
    // (useState initialisers only run on mount).
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the reused panel instance when the tree changes (useState initialisers only run on mount)
        setWaterMsg(null);
        setWaterOnChain(false);
    }, [tree.id]);
    // Re-seed the schedule editor whenever the watering data itself changes — including a remote
    // edit by another carer — so Save never silently reverts someone else's schedule.
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
    // WHO watered last, so a co-carer reads the fact and not only the date: the stored name,
    // or "you" when it was this viewer's own hand.
    const lastWateredByName = tree.watering?.lastWateredBy
        ? (tree.watering.lastWateredBy === currentUserId ? t('you') : (tree.watering.lastWateredByName || ''))
        : '';
    const lastWateredLine = lastWateredMs > 0
        ? speak(spokenLine(lastWateredByName ? 'last_watered_by' : 'last_watered',
            { date: new Date(lastWateredMs).toLocaleDateString(), name: lastWateredByName }))
        : '';
    const pendingWaterings = awaitingWitness(growthBlocks);

    const handleSaveSchedule = async () => {
        setWaterBusy(true); setWaterMsg(null);
        try {
            // Mirror exactly what was written — the service builds (and returns) the schedule.
            const watering = await setWateringSchedule(tree.id, { stage: waterStage, intervalDays: waterInterval, prev: tree.watering });
            onUpdate?.({ watering });
            const iv = watering.intervalDays || 0;
            setWaterMsg(waterStage === 'self_sustaining'
                ? t('water_marked_self')
                : t('water_schedule_set')
                    .replace('{stage}', t(waterStage === 'potted' ? 'stage_potted' : 'stage_planted'))
                    .replace('{n}', String(iv)));
        } catch (e) { setWaterMsg(errMsg(e, 'err_schedule_save')); }
        setWaterBusy(false);
    };

    const handleWaterPick = () => waterFileRef.current?.click();

    // Off-chain watering (the default): reset the cadence + caring clock, no photo / no growth block.
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
                lastWateredBy: currentUserId,
                lastWateredByName: currentUserName || '',
                ...(iv ? { nextDueAt: Timestamp.fromMillis(computeNextDueMillis(now, iv)) } : {}),
            } });
            setWaterMsg(t('watered_offchain'));
        } catch (e) { setWaterMsg(errMsg(e, 'err_watered_mark')); }
        setWaterBusy(false);
    };
    const handleWaterFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !currentUserId) return;
        setWaterBusy(true);
        try {
            setWaterMsg(t('water_reading_photo'));
            const img = await fileToWebpBase64(file);
            setWaterMsg(t('water_witness_looking'));
            const analysis = await analyzeWateringPhoto(img, tree);
            const auto = analysis.watering && (analysis.confidence || 0) >= 70;
            setWaterMsg(auto ? t('water_confirmed_ai') : t('water_recording'));
            const { confirmedBy } = await recordWatering({ tree, sender, imageFile: file, analysis });
            const now = Date.now();
            const iv = tree.watering?.intervalDays;
            onUpdate?.({ watering: {
                ...(tree.watering || {}),
                overdue: false,
                lastWateredAt: Timestamp.fromMillis(now),
                lastWateredBy: currentUserId,
                lastWateredByName: currentUserName || '',
                ...(iv ? { nextDueAt: Timestamp.fromMillis(computeNextDueMillis(now, iv)) } : {}),
            } });
            onChainRefresh();
            setWaterMsg(t(confirmedBy === 'ai' ? 'water_done_ai' : 'water_done_awaiting')
                .replace('{note}', analysis.note || ''));
        } catch (e) { setWaterMsg(errMsg(e, 'err_watering_record')); }
        setWaterBusy(false);
    };

    // The guardian's knock: a message into the guardians thread asking for stewardship.
    const handleAskStewardship = async () => {
        if (!currentUserId) return;
        setWaterBusy(true); setWaterMsg(null);
        try {
            await requestStewardship(tree, sender);
            setWaterMsg(t('steward_ask_sent'));
        } catch (e) { setWaterMsg(errMsg(e, 'err_circle_reach')); }
        setWaterBusy(false);
    };

    const handleRemindGuardians = async () => {
        if (!currentUserId) return;
        setWaterBusy(true); setWaterMsg(null);
        try {
            const ok = await sendWateringAlert(tree, sender);
            setWaterMsg(t(ok ? 'guardians_asked_water' : 'guardians_none_notify'));
            if (ok) onUpdate?.({ watering: { ...(tree.watering || {}), overdue: true } });
        } catch (e) { setWaterMsg(errMsg(e, 'err_reminder_send')); }
        setWaterBusy(false);
    };

    // The stage's droplet: a potted seed shows the sprout story, the rest the plain drop.
    const stageEmoji = stage === 'potted' ? '🌱' : '💧';

    return (
        <SectionCard title={t('watering')} icon={<Icons.Droplet />} className={overdue ? 'ring-2 ring-sky-300' : ''}>
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="text-sm text-sky-800/90">
                    {selfSustaining ? (
                        <p>{t('water_self_note')}</p>
                    ) : scheduled ? (
                        overdue ? (
                            <p className="font-semibold text-sky-700">{stageEmoji} {t('water_thirsty').replace('{when}', overByDays > 0 ? t('water_days_overdue').replace('{n}', String(overByDays)) : t('water_due_today'))}</p>
                        ) : (
                            <p>{stageEmoji} {t(stage === 'potted' ? 'water_next_potted' : 'water_next').replace('{n}', String(dueInDays))}</p>
                        )
                    ) : (
                        <p>{t('no_schedule')}</p>
                    )}
                    {/* The rhythm, spelled out for readers without the schedule editor. */}
                    {!canManageSchedule && scheduled && !selfSustaining && tree.watering?.intervalDays && (
                        <p className="mt-1 text-xs text-sky-700/70">{t('watered_every_n').replace('{n}', String(tree.watering.intervalDays))}</p>
                    )}
                    {lastWateredLine && <p className="mt-1 text-xs text-sky-700/70">{lastWateredLine}</p>}
                </div>
                {/* The primary action sits right beside the status — water this tree now. */}
                {canWater && !selfSustaining && (
                    <button type="button" onClick={waterOnChain ? handleWaterPick : handleWaterBypass} disabled={waterBusy} className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow transition-all hover:bg-sky-700 active:scale-95 disabled:opacity-50">
                        <Icons.Droplet /> <span className="whitespace-nowrap">{t('i_watered_today')}</span>
                    </button>
                )}
            </div>

            {canManageSchedule && (
                <div className="mb-4 space-y-3 rounded-xl border border-sky-200 bg-white p-4 dark:bg-slate-900">
                    {/* The growth journey: pot → ground → self-sustaining. Pick where the tree is. */}
                    <div role="radiogroup" aria-label={t('growth_stage')} className="grid grid-cols-3 gap-2">
                        {STAGE_META.map(s => (
                            <button
                                key={s.key}
                                type="button"
                                role="radio"
                                aria-checked={waterStage === s.key}
                                title={t(s.hintKey)}
                                onClick={() => setWaterStage(s.key)}
                                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center transition-all ${waterStage === s.key
                                    ? (s.key === 'self_sustaining' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-sky-500 bg-sky-50 text-sky-700')
                                    : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:text-slate-500'}`}
                            >
                                {s.icon}
                                <span className="text-[10px] font-bold uppercase tracking-wide leading-tight">{t(s.labelKey)}</span>
                            </button>
                        ))}
                    </div>
                    <p className="text-center text-xs text-slate-500">{(() => { const h = STAGE_META.find(s => s.key === waterStage)?.hintKey; return h ? t(h) : ''; })()}</p>
                    {waterStage !== 'self_sustaining' && (
                        <div className="flex items-center justify-center gap-2 text-sm text-sky-800">
                            <span>{t('water_every')}</span>
                            <div className="inline-flex items-center overflow-hidden rounded-lg border border-sky-200">
                                <button type="button" aria-label={t('fewer_days')} onClick={() => setWaterInterval(v => Math.max(1, v - 1))} className="px-3 py-1.5 font-bold text-sky-700 hover:bg-sky-50">−</button>
                                <span className="w-10 text-center font-bold tabular-nums">{waterInterval}</span>
                                <button type="button" aria-label={t('more_days')} onClick={() => setWaterInterval(v => Math.min(365, v + 1))} className="px-3 py-1.5 font-bold text-sky-700 hover:bg-sky-50">+</button>
                            </div>
                            <span>{t('days_unit')}</span>
                        </div>
                    )}
                    <button type="button" onClick={handleSaveSchedule} disabled={waterBusy} className="ml-auto block rounded-lg bg-sky-600 px-8 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50">{waterBusy ? t('saving') : t('save')}</button>
                </div>
            )}

            {canWater && (
                <div className="space-y-2">
                    {/* No `capture` attr: the OS offers its own chooser (camera OR photo library),
                        so a watering shot taken moments ago uploads as easily as a fresh one.
                        The proof's trust never lived in the lens — the guardian's witness judges. */}
                    <input ref={waterFileRef} type="file" accept="image/*" className="hidden" onChange={handleWaterFile} />
                    <div className="flex flex-wrap items-center gap-3">
                        {/* The water action moved up beside the status; its options stay here —
                            off-chain by default; opting in takes a photo + mints a growth block. */}
                        <label className="flex cursor-pointer items-center gap-2 text-xs leading-tight text-sky-700/80" title={t('water_photo_title')}>
                            <input type="checkbox" checked={waterOnChain} onChange={e => setWaterOnChain(e.target.checked)} className="accent-sky-600" />
                            <span>
                                <span className="block">{t('add_photo_proof')}</span>
                                <span className="block">{t('water_photo_mints')}</span>
                            </span>
                        </label>
                        {isOwner && overdue && !wateringAlertedToday(tree) && (
                            <button type="button" onClick={handleRemindGuardians} disabled={waterBusy} className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-white px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-50 dark:bg-slate-900">{t('remind_guardians')} 💧</button>
                        )}
                    </div>
                </div>
            )}

            {canAskStewardship && (
                <div className="mb-4 rounded-xl border border-sky-100 bg-white/70 p-4 dark:bg-slate-900/70">
                    <p className="text-xs leading-relaxed text-sky-800/80">
                        {t('guard_care_note')}
                    </p>
                    <button
                        type="button"
                        onClick={handleAskStewardship}
                        disabled={waterBusy}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-white px-4 py-2 text-xs font-bold text-sky-700 hover:bg-sky-50 disabled:opacity-50 dark:bg-slate-900"
                    >🌿 {t('ask_be_steward')}</button>
                </div>
            )}

            {/* The waterings still awaiting a human witness — and, for the circle, the hand to
                witness them right here where the care is read (one face with the Circle tab). */}
            {(canWater || canAskStewardship || canWitness) && pendingWaterings.length > 0 && (
                <WitnessWaterings
                    className="mt-4"
                    treeName={tree.name}
                    pulses={growthBlocks}
                    currentUserId={currentUserId}
                    canWitness={canWitness}
                    onWitnessed={onChainRefresh}
                />
            )}

            {/* speak(): a message may be a thrown KEY (the services throw keys) or an already-
                spoken sentence — the boundary says the first and passes the second through. */}
            {waterMsg && <p className="mt-3 text-xs text-sky-700">{speak(waterMsg)}</p>}
        </SectionCard>
    );
};
