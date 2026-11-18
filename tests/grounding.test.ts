import { describe, it, expect } from 'vitest';
import {
  GROUNDED_IN, GROUND_REQUEST, MAX_GROUNDS_PER_VISION, MAX_VISIONS_PER_TREE,
  groundRefusal, groundKeepsFaith, groundAskRefusal, groundAcceptRefusal, groundMarkOf,
  groundReleaseRefusal, isSeekingGround, visionReceivesLight, groundCarriesLight, GROUND_CARE_WINDOW_MS, rootVisionOf,
  groundBlocksOf, groundBlockVisibility,
  type GroundAskFacts, type GroundAcceptFacts,
} from '../src/domain/grounding';
import { REL_ENDPOINTS, SKIP_RELS, walkEndsOf } from '../src/domain/subgraph';
import { DOMAIN_KEYS } from '../src/domain/words';
import { BLOCK_CONTENT_FIELDS } from '../src/domain/chain/verify';
import { isCoHeld } from '../src/domain/unmint';
import { VALIDATION_WINDOW_MS } from '../src/domain/guardianship';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { seedGroundCommand } from '../src/domain/seedOrgans.mjs';
import { seedRequest } from '../src/domain/seedRequest.mjs';

// THE GROUND (2026-11-17): a vision needs no tree; a ground is two sides agreeing, and grants nothing.

const author = 'u-visionary';
const vision = { authorId: author, visibility: 'public' };
const tree = { treeType: 'LIFETREE', visibility: 'public', diedAtMs: null };

describe('which tree may ground which vision', () => {
  it('a lifetree and a nature tree may; a tree with no kind is a lifetree', () => {
    expect(groundRefusal(tree, vision)).toBeNull();
    expect(groundRefusal({ treeType: 'GUARDED' }, vision)).toBeNull();
    expect(groundRefusal({}, {})).toBeNull();
  });
  it('a secret tree and a bed ground no one', () => {
    expect(groundRefusal({ treeType: 'SECRET', visibility: 'private' }, { visibility: 'private' })).toBe('ground_secret_tree');
    expect(groundRefusal({ treeType: 'BED' }, vision)).toBe('ground_bed');
  });
  it('a ground is asked of the living', () => {
    expect(groundRefusal({ ...tree, diedAtMs: 1 }, vision)).toBe('ground_tree_gone');
  });
  it('a tree never grounds a vision seen further than itself', () => {
    expect(groundRefusal({ visibility: 'node' }, { visibility: 'public' })).toBe('ground_tree_hidden');
    expect(groundRefusal({ visibility: 'node' }, {})).toBe('ground_tree_hidden'); // an absent vision visibility is public
    expect(groundRefusal({ visibility: 'node' }, { visibility: 'node' })).toBeNull();
    expect(groundRefusal({ visibility: 'public' }, { visibility: 'node' })).toBeNull();
  });
  it('nothing private takes ground: the LIN is world-readable, and a link would tell', () => {
    expect(groundRefusal({ visibility: 'private' }, { visibility: 'public' })).toBe('ground_tree_hidden');
    expect(groundRefusal({ visibility: 'private' }, { visibility: 'node' })).toBe('ground_tree_hidden');
    expect(groundRefusal({ visibility: 'public' }, { visibility: 'private' })).toBe('ground_vision_hidden');
    expect(groundRefusal({ visibility: 'private' }, { visibility: 'private' })).toBe('ground_vision_hidden');
  });
  it('an unknown visibility word is read as hidden, never as open', () => {
    expect(groundRefusal({ visibility: 'pubic' }, { visibility: 'public' })).toBe('ground_tree_hidden');
    expect(groundRefusal({ visibility: 'public' }, { visibility: 'whatever' })).toBe('ground_vision_hidden');
  });
});

describe('a standing ground keeps faith', () => {
  it('while neither being is private and the tree is seen at least as far as the vision', () => {
    expect(groundKeepsFaith({ visibility: 'public' }, { visibility: 'public' })).toBe(true);
    expect(groundKeepsFaith({ visibility: 'node' }, { visibility: 'node' })).toBe(true);
    expect(groundKeepsFaith({ visibility: 'private' }, { visibility: 'public' })).toBe(false); // the tree was drawn private
    expect(groundKeepsFaith({ visibility: 'node' }, { visibility: 'public' })).toBe(false);    // the vision was opened
    expect(groundKeepsFaith({ visibility: 'public' }, { visibility: 'private' })).toBe(false); // the vision was drawn private
  });
  it('never in a tree that became furniture or a secret', () => {
    expect(groundKeepsFaith({ treeType: 'SECRET' }, vision)).toBe(false);
    expect(groundKeepsFaith({ treeType: 'BED' }, vision)).toBe(false);
  });
});

