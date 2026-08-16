// Planting limits — the forest grows by quality, not quantity.
//
// The personal cap is the Earth: a being may plant as many lifetrees as there are UN member
// states, one tree to a country, one lightseed citizenship each (the keeper's decision,
// 2026-07-19). Guarding stays intimate: 132 trees one can truly know. Each node may set its
// own caps (config/limits, edited on the node admin page); these defaults apply until it
// does. The caps are not a wall but an invitation to deepen what already lives; the refusal
// message IS the point, so it lives here with the numbers it explains.

import { isBedTree } from './bed';
import { spokenLine } from './words';

// The UN roll as of 2026 (South Sudan joined in 2011, none since). If the roll changes,
// this constant changes with it, in its own ring.
export const UN_MEMBER_STATES = 193;

export const DEFAULT_MAX_LIFETREES = UN_MEMBER_STATES;
export const DEFAULT_MAX_GUARDED_TREES = 132;

// NODE FULLNESS (ring 2026-08-17) — a node hosts at most 144 communities, of which at
// most 12 may be FACES (portals with their own apex domain and hosting site — the twelve
// that kiss the center; 12 is the kissing number in three dimensions, and it sits inside
// Firebase's real per-project ceiling with margin). Faces ARE hosted — 12 ⊂ 144, one
// number for fullness, one for embodiment. THE CAP IS THE REPRODUCTIVE TRIGGER, not a
// wall: the 145th arrival is the moment the node's duty becomes midwifery — a new node
// born through the Crossing, the charter at the head of the bundle. Without a fullness
// law the Crossing is disaster recovery; with one, it is the reproductive system.
export const DEFAULT_MAX_NODE_FACES = 12;
export const DEFAULT_MAX_NODE_COMMUNITIES = 144;

export interface NodeLimits {
  maxLifetrees: number;
  maxGuardedTrees: number;
  maxNodeFaces: number;
  maxNodeCommunities: number;
}

export const DEFAULT_NODE_LIMITS: NodeLimits = {
  maxLifetrees: DEFAULT_MAX_LIFETREES,
  maxGuardedTrees: DEFAULT_MAX_GUARDED_TREES,
  maxNodeFaces: DEFAULT_MAX_NODE_FACES,
  maxNodeCommunities: DEFAULT_MAX_NODE_COMMUNITIES,
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
    maxNodeFaces: num(raw?.maxNodeFaces, DEFAULT_MAX_NODE_FACES),
    maxNodeCommunities: num(raw?.maxNodeCommunities, DEFAULT_MAX_NODE_COMMUNITIES),
  };
};

// The node's fullness gate. `hostedCount` counts the node's communities EXCLUDING the
// auto-born tree circles (formation 'tree_co_ownership') — those are the shadow of the
// planting caps, not social spaces someone founded; counting them would make one law eat
// the other. `faceCount` counts communities holding a hosting face. The refusal for
// fullness is deliberately not a "no": it says it is time to SEED.
export const nodeCapacityGate = (
  counts: { hostedCount: number; faceCount: number },
  next: 'community' | 'face',
  limits: NodeLimits = DEFAULT_NODE_LIMITS,
): string | null => {
  if (next === 'face' && counts.faceCount >= limits.maxNodeFaces) {
    return spokenLine('node_faces_full', { max: limits.maxNodeFaces });
  }
  if (counts.hostedCount >= limits.maxNodeCommunities) {
    return spokenLine('node_full_seed', { max: limits.maxNodeCommunities });
  }
  return null;
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
    return spokenLine('limit_lifetrees', { max: limits.maxLifetrees });
  }
  if (type === 'GUARDED' && guarded >= limits.maxGuardedTrees) {
    return spokenLine('limit_guarded', { max: limits.maxGuardedTrees });
  }
  return null;
};
