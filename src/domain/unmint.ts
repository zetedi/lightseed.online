import type { DomainKey } from './words';

// THE UNMINT (ring 2026-08-15) — taking back an accidental mint without wounding the chain.
// Only the HEAD block may be taken back: the chain is shortened by exactly its newest link,
// never severed in the middle (mid-chain deletes are refused by the rules outright). Only
// the AUTHOR's hand. ANY block kind at the head qualifies — a growth, a tree-sent reach, an
// alignment — because the severing argument binds only BELOW the head; until the tree speaks
// again, the newest word can be unsaid whole (a head reach unsaid is the message fully
// unsent, the room's copy included). Two stand forever: a guardian-witnessed watering (its
// light is already minted; rays are append-only) and decisions (their own lifecycle law).
//
// Plain contract — guaranteed: the refusals here are the law functions/unmintBlock applies
// (mirrored in functions/src/birth.ts, held equal by tests/birth.test.ts; since ring
// 2026-09-23 the head is the server's, so the rules refuse every client delete of a chain
// block and the server's transaction rolls the head back atomically or not at all). The UI
// asks this law first so the door is honest before the call. Not guaranteed: the
// unmade block leaves no mark — an unmint is an erasure of the newest link by the hand that
// just forged it, not a retraction; below the head, retraction remains the way. Since ring
// 2026-10-21 the unmint also LIFTS what the block changed on its tree (the mint's touch, below).

export interface UnmintPulseFacts {
  authorId?: string;
  type?: string;
  lifetreeId?: string;
  hash?: string;
  wateringConfirmedBy?: string;
  seenBy?: string[];          // read receipts — another being's eyes on the block
  loveCount?: number;         // hearts — another being's mark
  vetoes?: string[];          // a guardian's conscience already acted
  matchId?: string;           // alignment sync-blocks are CO-MINTED across two chains
  matchedLifetreeId?: string;
  offeringId?: string;        // an accepted offering's twin (ring 2026-09-06): co-minted, co-held
}

export type UnmintRefusal = Extract<DomainKey,
  'unmint_not_author' | 'unmint_not_mint' | 'unmint_not_last' | 'unmint_witnessed' | 'unmint_coheld'>;

// NOTHING CO-HELD CAN BE UNSAID (Zoltán, 2026-08-15): the moment another being's mark
// lands on a block — seen, loved, vetoed, or co-minted as an alignment's paired block —
// it stops being only its author's word and stands. Witness and decision refusals are the
// same principle at higher stakes; this is its general form.
export const isCoHeld = (pulse: UnmintPulseFacts, authorUid: string): boolean =>
  (pulse.seenBy || []).some(uid => uid !== authorUid)
  || (pulse.loveCount || 0) > 0
  || (pulse.vetoes || []).length > 0
  || !!pulse.matchId
  || !!pulse.matchedLifetreeId
  || !!pulse.offeringId;

// Which refusals the STAFF HAND may pass through (worn with the amber SuperDot — power by
// role, not authorship): co-holding and authorship are social guards a steward may override
// for a mend; the structural guards never bend — below the head severs (not_last), a
// witnessed watering's light is minted (witnessed), and non-blocks/decisions have their own
// law (not_mint). Mirrors scripts/unwind-head-blocks.mjs, which refuses the same absolutes.
export const STAFF_OVERRIDABLE_REFUSALS: ReadonlySet<UnmintRefusal> =
  new Set(['unmint_coheld', 'unmint_not_author'] as const);

export const unmintRefusal = (
  pulse: UnmintPulseFacts,
  tree: { latestHash?: string },
  viewerUid: string | undefined,
): UnmintRefusal | null => {
  if (!viewerUid || pulse.authorId !== viewerUid) return 'unmint_not_author';
  if (!pulse.lifetreeId || !pulse.hash || pulse.type === 'decision') return 'unmint_not_mint';
  if (pulse.wateringConfirmedBy === 'guardian') return 'unmint_witnessed';
  if (isCoHeld(pulse, viewerUid)) return 'unmint_coheld';
  if (tree.latestHash !== pulse.hash) return 'unmint_not_last';
  return null;
};

