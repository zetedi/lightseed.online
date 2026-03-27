import type { Lifetree } from '../types';

const NON_EXPLICIT_VALIDATORS = new Set(['SYSTEM', 'GENESIS']);

export const isExplicitlyValidatedTree = (tree?: Pick<Lifetree, 'validated' | 'validatorId' | 'isNature'> | null) =>
  Boolean(tree && !tree.isNature && tree.validated && tree.validatorId && !NON_EXPLICIT_VALIDATORS.has(tree.validatorId));

export const canValidateTree = ({
  tree,
  myActiveTree,
  isSuperAdmin,
}: {
  tree?: Lifetree | null;
  myActiveTree?: Lifetree | null;
  isSuperAdmin?: boolean;
}) => {
  if (!tree || tree.isNature || isExplicitlyValidatedTree(tree)) return false;
  if (isSuperAdmin) return true;
  return Boolean(myActiveTree && isExplicitlyValidatedTree(myActiveTree) && myActiveTree.id !== tree.id);
};
