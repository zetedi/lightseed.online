// Planting limits — the forest grows by quality, not quantity.
//
// The personal cap is the Earth: a being may plant as many lifetrees as there are UN member
// states, one tree to a country, one lightseed citizenship each (the keeper's decision,
// 2026-07-19). Guarding stays intimate: 132 trees one can truly know. Each node may set its
// own caps (config/limits, edited on the node admin page); these defaults apply until it
// does. The caps are not a wall but an invitation to deepen what already lives; the refusal
// message IS the point, so it lives here with the numbers it explains.

import { isBedTree } from './bed';

// The UN roll as of 2026 (South Sudan joined in 2011, none since). If the roll changes,
// this constant changes with it, in its own ring.
export const UN_MEMBER_STATES = 193;

export const DEFAULT_MAX_LIFETREES = UN_MEMBER_STATES;
export const DEFAULT_MAX_GUARDED_TREES = 132;

export interface NodeLimits {
  maxLifetrees: number;
  maxGuardedTrees: number;
}

export const DEFAULT_NODE_LIMITS: NodeLimits = {
  maxLifetrees: DEFAULT_MAX_LIFETREES,
  maxGuardedTrees: DEFAULT_MAX_GUARDED_TREES,
};

// Coerce whatever the config doc holds into sane caps (missing/invalid → defaults).
export const normalizeNodeLimits = (raw: any): NodeLimits => {
  const num = (v: any, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
  };
  return {
    maxLifetrees: num(raw?.maxLifetrees, DEFAULT_MAX_LIFETREES),
    maxGuardedTrees: num(raw?.maxGuardedTrees, DEFAULT_MAX_GUARDED_TREES),
  };
};

type TreeLike = { treeType?: string; isNature?: boolean };

const isGuarded = (t: TreeLike): boolean => t.treeType === 'GUARDED' || (!t.treeType && t.isNature === true);

// Returns the refusal message when planting one more tree of `type` would cross a cap,
// or null when the planting may proceed.
export const treePlantingGate = (
  existing: TreeLike[],
  type: 'LIFETREE' | 'GUARDED',
  limits: NodeLimits = DEFAULT_NODE_LIMITS,
): string | null => {
  // Beds (domain/bed.ts) are a Light House's furniture, not the keeper's personal forest —
  // they never count against either cap (mirrored server-side in functions/onLifetreeCreated).
  const countable = existing.filter(t => !isBedTree(t));
  const guarded = countable.filter(isGuarded).length;
  const lifetrees = countable.length - guarded;

  if (type === 'LIFETREE' && lifetrees >= limits.maxLifetrees) {
    return `You already tend ${limits.maxLifetrees} lifetree${limits.maxLifetrees === 1 ? '' : 's'}: a tree for every country of the Earth. We would like quality, not quantity: deepen the trees you have, and let each one truly live.`;
  }
  if (type === 'GUARDED' && guarded >= limits.maxGuardedTrees) {
    return `You already guard ${limits.maxGuardedTrees} tree${limits.maxGuardedTrees === 1 ? '' : 's'}: a whole grove. We would like quality, not quantity: tend the ones in your care before standing for more.`;
  }
  return null;
};
