// THE SECRET TREE (ring 2026-10-02). A tree kind beside the lifetree, the guarded tree and the bed:
// a being with a chain and a circle but no place in the world's economy. The lifetree is a
// citizenship — counted against the 193, validated by guardians, kindling light when its care is
// witnessed. A secret tree is a shared story between a few: a chain of growths, a circle of equal
// keepers, invitations as its doorway (the open door of 2026-10-01), and nothing that can be gamed
// because nothing is minted. Belonging before rooting: a friend may keep or guard one with no tree
// of their own, and when they want light or a place, the Light Path is right there.
//
// Plain contract — GUARANTEED (rules, server and this law, each tested): a secret tree is born
// private and stays private for its whole life, from every hand, staff included; it never becomes
// another kind, nor another kind it; it is never validated; witnessing its care confirms the moment
// on its chain and kindles NO light; it counts toward none of the caps (193 / 132), the sustaining
// seven, or a being's rootedness (keeping a community, witnessing a key recovery); its guardians
// and keepers need no living tree of their own; it takes no self-serve guardian, enlists in no
// event and stands in no community garden; it forms no circle community (a community document is
// world-readable — its name would betray the tree); it has no Root Vision (visions read as public).
// A keeper holds at most MAX_SECRET_TREES. NOT GUARANTEED: secrecy against the circle itself (any
// member may tell); that a growth's photo carries no place in its own bytes; secret trees sprouting
// from one another (the mycelium — a later ring).
//
// THE ONE LINE THAT KEEPS IT HONEST: a secret tree grants nothing outside itself.

export const SECRET_TREE_TYPE = 'SECRET' as const;
export const MAX_SECRET_TREES = 12;

export const isSecretTree = (t: { treeType?: string | null } | null | undefined): boolean =>
  !!t && t.treeType === SECRET_TREE_TYPE;

// Does this tree ROOT a being — count as their own forest, make them a rooted keeper, carry a
// citizenship? Furniture (a bed) does not, and neither does a secret tree.
export const rootsABeing = (t: { treeType?: string | null } | null | undefined): boolean =>
  !!t && t.treeType !== 'BED' && t.treeType !== SECRET_TREE_TYPE;
