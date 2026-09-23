import type { DomainKey } from '../words';
import { signingPreimage } from '../signing';

// THE BIRTH OF A BLOCK — the law the server applies when a hand asks for a new link on a
// chain (ring 2026-09-23, "server-held heads"). Before this ring a browser read a tree's head,
// hashed a block it composed itself, and moved the head in its own transaction; the rules could
// freeze fields afterwards, but they never checked that the hash was the hash of the content,
// that the head really followed, or that the hand was the chain's to move. Now the chain is the
// server's: the client hands over only what a hand may SAY about a block (BLOCK_BIRTH_FIELDS),
// the server reads the bearer's head inside its transaction, judges the birth by this law,
// seals the block canonically over its stored bytes, and moves the head — one transaction, one
// hand, one law for every chain-bearing type. The rules refuse every client-born chain link
// and every client head move; this file is the judge the callable defers to.
//
// Plain contract — GUARANTEED: a block born through mintBlock has previousHash equal to the
// head the bearer carried when the transaction read it, blockHeight one above it, a canonical
// hash reproducible from its stored fields (verifyBlockSeal), authorId equal to the signed-in
// hand, mintedAt from the server's clock, and it was born by a carer of the tree (owner,
// co_owner, steward — or staff) or the author of the vision. NOT GUARANTEED: that the lived
// event is true (a photo proves a moment, not a life), nor that legacy blocks — born before
// this ring under the browser's seal — can be recomputed; verifyChain still walks their
// linkage and heights, and only that. Enforced by functions/src/blocks.ts (the hand),
// functions/src/birth.ts (this law's mirror, held true by tests/birth.test.ts), and the
// firestore.rules pulses/lifetrees/visions clauses (tests/rules).

export type ChainBearerKind = 'tree' | 'vision';

// Which pulse types may be born as a link on which chain. A tree's chain carries its growth,
// its standard records (minted conversations, wisdom, alignment and offering twins) and the
// reaches it sends; a vision's chain carries contributions. Events, offerings, decisions and
// person-reaches are STANDALONE records rooted in a sentinel (domain/bundle NON_CHAIN_ROOTS),
// never links — the rules keep those births client-side and headless.
export const TREE_BLOCK_TYPES = ['tree_growth', 'standard', 'reach'] as const;
export const VISION_BLOCK_TYPES = ['vision_growth'] as const;
export const BLOCK_VISIBILITIES = ['public', 'node', 'community', 'circle', 'private'] as const;

// What a hand may SAY about a block. Everything else the server says: lid, id, authorId, domain,
// mintedAt, previousHash, hash, loveCount, commentCount, createdAt — and the bearer's own name
// (a vision's visionTitle). A field outside this list refuses the whole birth: a client that
// names its own previousHash or authorId is not confused, it is forging.
export const BLOCK_BIRTH_FIELDS = [
  'type', 'title', 'body', 'content', 'imageUrl', 'imageUrls', 'visibility',
  'care', 'wateringConfirmedBy', 'wateringConfirmation',
  'reachTreeId', 'reachTreeName', 'recipientUid', 'recipientName',
  'threadId', 'participantUids', 'audience', 'threadName', 'isGroup', 'mintNotice', 'seenBy', 'door',
  'authorName', 'authorPersonName', 'authorPhoto', 'carriedByName', 'disclosure',
  'growthCategory', 'communityId',
] as const;
export type BlockBirthField = typeof BLOCK_BIRTH_FIELDS[number];

// Pick what a hand may say, dropping undefined — the client's half of the contract.
export function blockBirthOf(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of BLOCK_BIRTH_FIELDS) if (data[k] !== undefined) out[k] = data[k];
  return out;
}

export type BlockBirthRefusal = Extract<DomainKey,
  | 'block_no_bearer' | 'block_field_unknown' | 'block_field_bad' | 'block_type_unlawful'
  | 'block_not_carer' | 'block_witness_forged' | 'block_care_type'
  | 'block_reach_loud' | 'block_reach_stranger' | 'block_visibility_bad' | 'block_seen_forged'>;

