import { describe, it, expect } from 'vitest';
import {
  judgeBlockBirth, blockBirthOf, blockRecordOf, chainHeadOf, heightAfter, wateringResetOf,
  BLOCK_BIRTH_FIELDS, TREE_BLOCK_TYPES, VISION_BLOCK_TYPES, BLOCK_VISIBILITIES,
  type BlockBirthFacts,
} from '../src/domain/chain';
import {
  BLOCK_CONTENT_FIELDS, computeCanonicalHash, verifyBlockSeal, BLOCK_HASH_VERSION,
  SIGNED_BLOCK_FIELDS, BLOCK_SIGNATURE_DOMAIN, signedContentOf, blockSignaturePayload, blockSignaturePreimage,
  blockSignaturePayloadOf, judgeBlockSignature, isBlockSignatureClaim, type SignerFacts,
} from '../src/domain/chain';
import { signingPreimage } from '../src/domain/signing';
import { keypairFromSeed, signPayload, verifyPayload, subtleEd25519Available } from '../src/services/signingCrypto';
import { unmintRefusal, STAFF_OVERRIDABLE_REFUSALS } from '../src/domain/unmint';
import { DOMAIN_KEYS } from '../src/domain/words';
import {
  judgeBlockBirth as serverJudge, blockBirthOf as serverBirthOf, blockRecordOf as serverRecordOf,
  chainHeadOf as serverHeadOf, heightAfter as serverHeightAfter, wateringResetOf as serverWateringResetOf,
  BLOCK_BIRTH_FIELDS as SERVER_BIRTH_FIELDS, TREE_BLOCK_TYPES as SERVER_TREE_TYPES,
  VISION_BLOCK_TYPES as SERVER_VISION_TYPES, BLOCK_VISIBILITIES as SERVER_VISIBILITIES,
  unmintRefusal as serverUnmintRefusal, STAFF_OVERRIDABLE_REFUSALS as SERVER_STAFF_OVERRIDABLE,
  SIGNED_BLOCK_FIELDS as SERVER_SIGNED_FIELDS, BLOCK_SIGNATURE_DOMAIN as SERVER_SIGNATURE_DOMAIN,
  signedContentOf as serverSignedContentOf, blockSignaturePayload as serverSignaturePayload,
  blockSignaturePreimage as serverSignaturePreimage, blockSignaturePayloadOf as serverSignaturePayloadOf,
  judgeBlockSignature as serverJudgeSignature, signingPreimage as serverSigningPreimage,
} from '../functions/src/birth';

// THE BIRTH OF A BLOCK (ring 2026-09-23, server-held heads): the law functions/mintBlock applies
// to every new chain link, walked branch by branch — and THE MIRROR TEST: functions/src/birth.ts
// is the server's copy of src/domain/chain/birth.ts (functions is a separate TS project and
// cannot import src/domain). Every judgment below is asked of BOTH and compared, so the two
// laws can never drift apart silently (the mint.ts / offering.ts arrangement).

const ANA = 'ana';
const bearer = (over: Partial<BlockBirthFacts['bearer']> = {}): BlockBirthFacts['bearer'] =>
  ({ exists: true, carer: true, latestHash: 'h9', genesisHash: 'g0', blockHeight: 9, ...over });
const facts = (block: unknown, over: Partial<BlockBirthFacts> = {}): BlockBirthFacts =>
  ({ on: 'tree', minterUid: ANA, isStaff: false, bearer: bearer(), block, ...over });

// Ask both laws, insist they agree, hand back the domain's answer.
const judge = (f: BlockBirthFacts) => {
  const mine = judgeBlockBirth(f);
  expect(serverJudge(f)).toEqual(mine);
  return mine;
};
const refusalOf = (f: BlockBirthFacts) => { const j = judge(f); return j.outcome === 'reject' ? j.refusal : null; };

