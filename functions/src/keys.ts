// keys.ts — split from index.ts (ring 2026-09-16); every function keeps its name, trigger and options.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { db } from "./core";

// --- Signing-key epochs -----------------------------------------------------------------------
// The app and this package intentionally share a fixed-field preimage contract rather than an
// import (functions/rootDir is isolated). Keep byte order in sync with src/domain/keyEpoch.ts;
// tests exercise the browser half and the callable verifies both Ed25519 hands before any mutation.
const KEY_EVENT_VERSION = "lifeseed.key-event.v1";
const KEY_ROTATION_DOMAIN = "lifeseed.key-rotation.v1";
const KEY_RECOVERY_DOMAIN = "lifeseed.key-recovery.v1";
const KEY_RECOVERY_QUORUM = 3;
const FINGERPRINT_RE = /^[a-f0-9]{64}$/;
const EVENT_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

const signingKeyFingerprint = (pubkey: string): string =>
    createHash("sha256").update(pubkey, "utf8").digest("hex");

const rotationPreimage = (claim: {
    uid: string;
    lid: string;
    eventId: string;
    fromFingerprint: string;
    toFingerprint: string;
}): string => [
    KEY_EVENT_VERSION,
    KEY_ROTATION_DOMAIN,
    claim.uid,
    claim.lid,
    claim.eventId,
    claim.fromFingerprint,
    claim.toFingerprint,
].join("\n");

interface RecoveryClaim {
    uid: string;
    lid: string;
    eventId: string;
    fromFingerprint: string;
    toFingerprint: string;
    suspectedSinceMs: number;
}

const recoveryPreimage = (claim: RecoveryClaim): string => [
    KEY_EVENT_VERSION,
    KEY_RECOVERY_DOMAIN,
    claim.uid,
    claim.lid,
    claim.eventId,
    claim.fromFingerprint,
    claim.toFingerprint,
    String(claim.suspectedSinceMs),
].join("\n");

const recoveryWitnessPreimage = (claim: RecoveryClaim, witnessUid: string): string => [
    KEY_EVENT_VERSION,
    KEY_RECOVERY_DOMAIN,
    "witness",
    witnessUid,
    claim.uid,
    claim.lid,
    claim.eventId,
    claim.fromFingerprint,
    claim.toFingerprint,
    String(claim.suspectedSinceMs),
].join("\n");

const canonicalBase64 = (value: string): boolean => {
    try {
        return Buffer.from(value, "base64").toString("base64") === value;
    } catch {
        return false;
    }
};

// Exported for the signed block (blocks.ts): one Ed25519 verifier on the server, whatever is signed.
export const verifiesEd25519 = (pubkey: string, signature: string, preimage: string): boolean => {
    try {
        if (!canonicalBase64(pubkey) || !canonicalBase64(signature)) return false;
        const key = createPublicKey({
            key: Buffer.from(pubkey, "base64"),
            format: "der",
            type: "spki",
        });
        return key.asymmetricKeyType === "ed25519"
            && verifySignature(
                null,
                Buffer.from(preimage, "utf8"),
                key,
                Buffer.from(signature, "base64"),
            );
    } catch {
        return false;
    }
};

