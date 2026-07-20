import { addDoc, serverTimestamp, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { type Lifetree } from '../../types';
import { uuidv7 } from '../../utils/id';
import { daysOverdue, computeNextDueMillis, wateringAlertedToday, type TreeStage, type WateringSchedule, type WateringAnalysis } from '../../domain/watering';
import { buildGroupThreadId } from '../../utils/reachPermissions';
import { db, functions, pulsesCollection } from './core';
import { mintPulse, resolveCircleUids, sendThreadMessage } from './pulses';
import { uploadImage } from './media';

// --- Watering: scheduled tending of a (usually guarded) tree -----------------------------
// Watering is tending made literal. The owner sets a growth stage (potted/planted are tended on
// a schedule; self-sustaining is not); the daily Cloud Function (checkWateringSchedules) pings
// guardians when overdue. The default watering is an off-chain tick (markWateredOffChain); the
// opt-in photo path (recordWatering) mints a growth block with an AI/guardian witness. Both
// refresh lastTendedAt, so either keeps the tree's living validation lit.

// Set (or change) a tree's growth stage + watering schedule, returning the schedule as written
// so callers can mirror it locally instead of rebuilding it. A self-sustaining tree clears the
// cadence. Changing the stage or interval of an already-scheduled tree is NOT a watering: the
// clock (lastWateredAt) and the alert idempotency state (lastAlertAt/alertThreadId) carry over,
// and overdue is recomputed honestly — promoting an overdue seed doesn't quench its thirst.
// Only a tree not previously on a schedule anchors to now, so it isn't instantly overdue.
// Owner/guardian/staff (rules). Mode stays canonical for the daily sweep's query.
export const setWateringSchedule = async (
    treeId: string,
    input: { stage: TreeStage; intervalDays?: number; prev?: WateringSchedule },
): Promise<WateringSchedule> => {
    let watering: WateringSchedule;
    if (input.stage === 'self_sustaining') {
        watering = { mode: 'self_sustaining', stage: 'self_sustaining' };
    } else {
        const intervalDays = Math.max(1, Math.round(input.intervalDays || 7));
        const now = Date.now();
        const prev = input.prev;
        const lastWateredAt = (prev?.mode === 'scheduled' && prev.lastWateredAt) ? prev.lastWateredAt : Timestamp.fromMillis(now);
        const nextDueMs = computeNextDueMillis(lastWateredAt.toMillis(), intervalDays);
        watering = {
            mode: 'scheduled',
            stage: input.stage,
            intervalDays,
            lastWateredAt,
            nextDueAt: Timestamp.fromMillis(nextDueMs),
            overdue: now >= nextDueMs,
            ...(prev?.lastAlertAt ? { lastAlertAt: prev.lastAlertAt } : {}),
            ...(prev?.alertThreadId ? { alertThreadId: prev.alertThreadId } : {}),
        };
    }
    await updateDoc(doc(db, 'lifetrees', treeId), { watering, updatedAt: serverTimestamp() });
    return watering;
};

// Tell the guardians' thread the tree was tended. A normal (newest) message is also what clears
// the blue 'water me' careAlert border — newest message wins (see domain/views/threads) — so
// EVERY watering path must post one, or a resolved alert lingers in the inbox. Best-effort.
const postWateredNotice = async (
    tree: Lifetree,
    sender: { uid: string; displayName?: string | null; photoURL?: string | null },
    text: string,
) => {
    try {
        if (!tree.ownerId) return;
        const participantUids = await resolveCircleUids(tree, 'guardians');
        if (participantUids.length > 1) {
            await sendThreadMessage({
                thread: {
                    threadId: buildGroupThreadId(tree.id, 'guardians', tree.ownerId),
                    participantUids,
                    reachTreeId: tree.id,
                    reachTreeName: tree.name,
                    threadName: `${tree.name} · Guardians`,
                    audience: 'guardians',
                    isGroup: true,
                },
                fromTree: tree,
                sender,
                text,
            });
        }
    } catch (e) { console.warn('Watered notice could not be posted', e); }
};

// Off-chain "I Watered Today" — the default: resets the cadence WITHOUT minting a growth block
// or storing a photo (no chain advance), for routine watering you don't want on the tree's
// ledger. Still counts as tending (lastTendedAt keeps living validation lit) and still tells
// the guardians' thread, which clears any standing 'water me' alert.
export const markWateredOffChain = async (
    tree: Lifetree,
    sender: { uid: string; displayName?: string | null; photoURL?: string | null },
) => {
    const now = Date.now();
    const intervalDays = tree.watering?.mode === 'scheduled' ? tree.watering?.intervalDays : undefined;
    const update: Record<string, any> = {
        'watering.lastWateredAt': Timestamp.fromMillis(now),
        'watering.overdue': false,
        lastTendedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };
    if (intervalDays) update['watering.nextDueAt'] = Timestamp.fromMillis(computeNextDueMillis(now, intervalDays));
    await updateDoc(doc(db, 'lifetrees', tree.id), update);
    await postWateredNotice(tree, sender, `💧 ${sender.displayName || 'A guardian'} watered me — thank you!`);
};

// Record a watering: upload proof, mint a GROWTH pulse carrying the `watering` flag + the
// witness's verdict, reset the schedule clock, and let the guardians' thread know it's tended.
// `analysis` is produced by the caller via gemini.analyzeWateringPhoto (AI), or stood in for by
// a guardian. AI confidence ≥ 70 auto-confirms; otherwise the pulse waits for a guardian.

export const recordWatering = async ({
    tree,
    sender,
    imageFile,
    analysis,
}: {
    tree: Lifetree;
    sender: { uid: string; displayName?: string | null; photoURL?: string | null };
    imageFile: File;
    analysis: WateringAnalysis;
}): Promise<{ imageUrl: string; confirmedBy: 'ai' | 'pending' }> => {
    const imageUrl = await uploadImage(imageFile, `users/${sender.uid}/watering/${tree.id}/${Date.now()}.webp`);
    const confirmedBy: 'ai' | 'pending' = analysis.watering && (analysis.confidence || 0) >= 70 ? 'ai' : 'pending';
    const note = analysis.note || (confirmedBy === 'ai' ? 'Confirmed by AI.' : 'Awaiting a guardian to confirm.');

    // Reset the cadence + clear the overdue flag IN THE SAME transaction that appends the growth
    // block, so the tree can never be left "watered on the chain but still overdue". mintPulse
    // already sets lastTendedAt (GROWTH), so living validation re-lights automatically.
    const now = Date.now();
    const interval = tree.watering?.mode === 'scheduled' ? tree.watering?.intervalDays : undefined;
    const wateringUpdate: Record<string, any> = {
        'watering.lastWateredAt': Timestamp.fromMillis(now),
        'watering.overdue': false,
    };
    if (interval) wateringUpdate['watering.nextDueAt'] = Timestamp.fromMillis(computeNextDueMillis(now, interval));

    await mintPulse({
        lifetreeId: tree.id,
        type: 'tree_growth',
        care: 'watering',
        title: 'Watering',
        body: confirmedBy === 'ai' ? `Watered — confirmed by AI. ${note}` : `Watered — awaiting guardian confirmation. ${note}`,
        imageUrl,
        visibility: 'public',
        wateringConfirmedBy: confirmedBy,
        wateringConfirmation: {
            note,
            confidence: analysis.confidence || 0,
            model: analysis.model,
            provider: analysis.provider,
            ...(confirmedBy === 'ai' ? { confirmedAt: Timestamp.fromMillis(Date.now()) } : {}),
        },
        authorId: sender.uid,
        authorName: tree.name,
        authorPersonName: sender.displayName || undefined,
        authorPhoto: tree.imageUrl || sender.photoURL || undefined,
    }, wateringUpdate);

    // Let the guardians' thread know — a normal (newest) message clears the blue alert border.
    await postWateredNotice(tree, sender, `🌱 ${sender.displayName || 'A guardian'} watered me — thank you! (${confirmedBy === 'ai' ? 'confirmed by AI' : 'awaiting confirmation'})`);

    return { imageUrl, confirmedBy };
};

// A guardian WITNESSES a watering — the light mint (the sun ring). SERVER-MEDIATED: the
// witnessWatering callable derives the witness from the authenticated caller, verifies guardianship
// + tenure, and kindles the carer's ray + the witness's seventh atomically. The witness is never a
// client-passed field, so it can't be forged or aimed (Lumo's review, 2026-07-20). Also stamps the
// pulse confirmed for the validation display.
export const witnessWatering = async (pulseId: string): Promise<{ kindled: boolean; witnessUnits: number }> => {
    const fn = httpsCallable(functions, 'witnessWatering');
    const res = await fn({ pulseId });
    return res.data as { kindled: boolean; witnessUnits: number };
};

// Manually ping a tree's guardians that it needs watering — the client/"remind now" path that
// complements the daily Cloud Function. Writes an off-chain "water me" reach (careAlert flag →
// blue border) into the guardians thread and marks the tree alerted. Returns false if there are
// no guardians to reach. Callers gate on wateringAlertedToday() so it fires at most once a day.
export const sendWateringAlert = async (
    tree: Lifetree,
    sender: { uid: string; displayName?: string | null },
): Promise<boolean> => {
    if (!tree.ownerId) return false;
    const participantUids = await resolveCircleUids(tree, 'guardians');
    if (participantUids.filter(u => u !== tree.ownerId).length === 0) return false; // no one but the owner yet
    // Authorization: only a circle member (owner / co-guardian / guardian) may ping the circle —
    // a non-member calling this would otherwise create an orphaned alert pulse before the tree
    // update is rejected by the rules. Enforced here in addition to the UI gate.
    if (!participantUids.includes(sender.uid)) return false;
    // Idempotency (server-mirrored): at most one alert per UTC day, matching checkWateringSchedules,
    // so a client that skips the UI gate still can't spam the circle.
    if (wateringAlertedToday(tree)) return false;

    const now = Date.now();
    const over = daysOverdue(tree, now);
    const text = over <= 0
        ? `I'm ready for watering 💧 — could a guardian tend me today?`
        : `I'm thirsty 💧 — ${over} day${over > 1 ? 's' : ''} past my watering. Could a guardian tend me?`;
    const threadId = buildGroupThreadId(tree.id, 'guardians', tree.ownerId);

    // Mark the tree alerted FIRST: this write is gated by the lifetrees rule (owner/guardian/staff),
    // so an unauthorized caller is rejected here before any alert pulse is created (no orphan).
    await updateDoc(doc(db, 'lifetrees', tree.id), {
        'watering.overdue': true,
        'watering.lastAlertAt': serverTimestamp(),
        'watering.alertThreadId': threadId,
    });
    await addDoc(pulsesCollection, {
        lid: uuidv7(),
        lifetreeId: tree.id,
        type: 'reach',
        visibility: 'private',
        careAlert: 'watering',
        title: `Reach: ${tree.name} -> ${tree.name} (Guardians)`,
        body: text,
        content: text,
        reachTreeId: tree.id,
        reachTreeName: tree.name,
        recipientName: tree.name,
        recipientUid: null,
        participantUids,
        threadId,
        threadName: `${tree.name} · Guardians`,
        audience: 'guardians',
        isGroup: true,
        seenBy: [],
        authorId: sender.uid,
        authorName: tree.name,
        authorPhoto: tree.imageUrl || undefined,
        domain: tree.domain || '',
        loveCount: 0,
        commentCount: 0,
        previousHash: 'WATER_ALERT', // a nudge, not a chain block (mirrors the scheduled sweep)
        hash: uuidv7(),              // a plain unique id — never chain-verified
        createdAt: serverTimestamp(),
    });
    return true;
};

