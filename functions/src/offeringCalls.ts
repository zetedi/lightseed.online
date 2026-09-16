// offeringCalls.ts — split from index.ts (ring 2026-09-16); every function keeps its name, trigger and options.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { judgeOfferingAccept, offeringTwinBlocks, type OfferedToKind } from "./offering";
import { publicNameOf } from "./publicName";
import { createBlock, computeCanonicalHash, BLOCK_HASH_VERSION } from "./chain";
import { db, mintLid } from "./core";

// --- THE OFFERING OF CARE: acceptance -------------------------------------------------------
// acceptOffering — a hand standing for the receiver (a tree's keeper / co-owner / steward, a
// vision's author) accepts an OPEN offering made to it, and the agreement is minted as TWIN
// BLOCKS: one on the offerer's tree chain, one on the receiver's own chain (a tree's, or the
// vision's), each naming the offering and the other side — the alignment shape, on server
// ground. Everything is server-read: the caller is the acceptor; the offering, the receiver,
// the offerer's tree and the acceptor's standing come from the documents; the pure law
// (judgeOfferingAccept, mirrored from domain/offering) decides; the seals follow the node's
// lock exactly as mintPulse does in the browser (./chain mirrors the hashing). No light moves:
// acceptance seals the agreement; appreciation stays a coming rung.
export const acceptOffering = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to accept an offering.");
    const acceptorUid = request.auth.uid;
    const offeringId = request.data?.offeringId;
    if (!offeringId || typeof offeringId !== "string") throw new HttpsError("invalid-argument", "offeringId is required.");

    return db.runTransaction(async (t) => {
        // ── all reads first ──
        const offeringRef = db.doc(`pulses/${offeringId}`);
        const offeringSnap = await t.get(offeringRef);
        const o = (offeringSnap.data() ?? {}) as Record<string, any>;
        const toKind = o.offeredToKind as OfferedToKind | undefined;
        const toId = typeof o.offeredToId === "string" ? o.offeredToId : "";
        const fromTreeId = typeof o.offeringFromTreeId === "string" ? o.offeringFromTreeId : "";
        const authorId = typeof o.authorId === "string" ? o.authorId : "";

        let receiver: Record<string, any> | null = null;
        let standing = false;
        if (toId && (toKind === "tree" || toKind === "vision")) {
            const receiverSnap = await t.get(db.doc(`${toKind === "tree" ? "lifetrees" : "visions"}/${toId}`));
            receiver = receiverSnap.exists ? (receiverSnap.data() as Record<string, any>) : null;
            if (receiver) {
                if (toKind === "tree") {
                    // The tree's carers: its keeper, and co_owner / steward links (rules' isTreeCarer).
                    const links = await Promise.all(["co_owner", "steward"].map((rel) => t.get(db.doc(`links/${acceptorUid}__${rel}__${toId}`))));
                    standing = receiver.ownerId === acceptorUid || links.some((l) => l.exists);
                } else {
                    standing = receiver.authorId === acceptorUid;
                }
            }
        }
        const fromTreeSnap = fromTreeId ? await t.get(db.doc(`lifetrees/${fromTreeId}`)) : null;
        const fromTree = fromTreeSnap?.exists ? (fromTreeSnap.data() as Record<string, any>) : null;
        // The OFFERER's standing over the source tree (Lumo's review, 2026-09-07): the twin block
        // lands on that chain and moves its head, so the offerer must be its keeper, co-owner or
        // steward — read here, inside the transaction, never trusted from the offering's words.
        let fromStanding = false;
        if (fromTree && authorId) {
            const fromLinks = await Promise.all(["co_owner", "steward"].map((rel) => t.get(db.doc(`links/${authorId}__${rel}__${fromTreeId}`))));
            fromStanding = fromTree.ownerId === authorId || fromLinks.some((l) => l.exists);
        }

        const judgment = judgeOfferingAccept({
            acceptorUid,
            offering: { exists: offeringSnap.exists, type: o.type, status: o.offeringStatus, active: o.offeringActive, authorId, toKind, toId, fromTreeId },
            receiver: {
                exists: !!receiver,
                standing,
                diedAtMs: receiver?.diedAt && typeof receiver.diedAt.toMillis === "function" ? receiver.diedAt.toMillis() : null,
            },
            fromTree: { exists: !!fromTree, standing: fromStanding },
        });
        if (judgment.outcome === "reject") throw new HttpsError(judgment.code, judgment.message);
        if (!receiver || !fromTree || !toKind) throw new HttpsError("failed-precondition", "The sides of this offering could not be read.");

        // The node's seal: locked nodes seal canonically, unlocked ones keep the legacy seal — the
        // same choice mintPulse makes, read from the host community the offering was made at.
        const domain = String(o.domain || "");
        let locked = false;
        if (domain) {
            const cradle = await t.get(db.collection("communities").where("domain", "==", domain).limit(1));
            locked = !!cradle.docs[0]?.data()?.chainLocked;
        }

        // The acceptor's name for the receiver-side block, by the same hand that wrote authorName elsewhere.
        const acceptorSnap = await t.get(db.doc(`users/${acceptorUid}`));
        // Anonymous acceptors are named by the being the offering was made to (the tree in context).
        const acceptorName = publicNameOf({
            displayName: acceptorSnap.data()?.displayName || acceptorSnap.data()?.name,
            anonymous: !!acceptorSnap.data()?.anonymous,
            treeName: toKind === "tree" ? receiver.name : receiver.title,
        }) || "A being";

        const { from, to } = offeringTwinBlocks({
            id: offeringId,
            lid: String(o.lid || ""),
            title: String(o.title || "An offering"),
            authorId,
            authorName: String(o.authorName || "A being"),
            domain,
            visibility: typeof o.visibility === "string" ? o.visibility : "public",
            toKind,
            toId,
            toName: String(o.offeredToName || (toKind === "tree" ? receiver.name : receiver.title) || "a being"),
            fromTreeId,
            fromTreeName: String(o.offeringFromTreeName || fromTree.name || "a tree"),
        }, { uid: acceptorUid, name: acceptorName });

        const mintedAt = Date.now();
        const seal = async (previousHash: string, record: Record<string, unknown>): Promise<string> =>
            locked ? computeCanonicalHash(previousHash, mintedAt, record) : createBlock(previousHash, record, mintedAt);

        const fromRef = db.collection("pulses").doc();
        const toRef = db.collection("pulses").doc();
        const fromRecord = { ...from, lid: mintLid(), id: fromRef.id, mintedAt, previousHash: String(fromTree.latestHash || ""), loveCount: 0, commentCount: 0 };
        const toRecord = { ...to, lid: mintLid(), id: toRef.id, mintedAt, previousHash: String(receiver.latestHash || ""), loveCount: 0, commentCount: 0 };
        const [fromHash, toHash] = await Promise.all([seal(fromRecord.previousHash, fromRecord), seal(toRecord.previousHash, toRecord)]);
        const stamp = locked ? { hashVersion: BLOCK_HASH_VERSION } : {};

        // ── writes: both twins, both heads, the offering's answer — one transaction ──
        t.set(fromRef, { ...fromRecord, ...stamp, hash: fromHash, createdAt: FieldValue.serverTimestamp() });
        t.update(db.doc(`lifetrees/${fromTreeId}`), { latestHash: fromHash, blockHeight: (Number(fromTree.blockHeight) || 0) + 1 });
        t.set(toRef, { ...toRecord, ...stamp, hash: toHash, createdAt: FieldValue.serverTimestamp() });
        t.update(db.doc(`${toKind === "tree" ? "lifetrees" : "visions"}/${toId}`), { latestHash: toHash, blockHeight: (Number(receiver.blockHeight) || 0) + 1 });
        t.update(offeringRef, {
            offeringStatus: "accepted",
            offeringAnsweredBy: acceptorUid,
            offeringAnsweredAt: FieldValue.serverTimestamp(),
            offeringAcceptedPulseIds: { from: fromRef.id, to: toRef.id },
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { fromPulseId: fromRef.id, toPulseId: toRef.id };
    });
});
