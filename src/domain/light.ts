import { DAY_MS } from './watering';

// THE LAW OF LIGHT: the five rings of 2026-07-19 as arithmetic, pure and testable:
//
//   The sun is the origin        light enters ONLY through witnessed care for the living
//   The nights / the mornings    one ray per witnessed daily care; a ray spoken as 100
//   The ray                      lid-bearing, branching at prisms, fading by spreading
//   The tax of light             conserved at the prism: branches + glow = what arrived
//   The glow                     every attenuation lights the birth community's commons
//
// Everything later (the server-side mint, the profile face, the community glow, the map's
// shine) imports THIS module; nothing here touches a backend or a clock it wasn't handed.
// Magnitudes stay the council's to tune (the dials are parameters, not opinions).
//
// Two things are NOT arithmetic and live in the service/visibility layer (ring 2026-07-20,
// "Light is a birthright, glow a belonging"): WHERE a prism's shed light accrues (the
// community the light circulates THROUGH, whose dial the prism uses; not the birth
// community), and WHO may see a carer's light (a being not yet in a community sees their
// own light alone, never a public balance).

// ── The unit ──────────────────────────────────────────────────────────────────────────────
// One ray is spoken as "a hundred" (a night is a hundred): an echo of the world's night
// prices that helps adoption; an echo, never a peg. Integer units keep conservation exact.
export const RAY_UNITS = 100;

// One witnessed daily care kindles one ray (the nights are covered by the mornings).
export const KINDLE_UNITS_PER_WITNESSED_CARE = RAY_UNITS;

// ── The sun: what kindles ─────────────────────────────────────────────────────────────────
// A care act kindles ONLY when witnessed (confirmed: the AI at threshold or a guardian's
// hand, the watering law's own gate) and only for the living. Unwitnessed care warms the
// world but mints nothing; that is the forgery-resistance of the whole economy.
export interface CareAct {
  confirmed: boolean; // witnessed per domain/watering (AI_CONFIRM_THRESHOLD or a guardian)
  treeAlive: boolean; // the tended being still lives (a dead tree kindles memory, not light)
}

export const kindles = (act: CareAct): boolean => act.confirmed && act.treeAlive;

// One kindling per tree per day: the tree's own rhythm bounds the supply (life is the
// central bank). `lastKindledAtMs` null = never kindled from this tree before.
export const canKindleAgain = (lastKindledAtMs: number | null, nowMs: number): boolean =>
  lastKindledAtMs === null || nowMs - lastKindledAtMs >= DAY_MS;

// The witness's seventh (ring 2026-07-20, "the witness of care"): light enters ONLY through
// witnessed care, so the eye that vouches co-creates the light and its own care flows back to
// it. A HUMAN witness kindles 1/7 of a ray, ADDITIONAL (the carer keeps their whole ray, so a
// day's sleep stays covered exactly); it funds the web of trust and is the engine of community
// formation, since guarding another's tree becomes a source of light. The AI witness holds no
// light (not a being), and no one witnesses their own care.
export const WITNESS_SHARE_DENOMINATOR = 7;
export const witnessShareUnits = (rayUnits: number = RAY_UNITS): number =>
  Math.floor(rayUnits / WITNESS_SHARE_DENOMINATOR);

// What a confirmed care brings into the world: the carer's whole ray, plus a human witness's
// seventh when the witness is a real being other than the carer. The ONE allocation rule the
// server mint mirrors and the tests share; unwitnessed or lifeless care kindles nothing (the sun).
export interface KindleInput {
  confirmed: boolean;    // witnessed per the watering law (AI at threshold, or a guardian)
  treeAlive: boolean;
  carerUid: string;
  // A HUMAN witness distinct from the carer (a guardian who confirmed). Absent for AI-confirmed
  // care and for self-confirmation — neither adds a witness ray.
  witnessUid?: string;
}

export interface KindledRay {
  holderUid: string;
  role: 'carer' | 'witness';
  units: number;
}

