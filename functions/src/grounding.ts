// THE GROUND'S THREE HANDS (domain/grounding, 2026-11-17). Every step of a grounding is the
// server's, because every step has a law the rules cannot count or compare:
//   askGround     — the vision's author knocks at a tree (a `ground_request` link);
//   acceptGround  — a keeper or steward of the tree says yes: the `grounded_in` link is minted,
//                   the knock let go, one block written on each chain;
//   releaseGround — either side ends a standing ground: the link goes, a second pair of blocks
//                   stays. A ground whose vision or tree is gone is let go by the side that remains.
// No client hand creates a knock or a ground (the rules name no create clause for either, and
// staff's link_mint hand is closed to `grounded_in`); a knock may be withdrawn or declined by a
// client (rules), a ground only here.
//
// Everything is read inside the transaction: the two beings, the knock, the standing of the hand
// over the tree (anchor, or a keeper / steward link — the rules' isTreeCarer), and the counts.
// Nothing is taken from the request but the two ids.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentDeletedWithAuthContext } from "firebase-functions/v2/firestore";
import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { db, mintLid, tsToMs } from "./core";
import { charter } from "./charter";
import { publicNameOf } from "./publicName";
import { stageBlock } from "./blocks";
import { chainHeadOf, heightAfter } from "./birth";
import {
    GROUNDED_IN, GROUND_REQUEST, groundAskRefusal, groundAcceptRefusal, groundReleaseRefusal, groundMarkOf, groundBlocksOf, visionGoneGroundProse,
    type GroundAct,
} from "../../src/domain/grounding";
import type { DomainKey } from "../../src/domain/words";

type Doc = Record<string, any>;

const REFUSAL_CODE: Partial<Record<DomainKey, "not-found" | "permission-denied" | "failed-precondition" | "resource-exhausted" | "already-exists">> = {
    ground_no_request: "not-found",
    ground_not_standing: "not-found",
    ground_ask_author_only: "permission-denied",
    ground_accept_carer_only: "permission-denied",
    ground_release_not_yours: "permission-denied",
    ground_already: "already-exists",
    ground_already_asked: "already-exists",
    ground_vision_full: "resource-exhausted",
    ground_tree_full: "resource-exhausted",
};
// EVERY REFUSAL IS A KEY: the message a hand receives is a dictionary key the shell says in its
// own tongue (speak()), never an English sentence.
const refuse = (key: DomainKey): never => { throw new HttpsError(REFUSAL_CODE[key] ?? "failed-precondition", key); };

const idsOf = (data: unknown): { visionId: string; treeId: string } => {
    const visionId = (data as Doc)?.visionId, treeId = (data as Doc)?.treeId;
    if (typeof visionId !== "string" || !visionId || typeof treeId !== "string" || !treeId
        || visionId.includes("/") || treeId.includes("/") || visionId.includes("__") || treeId.includes("__")) {
        throw new HttpsError("invalid-argument", "ground_no_request");
    }
    return { visionId, treeId };
};

const linkRef = (visionId: string, rel: string, treeId: string) => db.doc(`links/${visionId}__${rel}__${treeId}`);
const linksOf = (end: "from" | "to", id: string, rel: string) => db.collection("links").where(end, "==", id).where("rel", "==", rel);

// The hand's standing over the tree: its anchor, or a keeper / steward link. A secret tree's seats
// live elsewhere and are not read: a secret tree grounds no one, and the law refuses it by kind.
const caresForTree = async (t: Transaction, uid: string, treeId: string, tree: Doc): Promise<boolean> => {
    if (tree.anchorUid === uid) return true;
    const links = await Promise.all(["keeper", "steward"].map((rel) => t.get(db.doc(`links/${uid}__${rel}__${treeId}`))));
    return links.some((l) => l.exists);
};

// A being's visibility as the law reads it: absent is the legacy 'public'; anything that is not
// a string is unreadable, and the law reads an unknown word as hidden.
const visibilityOf = (being: Doc): string | null =>
    being.visibility === undefined || being.visibility === null ? null : typeof being.visibility === "string" ? being.visibility : "unreadable";

