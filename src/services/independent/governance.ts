// THE INDEPENDENT NODE'S HAND for governance — the mirror of ../firebase/governance.ts (rings
// 2026-11-01/02). A decision is a pulse on the one ledger: born standalone through the document
// door, its voices Ed25519 signatures in their own slots (pulse_signatures), its governance
// overlays and its withdrawal marks judged by the pulses rule exactly as firestore.rules judged
// them. Events and offerings have their own server commands for birth, duplication, acceptance
// and the circle (migrations 040–048); their edits and flips go through the door.
import type * as F from '../firebase/governance';
import { session, requireUid, toMillis } from './core';
import { docGet, docAll, docCommand, serverTime } from './docs';
import { graphStore } from './store';
import { announce } from '../refreshBus';
import { createBlock } from '../../utils/crypto';
import { uuidv7 } from '../../utils/id';
import { toBase62 } from '../../domain/lid62';
import { type Pulse, type Decision, type DecisionMode, type ConsensusStance, type Position, votesRequired } from '../../types';
import { DECISION_EPOCH_DOMAIN, decisionIdentity, decisionEnacted, decisionAuthoritative, decisionEpochSignaturePayload, verifiedDecisionSigners, decisionDeletable } from '../../domain/decision';
import { signatureFromDoc } from '../../domain/covenant';
import { ensureSigningKey, publishSigningKey, isKeyInLineage, getPublishedSigningKey, sign as signWithKey, verify as verifyWithKey } from './keys';
export type { DecisionSignature, SignDecisionResult, EventLineage, OfferingAccepted } from '../firebase/governance';

const normalizeDomain = (domain: string) => domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
const newestFirst = <T extends { createdAt?: unknown }>(items: T[]) => [...items].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
const readDecision = (id: string) => docGet<Decision>('pulses', id);
const closed = (status: unknown) => ['passed', 'withdrawn', 'rejected', 'expired'].includes(String(status));
const stamp = () => new Date().toISOString();

export const createDecision: typeof F.createDecision = async (community, data) => {
    const mode: DecisionMode = data.mode || 'threshold';
    const payload = {
        type: 'decision', communityId: community.id, domain: normalizeDomain(community.domain), visibility: 'community' as const,
        nature: data.nature, title: data.title, body: data.body || '', subject: data.subject || '', authorId: data.proposedBy, proposedBy: data.proposedBy,
        mode, votesRequired: votesRequired(data.nature), positions: [] as Decision['positions'], status: 'open' as const,
        ...(data.nature === 'purchase' && data.spend ? { spend: { offeringId: data.spend.offeringId, units: data.spend.units } } : {}),
    };
    const hash = await createBlock('DECISION', payload, Date.now());
    const lid = uuidv7();
    const born = await docCommand({ action: 'create', collection: 'pulses', data: { ...payload, lid, previousHash: 'DECISION', hash, createdAt: serverTime() } });
    return { id: born.id, lid, ...payload, previousHash: 'DECISION', hash } as unknown as Decision;
};
export const getDecisionSignatures: typeof F.getDecisionSignatures = async (decisionId) =>
    (await docAll<Record<string, unknown>>('pulse_signatures', { parent: decisionId })).map(({ id, ...data }) => signatureFromDoc(id, data) as unknown as F.DecisionSignature);
