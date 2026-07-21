// THE MINT'S PURE LAW — every decision witnessWatering makes, with no Firestore in reach.
// Functions is its own TS project, so this module MIRRORS src/domain/light.ts; the mirror is
// held true by the ROOT test suite (tests/mint.test.ts imports both and compares), so the two
// laws can never drift apart silently (Lumo's second review, 2026-07-21). index.ts owns only
// the transaction plumbing: it gathers facts from snapshots, asks judgeWitness, and applies.

export const RAY_UNITS = 108; // the geometry of light (see src/domain/light.ts; ring 2026-07-21)
export const WITNESS_SHARE_DENOMINATOR = 7;
export const witnessShareUnits = (): number => Math.floor(RAY_UNITS / WITNESS_SHARE_DENOMINATOR);

// The UTC calendar day a care kindles in: the once-a-day denominator. Derived ONLY from the
// watering's own server birth time; a pulse without one cannot mint (the old client-supplied
// `mintedAt` fallback let the caller pick the day, so it is gone).
export const kindleDayKeyFromMs = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

// UUIDv7 (RFC 9562), mirrored from src/utils/id.ts: every Being's lid is time-ordered and
// portable (the LIN invariant; rays are beings too). The ten random bytes are a PARAMETER so
// this module stays pure and deterministic under test; index.ts hands in node:crypto's bytes.
export function uuidv7(atMs: number, random10: Uint8Array): string {
    if (random10.length < 10) throw new Error("uuidv7 needs 10 random bytes");
    const bytes = new Uint8Array(16);
    let ts = Math.max(0, Math.floor(atMs));
    for (let i = 5; i >= 0; i--) {
        bytes[i] = ts % 256;
        ts = Math.floor(ts / 256);
    }
    bytes.set(random10.subarray(0, 10), 6);
    bytes[6] = (bytes[6] & 0x0f) | 0x70;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ── THE LAST SPEND (ring 2026-07-21): where light goes when its holder leaves ─────────────
// Deletion is the final idleness, and idle light feeds the glow. The cascade: a CHOSEN HEIR
// receives the light through the prism (the glow keeps its share, the default seventh until
// per-community dials exist); with no heir each ray dissolves into its own provenance
// community's glow; with no community, into the node's (the instance commons). Conservation
// to the last unit, the same law as the prism.
export const DEFAULT_GLOW_SHARE_DENOMINATOR = 7;
export const NODE_GLOW_HOME = "NODE"; // glow/NODE: the instance commons, the home of last resort

// The prism law, mirrored from src/domain/light.ts (held to it by tests/mint.test.ts):
// glow + spendable = units, always.
export const prismSplit = (units: number, glowShareDenominator: number): { glow: number; spendable: number } => {
    if (!Number.isInteger(units) || units < 0) return { glow: 0, spendable: Math.max(0, Math.floor(units) || 0) };
    const d = Number.isInteger(glowShareDenominator) && glowShareDenominator >= 1 ? glowShareDenominator : 1;
    const glow = Math.floor(units / d);
    return { glow, spendable: units - glow };
};

export interface DepartingRay {
    units: number;
    communityId: string | null; // provenance: where the light was kindled (null = a solo carer's)
}

export interface RayRelease {
    toHeir: number;   // what the heir receives (0 when there is no heir)
    glow: number;     // what dissolves into the commons
    glowHome: string; // which glow doc receives it: the provenance community, or the node
}

// One departing ray's disposition under the cascade. Pure; the purge applies it.
export const releaseRay = (ray: DepartingRay, hasHeir: boolean): RayRelease => {
    const glowHome = ray.communityId || NODE_GLOW_HOME;
    const units = Number.isInteger(ray.units) && ray.units > 0 ? ray.units : 0;
    if (!hasHeir) return { toHeir: 0, glow: units, glowHome };
    const { glow, spendable } = prismSplit(units, DEFAULT_GLOW_SHARE_DENOMINATOR);
    return { toHeir: spendable, glow, glowHome };
};

// Everything the judgment needs, as plain facts the transaction already read. `unknown` fields
// carry whatever the documents held; the judgment does its own narrowing (the client wrote some
// of these, so nothing is assumed well-formed).
export interface WitnessFacts {
    witnessUid: string;
    pulse: {
        exists: boolean;
        care?: unknown;              // must be "watering"
        wateringConfirmedBy?: unknown; // "guardian" = already witnessed; "ai" is a hint, not a witness
        carerUid: string;            // pulse.authorId, auth-bound at create by the rules
        treeId: string;              // pulse.lifetreeId
        createdAtMs: number | null;  // the server birth time; null = cannot mint
    };
    guardianSinceMs: number | null;  // witness's guardian-link birth; null = not a guardian
    tree: {
        exists: boolean;
        treeType?: unknown;          // "BED" is not tended for light
        // The ONE living-state gate. Death is not yet in the data model (no tree has died on
        // record since Mahameru, who predates it); when it arrives it is a `diedAt` timestamp
        // on the lifetree, and THIS predicate is the single place the mint honors it.
        diedAtMs: number | null;
    };
    carerRayExists: boolean;         // rays/{treeId}__{dayKey}__carer already minted today
    witnessRayExists: boolean;
}

export type WitnessJudgment =
    | { outcome: "reject"; code: "not-found" | "failed-precondition" | "permission-denied"; message: string }
    | { outcome: "already" }
    | {
        outcome: "kindle";
        dayKey: string;
        // null = that ray already exists for this tree and day (idempotent; the cap held).
        carerRay: { holderUid: string; role: "carer"; units: number } | null;
        // The witness's seventh rides ONLY on a fresh carer kindle: witnessing a tree already
        // lit that day confirms the record but adds no new light.
        witnessRay: { holderUid: string; role: "witness"; units: number } | null;
    };

// The complete law of witnessing, in the order the server applies it. Mirrors
// src/domain/light.kindleRays: light enters ONLY through a human guardian's witnessed care of
// the living; AI validation lights the tree but holds no light and kindles none (the ring,
// 2026-07-20); no one witnesses their own care; guardianship must predate the watering (tenure).
export function judgeWitness(f: WitnessFacts): WitnessJudgment {
    const reject = (code: "not-found" | "failed-precondition" | "permission-denied", message: string): WitnessJudgment =>
        ({ outcome: "reject", code, message });

    if (!f.pulse.exists) return reject("not-found", "That watering no longer exists.");
    if (f.pulse.care !== "watering") return reject("failed-precondition", "That is not a watering.");
    // Already witnessed by a guardian: the first witness holds the record and any light; a second
    // guardian re-witnessing the same care changes nothing.
    if (f.pulse.wateringConfirmedBy === "guardian") return { outcome: "already" };
    if (!f.pulse.carerUid || !f.pulse.treeId) return reject("failed-precondition", "That watering is malformed.");
    if (f.pulse.createdAtMs === null) return reject("failed-precondition", "That watering carries no birth time.");
    if (f.witnessUid === f.pulse.carerUid) return reject("failed-precondition", "You cannot witness your own care.");
    if (f.guardianSinceMs === null) return reject("permission-denied", "Only a guardian of this tree may witness it.");
    if (f.guardianSinceMs > f.pulse.createdAtMs) return reject("failed-precondition", "Your guardianship began after this watering.");
    if (!f.tree.exists) return reject("not-found", "That tree no longer exists.");
    if (f.tree.treeType === "BED") return reject("failed-precondition", "A bed is not tended for light.");
    if (f.tree.diedAtMs !== null) return reject("failed-precondition", "A tree that has died kindles memory, not light.");

    const dayKey = kindleDayKeyFromMs(f.pulse.createdAtMs);
    const carerRay = f.carerRayExists
        ? null
        : { holderUid: f.pulse.carerUid, role: "carer" as const, units: RAY_UNITS };
    const witnessRay = (f.carerRayExists || f.witnessRayExists)
        ? null
        : { holderUid: f.witnessUid, role: "witness" as const, units: witnessShareUnits() };
    return { outcome: "kindle", dayKey, carerRay, witnessRay };
}
