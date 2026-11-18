import type { DomainKey } from './words';

// THE GROUND (proposal 2026-11-17, step 1: the law). A vision is a being in its own right — voiced
// by its author, growing its own chain, needing no tree to exist. GROUNDING is where idea meets
// matter, and it is a relation, never a field: the vision's author asks a tree, a carer of the
// tree (keeper or steward) says yes, and the yes stands as a link `vision__grounded_in__tree`.
// One vision may stand in several trees; one tree may ground several visions.
//
// Plain contract — GUARANTEED (this law, tests/grounding.test.ts; functions/src/grounding.ts;
// firestore.rules links, tests/rules): a `grounded_in` link exists only because the vision's author
// knocked through the server (askGround — no client hand writes a knock) AND a keeper or steward
// of the tree said yes through the server while that same hand was still the vision's author;
// both times the kind, life and visibility of both beings and the caps were judged inside one
// transaction; each grounding and each release wrote one sealed block on each chain; neither
// being is private; no client hand, staff included, creates a ground, and none removes one but
// staff's mend.
// Since 2026-11-18 the old `lifetreeId` field is gone (a migrated ground says `migrated` and has
// no blocks), the independent node keeps the same law, and light moving around a vision obeys
// visionReceivesLight (domain/spend's ground gate).
// NOT GUARANTEED YET: that a ground is re-judged when a tree or vision later changes who may see it
// (groundKeepsFaith is written and asked by no one); that a ground is released when its vision
// is deleted; any limit on how many visions may knock at one tree; that the
// ids of a node-only tree and vision, and the asker's uid, stay inside the node (the LIN is
// world-readable — only private beings are kept out of it). NEVER GUARANTEED: that a vision is being realised on the land
// that grounds it (a ground records consent, not work), or that author and carer are different
// people (a self-grounding is allowed and says so).
//
// THE ONE LINE: a ground grants nothing; it only says that two sides agreed.

// from = the VISION's id, to = the TREE's id.
export const GROUNDED_IN = 'grounded_in' as const;
// The knock: the vision's author asking a tree. Grants nothing, weaves nothing.
export const GROUND_REQUEST = 'ground_request' as const;

// Quality, not quantity: the number of faces, and of secret trees.
export const MAX_GROUNDS_PER_VISION = 12;
export const MAX_VISIONS_PER_TREE = 12;

type Visibility = 'public' | 'node' | 'private';

export interface GroundTreeFacts {
  treeType?: string | null;       // absent = 'LIFETREE'
  visibility?: string | null;     // absent = 'public' (the tree's legacy default)
  diedAtMs?: number | null;
}
export interface GroundVisionFacts {
  authorId: string;
  visibility?: string | null;     // absent = 'public' (the vision's legacy default)
}

// How far a being is seen. An unknown word is read as the most hidden, so a typo never opens.
const reach = (v: string | null | undefined): number =>
  v == null || v === 'public' ? 2 : (v as Visibility) === 'node' ? 1 : 0;

// A ground stands in a living tree.
export const groundTreeLives = (tree: Pick<GroundTreeFacts, 'diedAtMs'>): boolean => tree.diedAtMs == null;

// MAY THIS TREE GROUND THIS VISION? — the part of the law that looks only at the two beings.
//   · a secret tree grants nothing outside itself, and a bed is furniture: neither grounds anyone;
//   · a ground is asked of the living;
//   · NOTHING PRIVATE TAKES GROUND. The knock and the ground are links, and the LIN is
//     world-readable: a link would tell the world that a private tree exists, or that a private
//     vision exists, who voiced it and where it stands. So a private tree grounds no one and a
//     private vision asks no one, until the LIN has a quiet room for them (as secretLinks is for
//     a secret tree's seats);
//   · a tree never grounds a vision seen further than itself (a node-only tree, a public vision).
// A lifetree and a guarded (nature) tree both may: the nature tree is where a community's
// gardeners and a visionary are most likely to meet.
export const groundRefusal = (tree: GroundTreeFacts, vision: Pick<GroundVisionFacts, 'visibility'>): DomainKey | null => {
  if (tree.treeType === 'SECRET') return 'ground_secret_tree';
  if (tree.treeType === 'BED') return 'ground_bed';
  if (!groundTreeLives(tree)) return 'ground_tree_gone';
  if (reach(vision.visibility) < 1) return 'ground_vision_hidden';
  if (reach(tree.visibility) < 1 || reach(tree.visibility) < reach(vision.visibility)) return 'ground_tree_hidden';
  return null;
};

