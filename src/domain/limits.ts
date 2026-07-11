// Planting limits — the forest grows by quality, not quantity.
//
// One being can truly tend only so much: by default 12 lifetrees and 132 guarded trees —
// 144 in all. Each node may set its own caps (config/limits, edited on the node admin page);
// these defaults apply until it does. The caps are not a wall but an invitation to deepen
// what already lives; the refusal message IS the point, so it lives here with the numbers
// it explains.

export const DEFAULT_MAX_LIFETREES = 12;
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
  const guarded = existing.filter(isGuarded).length;
  const lifetrees = existing.length - guarded;

  if (type === 'LIFETREE' && lifetrees >= limits.maxLifetrees) {
    return `You already tend ${limits.maxLifetrees} lifetree${limits.maxLifetrees === 1 ? '' : 's'} — a full personal forest. We would like quality, not quantity: deepen the trees you have, and let each one truly live.`;
  }
  if (type === 'GUARDED' && guarded >= limits.maxGuardedTrees) {
    return `You already guard ${limits.maxGuardedTrees} tree${limits.maxGuardedTrees === 1 ? '' : 's'} — a whole grove. We would like quality, not quantity: tend the ones in your care before standing for more.`;
  }
  return null;
};