describe('the ask', () => {
  const ask = (over: Partial<GroundAskFacts> = {}): GroundAskFacts =>
    ({ askerUid: author, vision, tree, alreadyGrounded: false, pendingRequest: false, visionGroundCount: 0, visionAskCount: 0, ...over });

  it('the author may ask a tree that may ground the vision', () => {
    expect(groundAskRefusal(ask())).toBeNull();
  });
  it('no one else asks, and no one asks without a name', () => {
    expect(groundAskRefusal(ask({ askerUid: 'u-other' }))).toBe('ground_ask_author_only');
    expect(groundAskRefusal(ask({ askerUid: '', vision: { authorId: '' } }))).toBe('ground_ask_author_only');
  });
  it('the two beings are judged before the bookkeeping', () => {
    expect(groundAskRefusal(ask({ tree: { treeType: 'SECRET' }, alreadyGrounded: true }))).toBe('ground_secret_tree');
  });
  it('asks once, and not where it already stands', () => {
    expect(groundAskRefusal(ask({ alreadyGrounded: true }))).toBe('ground_already');
    expect(groundAskRefusal(ask({ pendingRequest: true }))).toBe('ground_already_asked');
  });
  it('a vision stands in at most twelve trees, counting the asks still waiting', () => {
    expect(MAX_GROUNDS_PER_VISION).toBe(12);
    expect(groundAskRefusal(ask({ visionGroundCount: 11 }))).toBeNull();
    expect(groundAskRefusal(ask({ visionGroundCount: 12 }))).toBe('ground_vision_full');
    expect(groundAskRefusal(ask({ visionAskCount: 12 }))).toBe('ground_vision_full');
    expect(groundAskRefusal(ask({ visionGroundCount: 7, visionAskCount: 4 }))).toBeNull();
    expect(groundAskRefusal(ask({ visionGroundCount: 7, visionAskCount: 5 }))).toBe('ground_vision_full');
  });
});

describe('the yes', () => {
  const yes = (over: Partial<GroundAcceptFacts> = {}): GroundAcceptFacts =>
    ({ accepterUid: 'u-gardener', accepterCaresForTree: true, requestedBy: author, vision, tree,
       alreadyGrounded: false, visionGroundCount: 0, treeVisionCount: 0, ...over });

  it('a carer of the tree answers an ask that stands', () => {
    expect(groundAcceptRefusal(yes())).toBeNull();
  });
  it('there is no yes without an ask — a carer cannot ground a vision unasked', () => {
    expect(groundAcceptRefusal(yes({ requestedBy: null }))).toBe('ground_no_request');
  });
  it('the yes stands only on a knock made by the one who is the author now', () => {
    // The vision changed hands after the knock: its new author never asked.
    expect(groundAcceptRefusal(yes({ vision: { authorId: 'u-victim', visibility: 'public' } }))).toBe('ground_no_request');
    expect(groundAcceptRefusal(yes({ requestedBy: 'u-someone-else' }))).toBe('ground_no_request');
    expect(groundAcceptRefusal(yes({ requestedBy: '', vision: { authorId: '' } }))).toBe('ground_no_request');
  });
  it('only a carer answers; the author is no carer of another being\'s tree', () => {
    expect(groundAcceptRefusal(yes({ accepterCaresForTree: false }))).toBe('ground_accept_carer_only');
    expect(groundAcceptRefusal(yes({ accepterUid: author, accepterCaresForTree: false }))).toBe('ground_accept_carer_only');
    expect(groundAcceptRefusal(yes({ accepterUid: '' }))).toBe('ground_accept_carer_only');
  });
  it('what the ask checked is checked again at the answer', () => {
    expect(groundAcceptRefusal(yes({ tree: { ...tree, diedAtMs: 5 } }))).toBe('ground_tree_gone');
    expect(groundAcceptRefusal(yes({ tree: { ...tree, visibility: 'private' } }))).toBe('ground_tree_hidden');
    expect(groundAcceptRefusal(yes({ vision: { authorId: author, visibility: 'private' } }))).toBe('ground_vision_hidden');
    expect(groundAcceptRefusal(yes({ alreadyGrounded: true }))).toBe('ground_already');
  });
  it('both caps hold: twelve grounds to a vision, twelve visions to a tree', () => {
    expect(MAX_VISIONS_PER_TREE).toBe(12);
    expect(groundAcceptRefusal(yes({ visionGroundCount: 12 }))).toBe('ground_vision_full');
    expect(groundAcceptRefusal(yes({ treeVisionCount: 11 }))).toBeNull();
    expect(groundAcceptRefusal(yes({ treeVisionCount: 12 }))).toBe('ground_tree_full');
  });
  it('an author may ground a vision in their own tree, and the link says so', () => {
    expect(groundAcceptRefusal(yes({ accepterUid: author }))).toBeNull();
    // Grown from the tree: one being saying yes twice needs no knock — but still must care for the tree.
    expect(groundAcceptRefusal(yes({ accepterUid: author, requestedBy: null }))).toBeNull();
    expect(groundAcceptRefusal(yes({ accepterUid: author, requestedBy: null, accepterCaresForTree: false }))).toBe('ground_accept_carer_only');
    expect(groundAcceptRefusal(yes({ accepterUid: author, requestedBy: null, tree: { treeType: 'SECRET' } }))).toBe('ground_secret_tree');
    expect(groundMarkOf({ accepterUid: author, vision })).toEqual({ self: true, birth: false });
    expect(groundMarkOf({ accepterUid: 'u-gardener', vision })).toEqual({ self: false, birth: false });
    expect(groundMarkOf({ accepterUid: author, vision, bornWithTree: true })).toEqual({ self: true, birth: true });
  });
});