// A routine rotation is cross-signed by the outgoing and incoming private keys. Auth names whose
// identity is being changed; the two signatures prove continuity. Frozen keys cannot rotate around
// a compromise declaration — they need the separate witnessed-recovery path.
export const rotateSigningKey = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to rotate a signing key.");
    const uid = request.auth.uid;
    const {
        eventId, lid, fromPubkey, toPubkey, fromFingerprint, toFingerprint, oldSig, newSig,
    } = (request.data || {}) as Record<string, unknown>;
    const values = { eventId, lid, fromPubkey, toPubkey, fromFingerprint, toFingerprint, oldSig, newSig };
    if (Object.values(values).some(value => typeof value !== "string" || !value)) {
        throw new HttpsError("invalid-argument", "The rotation proof is incomplete.");
    }
    const event = eventId as string;
    const fromKey = fromPubkey as string;
    const toKey = toPubkey as string;
    const fromFp = fromFingerprint as string;
    const toFp = toFingerprint as string;
    if (
        !EVENT_ID_RE.test(event)
        || (lid as string).length > 128
        || (lid as string).includes("\n")
        || !FINGERPRINT_RE.test(fromFp)
        || !FINGERPRINT_RE.test(toFp)
        || fromFp === toFp
        || fromKey.length > 1024
        || toKey.length > 1024
        || (oldSig as string).length > 1024
        || (newSig as string).length > 1024
    ) throw new HttpsError("invalid-argument", "The rotation proof is malformed.");
    if (signingKeyFingerprint(fromKey) !== fromFp || signingKeyFingerprint(toKey) !== toFp) {
        throw new HttpsError("invalid-argument", "A key does not match its fingerprint.");
    }
    const preimage = rotationPreimage({
        uid, lid: lid as string, eventId: event, fromFingerprint: fromFp, toFingerprint: toFp,
    });
    if (
        !verifiesEd25519(fromKey, oldSig as string, preimage)
        || !verifiesEd25519(toKey, newSig as string, preimage)
    ) throw new HttpsError("permission-denied", "Both the current and new key must sign the rotation.");

    const personRef = db.collection("persons").doc(uid);
    const oldKeyRef = personRef.collection("keys").doc(fromFp);
    const newKeyRef = personRef.collection("keys").doc(toFp);
    const eventRef = personRef.collection("keyEvents").doc(event);
    await db.runTransaction(async transaction => {
        const [personSnap, oldKeySnap, newKeySnap, eventSnap] = await Promise.all([
            transaction.get(personRef),
            transaction.get(oldKeyRef),
            transaction.get(newKeyRef),
            transaction.get(eventRef),
        ]);
        const person = personSnap.data() || {};
        if (
            !personSnap.exists
            || person.publicKeyPem !== fromKey
            || person.lid !== lid
            || person.signingKeyFingerprint !== fromFp
            || person.signingState !== "active"
        ) throw new HttpsError("failed-precondition", "The outgoing key is no longer the active epoch.");
        if (!oldKeySnap.exists || oldKeySnap.data()?.pubkey !== fromKey) {
            throw new HttpsError("failed-precondition", "The outgoing key has no anchored lineage.");
        }
        if (newKeySnap.exists) {
            throw new HttpsError("already-exists", "A routine rotation must move to a fresh key.");
        }
        if (eventSnap.exists) throw new HttpsError("already-exists", "This rotation event already exists.");

        const recordedAt = FieldValue.serverTimestamp();
        transaction.create(newKeyRef, { pubkey: toKey, publishedAt: recordedAt });
        transaction.create(eventRef, {
            version: 1,
            type: "rotate",
            uid,
            lid,
            epochId: event,
            keyFingerprint: toFp,
            previousFingerprint: fromFp,
            recordedAt,
            oldSig,
            newSig,
        });
        transaction.update(personRef, {
            publicKeyPem: toKey,
            signingKeyFingerprint: toFp,
            signingEpochId: event,
            signingState: "active",
            signingAnchoredAt: recordedAt,
            signingFrozenAt: FieldValue.delete(),
            signingFreezeEventId: FieldValue.delete(),
        });
    });
    return { epochId: event, fingerprint: toFp };
});

const recoveryWitnessEligible = async (uid: string): Promise<boolean> => {
    const initiate = await db.collection("initiates").doc(uid).get();
    if (initiate.exists) return true;
    const validatedTree = await db.collection("lifetrees")
        .where("ownerId", "==", uid)
        .where("validated", "==", true)
        .limit(1)
        .get();
    return !validatedTree.empty;
};

const recoveryClaimFrom = (uid: string, eventId: string, data: Record<string, unknown>): RecoveryClaim => ({
    uid,
    lid: data.lid as string,
    eventId,
    fromFingerprint: data.fromFingerprint as string,
    toFingerprint: data.toFingerprint as string,
    suspectedSinceMs: data.suspectedSinceMs as number,
});