describe('the birth law — what the server refuses', () => {
  it('a chain that does not exist', () => {
    expect(refusalOf(facts({ type: 'tree_growth' }, { bearer: bearer({ exists: false }) }))).toBe('block_no_bearer');
  });
  it('a block that is not an object', () => {
    expect(refusalOf(facts('growth'))).toBe('block_field_bad');
    expect(refusalOf(facts(null))).toBe('block_field_bad');
  });
  it('a hand naming what only the server says — its seal, its head, its author, its clock', () => {
    for (const forged of [{ previousHash: 'h9' }, { hash: 'x' }, { authorId: 'bakr' }, { mintedAt: 1 }, { lid: 'x' }, { id: 'x' }, { domain: 'x' }, { lifetreeId: 't' }, { loveCount: 5 }, { offeringId: 'o' }, { matchId: 'm' }, { vetoes: [] }]) {
      expect(refusalOf(facts({ type: 'tree_growth', ...forged })), JSON.stringify(forged)).toBe('block_field_unknown');
    }
  });
  it('a record kind that is not a link on this chain', () => {
    expect(refusalOf(facts({ type: 'event' }))).toBe('block_type_unlawful');
    expect(refusalOf(facts({ type: 'offering' }))).toBe('block_type_unlawful');
    expect(refusalOf(facts({ type: 'decision' }))).toBe('block_type_unlawful');
    expect(refusalOf(facts({ type: 'vision_growth' }))).toBe('block_type_unlawful');          // not on a tree
    expect(refusalOf(facts({ type: 'tree_growth' }, { on: 'vision' }))).toBe('block_type_unlawful'); // not on a vision
    expect(refusalOf(facts({}))).toBe('block_type_unlawful');
  });
  it('a hand without standing — unless it is staff', () => {
    expect(refusalOf(facts({ type: 'tree_growth' }, { bearer: bearer({ carer: false }) }))).toBe('block_not_carer');
    expect(refusalOf(facts({ type: 'tree_growth' }, { bearer: bearer({ carer: false }), isStaff: true }))).toBeNull();
  });
  it('fields out of shape', () => {
    expect(refusalOf(facts({ type: 'tree_growth', title: 7 }))).toBe('block_field_bad');
    expect(refusalOf(facts({ type: 'reach', participantUids: 'ana' }))).toBe('block_field_bad');
    expect(refusalOf(facts({ type: 'reach', participantUids: [ANA, 3] }))).toBe('block_field_bad');
    expect(refusalOf(facts({ type: 'tree_growth', isGroup: 'yes' }))).toBe('block_field_bad');
    expect(refusalOf(facts({ type: 'tree_growth', care: 'yes' }))).toBe('block_field_bad');
    expect(refusalOf(facts({ type: 'tree_growth', care: 'watering', wateringConfirmation: 'ok' }))).toBe('block_field_bad');
  });
  it('a visibility that does not exist', () => {
    expect(refusalOf(facts({ type: 'tree_growth', visibility: 'secret' }))).toBe('block_visibility_bad');
  });
  it('care rides only on growth; a watering never declares its own witness', () => {
    expect(refusalOf(facts({ type: 'standard', care: true }))).toBe('block_care_type');
    expect(refusalOf(facts({ type: 'reach', care: 'watering' }))).toBe('block_care_type');
    expect(refusalOf(facts({ type: 'tree_growth', wateringConfirmedBy: 'ai' }))).toBe('block_care_type'); // no care
    expect(refusalOf(facts({ type: 'tree_growth', care: 'watering', wateringConfirmedBy: 'guardian' }))).toBe('block_witness_forged');
    expect(refusalOf(facts({ type: 'tree_growth', care: 'watering', wateringConfirmedBy: 'pending' }))).toBeNull();
    expect(refusalOf(facts({ type: 'tree_growth', care: 'watering', wateringConfirmedBy: 'ai', wateringConfirmation: { note: 'wet' } }))).toBeNull();
    expect(refusalOf(facts({ type: 'tree_growth', care: true }))).toBeNull();
  });
  it('an addressed reach is born private, and the minter stands in it', () => {
    expect(refusalOf(facts({ type: 'reach', recipientUid: 'bakr', visibility: 'public' }))).toBe('block_reach_loud');
    expect(refusalOf(facts({ type: 'reach', participantUids: [ANA, 'bakr'] }))).toBe('block_reach_loud'); // default public
    expect(refusalOf(facts({ type: 'reach', participantUids: ['bakr', 'chen'], visibility: 'private' }))).toBe('block_reach_stranger');
    expect(refusalOf(facts({ type: 'reach', recipientUid: 'bakr', participantUids: [ANA, 'bakr'], visibility: 'private' }))).toBeNull();
    expect(refusalOf(facts({ type: 'reach', visibility: 'public' }))).toBeNull(); // a public reflection names no one
  });
  it('no one has seen a block before it exists', () => {
    expect(refusalOf(facts({ type: 'reach', seenBy: ['bakr'], visibility: 'private', participantUids: [ANA, 'bakr'] }))).toBe('block_seen_forged');
    expect(refusalOf(facts({ type: 'reach', seenBy: [], visibility: 'private', participantUids: [ANA, 'bakr'] }))).toBeNull();
    expect(refusalOf(facts({ type: 'reach', seenBy: [ANA], visibility: 'private', participantUids: [ANA, 'bakr'] }))).toBeNull();
  });
});