describe('letting go', () => {
  it('either side alone: the author for the vision, a carer for the tree', () => {
    expect(groundReleaseRefusal({ uid: author, visionAuthorId: author, caresForTree: false, grounded: true })).toBeNull();
    expect(groundReleaseRefusal({ uid: 'u-gardener', visionAuthorId: author, caresForTree: true, grounded: true })).toBeNull();
  });
  it('no stranger, and nothing that is not standing', () => {
    expect(groundReleaseRefusal({ uid: 'u-stranger', visionAuthorId: author, caresForTree: false, grounded: true })).toBe('ground_release_not_yours');
    expect(groundReleaseRefusal({ uid: '', visionAuthorId: '', caresForTree: false, grounded: true })).toBe('ground_release_not_yours');
    expect(groundReleaseRefusal({ uid: author, visionAuthorId: author, caresForTree: false, grounded: false })).toBe('ground_not_standing');
  });
  it('a ground whose vision is gone is still let go by the tree, so its place is not held for ever', () => {
    expect(groundReleaseRefusal({ uid: 'u-gardener', visionAuthorId: null, caresForTree: true, grounded: true })).toBeNull();
    expect(groundReleaseRefusal({ uid: 'u-stranger', visionAuthorId: null, caresForTree: false, grounded: true })).toBe('ground_release_not_yours');
  });
});

describe('seeking ground, and the light', () => {
  it('a vision with no ground is seeking ground', () => {
    expect(isSeekingGround(0)).toBe(true);
    expect(isSeekingGround(1)).toBe(false);
    expect(isSeekingGround(Number.NaN)).toBe(true);
  });
});

