// THE GROUND ON THIS SOIL (ring 2026-11-17): the same four acts and four readings the Firebase
// backend offers (../firebase/grounding), spoken to the node's own hands — POST
// /v1/grounding/command (seed/api/grounding.mjs over seed/schema/064), where the shared law
// (domain/grounding) is judged under locks. The readings walk the LIN through the graph port and
// hydrate each end through the ordinary reads, so a being this reader may not see comes back null,
// as on the origin.
import type * as F from '../firebase/grounding';
import type { Lifetree, Vision, Link } from '../../types';
import { GROUNDED_IN, GROUND_REQUEST } from '../../domain/grounding';
import { session } from './core';
import { graphStore } from './store';
import { getLifetreeById } from './pulses';
import { getVisionById } from './spaces';

export type { GroundOf } from '../firebase/grounding';

const act = (action: 'ask' | 'drop' | 'accept' | 'release') => async (visionId: string, treeId: string): Promise<void> => {
    await session.groundCommand({ action, visionId, treeId });
};
export const askGround: typeof F.askGround = act('ask');
export const acceptGround: typeof F.acceptGround = act('accept');
export const releaseGround: typeof F.releaseGround = act('release');
export const dropGroundAsk: typeof F.dropGroundAsk = act('drop');

type GroundLink = Link & { self?: boolean; birth?: boolean };
const ends = async <T>(links: Link[], end: 'from' | 'to', read: (id: string) => Promise<T | null>): Promise<F.GroundOf<T>[]> =>
    Promise.all((links as GroundLink[]).map(async l => {
        const id = String(l[end] || '');
        return { id, being: await read(id).catch(() => null), self: !!l.self, birth: !!l.birth };
    }));

export const getGroundsOfVision: typeof F.getGroundsOfVision = async (visionId) =>
    ends<Lifetree>(await graphStore.linksFrom(visionId, GROUNDED_IN), 'to', getLifetreeById);
export const getGroundAsksOfVision: typeof F.getGroundAsksOfVision = async (visionId) =>
    ends<Lifetree>(await graphStore.linksFrom(visionId, GROUND_REQUEST), 'to', getLifetreeById);
export const getVisionsGroundedIn: typeof F.getVisionsGroundedIn = async (treeId) =>
    ends<Vision>(await graphStore.linksTo(treeId, GROUNDED_IN), 'from', getVisionById);
export const getGroundAsksAt: typeof F.getGroundAsksAt = async (treeId) =>
    ends<Vision>(await graphStore.linksTo(treeId, GROUND_REQUEST), 'from', getVisionById);