describe('the birth law — what the server mints', () => {
  it('a growth on a tree: content kept, defaults filled, the head it follows and the height it takes', () => {
    const j = judge(facts({ type: 'tree_growth', imageUrl: 'https://x/y.webp', authorName: 'Ana' }));
    expect(j.outcome).toBe('mint');
    if (j.outcome !== 'mint') return;
    expect(j.content).toEqual({ type: 'tree_growth', imageUrl: 'https://x/y.webp', authorName: 'Ana', visibility: 'public', title: '', body: '' });
    expect(j.previousHash).toBe('h9');
    expect(j.blockHeight).toBe(10);
  });
  it('a contribution on a vision wears the vision\'s title and inherits its visibility', () => {
    const j = judge(facts({ type: 'vision_growth', body: 'a second node' }, { on: 'vision', bearer: bearer({ title: 'One forest', visibility: 'node' }) }));
    expect(j.outcome).toBe('mint');
    if (j.outcome !== 'mint') return;
    expect(j.content).toEqual({ type: 'vision_growth', body: 'a second node', visibility: 'node', title: 'One forest growth', visionTitle: 'One forest' });
  });
  it('the head a legacy bearer is followed at: latestHash, else genesis, else the root sentinel', () => {
    expect(chainHeadOf({ latestHash: 'h1', genesisHash: 'g0' })).toBe('h1');
    expect(chainHeadOf({ genesisHash: 'g0' })).toBe('g0');
    expect(chainHeadOf({})).toBe('0');
    expect(heightAfter({})).toBe(1);
    expect(heightAfter({ blockHeight: '4' })).toBe(5);
    for (const b of [{ latestHash: 'h1', genesisHash: 'g0' }, { genesisHash: 'g0' }, {}, { blockHeight: 3 }]) {
      expect(serverHeadOf(b)).toBe(chainHeadOf(b));
      expect(serverHeightAfter(b)).toBe(heightAfter(b));
    }
  });
});

describe('the record and the seal', () => {
  const content = { type: 'tree_growth', title: 'Watering', body: 'wet', visibility: 'public', care: 'watering', wateringConfirmedBy: 'pending', authorName: 'Ana' };
  const p = { on: 'tree' as const, bearerId: 'treeA', content, authorId: ANA, lid: '019f0000-0000-7000-8000-000000000001', id: 'p1', domain: 'lightseed.online', mintedAt: 1758585600000, previousHash: 'h9' };

  it('is the shape mintPulse wrote — and both laws write it identically', () => {
    const rec = blockRecordOf(p);
    expect(rec).toEqual({
      lid: p.lid, ...content, lifetreeId: 'treeA', authorId: ANA, domain: 'lightseed.online', id: 'p1',
      loveCount: 0, commentCount: 0, mintedAt: p.mintedAt, previousHash: 'h9',
    });
    expect(serverRecordOf(p)).toEqual(rec);
    expect(serverRecordOf({ ...p, on: 'vision', bearerId: 'v1' })).toEqual(blockRecordOf({ ...p, on: 'vision', bearerId: 'v1' }));
    expect(blockRecordOf({ ...p, on: 'vision', bearerId: 'v1' }).visionId).toBe('v1');
  });

  it('every field a hand may say that is chain content is sealed; the sealed record verifies', async () => {
    // The birth whitelist and the seal whitelist meet on the fields that matter: whatever a
    // hand says that is block content enters the hash; the rest (display, off-chain state) does not.
    const sealed = BLOCK_BIRTH_FIELDS.filter(f => (BLOCK_CONTENT_FIELDS as readonly string[]).includes(f));
    expect(sealed).toEqual(expect.arrayContaining(['type', 'title', 'body', 'content', 'imageUrl', 'visibility', 'care', 'participantUids', 'authorName']));
    expect((BLOCK_CONTENT_FIELDS as readonly string[]).includes('wateringConfirmedBy')).toBe(false); // mutated by the witness
    const rec = blockRecordOf(p);
    const hash = await computeCanonicalHash('h9', p.mintedAt, rec);
    expect(await verifyBlockSeal({ ...rec, hash, previousHash: 'h9', hashVersion: BLOCK_HASH_VERSION })).toBe(true);
    expect(await verifyBlockSeal({ ...rec, body: 'dry', hash, previousHash: 'h9', hashVersion: BLOCK_HASH_VERSION })).toBe(false);
  });

  it('the client sends only what a hand may say', () => {
    const asked = { type: 'reach', title: 'x', authorId: ANA, lifetreeId: 't', hash: 'h', previousHash: 'p', loveCount: 3, participantUids: [ANA], imageUrl: undefined };
    expect(blockBirthOf(asked)).toEqual({ type: 'reach', title: 'x', participantUids: [ANA] });
    expect(serverBirthOf(asked)).toEqual(blockBirthOf(asked));
  });
});