export const kindleRays = (input: KindleInput): KindledRay[] => {
  if (!kindles(input)) return [];
  const rays: KindledRay[] = [{ holderUid: input.carerUid, role: 'carer', units: RAY_UNITS }];
  if (input.witnessUid && input.witnessUid !== input.carerUid) {
    rays.push({ holderUid: input.witnessUid, role: 'witness', units: witnessShareUnits() });
  }
  return rays;
};

// ── The ray: the shared shape ─────────────────────────────────────────────────────────────
// A ray is a lid-bearing being. This is the shape every holder of one agrees on; where it
// is stored (and how its stations chain) is the service layer's concern, later.
export interface Ray {
  lid: string;
  sourceUid: string;      // whose witnessed care kindled it
  treeId: string;         // the living being whose tending brought it into the world
  communityId?: string;   // provenance: the community it was kindled in, if any (a solo carer has none)
  units: number;          // directed light still on this branch
  kindledAtMs: number;
}

// ── The prism: conservation and the tax ───────────────────────────────────────────────────
// At every prism the arriving light divides into what travels on and what dissolves into
// the glow of the community the light is CIRCULATING through (ring 2026-07-20). NOTHING IS
// LOST: glow + spendable = what arrived, to the
// last unit. The glow share is each community's dial (1/7 here, 1/8 there), given as the
// denominator; the integer remainder rides on with the spendable, a bias toward
// circulation (the commons is fed by every hop either way).
export interface PrismSplit {
  glow: number;
  spendable: number;
}

export const prismSplit = (units: number, glowShareDenominator: number): PrismSplit => {
  if (!Number.isInteger(units) || units < 0) return { glow: 0, spendable: Math.max(0, Math.floor(units) || 0) };
  const d = Number.isInteger(glowShareDenominator) && glowShareDenominator >= 1 ? glowShareDenominator : 1;
  const glow = Math.floor(units / d);
  return { glow, spendable: units - glow };
};

// A branching is VALID only when it conserves: the glow share taken at this community's
// dial plus every branch equals exactly what arrived, and no branch is empty (an empty
// branch would be a station without light, a lie on a chain).
export const validBranching = (
  unitsIn: number,
  branches: readonly number[],
  glowShareDenominator: number,
): boolean => {
  const { glow, spendable } = prismSplit(unitsIn, glowShareDenominator);
  if (branches.some(b => !Number.isInteger(b) || b <= 0)) return false;
  const sum = branches.reduce((a, b) => a + b, 0);
  return glow + sum === unitsIn && sum === spendable;
};

// Divide spendable light evenly across n branches, remainder-exact: the earliest branches
// carry the extra units (deterministic, nothing lost). Zero branches returns [].
export const splitEvenly = (spendable: number, n: number): number[] => {
  if (!Number.isInteger(n) || n <= 0 || spendable <= 0) return [];
  const base = Math.floor(spendable / n);
  const extra = spendable - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0)).filter(u => u > 0);
};

// ── Fading: idle light dims into the same glow ────────────────────────────────────────────
// Hoarded light dies alone (and even that is not loss: it feeds the birth community's
// glow). The RATE is a council magnitude, injected: units dimmed per whole elapsed week.
// Conservation holds here too: remaining + toGlow = units, always.
export interface IdleFade {
  remaining: number;
  toGlow: number;
}

export const idleFade = (units: number, elapsedMs: number, dimPerWeek: number): IdleFade => {
  if (units <= 0) return { remaining: 0, toGlow: 0 };
  const weeks = Math.max(0, Math.floor(elapsedMs / (7 * DAY_MS)));
  const toGlow = Math.min(units, Math.max(0, Math.floor(dimPerWeek)) * weeks);
  return { remaining: units - toGlow, toGlow };
};

// ── Attention: the sovereign dial ─────────────────────────────────────────────────────────
// The source's veto RIGHT follows their light to the last unit; their ATTENTION is their
// own to bound. A station notifies the source only while the branch still carries at
// least the source's floor ("set the veto dial to one ray" = a floor of RAY_UNITS).
export const visibleToSource = (branchUnits: number, attentionFloorUnits: number): boolean =>
  branchUnits >= Math.max(0, attentionFloorUnits);