// Recovery begins only after a one-way freeze. The candidate NEW key proves possession, but account
// auth cannot activate it; this merely opens a public-to-members proposal for three independent
// witnesses rooted in the validation web.
export const beginSigningKeyRecovery = onCall({ cors: true }, async request => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to begin recovery.");
    const uid = request.auth.uid;
    const { eventId, toPubkey, toFingerprint, newSig } =
        (request.data || {}) as Record<string, unknown>;
    if (
        typeof eventId !== "string" || !EVENT_ID_RE.test(eventId)
        || typeof toPubkey !== "string" || !toPubkey || toPubkey.length > 1024
        || typeof toFingerprint !== "string" || !FINGERPRINT_RE.test(toFingerprint)
        || typeof newSig !== "string" || !newSig || newSig.length > 1024
        || signingKeyFingerprint(toPubkey) !== toFingerprint
    ) throw new HttpsError("invalid-argument", "The recovery candidate is malformed.");

    const personRef = db.collection("persons").doc(uid);
    const proposalRef = personRef.collection("keyRecoveries").doc(eventId);
    const personSnap = await personRef.get();
    const person = personSnap.data() || {};
    if (
        !personSnap.exists
        || person.signingState !== "frozen"
        || typeof person.lid !== "string"
        || typeof person.signingKeyFingerprint !== "string"
        || typeof person.signingEpochId !== "string"
        || typeof person.signingFreezeEventId !== "string"
    ) throw new HttpsError("failed-precondition", "Freeze the current key before opening recovery.");
    if (person.signingKeyFingerprint === toFingerprint) {
        throw new HttpsError("invalid-argument", "Recovery must move to a fresh key.");
    }
    const [freezeSnap, epochSnap] = await Promise.all([
        personRef.collection("keyEvents").doc(person.signingFreezeEventId).get(),
        personRef.collection("keyEvents").doc(person.signingEpochId).get(),
    ]);
    const freeze = freezeSnap.data() || {};
    const freezeAt = freeze.recordedAt instanceof Timestamp
        ? freeze.recordedAt.toMillis() : 0;
    const suspectedSinceMs = freeze.claimedSuspectedSince instanceof Timestamp
        ? freeze.claimedSuspectedSince.toMillis() : freezeAt;
    const epochAt = epochSnap.data()?.recordedAt instanceof Timestamp
        ? epochSnap.data()!.recordedAt.toMillis() : 0;
    if (
        !freezeSnap.exists || !epochSnap.exists || !freezeAt || !epochAt
        || suspectedSinceMs < epochAt || suspectedSinceMs > freezeAt
    ) {
        throw new HttpsError("failed-precondition", "The freeze boundary is not trustworthy.");
    }
    const claim: RecoveryClaim = {
        uid,
        lid: person.lid,
        eventId,
        fromFingerprint: person.signingKeyFingerprint,
        toFingerprint,
        suspectedSinceMs,
    };
    if (!verifiesEd25519(toPubkey, newSig, recoveryPreimage(claim))) {
        throw new HttpsError("permission-denied", "The candidate key must sign its recovery.");
    }
    await db.runTransaction(async transaction => {
        const [freshPersonSnap, proposalSnap, newKeySnap] = await Promise.all([
            transaction.get(personRef),
            transaction.get(proposalRef),
            transaction.get(personRef.collection("keys").doc(toFingerprint)),
        ]);
        const freshPerson = freshPersonSnap.data() || {};
        if (
            freshPerson.signingState !== "frozen"
            || freshPerson.lid !== claim.lid
            || freshPerson.signingKeyFingerprint !== claim.fromFingerprint
            || freshPerson.signingFreezeEventId !== person.signingFreezeEventId
        ) throw new HttpsError("aborted", "The frozen identity changed while recovery opened.");
        if (proposalSnap.exists) throw new HttpsError("already-exists", "This recovery already exists.");
        if (newKeySnap.exists) throw new HttpsError("already-exists", "Recovery must use a fresh key.");
        transaction.create(proposalRef, {
            version: 1,
            uid,
            lid: person.lid,
            status: "open",
            fromFingerprint: claim.fromFingerprint,
            toFingerprint,
            toPubkey,
            suspectedSinceMs,
            newSig,
            createdAt: FieldValue.serverTimestamp(),
        });
    });
    return { eventId, recoveryCode: `${uid}:${eventId}`, suspectedSinceMs };
});

