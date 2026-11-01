// THE INDEPENDENT NODE'S HAND for keys — the mirror of ../firebase/keys.ts (rings 2026-11-01/02).
// Key custody is the same law on both soils: the private key lives ONLY on this device, non-
// extractable, in IndexedDB; the public key is anchored on the node (migration 031) and every
// rotation, freeze, recovery proposal, witness and activation is a proof the node verifies
// (032–036). The preview's custody services (./keyCustody, ./recoveryCustody) already keep that
// law against the independent API; this module lends them the names the shell knows.
import type * as F from '../firebase/keys';
import { session, requireUid, toMillis } from './core';
import { docGet, docAll } from './docs';
import { createSeedKeyCustody } from './keyCustody';
import { createSeedRecoveryCustody } from './recoveryCustody';
import { independentDeviceKeyStore, type DeviceSigningKey } from './keyStore';
import { sha256 } from '../../utils/crypto';
import { keyStandingAt, keyStandingCounts, type KeyEpoch, type KeyEvent } from '../../domain/keyEpoch';
import { signPayload, verifyPayload, subtleEd25519Available } from '../signingCrypto';
import { SigningKeyNeedsRestoreError, RestoreKeyMismatchError, SigningKeyFrozenError } from '../signingErrors';
export { SigningKeyNeedsRestoreError, RestoreKeyMismatchError, SigningKeyFrozenError } from '../signingErrors';
export type { SigningKeyState, PublishedSigningIdentity, EnsureKeyResult, RotateSigningKeyResult, PendingRecovery, BeginRecoveryResult, RecoveryPreview } from '../firebase/keys';

const store = independentDeviceKeyStore();
const custody = createSeedKeyCustody(session, store);
const recovery = createSeedRecoveryCustody(session, store);
type Identity = { uid: string; lid: string; publicKeyB64: string; fingerprint: string; epochId: string; state: string | null };
const readIdentity = async (uid: string): Promise<Identity | null> =>
    ((await session.read('/v1/signing-identity?id=' + encodeURIComponent(uid)).catch(async () =>
        (await import('./public')).seedPublicRead('/v1/signing-identity?id=' + encodeURIComponent(uid)))) as { identity: Identity | null }).identity;
const personLid = async (uid: string): Promise<string> => {
    const person = await docGet<{ lid?: string }>('persons', uid);
    if (!person?.lid) throw new Error('err_lid_before_publish');
    return person.lid;
};
const deviceKeys = async (uid: string): Promise<DeviceSigningKey[]> => {
    try { return await store.list(uid, await personLid(uid)); } catch { return []; }
};
const currentUid = (uid?: string): string => uid ?? requireUid();
const identityOf = async (uid: string): Promise<F.PublishedSigningIdentity> => {
    const found = await getPublishedSigningIdentity(uid);
    if (!found) throw new Error('err_recovered_identity');
    return found;
};
// The custody refusals, spoken in the shell's own words.
const refused = (e: unknown): never => {
    const word = e instanceof Error ? e.message : '';
    if (word === 'restore_required' || word === 'needs_restore') throw new SigningKeyNeedsRestoreError('needs_restore');
    if (word === 'stale_device') throw new SigningKeyNeedsRestoreError('stale_device');
    if (word === 'restore_mismatch') throw new RestoreKeyMismatchError();
    if (word === 'block_key_frozen' || word === 'frozen') throw new SigningKeyFrozenError();
    throw e;
};

