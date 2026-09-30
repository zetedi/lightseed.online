// SPENDING IS A GATE — the server's copy of src/domain/spend.ts (functions is its own TS project
// and cannot import src/domain). Held equal to the domain by tests/spend.test.ts, which imports
// both and asks the same facts of each. lightCalls.ts owns only the transaction plumbing.
import { prismSplit, DEFAULT_GLOW_SHARE_DENOMINATOR } from "./mint";

export type SpendRefusal =
    | "gift_nothing" | "gift_whole_units" | "gift_needs_both" | "gift_own_offering" | "gift_resting" | "gift_hold_less"
    | "appreciate_offering_gone" | "appreciate_not_received" | "appreciate_already" | "appreciate_coin_refused"
    | "spend_no_decision" | "spend_not_purchase" | "spend_no_offering" | "spend_nothing" | "spend_no_standing"
    | "spend_not_passed" | "spend_listening" | "spend_unsigned" | "spend_already" | "spend_coin_refused" | "spend_glow_short";

export interface SpendIntent { offeringId: string; units: number }

export const spendIntentProblem = (d: { offeringId?: string | null; units?: unknown } | null | undefined): SpendRefusal | null => {
    if (!d || typeof d.offeringId !== "string" || !d.offeringId.trim()) return "spend_no_offering";
    const u = d.units;
    if (typeof u !== "number" || !Number.isFinite(u) || u <= 0) return "spend_nothing";
    if (!Number.isInteger(u)) return "gift_whole_units";
    return null;
};

// The suspended gift (mirror of domain/gift.suspendGift): the glow share dissolves, the rest waits.
export const suspendGift = (units: number, glowShareDenominator: number = DEFAULT_GLOW_SHARE_DENOMINATOR): { glow: number; suspended: number } => {
    const { glow, spendable } = prismSplit(units, glowShareDenominator);
    return { glow, suspended: spendable };
};

export const coinAccepted = (rayPlace: string | null | undefined, offeringPlace: string | null | undefined, acceptsPlaces: readonly string[]): boolean => {
    if (!rayPlace) return true;
    if (!offeringPlace) return true;
    if (rayPlace === offeringPlace) return true;
    return acceptsPlaces.includes(rayPlace);
};

export interface HeldRayFact { id: string; units: number; place: string | null; dayKey: string }
export interface AppreciationFacts {
    giverUid: string;
    units: number;
    offering: { exists: boolean; type?: unknown; status?: unknown; active?: unknown; authorId: string; answeredBy?: unknown; place: string | null; acceptsPlaces: readonly string[] };
    rays: readonly HeldRayFact[];
    alreadyGiven: boolean;
    glowShareDenominator?: number;
}
export interface RayTake { id: string; units: number }
export type AppreciationJudgment =
    | { outcome: "reject"; refusal: SpendRefusal }
    | { outcome: "give"; take: RayTake[]; glow: number; suspended: number; glowHome: string | null };

export const pickRays = (rays: readonly HeldRayFact[], units: number, offeringPlace: string | null, acceptsPlaces: readonly string[]): { take: RayTake[]; taken: number } => {
    const usable = rays
        .filter((r) => Number.isInteger(r.units) && r.units > 0 && coinAccepted(r.place, offeringPlace, acceptsPlaces))
        .slice()
        .sort((a, b) => a.dayKey.localeCompare(b.dayKey) || a.id.localeCompare(b.id));
    const take: RayTake[] = [];
    let left = units;
    for (const r of usable) {
        if (left <= 0) break;
        const u = Math.min(r.units, left);
        take.push({ id: r.id, units: u });
        left -= u;
    }
    return { take, taken: units - left };
};

export const judgeAppreciation = (f: AppreciationFacts): AppreciationJudgment => {
    const reject = (refusal: SpendRefusal): AppreciationJudgment => ({ outcome: "reject", refusal });
    if (!f.offering.exists || f.offering.type !== "offering") return reject("appreciate_offering_gone");
    if (!Number.isFinite(f.units) || f.units <= 0) return reject("gift_nothing");
    if (!Number.isInteger(f.units)) return reject("gift_whole_units");
    if (!f.giverUid || !f.offering.authorId) return reject("gift_needs_both");
    if (f.giverUid === f.offering.authorId) return reject("gift_own_offering");
    if (f.offering.status !== "accepted" || f.offering.answeredBy !== f.giverUid) return reject("appreciate_not_received");
    if (f.offering.active === false) return reject("gift_resting");
    if (f.alreadyGiven) return reject("appreciate_already");
    const holding = f.rays.reduce((s, r) => s + (Number.isInteger(r.units) && r.units > 0 ? r.units : 0), 0);
    if (holding < f.units) return reject("gift_hold_less");
    const { take, taken } = pickRays(f.rays, f.units, f.offering.place, f.offering.acceptsPlaces);
    if (taken < f.units) return reject("appreciate_coin_refused");
    const { glow, suspended } = suspendGift(f.units, f.glowShareDenominator ?? DEFAULT_GLOW_SHARE_DENOMINATOR);
    return { outcome: "give", take, glow, suspended, glowHome: f.offering.place };
};

export interface SpendFacts {
    callerUid: string;
    callerStands: boolean;
    decision: { exists: boolean; type?: unknown; nature?: unknown; status?: unknown; listening?: unknown; communityId: string; votesRequired: number; verifiedSigners: number; spend?: unknown; alreadySpent: boolean };
    offering: { exists: boolean; type?: unknown; active?: unknown; place: string | null; acceptsPlaces: readonly string[] };
    glowUnits: number;
    glowShareDenominator?: number;
}
export type SpendJudgment =
    | { outcome: "reject"; refusal: SpendRefusal }
    | { outcome: "spend"; units: number; glow: number; suspended: number; glowHome: string | null };

const isSpendIntent = (v: unknown): v is SpendIntent => !!v && typeof v === "object" && spendIntentProblem(v as SpendIntent) === null;

export const judgeSpend = (f: SpendFacts): SpendJudgment => {
    const reject = (refusal: SpendRefusal): SpendJudgment => ({ outcome: "reject", refusal });
    if (!f.decision.exists || f.decision.type !== "decision") return reject("spend_no_decision");
    if (f.decision.nature !== "purchase") return reject("spend_not_purchase");
    if (!isSpendIntent(f.decision.spend)) return reject(spendIntentProblem(f.decision.spend as SpendIntent | null) ?? "spend_no_offering");
    if (!f.callerUid || !f.callerStands) return reject("spend_no_standing");
    if (f.decision.status !== "passed") return reject("spend_not_passed");
    if (f.decision.listening === true) return reject("spend_listening");
    if (!(f.decision.votesRequired > 0) || f.decision.verifiedSigners < f.decision.votesRequired) return reject("spend_unsigned");
    if (f.decision.alreadySpent) return reject("spend_already");
    if (!f.offering.exists || f.offering.type !== "offering") return reject("spend_no_offering");
    if (f.offering.active === false) return reject("gift_resting");
    if (!coinAccepted(f.decision.communityId, f.offering.place, f.offering.acceptsPlaces)) return reject("spend_coin_refused");
    const units = f.decision.spend.units;
    if (!Number.isInteger(f.glowUnits) || f.glowUnits < units) return reject("spend_glow_short");
    const { glow, suspended } = suspendGift(units, f.glowShareDenominator ?? DEFAULT_GLOW_SHARE_DENOMINATOR);
    return { outcome: "spend", units, glow, suspended, glowHome: f.offering.place };
};