export interface ChainBearerFacts {
  exists: boolean;
  // Standing over the chain: a tree's owner / co_owner / steward (the rules' isTreeCarer),
  // a vision's author. Read by the server from the documents, never from the request.
  carer: boolean;
  latestHash?: unknown;
  genesisHash?: unknown;
  blockHeight?: unknown;
  title?: unknown;       // a vision's title — sealed onto its contributions as visionTitle
  visibility?: unknown;  // a vision's own visibility — its contributions' default
}

export interface BlockBirthFacts {
  on: ChainBearerKind;
  minterUid: string;
  isStaff: boolean;
  bearer: ChainBearerFacts;
  block: unknown;
}

export type BlockBirthJudgment =
  | { outcome: 'reject'; refusal: BlockBirthRefusal }
  | { outcome: 'mint'; content: Record<string, unknown>; previousHash: string; blockHeight: number };

const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// The head a new block follows: the bearer's latestHash, else its genesis (a legacy vision
// backfilled to a root), else the sentinel root '0' — the same fallback growVision used.
export const chainHeadOf = (bearer: Pick<ChainBearerFacts, 'latestHash' | 'genesisHash'>): string =>
  String(bearer.latestHash || bearer.genesisHash || '0');

export const heightAfter = (bearer: Pick<ChainBearerFacts, 'blockHeight'>): number =>
  (Number(bearer.blockHeight) || 0) + 1;

