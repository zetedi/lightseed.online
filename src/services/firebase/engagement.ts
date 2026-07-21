import { query, getDocs, addDoc, serverTimestamp, doc, runTransaction, getDoc, where, updateDoc, getCountFromServer, writeBatch, Timestamp, type DocumentReference } from 'firebase/firestore';
import { type Lifetree, type Alignment } from '../../types';
import { createBlock } from '../../utils/crypto';
import { uuidv7 } from '../../utils/id';
import { isTokenisationEnabled } from '../../domain/tokenisation';
import { db, toMillis, mapDoc, pulsesCollection, alignmentsCollection } from './core';

// What the initiator supplies; lid/status/createdAt are stamped here, messages grow later.
// The lid: an alignment is a Being (types.ts) and gets its true name at birth like every other
// (it went nameless until the 2026-07-21 lid audit found it).
export type AlignmentProposal = Omit<Alignment, 'id' | 'status' | 'createdAt' | 'messages'>;
export const proposeAlignment = (data: AlignmentProposal) => addDoc(alignmentsCollection, { ...data, lid: uuidv7(), status: 'PENDING', createdAt: serverTimestamp() });

// Decline a pending alignment — the target owner passes on the resonance. A single field write
// (the alignments rule already lets the initiator or target update their own proposal).
export const rejectAlignment = (id: string) => updateDoc(doc(db, 'alignments', id), { status: 'REJECTED' });

// Post a note in an alignment's discussion — the recursive back-and-forth that happens while it's
// still PENDING, before the target finalises it with Accept. Transactional append (read-then-write)
// so two people writing at once don't clobber each other's note; the time is client-stamped (the
// array element can't hold a serverTimestamp sentinel). Only the two participants may post.
export const postAlignmentNote = async (id: string, uid: string, text: string): Promise<void> => {
    const body = text.trim();
    if (!body) return;
    const ref = doc(db, 'alignments', id);
    await runTransaction(db, async (t) => {
        const snap = await t.get(ref);
        if (!snap.exists()) throw new Error('This alignment no longer exists.');
        const data = snap.data() as Alignment;
        if (uid !== data.initiatorUid && uid !== data.targetUid) throw new Error('Only the two aligned trees can speak here.');
        if (data.status !== 'PENDING') throw new Error('This alignment is already settled.');
        const note = { by: uid, text: body.slice(0, 2000), at: Timestamp.fromMillis(Date.now()) };
        t.update(ref, { messages: [...(data.messages || []), note] });
    });
};
export const getPendingAlignments = async (uid: string) => (await getDocs(query(alignmentsCollection, where('targetUid', '==', uid), where('status', '==', 'PENDING')))).docs.map(d => (mapDoc(d) as Alignment));

// One alignment by id — so a sync-block opened anywhere (feed, tree leaf, profile history) lands
// on the same AlignmentView (an alignment pulse carries the alignment id in `matchId`).
export const getAlignmentById = async (id: string): Promise<Alignment | null> => {
    const snap = await getDoc(doc(db, 'alignments', id));
    return snap.exists() ? (mapDoc(snap) as Alignment) : null;
};

// LEGACY sync-blocks (minted before `matchId` was stamped on them) carry only `isMatch`, so the
// alignment must be resolved through the tree the block sits on: an ACCEPTED alignment this tree
// took part in. When several exist, the one proposed latest before the block was minted wins
// (a proposal always precedes its acceptance sync-block). Two single-field queries → dedupe.
// NOTE: migrateBackfillMatchIds (below) stamps matchId onto those legacy blocks with this same
// logic — after a verified run this fallback is a harmless safety net and can be removed.
export const findAlignmentForSyncBlock = async (treeId: string, blockAtMillis?: number): Promise<Alignment | null> => {
    const [asInitiator, asTarget] = await Promise.all([
        getDocs(query(alignmentsCollection, where('initiatorTreeId', '==', treeId))),
        getDocs(query(alignmentsCollection, where('targetTreeId', '==', treeId))),
    ]);
    const byId = new Map<string, Alignment>();
    [...asInitiator.docs, ...asTarget.docs].forEach(d => byId.set(d.id, mapDoc(d) as Alignment));
    const accepted = Array.from(byId.values()).filter(a => a.status === 'ACCEPTED');
    if (accepted.length === 0) return null;
    const at = blockAtMillis ?? Number.POSITIVE_INFINITY;
    const proposedBefore = accepted.filter(a => (a.createdAt?.toMillis() ?? 0) <= at);
    const pool = proposedBefore.length > 0 ? proposedBefore : accepted;
    return pool.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))[0] ?? null;
};

