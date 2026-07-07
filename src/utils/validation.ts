import type { Lifetree } from '../types';

const NON_EXPLICIT_VALIDATORS = new Set(['SYSTEM', 'GENESIS']);

export const isExplicitlyValidatedTree = (tree?: Pick<Lifetree, 'validated' | 'validatorId' | 'isNature'> | null) =>
  Boolean(tree && !tree.isNature && tree.validated && tree.validatorId && !NON_EXPLICIT_VALIDATORS.has(tree.validatorId));

// --- Validation as living care -------------------------------------------------------
// A tree's validation is not a permanent stamp; it stays lit only while the tree is tended
// (a real growth pulse or an explicit confirm) within the window. Untended, it DIMS — the
// stamp remains, but it no longer counts until re-tended. You keep standing by caring.
export const VALIDATION_WINDOW_MS = 365 * 24 * 3600 * 1000; // a year
export const VALIDATION_FADING_MS = 30 * 24 * 3600 * 1000;  // nudge in the last month

const toMs = (t: any): number => (t && typeof t.toMillis === 'function' ? t.toMillis() : (typeof t === 'number' ? t : 0));

// When the tree was last tended — last explicit tend / growth, falling back to update/birth.
export const lastTendedMillis = (tree?: Pick<Lifetree, 'lastTendedAt' | 'updatedAt' | 'createdAt'> | null): number =>
  toMs((tree as any)?.lastTendedAt) || toMs((tree as any)?.updatedAt) || toMs((tree as any)?.createdAt) || 0;

// Validated AND tended within the window — the badge is lit and the standing counts.
export const isValidationLive = (tree?: Lifetree | null, now: number = Date.now()): boolean =>
  isExplicitlyValidatedTree(tree) && (now - lastTendedMillis(tree) < VALIDATION_WINDOW_MS);

// Validated, but gone quiet — needs tending to re-light.
export const isValidationLapsed = (tree?: Lifetree | null, now: number = Date.now()): boolean =>
  isExplicitlyValidatedTree(tree) && !isValidationLive(tree, now);

// Still live, but inside the last month — time for the gentle nudge.
export const isValidationFading = (tree?: Lifetree | null, now: number = Date.now()): boolean => {
  if (!isExplicitlyValidatedTree(tree)) return false;
  const remaining = VALIDATION_WINDOW_MS - (now - lastTendedMillis(tree));
  return remaining > 0 && remaining < VALIDATION_FADING_MS;
};

// Days left before the validation dims (0 if already lapsed).
export const daysUntilLapse = (tree?: Lifetree | null, now: number = Date.now()): number =>
  Math.max(0, Math.ceil((VALIDATION_WINDOW_MS - (now - lastTendedMillis(tree))) / (24 * 3600 * 1000)));

export const canValidateTree = ({
  tree,
  myActiveTree,
  isSuperAdmin,
  isInitiate,
}: {
  tree?: Lifetree | null;
  myActiveTree?: Lifetree | null;
  isSuperAdmin?: boolean;
  isInitiate?: boolean;
}) => {
  if (!tree || tree.isNature || isExplicitlyValidatedTree(tree)) return false;
  // An initiate (the git-ledger membership) is a root of the validation web of trust.
  if (isSuperAdmin || isInitiate) return true;
  // Only a LIVE (tended) validator can pass validation on — a lapsed one must tend first.
  return Boolean(myActiveTree && isValidationLive(myActiveTree) && myActiveTree.id !== tree.id);
};

export const canToggleValidation = ({
  tree,
  myActiveTree,
  isAdmin,
  isSuperAdmin,
  isInitiate,
}: {
  tree?: Lifetree | null;
  myActiveTree?: Lifetree | null;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  isInitiate?: boolean;
}) => {
  if (!tree || tree.isNature) return false;
  // Un-validating stays staff-only; initiates only pass validation ON.
  if (isExplicitlyValidatedTree(tree)) return Boolean(isSuperAdmin || isAdmin);
  if (isSuperAdmin || isAdmin || isInitiate) return true;
  return Boolean(myActiveTree && isValidationLive(myActiveTree) && myActiveTree.id !== tree.id);
};