export const verifyDecision: typeof F.verifyDecision = async (decision, sigs) => {
    const identity = decisionIdentity(decision);
    const mode: DecisionMode = decision.mode || 'threshold';
    const uids = [...new Set(sigs.map(s => s.uid))];
    const published = new Map<string, string>();
    await Promise.all(uids.map(async uid => published.set(uid, await getPublishedSigningKey(uid))));
    const signers = await verifiedDecisionSigners(identity, sigs, mode, published, verifyWithKey, isKeyInLineage);
    return { valid: decisionAuthoritative(decision.status, signers.size, decision.votesRequired, mode), verifiedCount: signers.size,
        enacted: decisionEnacted(signers.size, decision.votesRequired), verifiedSigners: [...signers].sort() };
};
export const getDecisionSignatureState: typeof F.getDecisionSignatureState = async (decision) => {
    const signatures = await getDecisionSignatures(decision.id);
    return { signatures, ...(await verifyDecision(decision, signatures)) };
};
const isDecisionMember = async (communityId: string, uid: string): Promise<boolean> => {
    if (!communityId) return false;
    if ((await graphStore.linksFrom(uid, 'member')).some(l => l.to === communityId)) return true;
    const community = await docGet<{ anchorUid?: string }>('communities', communityId);
    return !!community && community.anchorUid === uid;
};
// Sign a decision in your own hand: the device key, the frozen identity, the own slot, and the
// verified quorum — enacted by the VERIFIED count, the status flag a best-effort denormalisation.
export const signDecision: typeof F.signDecision = async (decision, position) => {
    const uid = requireUid();
    const fresh = await readDecision(decision.id);
    if (!fresh) throw new Error('err_decision_not_found');
    const mode: DecisionMode = fresh.mode || 'threshold';
    if (fresh.status === 'passed') return { outcome: 'enacted', verifiedCount: fresh.votesRequired };
    if (['withdrawn', 'rejected', 'expired'].includes(fresh.status)) return { outcome: 'closed', verifiedCount: 0 };
    if (mode === 'threshold' && fresh.listening) return { outcome: 'listening', verifiedCount: 0 };
    if (!(await isDecisionMember(fresh.communityId, uid))) throw new Error('err_decision_member_only');
    if (await docGet('pulse_signatures', uid, decision.id)) {
        const standing = await verifyDecision(fresh, await getDecisionSignatures(decision.id));
        return { outcome: 'already', verifiedCount: standing.verifiedCount };
    }
    const key = await ensureSigningKey(uid);
    if ((await getPublishedSigningKey(uid)) !== key.publicKeyB64) {
        await publishSigningKey(uid, key.publicKeyB64);
        if ((await getPublishedSigningKey(uid)) !== key.publicKeyB64) throw new Error('err_pubkey_not_set');
    }
    const identity = decisionIdentity(fresh);
    const sig = await signWithKey(decisionEpochSignaturePayload(identity, uid, key.fingerprint, key.epochId), DECISION_EPOCH_DOMAIN, uid);
    const sigPosition: ConsensusStance | undefined = mode === 'consensus' ? (position ?? 'unite') : undefined;
    await docCommand({ action: 'create', collection: 'pulse_signatures', parent: decision.id, id: uid, data: {
        sig, pubkey: key.publicKeyB64, version: 3, keyFingerprint: key.fingerprint, epochId: key.epochId, recordedAt: serverTime(), ...(sigPosition ? { position: sigPosition } : {}),
    } });
    if (mode === 'consensus') {
        const current = await readDecision(decision.id);
        if (current) {
            const positions = (Array.isArray(current.positions) ? current.positions : []).filter(p => p.by !== uid);
            positions.push({ by: uid, stance: 'unite', note: '', at: stamp() } as unknown as Position);
            await docCommand({ action: 'update', collection: 'pulses', id: decision.id, patch: { positions: positions as unknown as Record<string, unknown>[] } }).catch(() => {});
        }
    }
    const sigs = await getDecisionSignatures(decision.id);
    const { verifiedCount, enacted, verifiedSigners } = await verifyDecision(fresh, sigs);
    const phrase = key.created && key.recoveryPhrase ? { recoveryPhrase: key.recoveryPhrase } : {};
    if (mode === 'threshold' && enacted) {
        try {
            const current = await readDecision(decision.id);
            if (current && current.status !== 'passed') {
                const enactedHash = await createBlock(current.hash || 'DECISION', { decision: decision.id, signers: verifiedSigners, enacted: true, sealedBySignatures: true }, Date.now());
                await docCommand({ action: 'update', collection: 'pulses', id: decision.id, patch: { status: 'passed', passedAt: serverTime(), enactedHash }, expect: { status: current.status } });
            }
        } catch { /* the flip is privileged; the crypto quorum stands regardless */ }
        return { outcome: 'enacted', verifiedCount, ...phrase };
    }
    return { outcome: 'signed', verifiedCount, ...phrase };
};
export const migrateDecisionsToSignatures: typeof F.migrateDecisionsToSignatures = async () => {
    const decisions = await docAll<Decision>('pulses', { where: { type: 'decision' } });
    let signed = 0, legacyUnsigned = 0;
    for (const d of decisions) {
        const sigs = await docAll('pulse_signatures', { parent: d.id });
        if (sigs.length) signed++; else if (Array.isArray(d.votes) && d.votes.length) legacyUnsigned++;
    }
    return { scanned: decisions.length, signed, legacyUnsigned };
};
export const raiseConcern: typeof F.raiseConcern = async (decisionId, uid, note) => {
    const actor = requireUid() || uid;
    const d = await readDecision(decisionId);
    if (!d) throw new Error('err_decision_not_found');
    if (closed(d.status)) return 'closed';
    const concerns = (Array.isArray(d.concerns) ? d.concerns : []).filter(c => c.by !== actor);
    await docCommand({ action: 'update', collection: 'pulses', id: decisionId, patch: { listening: true, concerns: [...concerns, { by: actor, note: note || '', at: stamp() }] as unknown as Record<string, unknown>[] } });
    return 'listening';
};
export const resumeDecision: typeof F.resumeDecision = async (decisionId) => { await docCommand({ action: 'update', collection: 'pulses', id: decisionId, patch: { listening: false } }); };
export const withdrawDecision: typeof F.withdrawDecision = async (decisionId) => {
    const uid = requireUid();
    const d = await readDecision(decisionId);
    if (!d) throw new Error('err_decision_not_found');
    if (['withdrawn', 'rejected', 'expired'].includes(d.status)) return 'closed';
    const withdrawnHash = await createBlock(d.enactedHash || d.hash || 'DECISION', { decision: decisionId, withdrawn: true, by: uid }, Date.now());
    await docCommand({ action: 'update', collection: 'pulses', id: decisionId, patch: { status: 'withdrawn', listening: false, withdrawnAt: serverTime(), withdrawnHash }, expect: { status: d.status } });
    return 'withdrawn';
};
export const rejectDecision: typeof F.rejectDecision = async (decisionId) => {
    await docCommand({ action: 'update', collection: 'pulses', id: decisionId, patch: { status: 'rejected', listening: false, rejectedAt: serverTime() } });
};
export const setDecisionVisibility: typeof F.setDecisionVisibility = async (decisionId, visibility) => {
    await docCommand({ action: 'update', collection: 'pulses', id: decisionId, patch: { visibility, updatedAt: serverTime() } });
};
export const deleteDecision: typeof F.deleteDecision = async (decisionId) => {
    const fresh = await readDecision(decisionId);
    if (!fresh) return;
    const sigs = await docAll('pulse_signatures', { parent: decisionId });
    if (!decisionDeletable(fresh, sigs.length)) throw new Error('err_decision_signed_no_delete');
    await docCommand({ action: 'delete', collection: 'pulses', id: decisionId });
};
export const recordPosition: typeof F.recordPosition = async (decisionId, uid, stance, note) => {
    const actor = requireUid() || uid;
    const d = await readDecision(decisionId);
    if (!d) throw new Error('err_proposal_not_found');
    if (closed(d.status)) return 'closed';
    const positions = (Array.isArray(d.positions) ? d.positions : []).filter(p => p.by !== actor);
    positions.push({ by: actor, stance, note: note || '', at: stamp() } as unknown as Position);
    await docCommand({ action: 'update', collection: 'pulses', id: decisionId, patch: { positions: positions as unknown as Record<string, unknown>[] } });
    return 'ok';
};
export const discernDecision: typeof F.discernDecision = async (decisionId, outcome) => {
    const d = await readDecision(decisionId);
    if (!d) throw new Error('err_proposal_not_found');
    if (closed(d.status)) throw new Error('err_proposal_settled');
    if (outcome === 'passed') {
        if ((Array.isArray(d.positions) ? d.positions : []).some(p => p.stance === 'block')) throw new Error('err_block_stands');
        const enactedHash = await createBlock(d.hash || 'DECISION', { decision: decisionId, united: true }, Date.now());
        await docCommand({ action: 'update', collection: 'pulses', id: decisionId, patch: { status: 'passed', passedAt: serverTime(), enactedHash }, expect: { status: d.status } });
        return 'passed';
    }
    await docCommand({ action: 'update', collection: 'pulses', id: decisionId, patch: { status: 'rejected', rejectedAt: serverTime() }, expect: { status: d.status } });
    return 'rejected';
};
export const getDecisions: typeof F.getDecisions = async (communityId) =>
    newestFirst((await docAll<Decision>('pulses', { where: { communityId, type: 'decision' } })));
