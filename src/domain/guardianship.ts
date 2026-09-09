import type { DomainKey } from './words';
import type { Stamp } from './time';

// GUARDIANS OF LIGHT (ring 2026-09-09). Validation stops being a stamp and becomes a
// relationship: a lifetree is VALIDATED when another being — one who owns a living lifetree
// of their own — was asked to guard it and said yes. The asking is a link
// (tree __guardian_request__ person), the answer mints the guardian link the circle already
// knows (person __guardian__ tree), and the tree's validation stands on its guardians: it is
// LIVE while enough guardians hold living trees of their own and the tree itself is cared for
// within the window, and it DIMS when they lapse. Guarding means witnessing care, and each
// witnessed care kindles light for the tree and a seventh for the witness (domain/light) —
// so the guardians are guardians of light, and light enters only through a human hand that
// holds a living tree. An intelligence may hint; it may never guard.
//
// HOW MANY GUARDIANS validate is a dial of the Light Path (nodeLimits.guardiansToValidate,
// one by default): planting is a ceremony, and a planter who wishes a larger circle may ask
// many — each yes is support; the dial says when the tree stands validated.
//
// Plain contract — guaranteed: guardianRequestRefusal names why an asking may not be made
// (or null); guardianAnswerOutcome names what a yes or a no mints; validationStanding answers
// 'live' | 'lapsed' | 'none' from the facts alone, never from a stored flag. Not guaranteed:
// who may act — the server proves the asker owns the tree and the answerer is the one asked;
// the old stamp (validated + validatorId) is honoured by isExplicitlyValidatedTree until its
// tree gains a guardian (the seam is stated, not hidden). Enforced by tests/guardianship.test.ts.

export const GUARDIANS_TO_VALIDATE_DEFAULT = 1;
export const GUARDIAN_REQUEST_REL = 'guardian_request' as const;
export const GUARDIAN_REL = 'guardian' as const;
export const VALIDATION_WINDOW_MS = 365 * 24 * 3600 * 1000; // mirrors utils/validation — a year of care

export interface TreeFacts {
  id: string;
  ownerId: string;
  treeType?: string | null;   // 'LIFETREE' (absent = LIFETREE) | 'GUARDED' | 'BED'
  isNature?: boolean | null;
  diedAtMs?: number | null;
  lastCaredAtMs?: number | null;
}

const isLifetree = (t: Pick<TreeFacts, 'treeType' | 'isNature'>) => !t.isNature && (!t.treeType || t.treeType === 'LIFETREE');
const isAlive = (t: Pick<TreeFacts, 'diedAtMs'>) => t.diedAtMs == null;
// A LIVING LIFETREE — what a guardian must own, and what may be guarded this way.
export const isLivingLifetree = (t: Pick<TreeFacts, 'treeType' | 'isNature' | 'diedAtMs'>): boolean => isLifetree(t) && isAlive(t);

export interface GuardianRequestFacts {
  askerUid: string;
  tree: TreeFacts;
  invitee: { uid: string; ownsLivingLifetree: boolean };
  alreadyGuardian: boolean;
  pendingRequest: boolean;
}

// Why the asking may not be made — or null when it may.
export const guardianRequestRefusal = (f: GuardianRequestFacts): DomainKey | null => {
  if (f.tree.ownerId !== f.askerUid) return 'guard_not_owner';
  if (!isLifetree(f.tree)) return 'guard_not_lifetree';
  if (!isAlive(f.tree)) return 'guard_tree_dead';
  if (f.invitee.uid === f.askerUid) return 'guard_self';
  if (!f.invitee.ownsLivingLifetree) return 'guard_no_living_tree';
  if (f.alreadyGuardian) return 'guard_already';
  if (f.pendingRequest) return 'guard_pending';
  return null;
};

export type GuardianAnswer = 'accept' | 'decline';
export interface GuardianAnswerOutcome {
  mintsGuardianLink: boolean;   // person __guardian__ tree
  requestMark: 'accepted' | 'declined';
  // With this answer counted, does the tree now reach the dial?
  validates: boolean;
}

// What a yes or a no mints. `guardiansAfter` counts the tree's guardians including this yes.
export const guardianAnswerOutcome = (answer: GuardianAnswer, guardiansAfter: number, guardiansToValidate: number): GuardianAnswerOutcome => {
  const dial = Math.max(1, Math.floor(guardiansToValidate) || GUARDIANS_TO_VALIDATE_DEFAULT);
  if (answer === 'decline') return { mintsGuardianLink: false, requestMark: 'declined', validates: false };
  return { mintsGuardianLink: true, requestMark: 'accepted', validates: guardiansAfter >= dial };
};

export type ValidationStanding = 'live' | 'lapsed' | 'none';
export interface GuardianFacts { uid: string; ownTreeAlive: boolean; ownTreeCaredAtMs?: number | null }

// The tree's standing from its guardians and its care — never from a stored flag. 'none' when
// fewer guardians than the dial hold living trees; 'lapsed' when the tree (or every counting
// guardian's own tree) has gone a year without care; 'live' otherwise.
export const validationStanding = (
  tree: Pick<TreeFacts, 'diedAtMs' | 'lastCaredAtMs'>,
  guardians: readonly GuardianFacts[],
  guardiansToValidate: number,
  nowMs: number,
): ValidationStanding => {
  const dial = Math.max(1, Math.floor(guardiansToValidate) || GUARDIANS_TO_VALIDATE_DEFAULT);
  if (!isAlive(tree)) return 'none';
  const standing = guardians.filter((g) => g.ownTreeAlive);
  if (standing.length < dial) return 'none';
  const cared = (ms: number | null | undefined) => ms != null && nowMs - ms < VALIDATION_WINDOW_MS;
  if (!cared(tree.lastCaredAtMs)) return 'lapsed';
  const liveGuardians = standing.filter((g) => cared(g.ownTreeCaredAtMs));
  return liveGuardians.length >= dial ? 'live' : 'lapsed';
};

// The words for the ceremony's asking and answering — domain keys the shell speaks.
export const GUARDIAN_ASK_KEY: DomainKey = 'guard_ask';
export const GUARDIAN_ANSWER_KEYS: Record<GuardianAnswer, DomainKey> = { accept: 'guard_accept', decline: 'guard_decline' };

// Timestamps as the stores hand them, to millis — the caller feeds facts, the law never reads a doc.
export const stampMs = (s: Stamp | number | null | undefined): number | null => {
  if (s == null) return null;
  if (typeof s === 'number') return s;
  const m = (s as { toMillis?: () => number }).toMillis;
  return typeof m === 'function' ? m.call(s) : null;
};
