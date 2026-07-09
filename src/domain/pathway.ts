// The Pathway — the trail a being walks through the forest, from first click to a sovereign
// community on its own domain. Pure and testable: `derivePathway` reads plain facts (already
// available in the app shell) and answers two questions — where does this being stand, and
// what is THE ONE next step? The UI (PathwayCTA) renders only that step, so the trail guides
// without nagging. Stages are a ladder: the stage is the first unmet milestone.
//
//   visitor   → sign up / request an invite
//   invited   → plant (or adopt) a tree
//   rooted    → tend / water it
//   tending   → connect (reach, guard, participate)
//   connected → become a community member
//   member    → follow a vision
//   visionary → invite a circle into shared care of your tree
//   circling  → your circle is already a community — name it (the keystone)
//   founding  → root it on its own domain, then tailor its appearance
//   sovereign → the path is walked; keep tending

export type PathwayStage =
  | 'visitor'
  | 'invited'
  | 'rooted'
  | 'tending'
  | 'connected'
  | 'member'
  | 'visionary'
  | 'circling'
  | 'founding'
  | 'sovereign';

// Ordered ladder — index in this array is the progress shown by the UI's dots.
export const PATHWAY_STAGES: readonly PathwayStage[] = [
  'visitor', 'invited', 'rooted', 'tending', 'connected',
  'member', 'visionary', 'circling', 'founding', 'sovereign',
];

// Every actionable step on the trail. 'founding' carries two steps (domain, then theme);
// every other stage carries one. Dismissals key on the STEP, so a finer nudge never
// resurrects a dismissed coarser one.
export type PathwayStepKey =
  | 'signUp'
  | 'plant'
  | 'tend'
  | 'connect'
  | 'join'
  | 'followVision'
  | 'formCircle'
  | 'nameCommunity'
  | 'rootDomain'
  | 'tailorTheme';

export interface PathwayStep {
  key: PathwayStepKey;
  label: string;
  description: string;
}

// Tending is a practice, not a checkbox: a tree tended longer ago than this window (or with
// an overdue watering) pulls the path back to 'rooted' until it's cared for again.
export const PATHWAY_TEND_WINDOW_MS = 30 * 24 * 3600 * 1000; // a month

export interface PathwayInput {
  signedIn: boolean;
  myTreesCount: number;       // trees the being owns
  guardedCount: number;       // trees the being guards (adopting counts as rooting)
  // Epoch millis of the most recent explicit tend across own/guarded trees.
  // null = has trees but none ever explicitly tended (planting alone is not tending).
  lastTendedAtMs: number | null;
  wateringOverdue: boolean;   // any of their trees past its watering due moment
  connectionsCount: number;   // alignments + reaches — threads to other beings
  isMember: boolean;          // holds a 'member' link to any community
  followedVisionsCount: number; // 'joined' links to visions
  circleSize: number;         // co_owner + steward links into their own trees
  ownsCommunity: boolean;
  communityHasCustomDomain: boolean; // their community's domain is not a hub domain
  communityHasTheme: boolean;        // their community has a tailored theme
}

export interface PathwayState {
  stage: PathwayStage;
  stageIndex: number;               // position on the ladder (0-based)
  stageCount: number;               // PATHWAY_STAGES.length — for "n / count" hints
  next: PathwayStep | null;         // null only at 'sovereign' — nothing left to prompt
}

const STEPS: Record<PathwayStepKey, PathwayStep> = {
  signUp: {
    key: 'signUp',
    label: 'Step into the forest',
    description: 'Request an invite or sign in — your path starts with a single seed.',
  },
  plant: {
    key: 'plant',
    label: 'Plant your lifetree',
    description: 'A living node of your own — plant a tree or adopt one to guard.',
  },
  tend: {
    key: 'tend',
    label: 'Tend your tree',
    description: 'Water it, snap its growth — a tree stays alive through care.',
  },
  connect: {
    key: 'connect',
    label: 'Connect with the forest',
    description: 'Reach another tree, guard one, or align a pulse — roots grow toward each other.',
  },
  join: {
    key: 'join',
    label: 'Stand with a community',
    description: 'Become a member of a community whose care you share.',
  },
  followVision: {
    key: 'followVision',
    label: 'Follow a vision',
    description: 'Join a vision growing in the forest and lend it your attention.',
  },
  formCircle: {
    key: 'formCircle',
    label: 'Form a tree circle',
    description: 'Invite a co-guardian or steward into shared care of your tree.',
  },
  nameCommunity: {
    key: 'nameCommunity',
    label: 'Your circle is already a community. Name it?',
    description: 'People already share care of your tree — give the circle a name and a home.',
  },
  rootDomain: {
    key: 'rootDomain',
    label: 'Root it on your own domain',
    description: 'Deploy your community as a sovereign node on its own address.',
  },
  tailorTheme: {
    key: 'tailorTheme',
    label: 'Tailor its appearance',
    description: 'Give your node its own colours, logo and light.',
  },
};

const state = (stage: PathwayStage, next: PathwayStepKey | null): PathwayState => ({
  stage,
  stageIndex: PATHWAY_STAGES.indexOf(stage),
  stageCount: PATHWAY_STAGES.length,
  next: next ? STEPS[next] : null,
});

// Where does this being stand, and what's the one next step? The ladder reads top-down:
// the first unmet milestone names the stage and its step. `now` is injectable for tests
// (and keeps callers' render paths pure — no clock reads inside a useMemo).
export const derivePathway = (input: PathwayInput, now: number = Date.now()): PathwayState => {
  if (!input.signedIn) return state('visitor', 'signUp');
  if (input.myTreesCount + input.guardedCount === 0) return state('invited', 'plant');
  // Never tended, gone quiet, or watering overdue — the path returns to care.
  if (input.lastTendedAtMs === null || now - input.lastTendedAtMs > PATHWAY_TEND_WINDOW_MS || input.wateringOverdue) {
    return state('rooted', 'tend');
  }
  if (input.guardedCount === 0 && input.connectionsCount === 0) return state('tending', 'connect');
  if (!input.isMember) return state('connected', 'join');
  if (input.followedVisionsCount === 0) return state('member', 'followVision');
  if (input.circleSize === 0) return state('visionary', 'formCircle');
  if (!input.ownsCommunity) return state('circling', 'nameCommunity');
  if (!input.communityHasCustomDomain) return state('founding', 'rootDomain');
  if (!input.communityHasTheme) return state('founding', 'tailorTheme');
  return state('sovereign', null);
};