// ── THE MINT'S TOUCH, REMEMBERED (ring 2026-10-21) ────────────────────────────────────────
// A growth block does not only lengthen the chain: in the same transaction it TOUCHES the tree
// it grows on — its newest face (latestGrowthUrl), its care stamp (lastCaredAt) and, for a
// watering, the schedule's clock (watering.lastWateredAt/By/ByName, overdue, nextDueAt). The
// unmint shortened the chain and left the touch standing: a watering taken back still read
// "last watered today, by you" on the care card, so the chain said one thing and the tree
// another. Now the mint REMEMBERS what the tree wore before (bearerBefore on the block — outside
// the seal, metadata like a read receipt, gone with the block), and the unmint LIFTS the touch
// in the transaction that shortens the chain: each field returns to its prior value, or is
// cleared when the mint created it.
//
// Only while the tree still wears THIS block's touch. A later hand may write over a touch
// without moving the head — the off-chain "I watered today" resets the same clock and stamp —
// and that later word stands. The guard is the mint's own exactness: it set the clock to the
// block's mintedAt, the care stamp to the block's birth (one commit, one server time) and the
// face to the block's own picture; equality says the touch is still the block's.
//
// Plain contract — guaranteed: touchMemoryOf records exactly the fields the mint's patch names,
// null for a field the tree did not have; touchRestoreOf restores only remembered fields, only
// those still worn, and never a field it does not know (TOUCH_FIELDS). Applied by
// functions/mintBlock and functions/unmintBlock (mirror in functions/src/birth.ts, held equal by
// tests/birth.test.ts). Not guaranteed: a block minted before this ring carries no memory, and
// its touch stays when it is unminted; a schedule changed between a watering and its unmint
// keeps the clock the memory holds (nextDueAt is restored, not recomputed); the staff unwind
// script (scripts/unwind-head-blocks.mjs) shortens only.

// The fields a growth mint may touch on its tree — the only ones the unmint knows how to lift.
export const TOUCH_FIELDS: readonly string[] = [
  'latestGrowthUrl', 'lastCaredAt',
  'watering.lastWateredAt', 'watering.lastWateredBy', 'watering.lastWateredByName', 'watering.overdue', 'watering.nextDueAt',
];

// The tree's prior values, nested as the tree nests them ({ watering: { lastWateredAt, … } }),
// null where the tree had no such field. Values are opaque (a stamp stays a stamp).
export type TouchMemory = Record<string, unknown>;

const readPath = (bearer: Record<string, unknown>, path: string): unknown => {
  let cur: unknown = bearer;
  for (const seg of path.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
};

// What the tree wore at the fields the mint's patch (dotted keys) is about to write.
export const touchMemoryOf = (bearer: Record<string, unknown>, patch: Record<string, unknown>): TouchMemory | null => {
  const memory: TouchMemory = {};
  for (const path of Object.keys(patch)) {
    const value = readPath(bearer, path);
    const before = value === undefined ? null : value;
    const dot = path.indexOf('.');
    if (dot < 0) { memory[path] = before; continue; }
    const head = path.slice(0, dot);
    const inner = (memory[head] && typeof memory[head] === 'object' ? memory[head] : {}) as Record<string, unknown>;
    inner[path.slice(dot + 1)] = before;
    memory[head] = inner;
  }
  return Object.keys(memory).length ? memory : null;
};

export interface TouchRestoreFacts {
  memory?: TouchMemory | null;                       // the block's bearerBefore (absent on a legacy block)
  block: { mintedAtMs?: number | null; createdAtMs?: number | null; imageUrl?: string | null };
  tree: { latestGrowthUrl?: string | null; lastCaredAtMs?: number | null; lastWateredAtMs?: number | null };
}
// The patch that lifts the touch: dotted keys to set back, and the keys the mint created, to clear.
export interface TouchRestore { set: Record<string, unknown>; clear: string[] }

const sameMoment = (a: number | null | undefined, b: number | null | undefined): boolean =>
  typeof a === 'number' && typeof b === 'number' && a > 0 && a === b;

// Does the tree still wear this block's touch at the field? (The guards named above.)
export const stillWorn = (path: string, f: TouchRestoreFacts): boolean => {
  if (path.startsWith('watering.')) return sameMoment(f.tree.lastWateredAtMs, f.block.mintedAtMs);
  if (path === 'latestGrowthUrl') return !!f.block.imageUrl && f.tree.latestGrowthUrl === f.block.imageUrl;
  if (path === 'lastCaredAt') return sameMoment(f.tree.lastCaredAtMs, f.block.createdAtMs);
  return false;
};

export const touchRestoreOf = (f: TouchRestoreFacts): TouchRestore => {
  const out: TouchRestore = { set: {}, clear: [] };
  const m = f.memory;
  if (!m || typeof m !== 'object' || Array.isArray(m)) return out;
  const flat: Array<[string, unknown]> = [];
  for (const [k, v] of Object.entries(m)) {
    if (k === 'watering' && v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) flat.push([`watering.${sk}`, sv]);
    } else flat.push([k, v]);
  }
  for (const [path, before] of flat) {
    if (!TOUCH_FIELDS.includes(path) || !stillWorn(path, f)) continue;
    if (before === null || before === undefined) out.clear.push(path);
    else out.set[path] = before;
  }
  return out;
};
