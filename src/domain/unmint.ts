import type { DomainKey } from './words';

// THE UNMINT (ring 2026-08-15) — taking back an accidental mint without wounding the chain.
// Only the HEAD block may be taken back: the chain is shortened by exactly its newest link,
// never severed in the middle (mid-chain deletes are refused by the rules outright). Only
// the AUTHOR's hand. ANY block kind at the head qualifies — a growth, a tree-sent reach, an
// alignment — because the severing argument binds only BELOW the head; until the tree speaks
// again, the newest word can be unsaid whole (a head reach unsaid is the message fully
// unsent, the room's copy included). Two stand forever: a guardian-witnessed watering (its
// light is already minted; rays are append-only) and decisions (their own lifecycle law).
//
// Plain contract — guaranteed: the refusals here mirror firestore.rules' unmint branch
// exactly (author, tree-chain block, head-only, unwitnessed, not a decision), and the
// service's transaction rolls the head back atomically or not at all. Not guaranteed: the
// unmade block leaves no mark — an unmint is an erasure of the newest link by the hand that
// just forged it, not a retraction; below the head, retraction remains the way.

export interface UnmintPulseFacts {
  authorId?: string;
  type?: string;
  lifetreeId?: string;
  hash?: string;
  wateringConfirmedBy?: string;
}

export type UnmintRefusal = Extract<DomainKey,
  'unmint_not_author' | 'unmint_not_mint' | 'unmint_not_last' | 'unmint_witnessed'>;

export const unmintRefusal = (
  pulse: UnmintPulseFacts,
  tree: { latestHash?: string },
  viewerUid: string | undefined,
): UnmintRefusal | null => {
  if (!viewerUid || pulse.authorId !== viewerUid) return 'unmint_not_author';
  if (!pulse.lifetreeId || !pulse.hash || pulse.type === 'decision') return 'unmint_not_mint';
  if (pulse.wateringConfirmedBy === 'guardian') return 'unmint_witnessed';
  if (tree.latestHash !== pulse.hash) return 'unmint_not_last';
  return null;
};