describe('the watering reset — the tree fields that ride with a watering block', () => {
  it('stamps the waterer and the moment; a scheduled tree gets its next due day', () => {
    const now = 1758585600000;
    const r = wateringResetOf({ watering: { mode: 'scheduled', intervalDays: 3 } }, now, ANA, 'Ana');
    expect(r).toEqual({ lastWateredAtMs: now, lastWateredBy: ANA, lastWateredByName: 'Ana', overdue: false, nextDueAtMs: now + 3 * 24 * 60 * 60 * 1000 });
    expect(wateringResetOf({ watering: { mode: 'self_sustaining' } }, now, ANA, 'Ana')).toEqual({ lastWateredAtMs: now, lastWateredBy: ANA, lastWateredByName: 'Ana', overdue: false });
    expect(wateringResetOf({}, now, ANA, '')).toEqual({ lastWateredAtMs: now, lastWateredBy: ANA, lastWateredByName: '', overdue: false });
    for (const t of [{ watering: { mode: 'scheduled', intervalDays: 3 } }, { watering: { mode: 'scheduled', intervalDays: 0 } }, {}]) {
      expect(serverWateringResetOf(t, now, ANA, 'Ana')).toEqual(wateringResetOf(t, now, ANA, 'Ana'));
    }
  });
});

describe('the functions mirror of the birth law stays true', () => {
  it('carries the same fields, types and visibilities', () => {
    expect([...SERVER_BIRTH_FIELDS]).toEqual([...BLOCK_BIRTH_FIELDS]);
    expect([...SERVER_TREE_TYPES]).toEqual([...TREE_BLOCK_TYPES]);
    expect([...SERVER_VISION_TYPES]).toEqual([...VISION_BLOCK_TYPES]);
    expect([...SERVER_VISIBILITIES]).toEqual([...BLOCK_VISIBILITIES]);
  });
  it('every refusal the law can speak is a word the dictionary carries', () => {
    for (const k of ['block_no_bearer', 'block_field_unknown', 'block_field_bad', 'block_type_unlawful', 'block_not_carer',
      'block_witness_forged', 'block_care_type', 'block_reach_loud', 'block_reach_stranger', 'block_visibility_bad', 'block_seen_forged',
      'align_not_target', 'align_not_pending']) {
      expect(DOMAIN_KEYS as readonly string[]).toContain(k);
    }
  });
  it('the unmint law is mirrored — refusals and the staff-overridable set', () => {
    const mint = (over: Record<string, unknown> = {}) => ({ authorId: ANA, type: 'tree_growth', lifetreeId: 't1', hash: 'h9', ...over });
    const cases: Array<[Record<string, unknown>, { latestHash?: string }, string | undefined]> = [
      [mint(), { latestHash: 'h9' }, ANA],
      [mint(), { latestHash: 'h9' }, 'bakr'],
      [mint({ lifetreeId: undefined }), { latestHash: 'h9' }, ANA],
      [mint({ type: 'decision' }), { latestHash: 'h9' }, ANA],
      [mint({ wateringConfirmedBy: 'guardian' }), { latestHash: 'h9' }, ANA],
      [mint({ seenBy: ['bakr'] }), { latestHash: 'h9' }, ANA],
      [mint({ loveCount: 1 }), { latestHash: 'h9' }, ANA],
      [mint({ offeringId: 'o' }), { latestHash: 'h9' }, ANA],
      [mint(), { latestHash: 'h8' }, ANA],
    ];
    for (const [pulse, tree, uid] of cases) {
      expect(serverUnmintRefusal(pulse, tree, uid)).toBe(unmintRefusal(pulse, tree, uid));
    }
    expect([...SERVER_STAFF_OVERRIDABLE].sort()).toEqual([...STAFF_OVERRIDABLE_REFUSALS].sort());
  });
});

