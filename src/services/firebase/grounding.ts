import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { Lifetree, Vision, Link } from '../../types';
import { GROUNDED_IN, GROUND_REQUEST } from '../../domain/grounding';
import { msOf } from '../../domain/time';
import { db, functions, mapDoc } from './core';
import { graphStore } from '../../services/store';

// THE GROUND, FROM THE SHELL (domain/grounding, ring 2026-11-17). A vision stands in a tree
// through a `grounded_in` link the SERVER mints; the shell only asks. Three callables carry the
// three acts (functions/src/grounding.ts) and every refusal comes back as a dictionary key.
//   askGround     the vision's author knocks at a tree;
//   acceptGround  a carer of the tree says yes — or grows their own vision from their own tree
//                 in one act (no knock needed when the two hands are one);
//   releaseGround either side lets a standing ground go.
// A knock is withdrawn by its author, or declined by a carer of the tree, as a plain link delete
// the rules allow.

type Ids = { visionId: string; treeId: string };
const call = async <R>(name: string, ids: Ids): Promise<R> => (await httpsCallable<Ids, R>(functions, name)(ids)).data;

export const askGround = async (visionId: string, treeId: string): Promise<void> => { await call('askGround', { visionId, treeId }); };
export const acceptGround = async (visionId: string, treeId: string): Promise<void> => { await call('acceptGround', { visionId, treeId }); };
export const releaseGround = async (visionId: string, treeId: string): Promise<void> => { await call('releaseGround', { visionId, treeId }); };
export const dropGroundAsk = (visionId: string, treeId: string): Promise<void> => graphStore.unlink(visionId, GROUND_REQUEST, treeId);

// What a face needs of one ground: the being at the other end (null when it is gone, or hidden
// from this reader) and how the ground was made.
// `createdAtMs` is when the ground was made (null when the link carries no moment): the eldest
// ground is a vision's home when none is a birth ground (domain/grounding homeGroundOf).
export interface GroundOf<T> { id: string; being: T | null; self: boolean; birth: boolean; createdAtMs: number | null }

const linksAt = async (end: 'from' | 'to', id: string, rel: string) =>
    (await getDocs(query(collection(db, 'links'), where(end, '==', id), where('rel', '==', rel)))).docs.map(d => d.data() as Partial<Link> & { self?: boolean; birth?: boolean });

const beingAt = async <T>(col: 'lifetrees' | 'visions', id: string): Promise<T | null> => {
    try {
        const snap = await getDoc(doc(db, col, id));
        return snap.exists() ? mapDoc<T>(snap) : null;
    } catch { return null; } // not this reader's to see
};

const ends = async <T>(end: 'from' | 'to', id: string, rel: string, col: 'lifetrees' | 'visions'): Promise<GroundOf<T>[]> => {
    const links = await linksAt(end, id, rel);
    return Promise.all(links.map(async l => {
        const other = String((end === 'from' ? l.to : l.from) || '');
        return { id: other, being: await beingAt<T>(col, other), self: !!l.self, birth: !!l.birth, createdAtMs: msOf(l.createdAt) || null };
    }));
};

// The trees a vision stands in, and the trees it is still asking.
export const getGroundsOfVision = (visionId: string): Promise<GroundOf<Lifetree>[]> => ends<Lifetree>('from', visionId, GROUNDED_IN, 'lifetrees');
export const getGroundAsksOfVision = (visionId: string): Promise<GroundOf<Lifetree>[]> => ends<Lifetree>('from', visionId, GROUND_REQUEST, 'lifetrees');
// The visions a tree grounds, and the visions knocking at it.
export const getVisionsGroundedIn = (treeId: string): Promise<GroundOf<Vision>[]> => ends<Vision>('to', treeId, GROUNDED_IN, 'visions');
export const getGroundAsksAt = (treeId: string): Promise<GroundOf<Vision>[]> => ends<Vision>('to', treeId, GROUND_REQUEST, 'visions');
