// THE INDEPENDENT NODE'S HAND for watering — the mirror of ../firebase/watering.ts (rings
// 2026-11-01/02). The schedule and the off-chain tick are a carer's edits through the document
// door; the photo path mints a growth block through the block command (the node composes the
// cadence reset in the same transaction); the thirst ask and the thanks are the tree's own
// nudges into its circle. Witnessing a watering kindles light — the light organ's hand, not yet grown.
import type * as F from '../firebase/watering';
import { stampOfMs, session } from './core';
import { docCommand, serverTime } from './docs';
import { uuidv7 } from '../../utils/id';
import { daysOverdue, computeNextDueMillis, wateringAlertedToday, standingAlertId, type WateringSchedule } from '../../domain/watering';
import { buildGroupThreadId } from '../../utils/reachPermissions';
import { mintPulse, resolveCircleUids, sendThreadMessage, postGuardiansNotice } from './pulses';
import { uploadImage } from './media';
import { announce } from '../refreshBus';
import { myNaming } from './accounts';
import type { Lifetree } from '../../types';

const iso = (ms: number) => new Date(ms).toISOString();
export const setWateringSchedule: typeof F.setWateringSchedule = async (treeId, input) => {
    let watering: WateringSchedule;
    if (input.stage === 'self_sustaining') watering = { mode: 'self_sustaining', stage: 'self_sustaining' };
    else {
        const intervalDays = Math.max(1, Math.round(input.intervalDays || 7));
        const now = Date.now();
        const prev = input.prev;
        const lastWateredAt = (prev?.mode === 'scheduled' && prev.lastWateredAt) ? prev.lastWateredAt : stampOfMs(now);
        const nextDueMs = computeNextDueMillis(lastWateredAt.toMillis(), intervalDays);
        watering = { mode: 'scheduled', stage: input.stage, intervalDays, lastWateredAt, nextDueAt: stampOfMs(nextDueMs), overdue: now >= nextDueMs,
            ...(prev?.lastAlertAt ? { lastAlertAt: prev.lastAlertAt } : {}), ...(prev?.alertThreadId ? { alertThreadId: prev.alertThreadId } : {}) };
    }
    await docCommand({ action: 'update', collection: 'lifetrees', id: treeId, patch: { watering: watering as unknown as Record<string, unknown>, updatedAt: serverTime() } });
    return watering;
};
const wateringPatchOf = (tree: Lifetree, update: Record<string, unknown>): Record<string, unknown> => {
    const watering: Record<string, unknown> = { ...(tree.watering || {}) };
    for (const [k, v] of Object.entries(update)) if (k.startsWith('watering.')) watering[k.slice('watering.'.length)] = v;
    return { watering };
};
export const markWateredOffChain: typeof F.markWateredOffChain = async (tree, sender) => {
    const now = Date.now();
    const naming = await myNaming();
    const intervalDays = tree.watering?.mode === 'scheduled' ? tree.watering?.intervalDays : undefined;
    const update: Record<string, unknown> = {
        'watering.lastWateredAt': stampOfMs(now), 'watering.lastWateredBy': sender.uid, 'watering.lastWateredByName': naming.name || '',
        'watering.overdue': false, lastCaredAt: serverTime(), updatedAt: serverTime(),
    };
    if (intervalDays) update['watering.nextDueAt'] = stampOfMs(computeNextDueMillis(now, intervalDays));
    await docCommand({ action: 'update', collection: 'lifetrees', id: tree.id, patch: update });
    announce('trees', tree.id, wateringPatchOf(tree, update));
    await postGuardiansNotice(tree, sender, `💧 ${naming.name || 'A guardian'} watered me — thank you!`);
};
export const recordWatering: typeof F.recordWatering = async ({ tree, sender, imageFile, analysis }) => {
    const imageUrl = await uploadImage(imageFile, `users/${sender.uid}/watering/${tree.id}/${Date.now()}.webp`);
    const confirmedBy: 'ai' | 'pending' = analysis.watering && (analysis.confidence || 0) >= 70 ? 'ai' : 'pending';
    const note = analysis.note || (confirmedBy === 'ai' ? 'Confirmed by AI.' : 'Awaiting a guardian to confirm.');
    const now = Date.now();
    const naming = await myNaming();
    const interval = tree.watering?.mode === 'scheduled' ? tree.watering?.intervalDays : undefined;
    const wateringUpdate: Record<string, unknown> = { 'watering.lastWateredAt': stampOfMs(now), 'watering.lastWateredBy': sender.uid, 'watering.lastWateredByName': naming.name || '', 'watering.overdue': false };
    if (interval) wateringUpdate['watering.nextDueAt'] = stampOfMs(computeNextDueMillis(now, interval));
    await mintPulse({
        lifetreeId: tree.id, type: 'tree_growth', care: 'watering', title: 'Watering',
        body: confirmedBy === 'ai' ? `Watered — confirmed by AI. ${note}` : `Watered — awaiting guardian confirmation. ${note}`,
        imageUrl, visibility: 'public', wateringConfirmedBy: confirmedBy,
        wateringConfirmation: { note, confidence: analysis.confidence || 0, model: analysis.model, provider: analysis.provider },
        authorName: tree.name, authorPersonName: naming.personName, authorPhoto: tree.imageUrl || sender.photoURL || undefined,
    });
    announce('trees', tree.id, wateringPatchOf(tree, wateringUpdate));
    await postGuardiansNotice(tree, sender, `🌱 ${naming.name || 'A guardian'} watered me — thank you! (${confirmedBy === 'ai' ? 'confirmed by AI' : 'awaiting confirmation'})`);
    return { imageUrl, confirmedBy };
};
// THE WITNESS (ring 2026-11-02): the circle's hand confirms a watering and the light kindles — the
// node derives the witness, the standing, the day and the rays (migration 054, domain/light judgeWitness).
export const witnessWatering: typeof F.witnessWatering = async (pulseId) =>
    await session.lightCommand({ action: 'witness', pulseId }) as { kindled: boolean; witnessUnits: number; secret?: boolean };