// One-time migration for legacy alignment sync-blocks: every pulse minted with `isMatch: true`
// before `matchId` was stamped on new blocks gets its alignment resolved with the SAME tree+time
// resolver logic (findAlignmentForSyncBlock — now used ONLY by this migration; the App runtime
// fallback was removed after the 2026-07-09 prod run), and the id written back. After a
// verified run, that runtime fallback is only a harmless safety net and can be removed.
// Sealed blocks (hashVersion set) are skipped — `matchId` is canonical block content
// (BLOCK_CONTENT_FIELDS), so adding it post-seal would break hash verification; sealed sync-blocks
// already carry their matchId anyway. Staff-run, idempotent (a stamped block is never revisited).
export const migrateBackfillMatchIds = async (): Promise<{ stamped: number; unresolved: number; skippedSealed: number }> => {
    const snap = await getDocs(query(pulsesCollection, where('isMatch', '==', true)));
    const updates: { ref: DocumentReference; matchId: string }[] = [];
    let unresolved = 0, skippedSealed = 0;
    for (const d of snap.docs) {
        const data = d.data();
        if (data.matchId !== undefined) continue; // already canonical
        if (data.hashVersion !== undefined) { skippedSealed++; continue; } // sealed — immutable content
        const treeId = typeof data.lifetreeId === 'string' ? data.lifetreeId : '';
        if (!treeId) { unresolved++; continue; }
        const atMillis = toMillis(data.createdAt);
        const alignment = await findAlignmentForSyncBlock(treeId, atMillis || undefined);
        if (alignment) updates.push({ ref: d.ref, matchId: alignment.id });
        else unresolved++;
    }
    for (let i = 0; i < updates.length; i += 400) {
        const batch = writeBatch(db);
        updates.slice(i, i + 400).forEach(u => batch.update(u.ref, { matchId: u.matchId }));
        await batch.commit();
        console.log(`[lightseed] matchId backfill — committed ${Math.min(i + 400, updates.length)}/${updates.length}`);
    }
    return { stamped: updates.length, unresolved, skippedSealed };
};

// Count of a user's accepted alignments (both sides) — server-side COUNT for the dashboard stat.
export const getMyAlignmentCount = async (uid: string): Promise<number> => {
    const [asTarget, asInitiator] = await Promise.all([
        getCountFromServer(query(alignmentsCollection, where('targetUid', '==', uid), where('status', '==', 'ACCEPTED'))),
        getCountFromServer(query(alignmentsCollection, where('initiatorUid', '==', uid), where('status', '==', 'ACCEPTED'))),
    ]);
    return asTarget.data().count + asInitiator.data().count;
};

// A person's alignments (both sides) — OPEN (still-discussing PENDING) and FINALISED (ACCEPTED).
// Declined ones drop off. Open ones are included so either party can reach the discussion page and
// speak before the target finalises. Two single-field queries (no status filter) → dedupe by id.
export const getMyAlignmentsHistory = async (uid: string) => {
    const [asTarget, asInitiator] = await Promise.all([
        getDocs(query(alignmentsCollection, where('targetUid', '==', uid))),
        getDocs(query(alignmentsCollection, where('initiatorUid', '==', uid))),
    ]);
    const byId = new Map<string, Alignment>();
    [...asTarget.docs, ...asInitiator.docs].forEach(d => byId.set(d.id, mapDoc(d) as Alignment));
    return Array.from(byId.values())
        .filter(a => a.status !== 'REJECTED')
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}

export interface AlignmentResult {
    initiatorTreeId: string; targetTreeId: string;
    initiatorPulseId: string; targetPulseId: string;
}