// ONLY A GROUNDED VISION RECEIVES LIGHT — and only through soil that is cared for now.
describe('the light reaches a vision through cared-for ground', () => {
  const DAY = 86_400_000;
  const now = 1_000 * DAY;
  const lit = { treeType: 'LIFETREE', diedAtMs: null, validated: true, lastCaredAtMs: now - 10 * DAY };

  it('a living, validated lifetree cared for within the year carries light', () => {
    expect(groundCarriesLight(lit, now)).toBe(true);
    expect(groundCarriesLight({ ...lit, treeType: undefined }, now)).toBe(true); // absent = a lifetree
  });
  it('the window is the validation year', () => {
    expect(GROUND_CARE_WINDOW_MS).toBe(VALIDATION_WINDOW_MS);
    expect(groundCarriesLight({ ...lit, lastCaredAtMs: now - GROUND_CARE_WINDOW_MS + 1 }, now)).toBe(true);
    expect(groundCarriesLight({ ...lit, lastCaredAtMs: now - GROUND_CARE_WINDOW_MS }, now)).toBe(false);
  });
  it('consent alone is not enough: a neglected or never-cared tree carries none', () => {
    expect(groundCarriesLight({ ...lit, lastCaredAtMs: now - 400 * DAY }, now)).toBe(false);
    expect(groundCarriesLight({ ...lit, lastCaredAtMs: null }, now)).toBe(false);
    expect(groundCarriesLight({ ...lit, lastCaredAtMs: undefined }, now)).toBe(false);
  });
  it('an unvalidated lifetree carries none; a nature tree needs no validation of its own', () => {
    expect(groundCarriesLight({ ...lit, validated: false }, now)).toBe(false);
    expect(groundCarriesLight({ ...lit, validated: null }, now)).toBe(false);
    expect(groundCarriesLight({ ...lit, treeType: 'GUARDED', validated: false }, now)).toBe(true);
    expect(groundCarriesLight({ ...lit, isNature: true, validated: false }, now)).toBe(true);
  });
  it('the dead, the secret and the bed carry none', () => {
    expect(groundCarriesLight({ ...lit, diedAtMs: now - DAY }, now)).toBe(false);
    expect(groundCarriesLight({ ...lit, treeType: 'SECRET' }, now)).toBe(false);
    expect(groundCarriesLight({ ...lit, treeType: 'BED' }, now)).toBe(false);
  });
  it('a vision receives light when any one of its grounds carries it, and never with none', () => {
    expect(visionReceivesLight([], now)).toBe(false);
    expect(visionReceivesLight([{ ...lit, validated: false }, { ...lit, diedAtMs: 1 }], now)).toBe(false);
    expect(visionReceivesLight([{ ...lit, validated: false }, lit], now)).toBe(true);
  });
});

describe('the two blocks of one act', () => {
  const source = {
    act: 'grounded' as const,
    vision: { id: 'v1', visibility: 'public' },
    tree: { id: 't1', visibility: 'public' },
    actor: { uid: 'u-gardener', name: 'Gardener' },
    self: false,
  };
  const prose = { title: 'T', treeBody: 'on the tree', visionBody: 'on the vision' };

  it('each names the act, its side and the other chain', () => {
    const { tree: onTree, vision: onVision } = groundBlocksOf(source, prose);
    expect(onTree).toMatchObject({ type: 'standard', groundAct: 'grounded', groundRole: 'tree', groundTwinOf: 'v1', groundTwinKind: 'vision', body: 'on the tree', visibility: 'public' });
    expect(onVision).toMatchObject({ type: 'vision_growth', groundAct: 'grounded', groundRole: 'vision', groundTwinOf: 't1', groundTwinKind: 'tree', body: 'on the vision', visibility: 'public' });
    expect('groundSelf' in onTree).toBe(false);
  });
  it('both blocks are authored by the hand that acted, whichever side it stands on', () => {
    const accepted = groundBlocksOf(source, prose);
    expect([accepted.tree.authorId, accepted.vision.authorId]).toEqual(['u-gardener', 'u-gardener']);
    const letGo = groundBlocksOf({ ...source, act: 'released', actor: { uid: author, name: 'Visionary' } }, prose);
    expect([letGo.tree.authorId, letGo.vision.authorId]).toEqual([author, author]);
    expect(letGo.tree.authorName).toBe('Visionary');
    expect(letGo.vision.groundAct).toBe('released');
  });
  it('a self-grounding says so on both blocks', () => {
    const own = groundBlocksOf({ ...source, self: true }, prose);
    expect(own.tree.groundSelf).toBe(true);
    expect(own.vision.groundSelf).toBe(true);
  });
  it('a block is seen as far as the more hidden of the two beings, never further', () => {
    expect(groundBlockVisibility('public', 'public')).toBe('public');
    expect(groundBlockVisibility(undefined, undefined)).toBe('public');
    expect(groundBlockVisibility('public', 'node')).toBe('node');
    expect(groundBlockVisibility('node', 'node')).toBe('node');
    expect(groundBlockVisibility('public', 'private')).toBe('private'); // unlawful, and still not louder
    expect(groundBlockVisibility('public', 'nonsense')).toBe('private');
    const quiet = groundBlocksOf({ ...source, vision: { id: 'v1', visibility: 'node' } }, prose);
    expect([quiet.tree.visibility, quiet.vision.visibility]).toEqual(['node', 'node']);
  });
  it('every field the blocks carry is sealed into the hash, and a ground block cannot be unsaid', () => {
    const { tree: onTree, vision: onVision } = groundBlocksOf({ ...source, self: true }, prose);
    for (const block of [onTree, onVision]) for (const key of Object.keys(block)) {
      expect(BLOCK_CONTENT_FIELDS as readonly string[]).toContain(key);
    }
    expect(isCoHeld({ groundAct: 'grounded' }, 'u-gardener')).toBe(true);
    expect(isCoHeld({}, 'u-gardener')).toBe(false);
  });
});

