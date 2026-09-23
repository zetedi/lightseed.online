// THE SERVER-HELD HEAD (ring 2026-09-23). Every link on a tree's or a vision's chain is born
// here: the hand asks (mintBlock), the server reads the bearer's head INSIDE the transaction,
// judges the birth by the pure law (./birth, mirrored from src/domain/chain/birth), seals the
// block canonically over the very bytes it stores, and moves the head — block and head in one
// write, so the chain can neither fork nor skip. The rules refuse every client-born chain link
// and every client head move (firestore.rules pulses/lifetrees/visions), so this file and its
// twins (acceptOffering, acceptAlignment, mintStayLeaf) are the only hands a chain has.
//
// The seal is CANONICAL for every block born here, sealed or unsealed node alike: the legacy
// seal hashed the browser's ad-hoc payload, which no one — not even this server — could
// recompute from the stored record; a server that holds the head owes every reader a hash
// they can check (chain/verifyBlockSeal). Legacy blocks keep their stored seals; verifyChain
// walks their linkage and height as before.
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { FieldValue, Timestamp, type Transaction, type DocumentReference } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { db, isStaffUid } from "./core";
import { staffHandOn } from "./staffHands";
import { uuidv7 } from "./mint";
import { charter } from "./charter";
import { computeCanonicalHash, BLOCK_HASH_VERSION } from "./chain";
import { publicNameOf } from "./publicName";
import { verifiesEd25519 } from "./keys";
import {
    judgeBlockBirth, blockRecordOf, wateringResetOf, unmintRefusal, STAFF_OVERRIDABLE_REFUSALS,
    judgeBlockSignature, blockSignaturePayload, blockSignaturePreimage, isBlockSignatureClaim,
    type ChainBearerKind, type BlockBirthRefusal, type BlockSignatureRefusal, type UnmintPulseFacts, type SignerFacts,
} from "./birth";

// ── the seal: one law for every server-born block ────────────────────────────────────────
export const sealBlock = async (previousHash: string, mintedAt: number, record: Record<string, unknown>) =>
    ({ hash: await computeCanonicalHash(previousHash, mintedAt, record), hashVersion: BLOCK_HASH_VERSION });

const REFUSAL_CODE: Record<BlockBirthRefusal, "not-found" | "permission-denied" | "invalid-argument" | "failed-precondition"> = {
    block_no_bearer: "not-found",
    block_not_carer: "permission-denied",
    block_field_unknown: "invalid-argument",
    block_field_bad: "invalid-argument",
    block_type_unlawful: "invalid-argument",
    block_visibility_bad: "invalid-argument",
    block_witness_forged: "failed-precondition",
    block_care_type: "failed-precondition",
    block_reach_loud: "failed-precondition",
    block_reach_stranger: "permission-denied",
    block_seen_forged: "failed-precondition",
};
const SIGNATURE_CODE: Record<BlockSignatureRefusal, "permission-denied" | "invalid-argument" | "failed-precondition" | "aborted"> = {
    block_unsigned: "permission-denied",
    block_signature_bad: "permission-denied",
    block_key_stale: "failed-precondition",
    block_key_frozen: "permission-denied",
    block_head_moved: "aborted",
};

// The signer, as the server knows them: persons/{uid}'s published key, epoch and state — the
// same three fields the rules' isCurrentEpochSignature and the key callables read.
const signerFactsOf = (person: Record<string, unknown> | undefined): SignerFacts => {
    if (!person || typeof person.publicKeyPem !== "string" || !person.publicKeyPem
        || typeof person.signingKeyFingerprint !== "string" || typeof person.signingEpochId !== "string") return { state: "none" };
    return {
        state: person.signingState === "frozen" ? "frozen" : "active",
        fingerprint: person.signingKeyFingerprint, epochId: person.signingEpochId, pubkey: person.publicKeyPem,
    };
};

// The domain a block is scoped to: the bearer's own place of record, else the door the hand
// stands at (the request's origin), else the node's. Never the client's word.
const domainOf = (bearerDomain: unknown, request: CallableRequest): string => {
    if (typeof bearerDomain === "string" && bearerDomain) return bearerDomain;
    const origin = String(request.rawRequest?.headers?.origin || "");
    try { if (origin) return new URL(origin).hostname.replace(/^www\./, ""); } catch { /* not a URL */ }
    return charter.domain;
};

const bearerPath = (on: ChainBearerKind, id: string) => `${on === "tree" ? "lifetrees" : "visions"}/${id}`;