const treeFactsOf = (tree: Doc) => ({
    treeType: typeof tree.treeType === "string" ? tree.treeType : null,
    visibility: visibilityOf(tree),
    diedAtMs: tree.diedAt ? (tsToMs(tree.diedAt) || 1) : null,
});
const visionFactsOf = (vision: Doc) => ({ authorId: String(vision.authorId || ""), visibility: visibilityOf(vision) });

const nameOf = async (t: Transaction, uid: string, speaksFor: string): Promise<string> => {
    const snap = await t.get(db.doc(`users/${uid}`));
    return publicNameOf({ displayName: snap.data()?.displayName || snap.data()?.name, anonymous: !!snap.data()?.anonymous, treeName: speaksFor }) || "A being";
};

// The blocks of one act, staged on the transaction — block and head together on each chain that
// still exists. CALL ONLY AFTER EVERY READ: stageBlock writes.
const stageGroundBlocks = async (t: Transaction, p: {
    act: GroundAct; visionId: string; treeId: string; vision: Doc | null; tree: Doc | null;
    actorUid: string; actorName: string; self: boolean;
    // The vision's last record when it has just been released: it lends its title and its
    // visibility to the tree's block, and has no chain left to take one (`vision` is then null).
    goneVision?: Doc;
}) => {
    const treeName = String(p.tree?.name || "a tree");
    const said = p.vision ?? p.goneVision ?? null;
    const visionTitle = String(said?.title || "a vision");
    const grounded = p.act === "grounded";
    const blocks = groundBlocksOf({
        act: p.act,
        vision: { id: p.visionId, visibility: said ? visibilityOf(said) : null },
        tree: { id: p.treeId, visibility: p.tree ? visibilityOf(p.tree) : null },
        actor: { uid: p.actorUid, name: p.actorName },
        self: p.self,
    }, p.goneVision ? visionGoneGroundProse(p.actorName, visionTitle, treeName) : {
        title: grounded ? "A vision takes ground" : "A ground is released",
        treeBody: grounded ? `${p.actorName} grounded the vision "${visionTitle}" in ${treeName}.` : `${p.actorName} released the vision "${visionTitle}" from ${treeName}.`,
        visionBody: grounded ? `${p.actorName} grounded this vision in the tree "${treeName}".` : `${p.actorName} released this vision from the tree "${treeName}".`,
    });

    const mintedAt = Date.now();
    const { authorId: treeAuthor, ...treeContent } = blocks.tree;
    const { authorId: visionAuthor, ...visionContent } = blocks.vision;
    const [treeBlock, visionBlock] = await Promise.all([
        p.tree ? stageBlock(t, {
            on: "tree", bearerId: p.treeId, content: treeContent, authorId: treeAuthor,
            previousHash: chainHeadOf(p.tree), blockHeight: heightAfter(p.tree),
            domain: String(p.tree.domain || charter.domain), mintedAt,
        }) : null,
        p.vision ? stageBlock(t, {
            on: "vision", bearerId: p.visionId, content: { ...visionContent, visionTitle }, authorId: visionAuthor,
            previousHash: chainHeadOf(p.vision), blockHeight: heightAfter(p.vision),
            domain: String(p.vision.domain || charter.domain), mintedAt,
        }) : null,
    ]);
    return { treePulseId: treeBlock?.ref.id ?? null, visionPulseId: visionBlock?.ref.id ?? null };
};