describe('the Root Vision is known by its birth ground', () => {
  it('is the vision whose ground was made at the tree\'s planting', () => {
    const grounds = [
      { visionId: 'v-later', treeId: 't1' },
      { visionId: 'v-root', treeId: 't1', birth: true },
      { visionId: 'v-elsewhere', treeId: 't2', birth: true },
    ];
    expect(rootVisionOf('t1', grounds)).toBe('v-root');
    expect(rootVisionOf('t2', grounds)).toBe('v-elsewhere');
  });
  it('a tree planted without a vision has none', () => {
    expect(rootVisionOf('t1', [{ visionId: 'v', treeId: 't1' }])).toBeNull();
    expect(rootVisionOf('t1', [])).toBeNull();
  });
  it('a damaged record with two births answers the eldest, whatever the reading order', () => {
    const a = { visionId: 'v-b', treeId: 't1', birth: true, createdAtMs: 20 };
    const b = { visionId: 'v-a', treeId: 't1', birth: true, createdAtMs: 10 };
    const undated = { visionId: 'v-0', treeId: 't1', birth: true };
    expect(rootVisionOf('t1', [a, b, undated])).toBe('v-a');
    expect(rootVisionOf('t1', [undated, b, a])).toBe('v-a');
    expect(rootVisionOf('t1', [{ ...a, createdAtMs: 10 }, b])).toBe('v-a');
  });
});

describe('the two rels in the walk\'s map', () => {
  it('a ground joins a vision to a tree; the knock weaves nothing', () => {
    expect(walkEndsOf(GROUNDED_IN)).toEqual({ from: 'vision', to: 'tree' });
    expect(walkEndsOf(GROUND_REQUEST)).toBeNull();
    expect(SKIP_RELS.has(GROUND_REQUEST)).toBe(true);
    expect(Object.hasOwn(REL_ENDPOINTS, GROUND_REQUEST)).toBe(false);
  });
  it('every refusal this law speaks is a word the dictionary must carry', () => {
    const spoken = ['ground_secret_tree', 'ground_bed', 'ground_tree_gone', 'ground_tree_hidden', 'ground_vision_hidden', 'ground_ask_author_only',
      'ground_already', 'ground_already_asked', 'ground_vision_full', 'ground_tree_full', 'ground_no_request',
      'ground_accept_carer_only', 'ground_not_standing', 'ground_release_not_yours'];
    for (const key of spoken) expect(DOMAIN_KEYS as readonly string[]).toContain(key);
  });
});

