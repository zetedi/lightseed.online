import { query, getDocs, addDoc, serverTimestamp, doc, runTransaction, getDoc, where, updateDoc, getCountFromServer, Timestamp } from 'firebase/firestore';
import { type Lifetree, type Alignment } from '../../types';
import { createBlock } from '../../utils/crypto';
import { isTokenisationEnabled } from '../../domain/tokenisation';
import { db, mapDoc, pulsesCollection, alignmentsCollection } from './core';

// What the initiator supplies; status/createdAt are stamped here, messages grow later.
export type AlignmentProposal = Omit<Alignment, 'id' | 'status' | 'createdAt' | 'messages'>;
export const proposeAlignment = (data: AlignmentProposal) => addDoc(alignmentsCollection, { ...data, status: 'PENDING', createdAt: serverTimestamp() });

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

// One alignment by id — so a sync-block leaf on a tree opens the same AlignmentProfile view as the
// profile's alignments list (an alignment pulse carries the alignment id in `matchId`).
export const getAlignmentById = async (id: string): Promise<Alignment | null> => {
    const snap = await getDoc(doc(db, 'alignments', id));
    return snap.exists() ? (mapDoc(snap) as Alignment) : null;
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
            lifetreeId: proposal.initiatorTreeId, type: 'standard', title: 'Alignment',
            body: `Aligned with ${targetTree?.name || 'another tree'}.`,
            isMatch: true, matchId: proposal.id, matchedLifetreeId: proposal.targetTreeId,
            authorId: proposal.initiatorUid, authorName: 'System',
            createdAt: serverTimestamp(), hash: initHash
        });
        t.update(initTreeRef, { latestHash: initHash, blockHeight: initTree.blockHeight + 1 });

        t.set(targetPulseRef, {
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
