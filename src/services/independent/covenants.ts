// THE INDEPENDENT NODE'S HAND for covenants — the mirror of ../firebase/covenants.ts (rings
// 2026-11-01/02). A covenant is a Being with its own chain and a frozen identity, proposed through
// the document door, its roster `party` links minted by the proposer (migration 053), each party
// signing its own slot (covenant_signatures) under the signing-epoch law; it seals only when a
// quorum of signatures verify, and breaks by a mark, never a delete.
import type * as F from '../firebase/covenants';
import { requireUid, toMillis } from './core';
import { docGet, docAll, docCommand, serverTime } from './docs';
import { graphStore } from './store';
import { createBlock } from '../../utils/crypto';
import { uuidv7 } from '../../utils/id';
import { COVENANT_EPOCH_DOMAIN, covenantIdentity, covenantSealed, alignmentCovenantId, covenantEpochSignaturePayload, verifiedCovenantSigners, signatureFromDoc, type Covenant, type CovenantKind, type CovenantParty } from '../../domain/covenant';
import { ensureSigningKey, publishSigningKey, isKeyInLineage, getPublishedSigningKey, sign as signWithKey, verify as verifyWithKey } from './keys';
export type { CovenantSignature, ProposeCovenantInput, SignCovenantResult, AlignmentForCovenant } from '../firebase/covenants';

interface MintCovenantArgs { kind: CovenantKind; title: string; body: string; parties: CovenantParty[]; quorum: number; proposedBy: string; id?: string; alignmentId?: string; bornAtMs?: number }
// Create-if-absent: a chosen id (the alignment's twin) converges two openers on ONE covenant.
const mintCovenant = async ({ kind, title, body, parties, quorum, proposedBy, id: chosenId, alignmentId, bornAtMs }: MintCovenantArgs): Promise<{ id: string; lid: string }> => {
    if (!parties.length) throw new Error('err_covenant_one_party');
    if (!Number.isInteger(quorum) || quorum < 1) throw new Error('err_covenant_quorum_one');
    if (quorum > parties.length) throw new Error('err_quorum_exceeds_parties');
    const lid = uuidv7();
    const genesisHash = await createBlock('0', { msg: 'Birth' }, bornAtMs || Date.now());
    let covenantId = chosenId;
    let created = true;
    if (chosenId) {
        const existing = await getCovenant(chosenId);
        if (existing) { created = false; }
    }
    if (created) {
        try {
            const born = await docCommand({ action: 'create', collection: 'covenants', ...(chosenId ? { id: chosenId } : {}), data: {
                lid, genesisHash, latestHash: genesisHash, blockHeight: 0, kind, title, body, quorum, proposedBy, status: 'proposed',
                ...(alignmentId ? { alignmentId } : {}), createdAt: serverTime(),
            } });
            covenantId = born.id;
        } catch (e) {
            // A concurrent opener landed the same twin: converge on it, mint no second roster.
            if (chosenId && e instanceof Error && e.message === 'doc_exists') created = false; else throw e;
        }
    }
    if (created && covenantId) {
        for (const p of parties) await graphStore.link(p.uid, 'party', covenantId);
    }
    const settled = await getCovenant(covenantId!);
    return { id: covenantId!, lid: settled?.lid ?? lid };
};
export const proposeCovenant: typeof F.proposeCovenant = (input) => mintCovenant({ ...input, proposedBy: requireUid() });
export const getCovenant: typeof F.getCovenant = (id) => docGet<Covenant>('covenants', id);
export const getCovenantParties: typeof F.getCovenantParties = async (id) =>
    (await graphStore.linksTo(id, 'party')).map(l => ({ uid: l.from, ...((l as { role?: string }).role ? { role: (l as { role?: string }).role } : {}) }));
export const getCovenantSignatures: typeof F.getCovenantSignatures = async (id) =>
    (await docAll<Record<string, unknown>>('covenant_signatures', { parent: id })).map(({ id: slot, ...data }) => signatureFromDoc(slot, data) as unknown as F.CovenantSignature);