// A STANDING GROUND KEEPS FAITH only while neither being has been drawn private and the tree is
// still seen at least as far as the vision. Asked again whenever either side changes who may see
// it: a ground that no longer keeps faith must be released before the change stands.
// Death does not break it — a ground in a tree that has died is a memory, and is kept as one.
export const groundKeepsFaith = (tree: Pick<GroundTreeFacts, 'treeType' | 'visibility'>, vision: Pick<GroundVisionFacts, 'visibility'>): boolean =>
  tree.treeType !== 'SECRET' && tree.treeType !== 'BED'
  && reach(vision.visibility) >= 1 && reach(tree.visibility) >= reach(vision.visibility);

// THE ASK — only the vision's author asks, once, of a tree that may ground it.
export interface GroundAskFacts {
  askerUid: string;
  vision: GroundVisionFacts;
  tree: GroundTreeFacts;
  alreadyGrounded: boolean;     // this vision already stands in this tree
  pendingRequest: boolean;      // this vision already asked this tree
  visionGroundCount: number;    // the grounds this vision already stands in
  visionAskCount: number;       // the asks this vision still has standing at other trees
}
export const groundAskRefusal = (f: GroundAskFacts): DomainKey | null => {
  if (!f.askerUid || f.vision.authorId !== f.askerUid) return 'ground_ask_author_only';
  const refused = groundRefusal(f.tree, f.vision);
  if (refused) return refused;
  if (f.alreadyGrounded) return 'ground_already';
  if (f.pendingRequest) return 'ground_already_asked';
  // Grounds and standing asks are counted together: a vision can never have more than twelve
  // trees answering or waiting to answer.
  if (f.visionGroundCount + f.visionAskCount >= MAX_GROUNDS_PER_VISION) return 'ground_vision_full';
  return null;
};

// THE YES — a carer of the tree answers an ask that still stands. Everything the ask checked is
// checked again: a tree may have died, turned private or filled between the knock and the answer.
export interface GroundAcceptFacts {
  accepterUid: string;
  accepterCaresForTree: boolean;  // keeper (the anchor or a keeper link) or steward — the caller proves it
  // Who knocked, as the knock itself says (null when there is no knock). The yes stands only on a
  // knock made by the one who is the vision's author NOW: a vision handed to another hand after
  // the knock was never asked by its new author.
  requestedBy: string | null;
  vision: GroundVisionFacts;
  tree: GroundTreeFacts;
  alreadyGrounded: boolean;
  visionGroundCount: number;
  treeVisionCount: number;        // the visions this tree already grounds
}
export const groundAcceptRefusal = (f: GroundAcceptFacts): DomainKey | null => {
  // GROWN FROM THE TREE: when the hand saying yes is the vision's own author, it is one being
  // saying yes twice and no knock is needed (a carer grows a vision from their tree in one act).
  const self = !!f.vision.authorId && f.accepterUid === f.vision.authorId;
  if (!self && (!f.requestedBy || f.requestedBy !== f.vision.authorId)) return 'ground_no_request';
  if (!f.accepterUid || !f.accepterCaresForTree) return 'ground_accept_carer_only';
  const refused = groundRefusal(f.tree, f.vision);
  if (refused) return refused;
  if (f.alreadyGrounded) return 'ground_already';
  if (f.visionGroundCount >= MAX_GROUNDS_PER_VISION) return 'ground_vision_full';
  if (f.treeVisionCount >= MAX_VISIONS_PER_TREE) return 'ground_tree_full';
  return null;
};

// WHAT THE LINK SAYS ABOUT ITS OWN MAKING, so a face can tell a meeting from a monologue.
//   self  — the one who accepted is the vision's own author (one being saying yes twice);
//   birth — this ground was made the moment the tree was planted (the Root Vision's ground).
export interface GroundMark { self: boolean; birth: boolean }
export const groundMarkOf = (f: { accepterUid: string; vision: Pick<GroundVisionFacts, 'authorId'>; bornWithTree?: boolean }): GroundMark =>
  ({ self: f.accepterUid === f.vision.authorId, birth: !!f.bornWithTree });