export const requestStewardship: typeof F.requestStewardship = async (tree, sender) => {
    if (!tree.anchorUid) throw new Error('err_tree_no_keeper');
    const participantUids = await resolveCircleUids(tree, 'guardians');
    if (!participantUids.includes(sender.uid)) throw new Error('err_guard_before_steward');
    await sendThreadMessage({
        thread: { threadId: buildGroupThreadId(tree.id, 'guardians', tree.anchorUid), participantUids, reachTreeId: tree.id, reachTreeName: tree.name, threadName: `${tree.name} · Guardians`, audience: 'guardians', isGroup: true },
        fromTree: tree, sender, text: `🌿 ${(await myNaming()).name || 'A guardian'} asks to become a steward of ${tree.name}, to help care its care. (The owner can invite from the Circle.)`,
    });
};
// The "remind now" ask: one standing line that keeps count, rewritten while it stands.
export const sendWateringAlert: typeof F.sendWateringAlert = async (tree, sender) => {
    if (!tree.anchorUid) return false;
    const participantUids = await resolveCircleUids(tree, 'guardians');
    if (participantUids.filter(u => u !== tree.anchorUid).length === 0) return false;
    if (!participantUids.includes(sender.uid)) return false;
    if (wateringAlertedToday(tree)) return false;
    const now = Date.now();
    const over = daysOverdue(tree, now);
    const text = over <= 0 ? `I'm ready for watering 💧 — could a guardian care me today?` : `I'm thirsty 💧 — ${over} day${over > 1 ? 's' : ''} past my watering. Could a guardian care me?`;
    const threadId = buildGroupThreadId(tree.id, 'guardians', tree.anchorUid);
    await docCommand({ action: 'update', collection: 'lifetrees', id: tree.id, patch: { 'watering.overdue': true, 'watering.lastAlertAt': serverTime(), 'watering.alertThreadId': threadId } });
    const standing = standingAlertId(tree);
    if (standing) {
        try {
            await docCommand({ action: 'update', collection: 'pulses', id: standing, patch: { body: text, content: text, createdAt: serverTime() } });
            await docCommand({ action: 'update', collection: 'lifetrees', id: tree.id, patch: { 'watering.lastAlertAt': serverTime() } });
            announce('reaches', tree.id);
            return true;
        } catch { /* the ask could not be rewritten — speak a new one below */ }
    }
    const alert = await docCommand({ action: 'create', collection: 'pulses', data: {
        lid: uuidv7(), lifetreeId: tree.id, type: 'reach', visibility: 'private', careAlert: 'watering',
        title: `Reach: ${tree.name} -> ${tree.name} (Guardians)`, body: text, content: text, reachTreeId: tree.id, reachTreeName: tree.name, recipientName: tree.name,
        recipientUid: null, participantUids, threadId, threadName: `${tree.name} · Guardians`, audience: 'guardians', isGroup: true, seenBy: [],
        authorId: sender.uid, authorName: tree.name, ...(tree.imageUrl ? { authorPhoto: tree.imageUrl } : {}), domain: tree.domain || '', loveCount: 0, commentCount: 0,
        previousHash: 'WATER_ALERT', hash: uuidv7(), createdAt: serverTime(),
    } });
    await docCommand({ action: 'update', collection: 'lifetrees', id: tree.id, patch: { 'watering.alertPulseId': alert.id } });
    announce('reaches', tree.id);
    return true;
};
void iso;