// The whole law, in the order the server applies it.
export function judgeBlockBirth(f: BlockBirthFacts): BlockBirthJudgment {
  const reject = (refusal: BlockBirthRefusal): BlockBirthJudgment => ({ outcome: 'reject', refusal });
  if (!f.bearer.exists) return reject('block_no_bearer');
  if (!isPlainObject(f.block)) return reject('block_field_bad');
  const b = f.block;

  // Only what a hand may say.
  for (const k of Object.keys(b)) {
    if (!(BLOCK_BIRTH_FIELDS as readonly string[]).includes(k)) return reject('block_field_unknown');
  }

  // The kind of link, lawful for this chain.
  const lawful: readonly string[] = f.on === 'tree' ? TREE_BLOCK_TYPES : VISION_BLOCK_TYPES;
  if (!isStr(b.type) || !lawful.includes(b.type)) return reject('block_type_unlawful');

  // The hand's standing over the chain — staff excepted (carrying, the genesis ceremony, mends).
  if (!f.isStaff && !f.bearer.carer) return reject('block_not_carer');

  // Shapes: strings where strings are promised, lists where lists are.
  for (const k of ['title', 'body', 'content', 'imageUrl', 'reachTreeId', 'reachTreeName', 'recipientName',
    'threadId', 'threadName', 'authorName', 'authorPersonName', 'authorPhoto', 'carriedByName', 'disclosure',
    'growthCategory', 'communityId', 'door', 'audience'] as const) {
    if (b[k] !== undefined && !isStr(b[k])) return reject('block_field_bad');
  }
  if (b.recipientUid !== undefined && b.recipientUid !== null && !isStr(b.recipientUid)) return reject('block_field_bad');
  for (const k of ['imageUrls', 'participantUids', 'seenBy'] as const) {
    if (b[k] !== undefined && !isStrList(b[k])) return reject('block_field_bad');
  }
  const participantUids = isStrList(b.participantUids) ? b.participantUids : undefined;
  const seenBy = isStrList(b.seenBy) ? b.seenBy : undefined;
  for (const k of ['isGroup', 'mintNotice'] as const) {
    if (b[k] !== undefined && typeof b[k] !== 'boolean') return reject('block_field_bad');
  }
  if (b.wateringConfirmation !== undefined && !isPlainObject(b.wateringConfirmation)) return reject('block_field_bad');

  // Visibility: one of the five, or absent (the bearer's, else public).
  const visibility = b.visibility === undefined
    ? (isStr(f.bearer.visibility) && (BLOCK_VISIBILITIES as readonly string[]).includes(f.bearer.visibility) ? f.bearer.visibility : 'public')
    : b.visibility;
  if (!isStr(visibility) || !(BLOCK_VISIBILITIES as readonly string[]).includes(visibility)) return reject('block_visibility_bad');

  // Care rides only on a tree's growth; a watering never self-declares a guardian witness
  // (the confirmation is functions/witnessWatering's, ring 2026-07-20).
  if (b.care !== undefined) {
    if (b.care !== true && b.care !== 'watering') return reject('block_field_bad');
    if (b.type !== 'tree_growth') return reject('block_care_type');
  }
  if (b.wateringConfirmedBy !== undefined || b.wateringConfirmation !== undefined) {
    if (b.care !== 'watering') return reject('block_care_type');
  }
  if (b.care === 'watering') {
    const by = b.wateringConfirmedBy === undefined ? 'pending' : b.wateringConfirmedBy;
    if (by !== 'ai' && by !== 'pending') return reject('block_witness_forged');
  }

  // A reach that names its recipients is born PRIVATE, and the minter stands in it.
  const addressed = (b.recipientUid !== undefined && b.recipientUid !== null) || participantUids !== undefined;
  if (b.type === 'reach' && addressed && visibility !== 'private') return reject('block_reach_loud');
  if (participantUids !== undefined && !participantUids.includes(f.minterUid)) return reject('block_reach_stranger');

  // No one has seen a block before it exists — except the hand that writes it.
  if (seenBy !== undefined && seenBy.some(uid => uid !== f.minterUid)) return reject('block_seen_forged');

  const content: Record<string, unknown> = { ...b, visibility };
  if (content.title === undefined) content.title = f.on === 'vision' && isStr(f.bearer.title) ? `${f.bearer.title} growth` : '';
  if (content.body === undefined) content.body = '';
  if (f.on === 'vision' && isStr(f.bearer.title)) content.visionTitle = f.bearer.title;
  return { outcome: 'mint', content, previousHash: chainHeadOf(f.bearer), blockHeight: heightAfter(f.bearer) };
}

// The stored record — exactly the shape mintPulse and growVision wrote, so every reader and
// verifier meets the same block whoever's hand sealed it. The hash is computed OVER this
// record (chain/verify blockContent picks the sealed fields), then set beside it.
export function blockRecordOf(p: {
  on: ChainBearerKind; bearerId: string; content: Record<string, unknown>;
  authorId: string; lid: string; id: string; domain: string; mintedAt: number; previousHash: string;
}): Record<string, unknown> {
  return {
    lid: p.lid,
    ...p.content,
    ...(p.on === 'tree' ? { lifetreeId: p.bearerId } : { visionId: p.bearerId }),
    authorId: p.authorId,
    domain: p.domain,
    id: p.id,
    loveCount: 0,
    commentCount: 0,
    mintedAt: p.mintedAt,
    previousHash: p.previousHash,
  };
}

// A watering's schedule reset — the tree fields that ride in the SAME transaction as its
// block (recordWatering used to hand these in as extraTreeUpdate; the server now composes
// them). Milliseconds here; the server dresses them as Timestamps.
export interface WateringResetMs {
  lastWateredAtMs: number;
  lastWateredBy: string;
  lastWateredByName: string;
  overdue: false;
  nextDueAtMs?: number;
}
const DAY_MS = 24 * 60 * 60 * 1000;
export function wateringResetOf(
  tree: { watering?: { mode?: unknown; intervalDays?: unknown } | null },
  nowMs: number, uid: string, name: string,
): WateringResetMs {
  const w = tree.watering;
  const interval = w && w.mode === 'scheduled' && typeof w.intervalDays === 'number' && w.intervalDays > 0 ? w.intervalDays : 0;
  return {
    lastWateredAtMs: nowMs,
    lastWateredBy: uid,
    lastWateredByName: name,
    overdue: false,
    ...(interval ? { nextDueAtMs: nowMs + Math.max(1, interval) * DAY_MS } : {}),
  };
}

