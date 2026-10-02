// THE TREE KINDS THAT ROOT A BEING — the server's copy of src/domain/secretTree.ts, held equal by
// tests/secretTree.test.ts. A bed is furniture; a secret tree grants nothing outside itself.
export const SECRET_TREE_TYPE = "SECRET";
export const MAX_SECRET_TREES = 12;
export const isSecretTree = (t: { treeType?: unknown } | null | undefined): boolean =>
    !!t && t.treeType === SECRET_TREE_TYPE;
// A secret tree's only seat is keeping (mirror of domain/secretTree invitableRolesFor).
export const secretRoleAllowed = (t: { treeType?: unknown } | null | undefined, role: unknown): boolean =>
    !isSecretTree(t) || role === "keeper";
export const rootsABeing = (t: { treeType?: unknown } | null | undefined): boolean =>
    !!t && t.treeType !== "BED" && t.treeType !== SECRET_TREE_TYPE;
// THE SECRET CIRCLE (mirror of domain/secretTree circleLedgerFor): a secret tree's keeper seats
// live in `secretLinks`, read by the circle alone; every other tree's in the world-readable `links`.
export const OPEN_LINKS = "links";
export const SECRET_LINKS = "secretLinks";
export const circleLedgerFor = (t: { treeType?: unknown } | null | undefined): string =>
    isSecretTree(t) ? SECRET_LINKS : OPEN_LINKS;
