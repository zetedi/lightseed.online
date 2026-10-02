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
// seven, or a being's rootedness (keeping a community, witnessing a key recovery); its keepers
// need no living tree of their own; it takes no self-serve guardian, enlists in no
// event and stands in no community garden; it forms no circle community (a community document is
// world-readable — its name would betray the tree); it has no Root Vision (visions read as public);
// it is never the session's ACTIVE tree, so it signs no reach, no stay and no anonymous name
// (anchoredTreeLists below, ring 2026-10-02 — the mend).
// A keeper holds at most MAX_SECRET_TREES. NOT GUARANTEED: secrecy against the circle itself (any
// member may tell); that the WELCOME is hidden — its keeper seats live in `secretLinks`, read by the
// circle alone (THE SECRET CIRCLE below), but the `welcomed_by` mark of an arrival stays in the
// world-readable LIN: it names the newcomer and the hand that welcomed them, never the tree; that a
// growth's photo carries no place in its own bytes; secret trees sprouting from one another (the
// mycelium — a later ring).
//
// THE ONE LINE THAT KEEPS IT HONEST: a secret tree grants nothing outside itself.
//
// ITS ONLY SEAT IS KEEPING (Zoltán, 2026-10-02: "Who gets to see it in person can be a keeper."):
// a secret tree has no outer rings — no guardians watching from outside, no stewards, no
// observers. Whoever is let in to see it keeps it, as an equal. Invitations to a secret tree are
// keeper invitations only (rules, server, and the circle's picker).
export const SECRET_TREE_ROLES = ['keeper'] as const;
export const ALL_INVITABLE_ROLES = ['keeper', 'steward', 'guardian', 'observer'] as const;
export const invitableRolesFor = (t: { treeType?: string | null } | null | undefined): readonly ('keeper' | 'steward' | 'guardian' | 'observer')[] =>
  isSecretTree(t) ? SECRET_TREE_ROLES : ALL_INVITABLE_ROLES;

export const SECRET_TREE_TYPE = 'SECRET' as const;
export const MAX_SECRET_TREES = 12;

export const isSecretTree = (t: { treeType?: string | null } | null | undefined): boolean =>
  !!t && t.treeType === SECRET_TREE_TYPE;

// Does this tree ROOT a being — count as their own forest, make them a rooted keeper, carry a
// citizenship? Furniture (a bed) does not, and neither does a secret tree.
export const rootsABeing = (t: { treeType?: string | null } | null | undefined): boolean =>
  !!t && t.treeType !== 'BED' && t.treeType !== SECRET_TREE_TYPE;

// THE LISTS A SESSION HOLDS of what a being anchors (ring 2026-10-02, the mend). `personal` is what
// the being WEARS — the trees that may be its active tree, sign its reaches, stand in events, count
// on the Light Path; `nature` is what it stands for; `secret` is kept apart, so a secret tree is
// never the active tree and never stamps its name or id on anything the world reads. (The session
// split on `isNature` alone before, so a secret tree was worn like a lifetree.)
export const anchoredTreeLists = <T extends { treeType?: string | null; isNature?: boolean | null }>(
  owned: readonly T[],
): { personal: T[]; nature: T[]; secret: T[] } => {
  const open = owned.filter(t => !isSecretTree(t));
  return {
    personal: open.filter(t => !t.isNature),
    nature: open.filter(t => !!t.isNature),
    secret: owned.filter(t => isSecretTree(t)),
  };
};

// THE SECRET CIRCLE (ring 2026-10-02). Every relation is a LIN link, and the `links` ledger is
// world-readable — so a secret tree's keeper seats, written there, told anyone who asked that the
// tree exists and who keeps it. A secret tree's seats live instead in `secretLinks`: the same
// link, the same id (`from__keeper__to`), a ledger only the tree's own circle (and staff) may
// read and only the server's hand may write. Plain contract — GUARANTEED (rules, server, emulator
// tests): a seat on a secret tree is minted into `secretLinks` and nowhere else; it carries every
// power a keeper link carries (the rules' isTreeKeeper reads both ledgers for a secret tree, and
// the secret one for no other kind); no one outside the circle can read or list it. NOT GUARANTEED: a seat minted before this ring stays in `links`
// until `scripts/secret-circle.mjs --write` moves it (both ledgers are honoured meanwhile).
export const OPEN_LINKS = 'links' as const;
export const SECRET_LINKS = 'secretLinks' as const;
export const circleLedgerFor = (t: { treeType?: string | null } | null | undefined): typeof OPEN_LINKS | typeof SECRET_LINKS =>
  isSecretTree(t) ? SECRET_LINKS : OPEN_LINKS;

// One circle from two ledgers: the same seat found in both (a tree mid-move) is one seat.
export const mergeLinks = <L extends { from: string; rel: string; to: string }>(...ledgers: readonly L[][]): L[] => {
  const seen = new Set<string>();
  const out: L[] = [];
  for (const l of ledgers.flat()) {
    const id = `${l.from}__${l.rel}__${l.to}`;
    if (!seen.has(id)) { seen.add(id); out.push(l); }
  }
  return out;
};
