// THE INDEPENDENT NODE'S HAND for engagement — the mirror of ../firebase/engagement.ts (rings
// 2026-11-01/02). Alignments are the node's command (migrations 044–045: the proposal is derived from
// the matched pulse, the notes stay with the parties, acceptance mints the paired blocks); love is the
// door's one atomic gesture; a tree's token balance moves through the door under the carer's law.
import type * as F from '../firebase/engagement';
import { unported } from './unported';
import { session, readDoc, readAll, toMillis } from './core';
import { docAll, docCommand, isLoved, loveToggle } from './docs';
import { docGet } from './docs';
import type { Alignment } from '../../types';
export type { AlignmentProposal, AlignmentResult } from '../firebase/engagement';

const ALIGNMENTS = '/v1/alignments';
type LoveKind = 'lifetrees' | 'visions' | 'pulses' | 'communities' | 'lightHouses';
const loveKindOf = (collection: string): LoveKind => {
    if (['lifetrees', 'visions', 'pulses', 'communities', 'lightHouses'].includes(collection)) return collection as LoveKind;
    throw new Error('err_love_target');
};

export const proposeAlignment: typeof F.proposeAlignment = async (data) => {
    const born = await session.alignmentCommand({ action: 'propose', fromTreeId: data.initiatorTreeId, targetPulseId: data.targetPulseId,
        ...(data.initiatorPulseId && data.initiatorPulseId !== 'PENDING_CREATION' ? { initiatorPulseId: data.initiatorPulseId } : {}) }) as { alignment: { id: string } };
    return { id: born.alignment.id } as unknown as Awaited<ReturnType<typeof F.proposeAlignment>>;
};
export const rejectAlignment: typeof F.rejectAlignment = async (id) => { await session.alignmentCommand({ action: 'reject', id }); };
export const postAlignmentNote: typeof F.postAlignmentNote = async (id, _uid, text) => {
    const body = text.trim();
    if (!body) return;
    await session.alignmentCommand({ action: 'note', id, text: body.slice(0, 2000) });
};
export const getPendingAlignments: typeof F.getPendingAlignments = async () => readAll<Alignment>(ALIGNMENTS, 'alignments', { target: 'me', status: 'PENDING' });
export const getAlignmentById: typeof F.getAlignmentById = (id) => readDoc<Alignment>(ALIGNMENTS + '?id=' + encodeURIComponent(id), 'alignment');
export const findAlignmentForSyncBlock: typeof F.findAlignmentForSyncBlock = async (treeId, blockAtMillis) => {
    const [asInitiator, asTarget] = await Promise.all([
        docAll<Alignment>('alignments', { where: { initiatorTreeId: treeId } }).catch(() => []),
        docAll<Alignment>('alignments', { where: { targetTreeId: treeId } }).catch(() => []),
    ]);
    const byId = new Map<string, Alignment>();
    for (const a of [...asInitiator, ...asTarget]) byId.set(a.id, a);
    const accepted = [...byId.values()].filter(a => a.status === 'ACCEPTED');
    if (!accepted.length) return null;
    const at = blockAtMillis ?? Number.POSITIVE_INFINITY;
    const before = accepted.filter(a => toMillis(a.createdAt) <= at);
    return (before.length ? before : accepted).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))[0] ?? null;
};
export const migrateBackfillMatchIds: typeof F.migrateBackfillMatchIds = unported('engagement.migrateBackfillMatchIds');
export const getMyAlignmentCount: typeof F.getMyAlignmentCount = async () =>
    (await readAll<{ id: string }>(ALIGNMENTS, 'alignments', { participant: 'me', status: 'ACCEPTED' })).length;
export const getMyAlignmentsHistory: typeof F.getMyAlignmentsHistory = async () =>
    (await readAll<Alignment>(ALIGNMENTS, 'alignments', { participant: 'me' })).filter(a => a.status !== 'REJECTED')
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
// The TARGET settles the alignment on the node: twin sync-blocks on both chains in one transaction.
export const acceptAlignment: typeof F.acceptAlignment = async (proposalId) => {
    const answer = await session.alignmentCommand({ action: 'accept', id: proposalId }) as { fromPulseId: string; toPulseId: string };
    const alignment = await getAlignmentById(proposalId);
    return { initiatorTreeId: alignment?.initiatorTreeId ?? '', targetTreeId: alignment?.targetTreeId ?? '', initiatorPulseId: answer.fromPulseId, targetPulseId: answer.toPulseId };
};
// Love: one gesture, the slot and the tally together (seed.love_toggle).
export const isBeingLoved: typeof F.isBeingLoved = (collection, id, uid) => isLoved(loveKindOf(collection), id, uid);
export const loveBeing: typeof F.loveBeing = async (collection, id) => { await loveToggle(loveKindOf(collection), id); };
export const isPulseLoved: typeof F.isPulseLoved = (id, uid) => isLoved('pulses', id, uid);
export const lovePulse: typeof F.lovePulse = async (id) => { await loveToggle('pulses', id); };
export const spendAiTokens: typeof F.spendAiTokens = async (treeId, amount) => {
    const tree = await docGet<{ aiTokenBalance?: number }>('lifetrees', treeId);
    if (!tree) throw new Error('err_tree_missing');
    const balance = tree.aiTokenBalance || 0;
    if (balance < amount) throw new Error('err_tokens');
    await docCommand({ action: 'update', collection: 'lifetrees', id: treeId, patch: { aiTokenBalance: balance - amount }, expect: { aiTokenBalance: tree.aiTokenBalance ?? null } });
    return balance - amount;
};