// THE TWO SOILS KEEP STEP (Zoltán, 2026-11-17): the independent node offers the same ground.
describe('the ground on the independent node — the command and the door', () => {
  it('a command is an action and two ids, and nothing else', () => {
    for (const action of ['ask', 'drop', 'accept', 'release']) {
      expect(seedGroundCommand({ action, visionId: 'v1', treeId: 't1' })).toEqual({ action, visionId: 'v1', treeId: 't1' });
    }
    expect(seedGroundCommand({ action: 'mint', visionId: 'v1', treeId: 't1' })).toBeNull();
    expect(seedGroundCommand({ action: 'ask', visionId: 'v1' })).toBeNull();
    expect(seedGroundCommand({ action: 'ask', visionId: 'v1', treeId: 't1', self: true })).toBeNull();
    expect(seedGroundCommand({ action: 'ask', visionId: 'a__grounded_in__b', treeId: 't1' })).toBeNull();
    expect(seedGroundCommand({ action: 'ask', visionId: 'v1', treeId: 'x/y' })).toBeNull();
    expect(seedGroundCommand(null)).toBeNull();
  });
  it('the door is signed-in POST only', () => {
    expect(seedRequest('POST', '/v1/grounding/command', 'Bearer x', true)).toEqual({ kind: 'groundCommand' });
    expect(seedRequest('POST', '/v1/grounding/command', null, false)).toMatchObject({ status: 401 });
    expect(seedRequest('GET', '/v1/grounding/command', 'Bearer x', true)).toMatchObject({ status: 405 });
  });
  it('the independent backend speaks to its own node: no grounding hand is left unported', () => {
    const source = readFileSync(resolve(__dirname, '../src/services/independent/grounding.ts'), 'utf8');
    expect(source).not.toMatch(/unported\(/);
    expect(source).toMatch(/session\.groundCommand\(/);
  });
});

// The home ground replaces the old `vision.lifetreeId` wherever one tree must answer.
describe('the home ground of a vision', () => {
  it('is the birth ground, else the eldest ground, else none', async () => {
    const { homeGroundOf, isRootVision } = await import('../src/domain/grounding');
    expect(homeGroundOf([])).toBeNull();
    const grounds = [{ treeId: 't-new', createdAtMs: 300 }, { treeId: 't-old', createdAtMs: 100 }, { treeId: 't-birth', birth: true, createdAtMs: 200 }];
    expect(homeGroundOf(grounds)).toBe('t-birth');
    expect(homeGroundOf([...grounds].reverse())).toBe('t-birth');
    expect(homeGroundOf(grounds.slice(0, 2))).toBe('t-old');
    // a ground without a moment is younger than any dated one; ties fall to the smaller id
    expect(homeGroundOf([{ treeId: 't-b' }, { treeId: 't-a' }, { treeId: 't-dated', createdAtMs: 5 }])).toBe('t-dated');
    expect(homeGroundOf([{ treeId: 't-b' }, { treeId: 't-a' }])).toBe('t-a');
    expect(isRootVision(grounds)).toBe(true);
    expect(isRootVision(grounds.slice(0, 2))).toBe(false);
    expect(isRootVision([])).toBe(false);
  });
});

// The stored tree record as the light law reads it (the hands on both soils pass these).
describe('may light move around this vision', () => {
  it('only through a ground that is alive, cared for within a year and explicitly validated (a guarded tree needs no validation)', async () => {
    const { visionLightOf, groundLightFactsOf, GROUND_CARE_WINDOW_MS } = await import('../src/domain/grounding');
    const now = 1_800_000_000_000, recent = now - 1000, stale = now - GROUND_CARE_WINDOW_MS;
    const lit = { treeType: 'LIFETREE', validated: true, validatorId: 'u-guardian', lastCaredAtMs: recent };
    expect(visionLightOf([], now)).toBe(false);
    expect(visionLightOf([lit], now)).toBe(true);
    expect(visionLightOf([{ ...lit, lastCaredAtMs: stale }], now)).toBe(false);
    expect(visionLightOf([{ ...lit, lastCaredAtMs: null }], now)).toBe(false);
    expect(visionLightOf([{ ...lit, diedAtMs: 5 }], now)).toBe(false);
    expect(visionLightOf([{ ...lit, validated: false }], now)).toBe(false);
    for (const validatorId of ['SYSTEM', 'GENESIS', '', undefined, 7]) expect(visionLightOf([{ ...lit, validatorId }], now)).toBe(false);
    for (const treeType of ['SECRET', 'BED']) expect(visionLightOf([{ ...lit, treeType }], now)).toBe(false);
    expect(visionLightOf([{ treeType: 'GUARDED', lastCaredAtMs: recent }], now)).toBe(true);
    expect(visionLightOf([{ isNature: true, lastCaredAtMs: recent }], now)).toBe(true);
    // one living ground among dead ones is enough
    expect(visionLightOf([{ ...lit, diedAtMs: 5 }, { ...lit, validated: false }, lit], now)).toBe(true);
    expect(groundLightFactsOf({ validated: 'true', validatorId: 'u' }).validated).toBe(false);
  });
});

describe('a vision is gone: the words its grounds end with', () => {
  it('names the hand, the vision and the tree, and writes nothing for the vision', async () => {
    const { visionGoneGroundProse } = await import('../src/domain/grounding');
    expect(visionGoneGroundProse('Alice', 'Clear water', 'Oak')).toEqual({
      title: 'A ground ends with its vision', treeBody: 'Alice released the vision "Clear water"; its ground in Oak ended with it.', visionBody: '' });
  });
});
