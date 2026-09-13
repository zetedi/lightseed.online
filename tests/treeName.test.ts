import { describe, it, expect } from 'vitest';
import { TREE_NAME_MAX, normalizeTreeName, treeNameProblem } from '../src/domain/treeName';
import { PERSON_NAME_MAX, normalizePersonName, personNameProblem } from '../src/domain/personName';

// One law for a name, whoever wears it: the tree's field and the person's field must always
// agree on what a name is, or the same string would stand on one being and fall on another.
describe('a tree wears the person\'s name law', () => {
  it('is the same law, not a copy', () => {
    expect(TREE_NAME_MAX).toBe(PERSON_NAME_MAX);
    expect(normalizeTreeName).toBe(normalizePersonName);
    expect(treeNameProblem).toBe(personNameProblem);
  });
  it('answers as a name law does', () => {
    expect(treeNameProblem('Mahameru')).toBeNull();
    expect(normalizeTreeName('  The   Listening   Root ')).toBe('The Listening Root');
    expect(treeNameProblem('')).toBe('name_empty');
    expect(treeNameProblem('a'.repeat(TREE_NAME_MAX + 1))).toBe('name_long');
  });
});