export const getCovenantBundle: typeof F.getCovenantBundle = async (id) => {
    const [covenant, parties, signatures] = await Promise.all([getCovenant(id), getCovenantParties(id), getCovenantSignatures(id)]);
    return { covenant, parties, signatures };
};
export const verifyCovenant: typeof F.verifyCovenant = async (covenant, parties, sigs) => {
    const identity = covenantIdentity(covenant, parties);
    const partyUids = new Set(parties.map(p => p.uid));
    const published = new Map<string, string>();
    await Promise.all([...partyUids].map(async uid => published.set(uid, await getPublishedSigningKey(uid))));
    const signers = await verifiedCovenantSigners(identity, sigs, partyUids, published, verifyWithKey, isKeyInLineage);
    const sealed = covenantSealed(signers.size, covenant.quorum);
    return { valid: covenant.status === 'sealed' ? sealed : true, verifiedCount: signers.size, sealed, verifiedSigners: [...signers].sort() };
};
export const signCovenant: typeof F.signCovenant = async (covenant) => {
    const uid = requireUid();
    const [fresh, parties] = await Promise.all([getCovenant(covenant.id), getCovenantParties(covenant.id)]);
    if (!fresh) throw new Error('err_covenant_gone');
    if (!parties.some(p => p.uid === uid)) throw new Error('err_covenant_party_only');
    const key = await ensureSigningKey(uid);
    if ((await getPublishedSigningKey(uid)) !== key.publicKeyB64) {
        await publishSigningKey(uid, key.publicKeyB64);
        if ((await getPublishedSigningKey(uid)) !== key.publicKeyB64) throw new Error('err_pubkey_not_set');
    }
    const identity = covenantIdentity(fresh, parties);
    const sig = await signWithKey(covenantEpochSignaturePayload(identity, uid, key.fingerprint, key.epochId), COVENANT_EPOCH_DOMAIN, uid);
    await docCommand({ action: 'create', collection: 'covenant_signatures', parent: covenant.id, id: uid, data: { sig, pubkey: key.publicKeyB64, version: 3, keyFingerprint: key.fingerprint, epochId: key.epochId, recordedAt: serverTime() } });
    const sigs = await getCovenantSignatures(covenant.id);
    const { verifiedCount, sealed, verifiedSigners } = await verifyCovenant(fresh, parties, sigs);
    if (sealed && fresh.status !== 'sealed') {
        const current = await getCovenant(covenant.id);
        if (current && current.status !== 'sealed') {
            const prev = current.latestHash || current.genesisHash || '0';
            const sealHash = await createBlock(prev, { sealed: true, signers: verifiedSigners }, Date.now());
            await docCommand({ action: 'update', collection: 'covenants', id: covenant.id, patch: { latestHash: sealHash, blockHeight: (current.blockHeight || 0) + 1, status: 'sealed', sealedAt: serverTime() }, expect: { status: current.status } });
        }
    }
    return { sealed, verifiedCount, ...(key.created && key.recoveryPhrase ? { recoveryPhrase: key.recoveryPhrase } : {}) };
};
export const breakCovenant: typeof F.breakCovenant = async (id) => {
    const uid = requireUid();
    const c = await getCovenant(id);
    if (!c) throw new Error('err_covenant_gone');
    if (c.status === 'broken') return;
    const prev = c.latestHash || c.genesisHash || '0';
    const breakHash = await createBlock(prev, { broken: true, by: uid }, Date.now());
    await docCommand({ action: 'update', collection: 'covenants', id, patch: { latestHash: breakHash, blockHeight: (c.blockHeight || 0) + 1, status: 'broken' }, expect: { status: c.status } });
};
export const getCovenantForAlignment: typeof F.getCovenantForAlignment = (alignmentId) => getCovenant(alignmentCovenantId(alignmentId));
export const ensureAlignmentCovenant: typeof F.ensureAlignmentCovenant = async (alignment) => {
    const uid = requireUid();
    const covenantId = alignmentCovenantId(alignment.id);
    const existing = await getCovenant(covenantId);
    if (existing) return existing;
    await mintCovenant({ kind: 'alignment', title: 'Alignment', body: 'A resonance between two lifetrees, sealed on both chains.',
        parties: [{ uid: alignment.initiatorUid, role: 'initiator' }, { uid: alignment.targetUid, role: 'target' }], quorum: 2, proposedBy: uid,
        id: covenantId, alignmentId: alignment.id, bornAtMs: toMillis(alignment.createdAt) || Date.now() });
    const minted = await getCovenant(covenantId);
    if (!minted) throw new Error('err_covenant_read_failed');
    return minted;
};
export const signAlignmentCovenant: typeof F.signAlignmentCovenant = async (alignment) => {
    const covenant = await ensureAlignmentCovenant(alignment);
    return { ...(await signCovenant({ id: covenant.id })), covenantId: covenant.id };
};
// The retrofit walk: every alignment gains its twin (unsigned until each party signs in the app).
export const migrateAlignmentsToCovenants: typeof F.migrateAlignmentsToCovenants = async () => {
    const alignments = await docAll<{ id: string; initiatorUid?: string; targetUid?: string; createdAt?: unknown }>('alignments');
    let created = 0, skipped = 0;
    for (const a of alignments) {
        if (!a.initiatorUid || !a.targetUid || await getCovenant(alignmentCovenantId(a.id))) { skipped++; continue; }
        await mintCovenant({ kind: 'alignment', title: 'Alignment', body: 'A resonance between two lifetrees, sealed on both chains.',
            parties: [{ uid: a.initiatorUid, role: 'initiator' }, { uid: a.targetUid, role: 'target' }], quorum: 2, proposedBy: a.initiatorUid,
            id: alignmentCovenantId(a.id), alignmentId: a.id, bornAtMs: toMillis(a.createdAt) || Date.now() });
        created++;
    }
    return { created, skipped };
};