// ── THE AUTHOR'S SIGNATURE (ring 2026-09-23, signed blocks) ──────────────────────────────────
// The server's seal proves that the head followed and that the bytes are the bytes; it does not
// prove WHO asked — that was the server's word about a session. A signed block carries the
// author's own Ed25519 signature (the signing crystal: persons/{uid} keys and epochs) over the
// chain POSITION and the CONTENT that will be stored, so the hand is provable by anyone holding
// the block and the author's published key — without trusting the server. Because the server
// composes the record, the client reaches the same content by running THIS SAME LAW
// (judgeBlockBirth) over the bearer it read, and signs signedContentOf(content): the fields the
// server stores verbatim (never rewrites), so a reader can rebuild the payload from the stored
// block alone (blockSignaturePayloadOf).
//
// Plain contract — GUARANTEED: a person with a published ACTIVE key can mint only with a valid
// signature by that key and epoch (an unsigned or stale-key birth is refused), a frozen key mints
// nothing, and the signature is sealed INTO the block's hash (authorSignature is chain content).
// NOT GUARANTEED: a person without a published key mints unsigned — the block then says so by
// carrying no authorSignature, and the server's word stands alone; twin blocks and stay leaves
// (the server's own hand) are unsigned by design. Enforced by functions/mintBlock (verifies with
// the person's published key, never the client's word), this law's mirror, tests/birth.test.ts.

export const BLOCK_SIGNATURE_DOMAIN = 'lifeseed.block-signature.v1';
export const BLOCK_SIGNATURE_VERSION = 1;

// The stored fields a signature covers — a subset of both what a hand may say and what the seal
// hashes, minus what the server may rewrite (a watering's confirmation) and what moves after
// birth (seenBy). visionTitle is the server's addition, deterministic from the bearer's doc.
export const SIGNED_BLOCK_FIELDS = [
  'type', 'title', 'body', 'content', 'imageUrl', 'imageUrls', 'visibility', 'care',
  'reachTreeId', 'reachTreeName', 'recipientUid', 'recipientName',
  'threadId', 'participantUids', 'audience', 'threadName', 'isGroup',
  'authorName', 'authorPersonName', 'authorPhoto', 'growthCategory', 'communityId', 'visionTitle',
] as const;

export function signedContentOf(content: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of SIGNED_BLOCK_FIELDS) if (content[k] !== undefined) out[k] = content[k];
  return out;
}

export interface BlockSignaturePayload {
  on: ChainBearerKind;
  bearer: string;
  previousHash: string;
  content: Record<string, unknown>;
  signer: string;
  key: { fingerprint: string; epochId: string };
}

export function blockSignaturePayload(p: {
  on: ChainBearerKind; bearerId: string; previousHash: string; content: Record<string, unknown>;
  signerUid: string; keyFingerprint: string; epochId: string;
}): BlockSignaturePayload {
  return {
    on: p.on, bearer: p.bearerId, previousHash: p.previousHash, content: signedContentOf(p.content),
    signer: p.signerUid, key: { fingerprint: p.keyFingerprint, epochId: p.epochId },
  };
}

// The exact bytes the signature covers (domain/signing.signingPreimage under the block tag).
export const blockSignaturePreimage = (payload: BlockSignaturePayload): string =>
  signingPreimage(BLOCK_SIGNATURE_DOMAIN, payload);

// What a block stores beside its seal. `pubkey` is frozen here (the person's published key at
// the moment of birth) so verification never depends on a later-rotated key — the covenant shape.
export interface BlockAuthorSignature {
  version: 1;
  sig: string;
  pubkey: string;
  keyFingerprint: string;
  epochId: string;
}

