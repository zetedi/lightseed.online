import { DAY_MS } from './watering';
import type { Being } from './being';

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
// A care act kindles ONLY when a HUMAN GUARDIAN witnesses it, and only for the living.
// AI validation is a hint for the guardian's eye (it lights the tree's validation display),
// never a witness: it holds no light and kindles none (ring 2026-07-20, "The mint stands on
// server ground"; a trustworthy server-side AI witness is a coming rung). Unwitnessed care
// warms the world but mints nothing; that is the forgery-resistance of the whole economy.
export interface CareAct {
  witnessed: boolean; // a human guardian's authenticated hand (the witnessWatering callable)
  treeAlive: boolean; // the tended being still lives (a dead tree kindles memory, not light)
}

export const kindles = (act: CareAct): boolean => act.witnessed && act.treeAlive;

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

// What a witnessed care brings into the world: the carer's whole ray, plus the witness's
// seventh. The ONE allocation rule the server mint mirrors (functions/src/mint.ts, held to
// this module by tests/mint.test.ts). A kindle REQUIRES a human witness distinct from the
// carer: no witness, a self-witness, or a lifeless tree kindles nothing (the sun); AI
// validation alone is a hint, never a witness (ring 2026-07-20).
export interface KindleInput {
  treeAlive: boolean;
  carerUid: string;
  // The authenticated human guardian who witnessed. Absent = unwitnessed (AI validation alone).
  witnessUid?: string;
}

export interface KindledRay {
  holderUid: string;
  role: 'carer' | 'witness';
  units: number;
}

export const kindleRays = (input: KindleInput): KindledRay[] => {
  const witnessed = Boolean(input.witnessUid && input.witnessUid !== input.carerUid);
  if (!kindles({ witnessed, treeAlive: input.treeAlive })) return [];
  return [
    { holderUid: input.carerUid, role: 'carer', units: RAY_UNITS },
    { holderUid: input.witnessUid as string, role: 'witness', units: witnessShareUnits() },
  ];
};

// ── The ray: the shared shape ─────────────────────────────────────────────────────────────
// A ray is a lid-bearing BEING (extends Being; type-only, so this module stays pure). This is
// the shape every holder of one agrees on; where it is stored (and how its stations chain) is
// the service layer's concern, later.
export interface Ray extends Being {
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