// ── askGround: the vision's author knocks at a tree ───────────────────────────────────────────
export const askGround = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "ground_signin");
    const uid = request.auth.uid;
    const { visionId, treeId } = idsOf(request.data);

    return db.runTransaction(async (t) => {
        const [visionSnap, treeSnap, askSnap, groundSnap, grounds, asks] = await Promise.all([
            t.get(db.doc(`visions/${visionId}`)), t.get(db.doc(`lifetrees/${treeId}`)),
            t.get(linkRef(visionId, GROUND_REQUEST, treeId)), t.get(linkRef(visionId, GROUNDED_IN, treeId)),
            t.get(linksOf("from", visionId, GROUNDED_IN)), t.get(linksOf("from", visionId, GROUND_REQUEST)),
        ]);
        // One answer for "no such vision", "not yours" and "no such tree": the knock is no oracle
        // for which ids exist.
        if (!visionSnap.exists || !treeSnap.exists) throw new HttpsError("permission-denied", "ground_ask_author_only");

        const refusal = groundAskRefusal({
            askerUid: uid, vision: visionFactsOf(visionSnap.data() as Doc), tree: treeFactsOf(treeSnap.data() as Doc),
            alreadyGrounded: groundSnap.exists, pendingRequest: askSnap.exists,
            visionGroundCount: grounds.size, visionAskCount: asks.size,
        });
        if (refusal) refuse(refusal);

        t.set(linkRef(visionId, GROUND_REQUEST, treeId), {
            lid: mintLid(), type: "link", rel: GROUND_REQUEST, from: visionId, to: treeId,
            requestedBy: uid, createdAt: FieldValue.serverTimestamp(),
        });
        return { asked: true };
    });
});

// ── acceptGround: a carer of the tree says yes to a vision's standing ask ─────────────────────
export const acceptGround = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "ground_signin");
    const uid = request.auth.uid;
    const { visionId, treeId } = idsOf(request.data);

    return db.runTransaction(async (t) => {
        // ── all reads first ──
        const [visionSnap, treeSnap, askSnap, groundSnap] = await Promise.all([
            t.get(db.doc(`visions/${visionId}`)), t.get(db.doc(`lifetrees/${treeId}`)),
            t.get(linkRef(visionId, GROUND_REQUEST, treeId)), t.get(linkRef(visionId, GROUNDED_IN, treeId)),
        ]);
        if (!visionSnap.exists || !treeSnap.exists) throw new HttpsError("not-found", "ground_no_request");
        const vision = visionSnap.data() as Doc, tree = treeSnap.data() as Doc;
        const [cares, visionGrounds, treeGrounds] = await Promise.all([
            caresForTree(t, uid, treeId, tree),
            t.get(linksOf("from", visionId, GROUNDED_IN)), t.get(linksOf("to", treeId, GROUNDED_IN)),
        ]);
        const asked = askSnap.exists ? askSnap.data()?.requestedBy : null;

        const refusal = groundAcceptRefusal({
            accepterUid: uid, accepterCaresForTree: cares,
            requestedBy: typeof asked === "string" && asked ? asked : null,
            vision: visionFactsOf(vision), tree: treeFactsOf(tree),
            alreadyGrounded: groundSnap.exists, visionGroundCount: visionGrounds.size, treeVisionCount: treeGrounds.size,
        });
        if (refusal) refuse(refusal);

        const authorId = String(vision.authorId);
        const mark = groundMarkOf({ accepterUid: uid, vision: { authorId } });
        const actorName = await nameOf(t, uid, String(tree.name || ""));

        // ── writes: the two blocks and heads, the ground, the knock let go ──
        const pulses = await stageGroundBlocks(t, { act: "grounded", visionId, treeId, vision, tree, actorUid: uid, actorName, self: mark.self });
        t.set(linkRef(visionId, GROUNDED_IN, treeId), {
            lid: mintLid(), type: "link", rel: GROUNDED_IN, from: visionId, to: treeId,
            self: mark.self, birth: mark.birth, requestedBy: authorId, acceptedBy: uid,
            groundedPulseIds: { tree: pulses.treePulseId, vision: pulses.visionPulseId },
            createdAt: FieldValue.serverTimestamp(),
        });
        t.delete(linkRef(visionId, GROUND_REQUEST, treeId));
        return { ...pulses, self: mark.self };
    });
});