// The hand's standing over a chain, read from the documents inside the transaction: a tree's
// owner / co_owner / steward (the rules' isTreeCarer), a vision's author.
const readStanding = async (t: Transaction, on: ChainBearerKind, id: string, bearer: Record<string, unknown>, uid: string): Promise<boolean> => {
    if (on === "vision") return bearer.authorId === uid;
    if (bearer.ownerId === uid) return true;
    const links = await Promise.all(["co_owner", "steward"].map((rel) => t.get(db.doc(`links/${uid}__${rel}__${id}`))));
    return links.some((l) => l.exists);
};

// ── the birth itself, staged on a transaction (shared by mintBlock and the twin mints) ─────
export interface BornBlock { ref: DocumentReference; record: Record<string, unknown>; hash: string; blockHeight: number }

export const stageBlock = async (t: Transaction, p: {
    on: ChainBearerKind; bearerId: string;
    content: Record<string, unknown>; previousHash: string; blockHeight: number;
    authorId: string; domain: string; mintedAt: number;
    bearerPatch?: Record<string, unknown>;
}): Promise<BornBlock> => {
    const ref = db.collection("pulses").doc();
    const record = blockRecordOf({
        on: p.on, bearerId: p.bearerId, content: p.content, authorId: p.authorId,
        lid: uuidv7(p.mintedAt, randomBytes(10)), id: ref.id, domain: p.domain, mintedAt: p.mintedAt, previousHash: p.previousHash,
    });
    const seal = await sealBlock(p.previousHash, p.mintedAt, record);
    t.set(ref, { ...record, hashVersion: seal.hashVersion, hash: seal.hash, createdAt: FieldValue.serverTimestamp() });
    t.update(db.doc(bearerPath(p.on, p.bearerId)), { latestHash: seal.hash, blockHeight: p.blockHeight, ...(p.bearerPatch || {}) });
    return { ref, record, hash: seal.hash, blockHeight: p.blockHeight };
};