export const deleteCommunityEvent: typeof F.deleteCommunityEvent = async (eventId) => { await docCommand({ action: 'delete', collection: 'pulses', id: eventId }); };
export const updateEvent: typeof F.updateEvent = async (eventId, data) => {
    await docCommand({ action: 'update', collection: 'pulses', id: eventId, patch: { ...data, updatedAt: serverTime() } as Record<string, unknown> });
    announce('events', eventId, data as Record<string, unknown>);
};
// DUPLICATE is the server's hand (migration 046): the copy, its proof and its lineage link, atomically.
export const duplicateEvent: typeof F.duplicateEvent = async (event) => {
    const copy = (await session.eventCommand({ action: 'duplicate', id: event.id }) as { event: Pulse }).event;
    announce('events');
    return copy;
};
export const getEventLineage: typeof F.getEventLineage = async (event) => {
    const readEvent = async (id?: string | null) => (!id || id === event.id) ? null : docGet<Pulse>('pulses', id).catch(() => null);
    const [parent, root, children] = await Promise.all([readEvent(event.descendsFromId), readEvent(event.lineageRootId), graphStore.linksTo(event.id, 'descends_from').then(l => l.length).catch(() => 0)]);
    return { parent, root, childCount: children };
};
const bornStandalone = async (root: 'EVENT' | 'OFFERING' | 'COMMUNITY_EVENT', payload: Record<string, unknown>) => {
    const hash = await createBlock(root, payload, Date.now());
    const lid = uuidv7();
    const born = await docCommand({ action: 'create', collection: 'pulses', data: { ...payload, lid, loveCount: 0, commentCount: 0, previousHash: root, hash, createdAt: serverTime() } });
    return { id: born.id, lid, ...payload, loveCount: 0, commentCount: 0, previousHash: root, hash } as unknown as Pulse;
};
export const createEvent: typeof F.createEvent = async (data) => {
    const domain = normalizeDomain(data.domain || window.location.hostname);
    return bornStandalone('EVENT', { ...data, type: 'event', domain, visibility: data.visibility || 'public' });
};
export const createOffering: typeof F.createOffering = async (data) => {
    const domain = normalizeDomain(data.domain || window.location.hostname);
    const offering = await bornStandalone('OFFERING', { ...data, type: 'offering', domain, visibility: data.visibility || 'public' });
    const keeper = typeof data.offeredToKeeperUid === 'string' ? data.offeredToKeeperUid : '';
    const fromTreeId = typeof data.offeringFromTreeId === 'string' ? data.offeringFromTreeId : '';
    if (keeper && data.authorId && keeper !== data.authorId && fromTreeId) {
        const partnerTreeId = (data.offeredToKind === 'tree' ? data.offeredToId : (data as { offeredToRootTreeId?: string }).offeredToRootTreeId) || keeper;
        const door = `/b/${toBase62(String(offering.lid))}`;
        const text = `${data.authorName || 'A being'} offered «${data.title}» to ${data.offeredToName || (data.offeredToKind === 'vision' ? 'your vision' : 'your tree')}. Answer on its leaf: ${door}`;
        try {
            await docCommand({ action: 'create', collection: 'pulses', data: {
                lid: uuidv7(), lifetreeId: fromTreeId, type: 'reach', visibility: 'private', title: `Reach: ${data.offeringFromTreeName || 'a tree'} -> ${data.offeredToName || 'a being'}`,
                body: text, content: text, door, reachTreeId: partnerTreeId, reachTreeName: data.offeredToName || '', recipientName: data.offeredToName || '',
                recipientUid: keeper, participantUids: [data.authorId, keeper], threadId: [fromTreeId, partnerTreeId].sort().join('__'), seenBy: [],
                authorId: data.authorId, authorName: data.offeringFromTreeName || data.authorName || 'A being', ...(data.authorPhoto ? { authorPhoto: data.authorPhoto } : {}),
                domain, loveCount: 0, commentCount: 0, previousHash: 'OFFER_NOTICE', hash: uuidv7(), createdAt: serverTime(),
            } });
        } catch (e) { console.warn('[lightseed] the offering stands; its notice could not be sent', e); }
    }
    return offering;
};
export const withdrawOffering: typeof F.withdrawOffering = async (id) => {
    await docCommand({ action: 'update', collection: 'pulses', id, patch: { offeringStatus: 'withdrawn', offeringAnsweredAt: serverTime(), updatedAt: serverTime() } });
    announce('pulses', id, { offeringStatus: 'withdrawn' });
};
export const declineOffering: typeof F.declineOffering = async (id, byUid) => {
    await docCommand({ action: 'update', collection: 'pulses', id, patch: { offeringStatus: 'declined', offeringAnsweredBy: byUid, offeringAnsweredAt: serverTime(), updatedAt: serverTime() } });
    announce('pulses', id, { offeringStatus: 'declined', offeringAnsweredBy: byUid });
};
// ACCEPTANCE is the server's (migration 040): twin blocks on both chains in one transaction.
export const acceptOffering: typeof F.acceptOffering = async (id) => {
    const answer = await session.offeringCommand({ action: 'accept', id }) as { fromPulseId: string; toPulseId: string };
    announce('pulses', id, { offeringStatus: 'accepted' });
    return answer;
};
export const getOfferingsTo: typeof F.getOfferingsTo = async (kind, id) =>
    newestFirst(await docAll<Pulse>('pulses', { where: { type: 'offering', offeredToKind: kind, offeredToId: id } }));
export const setOfferingActive: typeof F.setOfferingActive = async (id, active) => {
    await docCommand({ action: 'update', collection: 'pulses', id, patch: { offeringActive: active, updatedAt: serverTime() } });
};
export const updateOffering: typeof F.updateOffering = async (id, data) => {
    await docCommand({ action: 'update', collection: 'pulses', id, patch: { ...data, updatedAt: serverTime() } as Record<string, unknown> });
    announce('pulses', id, data as Record<string, unknown>);
};
export const createCommunityEvent: typeof F.createCommunityEvent = async (community, data) =>
    bornStandalone('COMMUNITY_EVENT', { ...data, type: 'event', domain: normalizeDomain(community.domain), communityId: community.id, communityName: community.name, visibility: data.visibility || 'public' });