// ── releaseGround: either side lets a standing ground go ──────────────────────────────────────
export const releaseGround = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "ground_signin");
    const uid = request.auth.uid;
    const { visionId, treeId } = idsOf(request.data);

    return db.runTransaction(async (t) => {
        const [visionSnap, treeSnap, groundSnap] = await Promise.all([
            t.get(db.doc(`visions/${visionId}`)), t.get(db.doc(`lifetrees/${treeId}`)), t.get(linkRef(visionId, GROUNDED_IN, treeId)),
        ]);
        const vision = visionSnap.exists ? (visionSnap.data() as Doc) : null;
        const tree = treeSnap.exists ? (treeSnap.data() as Doc) : null;
        const ground = groundSnap.exists ? (groundSnap.data() as Doc) : null;
        const cares = tree ? await caresForTree(t, uid, treeId, tree) : false;
        // The vision's author now — or, when the vision is gone, the hand the ground remembers.
        const visionAuthorId = vision ? String(vision.authorId || "") : typeof ground?.requestedBy === "string" ? ground.requestedBy : "";

        const refusal = groundReleaseRefusal({ uid, visionAuthorId: visionAuthorId || null, caresForTree: cares, grounded: !!ground });
        if (refusal) refuse(refusal);

        const actorName = await nameOf(t, uid, String(cares ? tree?.name || "" : vision?.title || ""));
        const pulses = await stageGroundBlocks(t, { act: "released", visionId, treeId, vision, tree, actorUid: uid, actorName, self: !!ground?.self });
        t.delete(linkRef(visionId, GROUNDED_IN, treeId));
        return pulses;
    });
});

// ── A VISION IS GONE: its grounds end with it (ring 2026-11-18; domain/grounding) ─────────────
// A vision is deleted by a client hand under the rules (its author, or staff) or by the server
// (an account's departure). Whichever hand it was, this trigger ends what the vision left
// standing: every `grounded_in` link is removed with ONE block on the tree's chain, in one
// transaction per tree, and every knock is withdrawn. Idempotent — a delivery repeated finds the
// link gone and writes nothing. The block's author is the hand that deleted the vision when the
// event names a signed-in user; otherwise the vision's own author.
export const onVisionDeleted = onDocumentDeletedWithAuthContext("visions/{visionId}", async (event) => {
    const gone = event.data?.data() as Doc | undefined;
    const visionId = event.params.visionId;
    if (!gone) return;
    const authorId = typeof gone.authorId === "string" ? gone.authorId : "";
    // The event names the principal that deleted the record. It is believed only when it is a
    // person of this node (users/{authId} exists) and not a service account or the system; any
    // other origin (the admin SDK, a TTL, an unreadable context) is no nameable hand, and the
    // vision's author stands for it. How the platform labels a signed-in person's authType was
    // not verified against a live delete (2026-11-18); the users/{authId} check is the guard.
    const claimed = event.authType !== "service_account" && event.authType !== "system" && typeof event.authId === "string" ? event.authId : "";
    const actorUid = claimed && !claimed.includes("/") && (await db.doc(`users/${claimed}`).get()).exists ? claimed : authorId;
    const [grounds, knocks] = await Promise.all([linksOf("from", visionId, GROUNDED_IN).get(), linksOf("from", visionId, GROUND_REQUEST).get()]);
    await Promise.all(knocks.docs.map((d) => d.ref.delete()));
    for (const link of grounds.docs) {
        const treeId = String(link.data().to || "");
        if (!treeId) { await link.ref.delete(); continue; }
        await db.runTransaction(async (t) => {
            const [groundSnap, treeSnap] = await Promise.all([t.get(link.ref), t.get(db.doc(`lifetrees/${treeId}`))]);
            if (!groundSnap.exists) return;
            const tree = treeSnap.exists ? (treeSnap.data() as Doc) : null;
            // Without a hand to name, the ground still ends; the chain simply carries no block for it.
            if (tree && actorUid) {
                const actorName = await nameOf(t, actorUid, String(gone.title || ""));
                await stageGroundBlocks(t, { act: "released", visionId, treeId, vision: null, tree, actorUid, actorName, self: !!groundSnap.data()?.self, goneVision: gone });
            }
            t.delete(link.ref);
        });
    }
});