describe("the author's signature — the law, the mirror, and a real Ed25519 roundtrip", () => {
  const content = { type: 'tree_growth', title: 'Leaf', body: 'grew', visibility: 'public', imageUrl: 'https://x/y.webp', authorName: 'Ana', wateringConfirmedBy: 'pending', seenBy: [] };
  const active: SignerFacts = { state: 'active', fingerprint: 'f'.repeat(64), epochId: 'anchor_' + 'f'.repeat(64), pubkey: 'PUB' };
  const claim = { sig: 'SIG', keyFingerprint: active.fingerprint!, epochId: active.epochId!, previousHash: 'h9' };
  const judge = (f: Parameters<typeof judgeBlockSignature>[0]) => {
    const mine = judgeBlockSignature(f);
    expect(serverJudgeSignature(f)).toEqual(mine);
    return mine;
  };
  const refusal = (f: Parameters<typeof judgeBlockSignature>[0]) => { const j = judge(f); return j.outcome === 'reject' ? j.refusal : j.outcome; };

  it('the signed fields are stored verbatim and sealed: a subset of both the birth and the seal', () => {
    for (const f of SIGNED_BLOCK_FIELDS) {
      expect(BLOCK_CONTENT_FIELDS as readonly string[], `${f} is not sealed`).toContain(f);
      if (f !== 'visionTitle') expect(BLOCK_BIRTH_FIELDS as readonly string[], `${f} is not a hand's to say`).toContain(f);
    }
    for (const f of ['wateringConfirmedBy', 'wateringConfirmation', 'seenBy', 'authorSignature']) expect(SIGNED_BLOCK_FIELDS as readonly string[]).not.toContain(f);
    expect(BLOCK_CONTENT_FIELDS as readonly string[]).toContain('authorSignature');
    expect(signedContentOf(content)).toEqual({ type: 'tree_growth', title: 'Leaf', body: 'grew', visibility: 'public', imageUrl: 'https://x/y.webp', authorName: 'Ana' });
  });

  it('no published key: unsigned is plain, a stray claim is refused', () => {
    expect(refusal({ signer: { state: 'none' }, claim: undefined, headHash: 'h9', verified: false })).toBe('unsigned');
    expect(refusal({ signer: { state: 'none' }, claim, headHash: 'h9', verified: true })).toBe('block_key_stale');
  });
  it('a frozen key mints nothing', () => {
    expect(refusal({ signer: { ...active, state: 'frozen' }, claim, headHash: 'h9', verified: true })).toBe('block_key_frozen');
    expect(refusal({ signer: { ...active, state: 'frozen' }, claim: undefined, headHash: 'h9', verified: false })).toBe('block_key_frozen');
  });
  it('a published key demands a signature by the current key over the current head', () => {
    expect(refusal({ signer: active, claim: undefined, headHash: 'h9', verified: false })).toBe('block_unsigned');
    expect(refusal({ signer: active, claim: { sig: '' }, headHash: 'h9', verified: false })).toBe('block_signature_bad');
    expect(refusal({ signer: active, claim: { ...claim, keyFingerprint: 'old' }, headHash: 'h9', verified: true })).toBe('block_key_stale');
    expect(refusal({ signer: active, claim: { ...claim, epochId: 'anchor_old' }, headHash: 'h9', verified: true })).toBe('block_key_stale');
    expect(refusal({ signer: active, claim, headHash: 'h10', verified: true })).toBe('block_head_moved');
    expect(refusal({ signer: active, claim, headHash: 'h9', verified: false })).toBe('block_signature_bad');
    const ok = judge({ signer: active, claim, headHash: 'h9', verified: true });
    expect(ok).toEqual({ outcome: 'signed', signature: { version: 1, sig: 'SIG', pubkey: 'PUB', keyFingerprint: active.fingerprint, epochId: active.epochId } });
    expect(isBlockSignatureClaim(claim)).toBe(true);
    expect(isBlockSignatureClaim({ sig: 'x' })).toBe(false);
  });

  it('the payload and preimage are the same bytes on both sides, and rebuild from a stored block', () => {
    const p = blockSignaturePayload({ on: 'tree', bearerId: 'treeA', previousHash: 'h9', content, signerUid: ANA, keyFingerprint: active.fingerprint!, epochId: active.epochId! });
    expect(serverSignaturePayload({ on: 'tree', bearerId: 'treeA', previousHash: 'h9', content, signerUid: ANA, keyFingerprint: active.fingerprint!, epochId: active.epochId! })).toEqual(p);
    expect(serverSignedContentOf(content)).toEqual(signedContentOf(content));
    expect(serverSignaturePreimage(p)).toBe(blockSignaturePreimage(p));
    expect(blockSignaturePreimage(p)).toBe(signingPreimage(BLOCK_SIGNATURE_DOMAIN, p));
    expect(serverSigningPreimage('t', { a: 1 })).toBe(signingPreimage('t', { a: 1 }));
    expect(SERVER_SIGNATURE_DOMAIN).toBe(BLOCK_SIGNATURE_DOMAIN);
    expect([...SERVER_SIGNED_FIELDS]).toEqual([...SIGNED_BLOCK_FIELDS]);
    // A stored block — the record plus the server's additions — yields the very same payload.
    const stored = { ...content, lifetreeId: 'treeA', authorId: ANA, previousHash: 'h9', hash: 'H', mintedAt: 1, domain: 'd', id: 'p1', lid: 'l',
      authorSignature: { version: 1, sig: 'SIG', pubkey: 'PUB', keyFingerprint: active.fingerprint, epochId: active.epochId }, loveCount: 0 };
    expect(blockSignaturePayloadOf(stored)).toEqual(p);
    expect(serverSignaturePayloadOf(stored)).toEqual(p);
    expect(blockSignaturePayloadOf({ ...stored, authorSignature: undefined })).toBeNull();
    const vision = { ...stored, lifetreeId: undefined, visionId: 'v1', visionTitle: 'One forest' };
    expect(blockSignaturePayloadOf(vision)?.on).toBe('vision');
    expect(blockSignaturePayloadOf(vision)?.content.visionTitle).toBe('One forest');
  });

  it('a real key signs the payload; the stored block verifies; a changed body or head does not', async () => {
    if (!(await subtleEd25519Available())) return;
    const kp = await keypairFromSeed(Uint8Array.from({ length: 32 }, (_, i) => (i * 13 + 5) & 0xff));
    const p = blockSignaturePayload({ on: 'tree', bearerId: 'treeA', previousHash: 'h9', content, signerUid: ANA, keyFingerprint: 'fp', epochId: 'anchor_fp' });
    const sig = await signPayload(kp.privateKey, p, BLOCK_SIGNATURE_DOMAIN);
    const stored = { ...content, lifetreeId: 'treeA', authorId: ANA, previousHash: 'h9',
      authorSignature: { version: 1, sig, pubkey: kp.publicKeyB64, keyFingerprint: 'fp', epochId: 'anchor_fp' } };
    const verifies = async (b: Record<string, unknown>) => {
      const payload = blockSignaturePayloadOf(b);
      const a = b.authorSignature as { sig: string; pubkey: string };
      return payload ? verifyPayload(a.pubkey, a.sig, payload, BLOCK_SIGNATURE_DOMAIN) : false;
    };
    expect(await verifies(stored)).toBe(true);
    expect(await verifies({ ...stored, body: 'withered' })).toBe(false);
    expect(await verifies({ ...stored, previousHash: 'h8' })).toBe(false);
    expect(await verifies({ ...stored, authorId: 'bakr' })).toBe(false);
    // Off-chain state may move without touching the signature; the seal binds the signature.
    expect(await verifies({ ...stored, seenBy: ['bakr'], wateringConfirmedBy: 'guardian' })).toBe(true);
    const hash = await computeCanonicalHash('h9', 1, stored);
    expect(await verifyBlockSeal({ ...stored, hash, mintedAt: 1, hashVersion: BLOCK_HASH_VERSION })).toBe(true);
    expect(await verifyBlockSeal({ ...stored, authorSignature: { ...stored.authorSignature, sig: 'swapped' }, hash, mintedAt: 1, hashVersion: BLOCK_HASH_VERSION })).toBe(false);
  });
});
