// THE BIRTH OF A BLOCK, server side — the pure half, with no Firestore in reach.
//
// Functions is its own TS project and cannot import src/domain, so this module MIRRORS
// src/domain/chain/birth.ts (the birth judgment, the record shape, the watering reset) and
// src/domain/unmint.ts (the unmint refusals and the staff-overridable set) and the signature
// law with its preimage (domain/signing.signingPreimage under the block tag). The mirror is held
// true by the ROOT test suite (tests/birth.test.ts imports BOTH and compares judgments over
// the same facts), the mint.ts arrangement. blocks.ts owns only the plumbing: read the
// bearer, its links and the hand's standing; let this law judge; seal; move the head.

import { canonicalize } from './chain';

export type ChainBearerKind = 'tree' | 'vision';

export const TREE_BLOCK_TYPES = ['tree_growth', 'standard', 'reach'] as const;
export const VISION_BLOCK_TYPES = ['vision_growth'] as const;
export const BLOCK_VISIBILITIES = ['public', 'node', 'community', 'circle', 'private'] as const;

export const BLOCK_BIRTH_FIELDS = [
    'type', 'title', 'body', 'content', 'imageUrl', 'imageUrls', 'visibility',
    'care', 'wateringConfirmedBy', 'wateringConfirmation',
    'reachTreeId', 'reachTreeName', 'recipientUid', 'recipientName',
    'threadId', 'participantUids', 'audience', 'threadName', 'isGroup', 'mintNotice', 'seenBy', 'door',
    'authorName', 'authorPersonName', 'authorPhoto', 'carriedByName', 'disclosure',
    'growthCategory', 'communityId',
] as const;

export function blockBirthOf(data: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of BLOCK_BIRTH_FIELDS) if (data[k] !== undefined) out[k] = data[k];
    return out;
}

export type BlockBirthRefusal =
    | 'block_no_bearer' | 'block_field_unknown' | 'block_field_bad' | 'block_type_unlawful'
    | 'block_not_carer' | 'block_witness_forged' | 'block_care_type'
    | 'block_reach_loud' | 'block_reach_stranger' | 'block_visibility_bad' | 'block_seen_forged';

export interface ChainBearerFacts {
    exists: boolean;
    carer: boolean;
    latestHash?: unknown;
    genesisHash?: unknown;
    blockHeight?: unknown;
    title?: unknown;
    visibility?: unknown;
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

export const chainHeadOf = (bearer: Pick<ChainBearerFacts, 'latestHash' | 'genesisHash'>): string =>
    String(bearer.latestHash || bearer.genesisHash || '0');

export const heightAfter = (bearer: Pick<ChainBearerFacts, 'blockHeight'>): number =>
    (Number(bearer.blockHeight) || 0) + 1;

export function judgeBlockBirth(f: BlockBirthFacts): BlockBirthJudgment {
    const reject = (refusal: BlockBirthRefusal): BlockBirthJudgment => ({ outcome: 'reject', refusal });
    if (!f.bearer.exists) return reject('block_no_bearer');
    if (!isPlainObject(f.block)) return reject('block_field_bad');
    const b = f.block;

    for (const k of Object.keys(b)) {
        if (!(BLOCK_BIRTH_FIELDS as readonly string[]).includes(k)) return reject('block_field_unknown');
    }

    const lawful: readonly string[] = f.on === 'tree' ? TREE_BLOCK_TYPES : VISION_BLOCK_TYPES;
    if (!isStr(b.type) || !lawful.includes(b.type)) return reject('block_type_unlawful');

    if (!f.isStaff && !f.bearer.carer) return reject('block_not_carer');

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

    const visibility = b.visibility === undefined
        ? (isStr(f.bearer.visibility) && (BLOCK_VISIBILITIES as readonly string[]).includes(f.bearer.visibility) ? f.bearer.visibility : 'public')
        : b.visibility;
    if (!isStr(visibility) || !(BLOCK_VISIBILITIES as readonly string[]).includes(visibility)) return reject('block_visibility_bad');

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

    const addressed = (b.recipientUid !== undefined && b.recipientUid !== null) || participantUids !== undefined;
    if (b.type === 'reach' && addressed && visibility !== 'private') return reject('block_reach_loud');
    if (participantUids !== undefined && !participantUids.includes(f.minterUid)) return reject('block_reach_stranger');

    if (seenBy !== undefined && seenBy.some(uid => uid !== f.minterUid)) return reject('block_seen_forged');

    const content: Record<string, unknown> = { ...b, visibility };
    if (content.title === undefined) content.title = f.on === 'vision' && isStr(f.bearer.title) ? `${f.bearer.title} growth` : '';
    if (content.body === undefined) content.body = '';
    if (f.on === 'vision' && isStr(f.bearer.title)) content.visionTitle = f.bearer.title;
    return { outcome: 'mint', content, previousHash: chainHeadOf(f.bearer), blockHeight: heightAfter(f.bearer) };
}

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

// ── THE UNMINT (mirror of src/domain/unmint.ts) ──────────────────────────────────────────
export interface UnmintPulseFacts {
    authorId?: string;
    type?: string;
    lifetreeId?: string;
    hash?: string;
    wateringConfirmedBy?: string;
    seenBy?: string[];
    loveCount?: number;
    vetoes?: string[];
    matchId?: string;
    matchedLifetreeId?: string;
    offeringId?: string;
}

export type UnmintRefusal = 'unmint_not_author' | 'unmint_not_mint' | 'unmint_not_last' | 'unmint_witnessed' | 'unmint_coheld';

export const isCoHeld = (pulse: UnmintPulseFacts, authorUid: string): boolean =>
    (pulse.seenBy || []).some(uid => uid !== authorUid)
    || (pulse.loveCount || 0) > 0
    || (pulse.vetoes || []).length > 0
    || !!pulse.matchId
    || !!pulse.matchedLifetreeId
    || !!pulse.offeringId;

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

// ── THE AUTHOR'S SIGNATURE (mirror of the signed-block law in src/domain/chain/birth.ts) ────
export const SIGNING_VERSION = 'lifeseed.sign.v1';
export const signingPreimage = (domainTag: string, payload: unknown): string =>
    [SIGNING_VERSION, domainTag, canonicalize(payload)].join('\n');

export const BLOCK_SIGNATURE_DOMAIN = 'lifeseed.block-signature.v1';
export const BLOCK_SIGNATURE_VERSION = 1;

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

export const blockSignaturePreimage = (payload: BlockSignaturePayload): string =>
    signingPreimage(BLOCK_SIGNATURE_DOMAIN, payload);

export interface BlockAuthorSignature {
    version: 1;
    sig: string;
    pubkey: string;
    keyFingerprint: string;
    epochId: string;
}

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

export type BlockSignatureRefusal = 'block_unsigned' | 'block_signature_bad' | 'block_key_stale' | 'block_key_frozen' | 'block_head_moved';

export interface SignerFacts {
    state: 'none' | 'active' | 'frozen';
    fingerprint?: string;
    epochId?: string;
    pubkey?: string;
}

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

export function judgeBlockSignature(f: {
    signer: SignerFacts;
    claim: unknown;
    headHash: string;
    verified: boolean;
}): { outcome: 'reject'; refusal: BlockSignatureRefusal } | { outcome: 'unsigned' } | { outcome: 'signed'; signature: BlockAuthorSignature } {
    const reject = (refusal: BlockSignatureRefusal) => ({ outcome: 'reject' as const, refusal });
    if (f.signer.state === 'frozen') return reject('block_key_frozen');
    if (f.signer.state === 'none') {
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