// A witness signs in their own current epoch. Eligibility is a public-root fact: git initiation or
// ownership of a validated tree. The witness signature is UID-bound, so one hand cannot occupy
// several witness slots even if several accounts publish the same public key.
export const witnessSigningKeyRecovery = onCall({ cors: true }, async request => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to witness recovery.");
    const witnessUid = request.auth.uid;
    const {
        targetUid, eventId, sig, pubkey, keyFingerprint, epochId,
    } = (request.data || {}) as Record<string, unknown>;
    if (
        typeof targetUid !== "string" || !targetUid || targetUid === witnessUid
        || typeof eventId !== "string" || !EVENT_ID_RE.test(eventId)
        || typeof sig !== "string" || !sig || sig.length > 1024
        || typeof pubkey !== "string" || !pubkey || pubkey.length > 1024
        || typeof keyFingerprint !== "string" || !FINGERPRINT_RE.test(keyFingerprint)
        || typeof epochId !== "string" || !EVENT_ID_RE.test(epochId)
        || signingKeyFingerprint(pubkey) !== keyFingerprint
    ) throw new HttpsError("invalid-argument", "The witness proof is malformed.");
    if (!(await recoveryWitnessEligible(witnessUid))) {
        throw new HttpsError(
            "permission-denied",
            "Recovery witnesses must be initiated or hold a validated lifetree.",
        );
    }

    const targetRef = db.collection("persons").doc(targetUid);
    const proposalRef = targetRef.collection("keyRecoveries").doc(eventId);
    const [proposalSnap, witnessPersonSnap] = await Promise.all([
        proposalRef.get(),
        db.collection("persons").doc(witnessUid).get(),
    ]);
    const proposal = proposalSnap.data() as Record<string, unknown> | undefined;
    const witnessPerson = witnessPersonSnap.data() || {};
    if (!proposalSnap.exists || !proposal || proposal.status !== "open") {
        throw new HttpsError("not-found", "This recovery is not open.");
    }
    if (
        witnessPerson.signingState !== "active"
        || witnessPerson.publicKeyPem !== pubkey
        || witnessPerson.signingKeyFingerprint !== keyFingerprint
        || witnessPerson.signingEpochId !== epochId
    ) throw new HttpsError("failed-precondition", "The witness key is not the current active epoch.");
    const claim = recoveryClaimFrom(targetUid, eventId, proposal);
    if (!verifiesEd25519(pubkey, sig, recoveryWitnessPreimage(claim, witnessUid))) {
        throw new HttpsError("permission-denied", "The witness signature does not bind to this recovery.");
    }
    const witnessRef = proposalRef.collection("witnesses").doc(`${witnessUid}__${epochId}`);
    await db.runTransaction(async transaction => {
        const [freshProposal, existing] = await Promise.all([
            transaction.get(proposalRef),
            transaction.get(witnessRef),
        ]);
        if (!freshProposal.exists || freshProposal.data()?.status !== "open") {
            throw new HttpsError("failed-precondition", "This recovery is no longer open.");
        }
        if (existing.exists) return;
        transaction.create(witnessRef, {
            witnessUid,
            version: 3,
            sig,
            pubkey,
            keyFingerprint,
            epochId,
            recordedAt: FieldValue.serverTimestamp(),
        });
    });
    return { witnessed: true };
});