// ── mintBlock: a hand asks for a link on a chain it cares for ────────────────────────────
export const mintBlock = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to mint.");
    const uid = request.auth.uid;
    const on = request.data?.on;
    const id = request.data?.id;
    if ((on !== "tree" && on !== "vision") || typeof id !== "string" || !id) throw new HttpsError("invalid-argument", "block_no_bearer");
    const isStaff = await isStaffUid(uid);

    return db.runTransaction(async (t) => {
        // ── all reads first ──
        const bearerSnap = await t.get(db.doc(bearerPath(on, id)));
        const bearer = (bearerSnap.data() ?? {}) as Record<string, unknown>;
        const carer = bearerSnap.exists ? await readStanding(t, on, id, bearer, uid) : false;
        const block = request.data?.block;
        // THE STAFF HANDS (domain/staffHands): a staff hand that is not a carer mints on another
        // being's chain only while the switchable hand is lent — tree_water for a watering,
        // tree_edit for any other link (the hands the rules' watering fork and tree-head branch
        // once read; the birth moved here, and the switch came with it).
        let staffHand = false;
        if (isStaff && !carer) {
            const switches = (await t.get(db.collection("config").doc("staffHands"))).data();
            const care = block && typeof block === "object" ? (block as Record<string, unknown>).care : undefined;
            staffHand = care === "watering" ? staffHandOn(switches, "tree_water") : staffHandOn(switches, "tree_edit");
        }
        const judgment = judgeBlockBirth({
            on, minterUid: uid, isStaff: isStaff && (carer || staffHand),
            bearer: { exists: bearerSnap.exists, carer, latestHash: bearer.latestHash, genesisHash: bearer.genesisHash, blockHeight: bearer.blockHeight, title: bearer.title, visibility: bearer.visibility },
            block,
        });
        if (judgment.outcome === "reject") throw new HttpsError(REFUSAL_CODE[judgment.refusal], judgment.refusal);
        const { content } = judgment;

        // THE AUTHOR'S SIGNATURE (signed blocks): a person with a published key signs the chain
        // position and the content this very judgment produced; the server verifies with the
        // PUBLISHED key (never the claim's), and seals the signature into the block.
        const signer = signerFactsOf((await t.get(db.doc(`persons/${uid}`))).data() as Record<string, unknown> | undefined);
        const claim = request.data?.signature;
        const verified = signer.state === "active" && isBlockSignatureClaim(claim) && !!signer.pubkey
            && claim.keyFingerprint === signer.fingerprint && claim.epochId === signer.epochId
            && claim.previousHash === judgment.previousHash
            && verifiesEd25519(signer.pubkey, claim.sig, blockSignaturePreimage(blockSignaturePayload({
                on, bearerId: id, previousHash: judgment.previousHash, content,
                signerUid: uid, keyFingerprint: claim.keyFingerprint, epochId: claim.epochId,
            })));
        const signed = judgeBlockSignature({ signer, claim, headHash: judgment.previousHash, verified });
        if (signed.outcome === "reject") throw new HttpsError(SIGNATURE_CODE[signed.refusal], signed.refusal);
        if (signed.outcome === "signed") content.authorSignature = signed.signature;
        const mintedAt = Date.now();

        // A tree's growth touches the tree: its latest face, its care stamp — and a watering
        // resets the schedule in the SAME transaction as its block (no window where the chain
        // says watered and the tree says overdue). The waterer's public name is read here.
        const bearerPatch: Record<string, unknown> = {};
        if (on === "tree" && content.type === "tree_growth") {
            if (typeof content.imageUrl === "string" && content.imageUrl) bearerPatch.latestGrowthUrl = content.imageUrl;
            bearerPatch.lastCaredAt = FieldValue.serverTimestamp();
            if (content.care === "watering") {
                const userSnap = await t.get(db.doc(`users/${uid}`));
                const u = (userSnap.data() ?? {}) as Record<string, unknown>;
                const name = publicNameOf({
                    displayName: (u.displayName as string) || (u.name as string),
                    anonymous: !!u.anonymous,
                    treeName: bearer.name as string,
                }) || "";
                const reset = wateringResetOf(bearer as { watering?: { mode?: unknown; intervalDays?: unknown } | null }, mintedAt, uid, name);
                bearerPatch["watering.lastWateredAt"] = Timestamp.fromMillis(reset.lastWateredAtMs);
                bearerPatch["watering.lastWateredBy"] = reset.lastWateredBy;
                bearerPatch["watering.lastWateredByName"] = reset.lastWateredByName;
                bearerPatch["watering.overdue"] = false;
                if (reset.nextDueAtMs) bearerPatch["watering.nextDueAt"] = Timestamp.fromMillis(reset.nextDueAtMs);
                // An AI-confirmed watering wears its confirmation moment from the server's clock.
                if ((content.wateringConfirmedBy ?? "pending") === "ai") {
                    content.wateringConfirmedBy = "ai";
                    content.wateringConfirmation = { ...((content.wateringConfirmation as Record<string, unknown>) || {}), confirmedAt: Timestamp.fromMillis(mintedAt) };
                } else {
                    content.wateringConfirmedBy = "pending";
                }
            }
        }

        // ── writes ──
        const born = await stageBlock(t, {
            on, bearerId: id, content,
            previousHash: judgment.previousHash, blockHeight: judgment.blockHeight,
            authorId: uid, domain: domainOf(bearer.domain, request), mintedAt, bearerPatch,
        });
        return {
            pulseId: born.ref.id,
            lid: born.record.lid,
            hash: born.hash,
            previousHash: judgment.previousHash,
            blockHeight: born.blockHeight,
            mintedAt,
            ...(typeof bearerPatch.latestGrowthUrl === "string" ? { latestGrowthUrl: bearerPatch.latestGrowthUrl } : {}),
        };
    });
});

