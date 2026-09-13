import { PERSON_NAME_MAX, normalizePersonName, personNameProblem } from './personName';

// A TREE'S NAME (ring 2026-09-13) is a name like any being's: something is written, it fits a
// line, it carries no control characters, its whitespace is one breath wide. The law is the
// person's law, worn by a tree — one answer for "is this a name", so the two fields can never
// drift apart (tests/treeName holds them equal). Nothing here about the tree's chain: a
// name is a face, not a block; renaming rewrites no history.
export const TREE_NAME_MAX = PERSON_NAME_MAX;
export const normalizeTreeName = normalizePersonName;
export const treeNameProblem = personNameProblem;
