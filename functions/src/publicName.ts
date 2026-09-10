// MIRROR of src/domain/publicName.ts (ring 2026-09-10) — keep the two in step.
// A being chooses whether its own name is spoken: anonymous, and only its tree speaks for it.
export interface NamePresence {
    displayName?: string | null;
    anonymous?: boolean | null;
    treeName?: string | null;
}

const clean = (raw: string | null | undefined): string => (raw ?? "").replace(/\s+/g, " ").trim();

export const publicNameOf = (p: NamePresence): string | null => {
    const tree = clean(p.treeName) || null;
    if (p.anonymous) return tree;
    return clean(p.displayName) || tree;
};
