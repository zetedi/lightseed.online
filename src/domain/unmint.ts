import type { DomainKey } from './words';

// THE UNMINT (ring 2026-08-15) — taking back an accidental mint without wounding the chain.
// Only the HEAD block may be taken back: the chain is shortened by exactly its newest link,
// never severed in the middle (mid-chain deletes are refused by the rules outright). Only
// the AUTHOR's hand; and a guardian-witnessed watering stands forever — its light is already
// minted and rays are append-only: unminting it would orphan kindled light.
//
// Plain contract — guaranteed: the refusals here mirror firestore.rules' unmint branch
// exactly (author, tree_growth, head-only, unwitnessed), and the service's transaction rolls
// the head back atomically or not at all. Not guaranteed: the unmade block leaves no mark —
// an unmint is an erasure of the newest link by the hand that just forged it, not a
// retraction; if a record of the mistake matters, retract instead (where retraction exists).

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
  if (pulse.type !== 'tree_growth' || !pulse.lifetreeId) return 'unmint_not_mint';
  if (pulse.wateringConfirmedBy === 'guardian') return 'unmint_witnessed';
  if (!pulse.hash || tree.latestHash !== pulse.hash) return 'unmint_not_last';
  return null;
};