export const keyFingerprint: typeof F.keyFingerprint = (publicKeyB64) => sha256(publicKeyB64);
export const getPublishedSigningKey: typeof F.getPublishedSigningKey = async (uid) => (await readIdentity(uid))?.publicKeyB64 ?? '';
export const getPublishedSigningIdentity: typeof F.getPublishedSigningIdentity = async (uid) => {
    const identity = await readIdentity(uid);
    if (!identity || !identity.publicKeyB64 || !identity.fingerprint || !identity.epochId) return null;
    return { lid: identity.lid || '', publicKeyB64: identity.publicKeyB64, fingerprint: identity.fingerprint, epochId: identity.epochId, state: identity.state === 'frozen' ? 'frozen' : 'active' };
};
// The standing of a signature's key epoch, read from the person's append-only key events.
export const getSignatureKeyStanding: typeof F.getSignatureKeyStanding = async (uid, publicKeyB64, signature) => {
    if (signature.version !== 3 || !signature.keyFingerprint || !signature.epochId || !toMillis(signature.recordedAt)) return 'unanchored';
    if (await keyFingerprint(publicKeyB64) !== signature.keyFingerprint) return 'unknown_epoch';
    const [person, rows] = await Promise.all([docGet<Record<string, unknown>>('persons', uid), docAll<Record<string, unknown>>('person_key_events', { parent: uid })]);
    if (!person) return 'unknown_epoch';
    const personLidValue = typeof person.lid === 'string' ? person.lid : '';
    const events: KeyEvent[] = rows.flatMap(event => {
        const recordedAtMs = toMillis(event.recordedAt);
        if (!['anchor', 'rotate', 'freeze', 'recover'].includes(String(event.type)) || event.lid !== personLidValue
            || typeof event.epochId !== 'string' || typeof event.keyFingerprint !== 'string' || !recordedAtMs) return [];
        return [{ eventId: event.id as string, type: event.type as KeyEvent['type'], epochId: event.epochId, keyFingerprint: event.keyFingerprint, recordedAtMs,
            ...(typeof event.previousFingerprint === 'string' ? { previousFingerprint: event.previousFingerprint } : {}),
            ...(toMillis(event.suspectedSince) ? { suspectedSinceMs: toMillis(event.suspectedSince) } : {}) }];
    });
    const epochs: KeyEpoch[] = events.filter(e => e.type !== 'freeze').map(e => ({ epochId: e.epochId, fingerprint: e.keyFingerprint, anchoredAtMs: e.recordedAtMs }));
    return keyStandingAt({ epochId: signature.epochId, keyFingerprint: signature.keyFingerprint, recordedAtMs: toMillis(signature.recordedAt) }, epochs, events,
        typeof person.signingKeyFingerprint === 'string' ? person.signingKeyFingerprint : '');
};
export const isKeyInLineage: typeof F.isKeyInLineage = async (uid, publicKeyB64, signature) => {
    if (!publicKeyB64) return false;
    try {
        const record = await docGet<{ pubkey?: string }>('person_keys', await keyFingerprint(publicKeyB64), uid);
        const inLineage = !!record && record.pubkey === publicKeyB64;
        if (!inLineage || signature?.version !== 3) return inLineage;
        return keyStandingCounts(await getSignatureKeyStanding(uid, publicKeyB64, signature));
    } catch { return false; }
};
export const getDeviceKeyInfo: typeof F.getDeviceKeyInfo = async (uid) => {
    const keys = await deviceKeys(currentUid(uid));
    const published = await getPublishedSigningKey(currentUid(uid)).catch(() => '');
    const key = keys.find(k => k.publicKeyB64 === published) ?? keys[0];
    return key ? { publicKeyB64: key.publicKeyB64 } : null;
};
export const publishSigningKey: typeof F.publishSigningKey = async (uid, publicKeyB64) => {
    const keys = await deviceKeys(uid);
    if (!keys.some(k => k.publicKeyB64 === publicKeyB64)) throw new SigningKeyNeedsRestoreError('needs_restore');
    const state = await custody.inspect();
    if (state.status === 'ready') return;
    await custody.publishStored().catch(refused);
};
export const hasSigningKey: typeof F.hasSigningKey = async (uid) => (await deviceKeys(currentUid(uid))).length > 0;
export const readyToSign: typeof F.readyToSign = async () => {
    try { const state = await custody.inspect(); return (state.status === 'ready' || state.status === 'publish_needed') && !state.frozen; }
    catch { return false; }
};
// Get-or-create THIS device's key under the custody rule; the phrase is returned once, at creation.
export const ensureSigningKey: typeof F.ensureSigningKey = async (uid) => {
    const id = currentUid(uid);
    const state = await custody.inspect().catch(refused);
    if (state.frozen) throw new SigningKeyFrozenError();
    if (state.status === 'needs_restore' || state.status === 'stale_device') throw new SigningKeyNeedsRestoreError(state.status);
    if (state.status === 'publish_needed') await custody.publishStored().catch(refused);
    if (state.status === 'fresh') {
        const { words } = await custody.prepare().catch(refused);
        const { publicKeyB64 } = await custody.confirmBackup().catch(refused);
        const identity = await identityOf(id);
        return { created: true, publicKeyB64, fingerprint: identity.fingerprint, epochId: identity.epochId, recoveryPhrase: words };
    }
    const identity = await identityOf(id);
    return { created: false, publicKeyB64: identity.publicKeyB64, fingerprint: identity.fingerprint, epochId: identity.epochId };
};
export const restoreFromPhrase: typeof F.restoreFromPhrase = async (words) => custody.restore(words.join(' ')).catch(refused);
export const rotateSigningKey: typeof F.rotateSigningKey = async (uid) => {
    const id = currentUid(uid);
    const { words } = await custody.prepareRotation().catch(refused);
    const { publicKeyB64 } = await custody.confirmBackup().catch(refused);
    const identity = await identityOf(id);
    return { publicKeyB64, fingerprint: identity.fingerprint, epochId: identity.epochId, recoveryPhrase: words };
};
export const freezeSigningKey: typeof F.freezeSigningKey = async (uid, suspectedSinceMs) => {
    const identity = await getPublishedSigningIdentity(currentUid(uid));
    if (!identity) throw new Error('err_no_anchor_freeze');
    if (identity.state === 'frozen') return;
    if (suspectedSinceMs !== undefined && (!Number.isFinite(suspectedSinceMs) || suspectedSinceMs > Date.now())) throw new Error('err_compromise_future');
    await session.signingCommand({ action: 'freeze', epochId: identity.epochId, fingerprint: identity.fingerprint, ...(suspectedSinceMs !== undefined ? { suspectedSinceMs } : {}) });
};
const witnessCountOf = async (uid: string, eventId: string): Promise<number> => {
    try {
        const body = await session.read(`/v1/signing-recovery-witnesses?id=${encodeURIComponent(uid)}&event=${encodeURIComponent(eventId)}`) as { items?: { witnessUid?: string }[] };
        return new Set((body.items ?? []).map(w => w.witnessUid).filter((w): w is string => typeof w === 'string')).size;
    } catch { return 0; }
};
export const getPendingSigningKeyRecovery: typeof F.getPendingSigningKeyRecovery = async (uid) => {
    const id = currentUid(uid);
    const state = await recovery.inspect().catch(() => null);
    const code = state?.codes[0];
    if (!code) return null;
    const eventId = code.slice(code.lastIndexOf(':') + 1);
    return { eventId, recoveryCode: code, witnessCount: await witnessCountOf(id, eventId) };
};
export const beginSigningKeyRecovery: typeof F.beginSigningKeyRecovery = async () => {
    const { words } = await recovery.prepare().catch(refused);
    const { code } = await recovery.confirmBackup().catch(refused);
    return { eventId: code.slice(code.lastIndexOf(':') + 1), recoveryCode: code, witnessCount: 0, recoveryPhrase: words };
};
export const getSigningKeyRecoveryPreview: typeof F.getSigningKeyRecoveryPreview = async (code) => {
    const proposal = await recovery.read(code);
    if (proposal.status !== 'open') throw new Error('err_recovery_closed');
    const person = await docGet<{ displayName?: string }>('persons', proposal.uid).catch(() => null);
    return { targetUid: proposal.uid, targetName: person?.displayName || proposal.uid, targetLid: proposal.lid, eventId: proposal.id,
        fromFingerprint: proposal.fromFingerprint, toFingerprint: proposal.toFingerprint, suspectedSinceMs: proposal.suspectedSinceMs };
};
export const witnessSigningKeyRecovery: typeof F.witnessSigningKeyRecovery = async (code, uid) => {
    const proposal = await recovery.read(code);
    if (proposal.uid === currentUid(uid)) throw new Error('err_own_recovery');
    await recovery.witness(proposal).catch(refused);
};
export const activateSigningKeyRecovery: typeof F.activateSigningKeyRecovery = async (uid) => {
    const id = currentUid(uid);
    const pending = await getPendingSigningKeyRecovery(id);
    if (!pending) throw new Error('err_recovery_key_absent');
    await recovery.activate(pending.recoveryCode).catch(refused);
    return identityOf(id);
};
// Sign a payload under a domain tag with THIS device's key — the key that IS the published identity.
export const sign: typeof F.sign = async (payload, domainTag, uid) => {
    const id = currentUid(uid);
    const [keys, identity] = await Promise.all([deviceKeys(id), getPublishedSigningIdentity(id)]);
    if (!keys.length) throw new Error('err_no_device_key');
    const key = identity ? keys.find(k => k.publicKeyB64 === identity.publicKeyB64) : undefined;
    if (!identity || !key) throw new SigningKeyNeedsRestoreError(identity ? 'stale_device' : 'needs_restore');
    if (identity.state === 'frozen') throw new SigningKeyFrozenError();
    return signPayload(key.privateKey, payload, domainTag);
};
export const verify: typeof F.verify = verifyPayload;
export const signingAvailable: typeof F.signingAvailable = subtleEd25519Available;