// LETTING GO — either side alone: the author for the vision, any carer for the tree. A ground whose
// vision or tree no longer exists is still let go (so a deleted vision never holds one of a
// tree's twelve places for ever): then the side that remains releases it, and `visionAuthorId` is
// what the ground itself remembers of who asked.
export interface GroundReleaseFacts {
  uid: string;
  visionAuthorId: string | null;
  caresForTree: boolean;
  grounded: boolean;
}
export const groundReleaseRefusal = (f: GroundReleaseFacts): DomainKey | null => {
  if (!f.grounded) return 'ground_not_standing';
  if (!f.uid || ((!f.visionAuthorId || f.visionAuthorId !== f.uid) && !f.caresForTree)) return 'ground_release_not_yours';
  return null;
};

// A vision with no ground is SEEKING GROUND, and says so on its face.
export const isSeekingGround = (groundCount: number): boolean => !(groundCount > 0);

// ONLY A GROUNDED VISION RECEIVES LIGHT (Zoltán, 2026-11-17: "that makes the system regenerative").
// Light enters the world only through witnessed care for the living (domain/light), so a vision
// is reached by it only where it stands in soil that is being CARED FOR NOW: a living tree, cared
// for within the year (the validation window), and standing in the web of trust — a lifetree must
// be validated; a guarded (nature) tree is stood for by its community and needs no validation of
// its own. Consent alone is not enough: a ground in one's own neglected tree carries no light.
// A ground in a tree that has died is remembered, and carries none.
// ENFORCED (ring 2026-11-18) wherever light moves around a vision: the appreciation of an offering
// made to a vision, and a community's spend on one, are refused (`light_vision_ungrounded`) unless
// this answers yes — domain/spend asks it of the facts the server read (`visionLightOf`), on both
// soils. Accepting such an offering moves no light and is not gated. No light ARRIVES at a vision
// by any path yet; when one is built it must ask this too.
export const GROUND_CARE_WINDOW_MS = 365 * 24 * 3600 * 1000; // a year, as guardianship's VALIDATION_WINDOW_MS
export interface GroundLightFacts {
  treeType?: string | null;
  isNature?: boolean | null;       // the legacy mark of a guarded tree
  diedAtMs?: number | null;
  validated?: boolean | null;      // EXPLICITLY validated (a peer or an initiate, never SYSTEM/GENESIS) — the caller proves it
  lastCaredAtMs?: number | null;
}
export const groundCarriesLight = (tree: GroundLightFacts, nowMs: number): boolean => {
  if (tree.treeType === 'SECRET' || tree.treeType === 'BED' || !groundTreeLives(tree)) return false;
  if (tree.lastCaredAtMs == null || !(nowMs - tree.lastCaredAtMs < GROUND_CARE_WINDOW_MS)) return false;
  return tree.treeType === 'GUARDED' || tree.isNature === true || tree.validated === true;
};
export const visionReceivesLight = (grounds: readonly GroundLightFacts[], nowMs: number): boolean =>
  grounds.some(g => groundCarriesLight(g, nowMs));

// ── THE TWO BLOCKS ──────────────────────────────────────────────────────────────────────────
// A grounding, and a letting go, is written once on each chain: one block on the tree's, one on
// the vision's, each naming the other. Chains are append-only, so an ended ground is a second
// pair of blocks ('released'), never the removal of the first.
//
// WHOSE NAME A BLOCK WEARS: both blocks are authored by the hand that acted — the carer who said
// yes, or whichever side let go. Nothing is attributed to a being that did not act.
//
// HOW FAR A BLOCK IS SEEN: as far as the more hidden of the two beings. Since nothing private
// takes ground, that is 'public' or 'node'; should a private being ever reach here, the block is
// 'private' (its author alone) rather than louder than the being.
export type GroundAct = 'grounded' | 'released';

export const groundBlockVisibility = (treeVisibility: string | null | undefined, visionVisibility: string | null | undefined): 'public' | 'node' | 'private' => {
  const quiet = Math.min(reach(treeVisibility), reach(visionVisibility));
  return quiet === 2 ? 'public' : quiet === 1 ? 'node' : 'private';
};

