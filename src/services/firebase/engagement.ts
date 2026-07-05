import { query, getDocs, addDoc, serverTimestamp, doc, runTransaction, getDoc, where } from 'firebase/firestore';
import { type Lifetree, type Alignment } from '../../types';
import { createBlock } from '../../utils/crypto';
import { db, mapDoc, pulsesCollection, alignmentsCollection } from './core';

export const proposeAlignment = (data: any) => addDoc(alignmentsCollection, { ...data, status: 'PENDING', createdAt: serverTimestamp() });
export const getPendingAlignments = async (uid: string) => (await getDocs(query(alignmentsCollection, where('targetUid', '==', uid), where('status', '==', 'PENDING')))).docs.map(d => (mapDoc(d) as Alignment));

export const getMyAlignmentsHistory = async (uid: string) => {
    const [s1, s2] = await Promise.all([getDocs(query(alignmentsCollection, where('targetUid', '==', uid), where('status', '==', 'ACCEPTED'))), getDocs(query(alignmentsCollection, where('initiatorUid', '==', uid), where('status', '==', 'ACCEPTED')))]);
    return [...s1.docs, ...s2.docs].map(d => (mapDoc(d) as Alignment)).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}

export const acceptAlignment = async (proposalId: string) => {
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

        t.set(doc(pulsesCollection), {
            lifetreeId: proposal.initiatorTreeId, type: 'standard', title: 'Alignment', body: 'Pulse Sync',
            isMatch: true, authorId: proposal.initiatorUid, authorName: 'System',
            createdAt: serverTimestamp(), hash: initHash
        });
        t.update(initTreeRef, { latestHash: initHash, blockHeight: initTree.blockHeight + 1 });

        t.set(doc(pulsesCollection), {
            lifetreeId: proposal.targetTreeId, type: 'standard', title: 'Alignment', body: 'Pulse Sync',
            isMatch: true, authorId: proposal.targetUid, authorName: 'System',
            createdAt: serverTimestamp(), hash: targetHash
        });
        t.update(targetTreeRef, { latestHash: targetHash, blockHeight: targetTree.blockHeight + 1 });

        t.update(matchRef, { status: 'ACCEPTED' });
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

        const treeId = pulseData.lifetreeId;
        const authorTreeRef = treeId ? doc(db, 'lifetrees', treeId) : null;
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