// Rebuild the payload from a STORED block — for any reader with the block in hand.
export function blockSignaturePayloadOf(block: Record<string, unknown>): BlockSignaturePayload | null {
  const sig = block.authorSignature as Partial<BlockAuthorSignature> | undefined;
  if (!sig || typeof sig.keyFingerprint !== 'string' || typeof sig.epochId !== 'string') return null;
  const on: ChainBearerKind | null = typeof block.lifetreeId === 'string' ? 'tree' : typeof block.visionId === 'string' ? 'vision' : null;
  if (!on || typeof block.authorId !== 'string' || typeof block.previousHash !== 'string') return null;
  return blockSignaturePayload({
    on, bearerId: String(on === 'tree' ? block.lifetreeId : block.visionId), previousHash: block.previousHash,
    content: block, signerUid: block.authorId, keyFingerprint: sig.keyFingerprint, epochId: sig.epochId,
  });
}

export type BlockSignatureRefusal = Extract<DomainKey,
  'block_unsigned' | 'block_signature_bad' | 'block_key_stale' | 'block_key_frozen' | 'block_head_moved'>;

// What the server knows about the signer, read from persons/{uid} inside its transaction.
export interface SignerFacts {
  state: 'none' | 'active' | 'frozen';
  fingerprint?: string;
  epochId?: string;
  pubkey?: string;
}

// What the client claims: the signature and the head it signed over.
export interface BlockSignatureClaim {
  sig: string;
  keyFingerprint: string;
  epochId: string;
  previousHash: string;
}

export const isBlockSignatureClaim = (v: unknown): v is BlockSignatureClaim =>
  !!v && typeof v === 'object'
  && typeof (v as BlockSignatureClaim).sig === 'string' && !!(v as BlockSignatureClaim).sig
  && typeof (v as BlockSignatureClaim).keyFingerprint === 'string'
  && typeof (v as BlockSignatureClaim).epochId === 'string'
  && typeof (v as BlockSignatureClaim).previousHash === 'string';

// The signature law, in the order the server applies it. `verified` is the crypto's answer over
// blockSignaturePreimage(payload) with the signer's PUBLISHED key — asked only when the claim
// names the current key and the head the server read; the law never trusts the claim's pubkey.
export function judgeBlockSignature(f: {
  signer: SignerFacts;
  claim: unknown;
  headHash: string;
  verified: boolean;
}): { outcome: 'reject'; refusal: BlockSignatureRefusal } | { outcome: 'unsigned' } | { outcome: 'signed'; signature: BlockAuthorSignature } {
  const reject = (refusal: BlockSignatureRefusal) => ({ outcome: 'reject' as const, refusal });
  if (f.signer.state === 'frozen') return reject('block_key_frozen');
  if (f.signer.state === 'none') {
    // No published key: an unsigned birth, said plainly. A claim from a key that is nobody's
    // published identity is not a signature.
    return f.claim === undefined || f.claim === null ? { outcome: 'unsigned' } : reject('block_key_stale');
  }
  if (f.claim === undefined || f.claim === null) return reject('block_unsigned');
  if (!isBlockSignatureClaim(f.claim)) return reject('block_signature_bad');
  if (f.claim.keyFingerprint !== f.signer.fingerprint || f.claim.epochId !== f.signer.epochId) return reject('block_key_stale');
  if (f.claim.previousHash !== f.headHash) return reject('block_head_moved');
  if (!f.verified) return reject('block_signature_bad');
  return {
    outcome: 'signed',
    signature: { version: BLOCK_SIGNATURE_VERSION, sig: f.claim.sig, pubkey: String(f.signer.pubkey || ''), keyFingerprint: f.claim.keyFingerprint, epochId: f.claim.epochId },
  };
}