export const activateSigningKeyRecovery = onCall({ cors: true }, async request => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to complete recovery.");
    const uid = request.auth.uid;
    const eventId = request.data?.eventId;
    if (typeof eventId !== "string" || !EVENT_ID_RE.test(eventId)) {
        throw new HttpsError("invalid-argument", "The recovery id is malformed.");
    }
    const personRef = db.collection("persons").doc(uid);
    const proposalRef = personRef.collection("keyRecoveries").doc(eventId);
    const [personSnap, proposalSnap, witnessesSnap] = await Promise.all([
        personRef.get(),
        proposalRef.get(),
        proposalRef.collection("witnesses").limit(20).get(),
    ]);
    const person = personSnap.data() || {};
    const proposal = proposalSnap.data() as Record<string, unknown> | undefined;
    if (
        !personSnap.exists
        || person.signingState !== "frozen"
        || !proposalSnap.exists
        || !proposal
        || proposal.status !== "open"
    ) throw new HttpsError("failed-precondition", "This recovery is not open on a frozen identity.");
    const claim = recoveryClaimFrom(uid, eventId, proposal);
    if (
        person.signingKeyFingerprint !== claim.fromFingerprint
        || person.lid !== claim.lid
        || typeof proposal.toPubkey !== "string"
        || typeof proposal.newSig !== "string"
        || signingKeyFingerprint(proposal.toPubkey) !== claim.toFingerprint
        || !verifiesEd25519(proposal.toPubkey, proposal.newSig, recoveryPreimage(claim))
    ) throw new HttpsError("failed-precondition", "The recovery proposal no longer matches the identity.");

    const assuredWitnesses: Array<{ uid: string; data: Record<string, unknown> }> = [];
    for (const witnessDoc of witnessesSnap.docs) {
        const witness = witnessDoc.data() as Record<string, unknown>;
        const witnessUid = witness.witnessUid;
        if (
            typeof witnessUid !== "string"
            || witnessDoc.id !== `${witnessUid}__${witness.epochId}`
        ) continue;
        if (!(await recoveryWitnessEligible(witnessUid))) continue;
        const witnessPersonSnap = await db.collection("persons").doc(witnessUid).get();
        const witnessPerson = witnessPersonSnap.data() || {};
        if (
            witness.version !== 3
            || witnessPerson.signingState !== "active"
            || witnessPerson.publicKeyPem !== witness.pubkey
            || witnessPerson.signingKeyFingerprint !== witness.keyFingerprint
            || witnessPerson.signingEpochId !== witness.epochId
            || typeof witness.pubkey !== "string"
            || typeof witness.sig !== "string"
            || !verifiesEd25519(
                witness.pubkey,
                witness.sig,
                recoveryWitnessPreimage(claim, witnessUid),
            )
        ) continue;
        assuredWitnesses.push({ uid: witnessUid, data: witness });
    }
    if (new Set(assuredWitnesses.map(witness => witness.uid)).size < KEY_RECOVERY_QUORUM) {
        throw new HttpsError(
            "failed-precondition",
            `Recovery needs ${KEY_RECOVERY_QUORUM} current, independent witnesses.`,
        );
    }

    const newKeyRef = personRef.collection("keys").doc(claim.toFingerprint);
    const eventRef = personRef.collection("keyEvents").doc(eventId);
    await db.runTransaction(async transaction => {
        const [freshPersonSnap, freshProposalSnap, newKeySnap, eventSnap] = await Promise.all([
            transaction.get(personRef),
            transaction.get(proposalRef),
            transaction.get(newKeyRef),
            transaction.get(eventRef),
        ]);
        const freshPerson = freshPersonSnap.data() || {};
        if (
            freshPerson.signingState !== "frozen"
            || freshPerson.lid !== claim.lid
            || freshPerson.signingKeyFingerprint !== claim.fromFingerprint
            || freshProposalSnap.data()?.status !== "open"
        ) throw new HttpsError("aborted", "The recovery boundary changed.");
        if (newKeySnap.exists || eventSnap.exists) {
            throw new HttpsError("already-exists", "The recovered epoch already exists.");
        }
        // Re-check each witness's CURRENT declaration in the same transaction that activates.
        for (const witness of assuredWitnesses.slice(0, KEY_RECOVERY_QUORUM)) {
            const current = (await transaction.get(db.collection("persons").doc(witness.uid))).data() || {};
            if (
                current.signingState !== "active"
                || current.publicKeyPem !== witness.data.pubkey
                || current.signingKeyFingerprint !== witness.data.keyFingerprint
                || current.signingEpochId !== witness.data.epochId
            ) throw new HttpsError("aborted", "A witness epoch changed; ask them to witness again.");
        }
        const recordedAt = FieldValue.serverTimestamp();
        transaction.create(newKeyRef, { pubkey: proposal.toPubkey, publishedAt: recordedAt });
        transaction.create(eventRef, {
            version: 1,
            type: "recover",
            uid,
            lid: claim.lid,
            epochId: eventId,
            keyFingerprint: claim.toFingerprint,
            previousFingerprint: claim.fromFingerprint,
            suspectedSince: Timestamp.fromMillis(claim.suspectedSinceMs),
            recoveryId: eventId,
            recordedAt,
        });
        transaction.update(personRef, {
            publicKeyPem: proposal.toPubkey,
            signingKeyFingerprint: claim.toFingerprint,
            signingEpochId: eventId,
            signingState: "active",
            signingAnchoredAt: recordedAt,
            signingFrozenAt: FieldValue.delete(),
            signingFreezeEventId: FieldValue.delete(),
        });
        transaction.update(proposalRef, {
            status: "activated",
            activatedAt: recordedAt,
        });
    });
    return { epochId: eventId, fingerprint: claim.toFingerprint };
});