// ── unmintBlock: the accidental newest link, taken back by the hand that forged it ───────
// The law is domain/unmint (mirrored in ./birth): only the author, only a tree-chain block,
// only the HEAD, never a witnessed watering, nothing co-held. Staff may pass the two social
// guards (co-held, not-author) wearing the amber dot; the structural ones bend to no one.
// The delete and the rollback are one transaction, so the chain only ever shortens by its
// newest link. An unmint is an erasure, said plainly; below the head, retraction is the way.
export const unmintBlock = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to unmint.");
    const uid = request.auth.uid;
    const pulseId = request.data?.pulseId;
    if (typeof pulseId !== "string" || !pulseId) throw new HttpsError("invalid-argument", "unmint_not_mint");
    const isStaff = await isStaffUid(uid);

    return db.runTransaction(async (t) => {
        const pulseRef = db.doc(`pulses/${pulseId}`);
        const pulseSnap = await t.get(pulseRef);
        if (!pulseSnap.exists) throw new HttpsError("not-found", "unmint_not_mint");
        const pulse = pulseSnap.data() as UnmintPulseFacts & Record<string, unknown>;
        const treeId = typeof pulse.lifetreeId === "string" ? pulse.lifetreeId : "";
        const treeRef = treeId ? db.doc(`lifetrees/${treeId}`) : null;
        const treeSnap = treeRef ? await t.get(treeRef) : null;
        const tree = (treeSnap?.data() ?? {}) as Record<string, unknown>;

        const refusal = unmintRefusal(pulse, { latestHash: tree.latestHash as string | undefined }, uid);
        if (refusal && !(isStaff && STAFF_OVERRIDABLE_REFUSALS.has(refusal))) {
            throw new HttpsError(refusal === "unmint_not_author" ? "permission-denied" : "failed-precondition", refusal);
        }
        if (!treeRef || !treeSnap?.exists) throw new HttpsError("not-found", "unmint_not_mint");
        // The structural guard, re-checked on the server's own read: exactly the head.
        if (tree.latestHash !== pulse.hash) throw new HttpsError("failed-precondition", "unmint_not_last");

        const latestHash = String(pulse.previousHash || "");
        const blockHeight = Math.max(0, (Number(tree.blockHeight) || 1) - 1);
        t.delete(pulseRef);
        t.update(treeRef, { latestHash, blockHeight, updatedAt: FieldValue.serverTimestamp() });
        return { latestHash, blockHeight };
    });
});

// ── acceptAlignment: the target settles, and the twin sync-blocks are born on both chains ─
// The alignment shape on server ground (it was the browser's, and the rules had already
// refused its foreign head move): only the TARGET's hand, only while PENDING; each tree's
// block names the other tree and the alignment, sealed and headed in one transaction.
export const acceptAlignment = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to align.");
    const uid = request.auth.uid;
    const alignmentId = request.data?.alignmentId;
    if (typeof alignmentId !== "string" || !alignmentId) throw new HttpsError("invalid-argument", "align_not_pending");

    return db.runTransaction(async (t) => {
        const matchRef = db.doc(`alignments/${alignmentId}`);
        const matchSnap = await t.get(matchRef);
        const a = (matchSnap.data() ?? {}) as Record<string, unknown>;
        if (!matchSnap.exists || a.status !== "PENDING") throw new HttpsError("failed-precondition", "align_not_pending");
        if (a.targetUid !== uid) throw new HttpsError("permission-denied", "align_not_target");
        const initTreeId = String(a.initiatorTreeId || "");
        const targetTreeId = String(a.targetTreeId || "");
        const [initSnap, targetSnap] = await Promise.all([t.get(db.doc(`lifetrees/${initTreeId}`)), t.get(db.doc(`lifetrees/${targetTreeId}`))]);
        if (!initSnap.exists || !targetSnap.exists) throw new HttpsError("not-found", "block_no_bearer");
        const initTree = initSnap.data() as Record<string, unknown>;
        const targetTree = targetSnap.data() as Record<string, unknown>;
        const mintedAt = Date.now();

        const twin = (otherName: unknown, otherTreeId: string) => ({
            type: "standard", title: "Alignment",
            body: `Aligned with ${(typeof otherName === "string" && otherName) || "another tree"}.`,
            isMatch: true, matchId: alignmentId, matchedLifetreeId: otherTreeId,
            authorName: "System", visibility: "public",
        });
        const initBorn = await stageBlock(t, {
            on: "tree", bearerId: initTreeId, content: twin(targetTree.name, targetTreeId),
            previousHash: String(initTree.latestHash || initTree.genesisHash || "0"), blockHeight: (Number(initTree.blockHeight) || 0) + 1,
            authorId: String(a.initiatorUid || ""), domain: domainOf(initTree.domain, request), mintedAt,
        });
        const targetBorn = await stageBlock(t, {
            on: "tree", bearerId: targetTreeId, content: twin(initTree.name, initTreeId),
            previousHash: String(targetTree.latestHash || targetTree.genesisHash || "0"), blockHeight: (Number(targetTree.blockHeight) || 0) + 1,
            authorId: uid, domain: domainOf(targetTree.domain, request), mintedAt,
        });
        t.update(matchRef, { status: "ACCEPTED" });
        return { initiatorTreeId: initTreeId, targetTreeId, initiatorPulseId: initBorn.ref.id, targetPulseId: targetBorn.ref.id };
    });
});
