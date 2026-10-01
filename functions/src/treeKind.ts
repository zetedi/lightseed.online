// THE TREE KINDS THAT ROOT A BEING — the server's copy of src/domain/secretTree.ts, held equal by
// tests/secretTree.test.ts. A bed is furniture; a secret tree grants nothing outside itself.
export const SECRET_TREE_TYPE = "SECRET";
export const MAX_SECRET_TREES = 12;
export const isSecretTree = (t: { treeType?: unknown } | null | undefined): boolean =>
    !!t && t.treeType === SECRET_TREE_TYPE;
export const rootsABeing = (t: { treeType?: unknown } | null | undefined): boolean =>
    !!t && t.treeType !== "BED" && t.treeType !== SECRET_TREE_TYPE;