export const acceptAlignment = async (proposalId: string): Promise<AlignmentResult> => {
    const matchRef = doc(db, 'alignments', proposalId);
    return runTransaction(db, async (t) => {
        // Firestore transactions require ALL reads before ANY writes, so read the proposal and
        // both trees up front, then compute hashes, then apply every write.
        const matchDoc = await t.get(matchRef);
        if (!matchDoc.exists() || matchDoc.data()?.status !== 'PENDING') throw new Error("Invalid alignment");
        const proposal = matchDoc.data() as Alignment;

        const initTreeRef = doc(db, 'lifetrees', proposal.initiatorTreeId);
        const targetTreeRef = doc(db, 'lifetrees', proposal.targetTreeId);
        const initTree = (await t.get(initTreeRef)).data() as Lifetree;
        const targetTree = (await t.get(targetTreeRef)).data() as Lifetree;

        const initHash = await createBlock(initTree.latestHash, { match: proposal.id }, Date.now());
        const targetHash = await createBlock(targetTree.latestHash, { match: proposal.id }, Date.now());

        // The two sync blocks form a mutual contract: each records the OTHER tree it aligned with
        // (matchedLifetreeId) and the alignment id (matchId), so the pulse itself carries both
        // trees + pulses in the alignment. Their ids are returned so the UI can open the block.
        const initPulseRef = doc(pulsesCollection);
        const targetPulseRef = doc(pulsesCollection);

        t.set(initPulseRef, {
            lid: uuidv7(),
            lifetreeId: proposal.initiatorTreeId, type: 'standard', title: 'Alignment',
            body: `Aligned with ${targetTree?.name || 'another tree'}.`,
            isMatch: true, matchId: proposal.id, matchedLifetreeId: proposal.targetTreeId,
            authorId: proposal.initiatorUid, authorName: 'System',
            createdAt: serverTimestamp(), hash: initHash
        });
        t.update(initTreeRef, { latestHash: initHash, blockHeight: initTree.blockHeight + 1 });

        t.set(targetPulseRef, {
            lid: uuidv7(),
            lifetreeId: proposal.targetTreeId, type: 'standard', title: 'Alignment',
            body: `Aligned with ${initTree?.name || 'another tree'}.`,
            isMatch: true, matchId: proposal.id, matchedLifetreeId: proposal.initiatorTreeId,
            authorId: proposal.targetUid, authorName: 'System',
            createdAt: serverTimestamp(), hash: targetHash
        });
        t.update(targetTreeRef, { latestHash: targetHash, blockHeight: targetTree.blockHeight + 1 });

        t.update(matchRef, { status: 'ACCEPTED' });
        return {
            initiatorTreeId: proposal.initiatorTreeId, targetTreeId: proposal.targetTreeId,
            initiatorPulseId: initPulseRef.id, targetPulseId: targetPulseRef.id,
        };
    });
}

export const isPulseLoved = async (id: string, uid: string) => (await getDoc(doc(db, 'pulses', id, 'loves', uid))).exists();
export const lovePulse = async (id: string, uid: string) => {
    const pulseRef = doc(db, 'pulses', id);
    const loveRef = doc(pulseRef, 'loves', uid);
    return runTransaction(db, async (t) => {
        // All reads first (Firestore requires reads before writes). The author-tree read is only
        // needed when ADDING a love (to reward a token), but it must still happen before any write.
        const pulse = await t.get(pulseRef);
        if (!pulse.exists()) return;
        const pulseData = pulse.data();
        const love = await t.get(loveRef);

        // The token reward writes to the author's tree, which the lifetrees rules only allow for
        // that tree's own circle — so only reward when the node's token economy is enabled. While
        // off, loving a pulse (or reach) is a pure loveCount/loves write anyone can do.
        const treeId = pulseData.lifetreeId;
        const authorTreeRef = (isTokenisationEnabled() && treeId) ? doc(db, 'lifetrees', treeId) : null;
        const authorTree = (!love.exists() && authorTreeRef) ? await t.get(authorTreeRef) : null;

        let count = pulseData.loveCount || pulseData.validationScore || 0;
        if (love.exists()) {
            t.delete(loveRef);
            count--;
        } else {
            t.set(loveRef, { uid, createdAt: serverTimestamp() });
            count++;

            // Reward 1 Token to Pulse Author Tree (Living Intelligence Network economy).
            if (authorTreeRef && authorTree?.exists()) {
                const currentBalance = authorTree.data()?.aiTokenBalance || 0;
                t.update(authorTreeRef, { aiTokenBalance: currentBalance + 1 });
            }
        }
        t.update(pulseRef, { loveCount: Math.max(0, count), validationScore: Math.max(0, count) });
    });
}

export const spendAiTokens = async (treeId: string, amount: number) => {
    const treeRef = doc(db, 'lifetrees', treeId);
    return runTransaction(db, async (t) => {
        const tree = await t.get(treeRef);
        if (!tree.exists()) throw new Error("Tree not found");
        const balance = tree.data()?.aiTokenBalance || 0;
        if (balance < amount) throw new Error("Not enough AI tokens (Attention-Energy). Validate pulses or visions to earn more.");
        t.update(treeRef, { aiTokenBalance: balance - amount });
        return balance - amount;
    });
}
