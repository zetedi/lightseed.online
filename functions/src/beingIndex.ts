// THE LID INDEX, server side — the pure half, with no Firestore in reach.
//
// Functions is its own TS project and cannot import src/domain, so this module MIRRORS
// src/domain/beingIndex.ts. The mirror is held true by the ROOT test suite
// (tests/beingIndex.test.ts imports BOTH and compares), so the two laws can never drift apart
// silently — the same arrangement mint.ts has with light.ts.
//
// index.ts owns only the plumbing: a trigger hands in where it stands, which document, and the
// true name that document carries; this module says whether that deserves an entry.

export type BeingKind = 'person' | 'tree' | 'vision' | 'lightHouse' | 'community' | 'pulse';

export const COLLECTION_FOR_KIND: Record<BeingKind, string> = {
    person: "users",
    tree: "lifetrees",
    vision: "visions",
    lightHouse: "lightHouses",
    community: "communities",
    pulse: "pulses",
};

// A true name is a UUIDv7 — birth-time in its first bits (the LIN invariant). Mirrored from
// src/domain/dataAuthority.isLid, which the app half of this law reuses.
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const isLid = (value: unknown): value is string =>
    typeof value === "string" && UUID_V7.test(value);

export interface BeingEntry {
    lid: string;
    kind: BeingKind;
    collection: string;
    docId: string;
}

export const kindForCollection = (collection: string): BeingKind | null => {
    const found = (Object.keys(COLLECTION_FOR_KIND) as BeingKind[])
        .find((kind) => COLLECTION_FOR_KIND[kind] === collection);
    return found ?? null;
};

// The entry a document deserves, or null if it deserves none: a collection the index does not
// address (links, alignments, covenants, invites, the mail queue) and a document carrying no
// true name both answer null and are let alone.
export const entryFor = (collection: string, docId: string, lid: unknown): BeingEntry | null => {
    const kind = kindForCollection(collection);
    if (!kind) return null;
    if (!isLid(lid)) return null;
    if (typeof docId !== "string" || !docId.trim()) return null;
    return { lid, kind, collection, docId };
};