export interface GroundBlockSource {
  act: GroundAct;
  vision: { id: string; visibility?: string | null };
  tree: { id: string; visibility?: string | null };
  actor: { uid: string; name: string };
  self: boolean;
}
export function groundBlocksOf(source: GroundBlockSource, prose: { title: string; treeBody: string; visionBody: string }) {
  const shared = { title: prose.title, groundAct: source.act, authorId: source.actor.uid, authorName: source.actor.name,
    visibility: groundBlockVisibility(source.tree.visibility, source.vision.visibility),
    ...(source.self ? { groundSelf: true } : {}) };
  return {
    tree: { ...shared, type: 'standard', body: prose.treeBody, groundRole: 'tree', groundTwinOf: source.vision.id, groundTwinKind: 'vision' },
    vision: { ...shared, type: 'vision_growth', body: prose.visionBody, groundRole: 'vision', groundTwinOf: source.tree.id, groundTwinKind: 'tree' },
  };
}

// THE ROOT VISION OF A TREE is known by its birth ground, never by its title. A tree has at most
// one; if a damaged record shows several, the eldest ground answers (then the smaller id, so the
// answer never depends on the order the links were read in).
export interface GroundLinkFacts { visionId: string; treeId: string; birth?: boolean | null; createdAtMs?: number | null }
export const rootVisionOf = (treeId: string, grounds: readonly GroundLinkFacts[]): string | null => {
  const births = grounds.filter(g => g.treeId === treeId && g.birth === true);
  if (!births.length) return null;
  return [...births].sort((a, b) =>
    (a.createdAtMs ?? Infinity) - (b.createdAtMs ?? Infinity) || a.visionId.localeCompare(b.visionId))[0].visionId;
};

// THE HOME GROUND OF A VISION: the one tree that answers when a single tree must (the thread a
// keeper's notice lands in, the chain the Shadow compare opens on, the name a resonance wears).
// A vision may stand in twelve trees; its home is its birth ground, else the eldest ground, else
// none (keeper's word, 2026-11-18). Ties fall to the smaller id, so the answer never depends on
// the order the links were read in. This replaces the old `vision.lifetreeId` field.
export interface VisionGroundFacts { treeId: string; birth?: boolean | null; createdAtMs?: number | null }
export const homeGroundOf = (grounds: readonly VisionGroundFacts[]): string | null => {
  if (!grounds.length) return null;
  return [...grounds].sort((a, b) =>
    Number(b.birth === true) - Number(a.birth === true)
    || (a.createdAtMs ?? Infinity) - (b.createdAtMs ?? Infinity) || a.treeId.localeCompare(b.treeId))[0].treeId;
};
// A vision is a tree's Root Vision when one of its grounds is a birth ground — never by its title.
export const isRootVision = (grounds: readonly Pick<VisionGroundFacts, 'birth'>[]): boolean => grounds.some(g => g.birth === true);

// A tree's stored record as the light law reads it. Validation is the EXPLICIT stamp only (a
// guardian's or an initiate's yes names its giver in `validatorId`; the system's and the genesis'
// own stamps do not count — utils/validation isExplicitlyValidatedTree). Care is `lastCaredAt`
// alone: a tree never cared for carries no light, whatever else was edited on it.
export interface GroundTreeRecord {
  treeType?: unknown; isNature?: unknown; validated?: unknown; validatorId?: unknown;
  diedAtMs?: number | null; lastCaredAtMs?: number | null;
}
export const groundLightFactsOf = (tree: GroundTreeRecord): GroundLightFacts => ({
  treeType: typeof tree.treeType === 'string' ? tree.treeType : null,
  isNature: tree.isNature === true,
  diedAtMs: tree.diedAtMs ?? null,
  validated: tree.validated === true && typeof tree.validatorId === 'string' && tree.validatorId !== ''
    && tree.validatorId !== 'SYSTEM' && tree.validatorId !== 'GENESIS',
  lastCaredAtMs: tree.lastCaredAtMs ?? null,
});
// May light move around this vision now? `trees` are the records of every tree it stands in
// (its `grounded_in` links, read by the server at the moment of movement).
export const visionLightOf = (trees: readonly GroundTreeRecord[], nowMs: number): boolean =>
  visionReceivesLight(trees.map(groundLightFactsOf), nowMs);
