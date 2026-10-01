// invites.ts — split from index.ts (ring 2026-09-16); every function keeps its name, trigger and options.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { isSecretTree, rootsABeing, secretRoleAllowed } from "./treeKind";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { charter, NODE_ORIGIN } from "./charter";
import { publicNameOf } from "./publicName";
import { dressMailText } from "./mailVoice";
import { guardianAnswerOutcome, isLivingLifetree } from "./guardianship";
import { composeSystemEmailHtml, db, keeperLinkRef, mintLid, normalizeAnchorDomain, placeOfCommunity, voiceOf, writeMail } from "./core";

// Community join requests: when a join_request link lands (someone pressed Join on a
// community), email that community's keeper. Server-side because the keeper's email lives on
// their private user doc, which the requester can never read. The Members tab is where the
// keeper accepts or declines; this email just carries the knock to their door.
// A person's public name from persons/{uid} (world-readable): their own, or — anonymous — the
// name of their default tree (else the first tree they own). Null when nothing may be said.
const publicNameByPerson = async (uid: string, person: any | null): Promise<string | null> => {
    if (!person) return null;
    let treeName: string | null = null;
    if (person.anonymous) {
        const preferred = person.defaultTreeId ? await db.collection("lifetrees").doc(String(person.defaultTreeId)).get() : null;
        if (preferred?.exists && preferred.data()?.anchorUid === uid) treeName = String(preferred.data()?.name || "") || null;
        if (!treeName) {
            const first = await db.collection("lifetrees").where("anchorUid", "==", uid).limit(1).get();
            treeName = first.empty ? null : (String(first.docs[0].data()?.name || "") || null);
        }
    }
    return publicNameOf({ displayName: person.displayName, anonymous: !!person.anonymous, treeName });
};

export const onJoinRequestCreated = onDocumentCreated("links/{linkId}", async (event) => {
    const snap = event.data;
    if (!snap) return;
    const link = snap.data() as any;
    if (link.rel !== "join_request") return;

    try {
        const [communitySnap, personSnap, stewardSnap] = await Promise.all([
            db.collection("communities").doc(String(link.to)).get(),
            db.collection("persons").doc(String(link.from)).get(),
            // The knock reaches every door-keeper: the owner AND the delegated stewards.
            db.collection("links").where("rel", "==", "steward").where("to", "==", String(link.to)).get(),
        ]);
        if (!communitySnap.exists) return;
        const community = communitySnap.data() as any;
        const anchorUid = community.anchorUid as string;
        // Bound the fan-out: a knock reaches the owner and up to a few stewards, never an
        // unbounded blast (each recipient is one queued email against the node's quota).
        const MAX_KNOCK_RECIPIENTS = 6;
        const keeperIds = Array.from(new Set(
            [anchorUid, ...stewardSnap.docs.map((d) => (d.data() as any).from as string)]
                .filter((uid) => uid && uid !== link.from),
        )).slice(0, MAX_KNOCK_RECIPIENTS);
        if (keeperIds.length === 0) return;

        // The requester's PUBLIC name (publicName mirror): anonymous beings are named by their tree.
        const requester = (await publicNameByPerson(String(link.from), personSnap.exists ? (personSnap.data() as any) : null)) || "Someone";
        const communityName = community.name || "your community";
        const text = `${requester} asked to join ${communityName}.\n\nYou can accept or decline on the community's Members tab.`;
        const knockPlace = placeOfCommunity(community as Record<string, unknown>);
        const html = composeSystemEmailHtml(text, NODE_ORIGIN, `Open ${charter.name}`, voiceOf(knockPlace));
        await Promise.all(keeperIds.map(async (uid) => {
            const keeper = await db.collection("users").doc(uid).get();
            const email = keeper.exists ? (keeper.data() as any)?.email : null;
            if (!email) return;
            await writeMail({
                to: [email],
                subject: `${requester} asked to join ${communityName}`,
                place: knockPlace,
                html,
                text: `${dressMailText(text, voiceOf(knockPlace))}\n\n${NODE_ORIGIN}`,
                uid,
            });
        }));
    } catch (e) {
        console.error("Join-request email failed:", e);
    }
});

// --- Node membership: an accepted network invite makes the newcomer a member of the node it
// was sent from (Phase 2, "invitations carry the node"). Runs server-side so the member link is
// minted with admin rights the newcomer could not grant themselves. The ESCALATION GUARD is the
// heart of it: anyone may create a network invite and stamp any node on it, so we mint membership
// ONLY when the INVITER actually belongs to that node (its owner or a member) — otherwise a
// stranger's invite could hand out membership of a community they have nothing to do with.
export const onNetworkInviteAccepted = onDocumentUpdated("networkInvites/{inviteId}", async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    // Only the pending → accepted transition, once.
    if (before.status === "accepted" || after.status !== "accepted") return;

    const nodeCommunityId = String(after.nodeCommunityId || "");
    const memberUid = String(after.acceptedByUserId || "");
    const inviterUid = String(after.invitedByUserId || "");
    // The hand that welcomed (ring 2026-08-21): EVERY acceptance — node-bound or plain —
    // leaves newcomer __welcomed_by__ inviter. Create-if-absent (redelivery-safe), before
    // the nodeless early-return below so a plain invitation still leaves its thread.
    if (memberUid && inviterUid && memberUid !== inviterUid) {
        const welcomeRef = db.collection("links").doc(`${memberUid}__welcomed_by__${inviterUid}`);
        try {
            if (!(await welcomeRef.get()).exists) {
                await welcomeRef.set({
                    lid: mintLid(), type: "link", rel: "welcomed_by", from: memberUid, to: inviterUid,
                    inviteId: event.params.inviteId, createdAt: FieldValue.serverTimestamp(),
                });
            }
        } catch (e) { console.warn("welcomed_by mint failed:", e); }
    }
    if (!nodeCommunityId || !memberUid || !inviterUid) return; // a plain (nodeless) invite: no membership

    try {
        const [community, inviterMember] = await Promise.all([
            db.collection("communities").doc(nodeCommunityId).get(),
            db.collection("links").doc(`${inviterUid}__member__${nodeCommunityId}`).get(),
        ]);
        if (!community.exists) return;
        const inviterBelongs = (community.data() as any)?.anchorUid === inviterUid || inviterMember.exists;
        if (!inviterBelongs) {
            console.warn(`onNetworkInviteAccepted: inviter ${inviterUid} does not belong to node ${nodeCommunityId}; no membership minted for ${memberUid}.`);
            return;
        }
        // Mint TWO edges (mirrors the door's join): the `member` link (which the being may later
        // drop by leaving) and an append-only `invited_by` provenance mark (from=newcomer,
        // to=node) that survives leaving — how they arrived, who vouched. Both in a transaction
        // that creates each only when ABSENT, so Eventarc's at-least-once redelivery never rewrites
        // a stable lid or resets a join date (create-if-absent, never clobber).
        const memberRef = db.collection("links").doc(`${memberUid}__member__${nodeCommunityId}`);
        const provRef = db.collection("links").doc(`${memberUid}__invited_by__${nodeCommunityId}`);
        await db.runTransaction(async (tx) => {
            const [m, p] = await Promise.all([tx.get(memberRef), tx.get(provRef)]);
            const edge = (rel: string) => ({
                lid: mintLid(), type: "link", rel, from: memberUid, to: nodeCommunityId,
                inviteId: event.params.inviteId, invitedBy: inviterUid,
                createdAt: FieldValue.serverTimestamp(),
            });
            if (!m.exists) tx.set(memberRef, edge("member"));
            if (!p.exists) tx.set(provRef, edge("invited_by"));
        });
    } catch (e) {
        console.error("Node membership mint failed:", e);
    }
});

// --- Tree Circle: accept a keeping / guardianship invite -------------------
// Protected multi-document mutation: writes the tree's role array AND the rooted
// community. Runs with admin rights so the invitee never writes those docs directly.
const VALID_ROLES = ["keeper", "guardian", "observer", "steward"];

export const acceptTreeInvite = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be signed in.");
    }
    const uid = request.auth.uid;
    const inviteId = request.data?.inviteId;
    if (!inviteId) {
        throw new HttpsError("invalid-argument", "inviteId is required.");
    }

    return await db.runTransaction(async (tx) => {
        const inviteRef = db.collection("treeKeepingInvites").doc(inviteId);
        const inviteSnap = await tx.get(inviteRef);
        if (!inviteSnap.exists) {
            throw new HttpsError("not-found", "Invite not found.");
        }
        const invite = inviteSnap.data() as any;
        if (invite.invitedUserId !== uid) {
            throw new HttpsError("permission-denied", "This invite is not for you.");
        }
        if (invite.status !== "pending") {
            throw new HttpsError("failed-precondition", "This invite is no longer pending.");
        }

        const treeRef = db.collection("lifetrees").doc(invite.lifetreeId);
        const treeSnap = await tx.get(treeRef);
        if (!treeSnap.exists) {
            throw new HttpsError("not-found", "Lifetree not found.");
        }
        const tree = treeSnap.data() as any;

        if (!VALID_ROLES.includes(invite.role)) {
            throw new HttpsError("invalid-argument", "Unknown role.");
        }

        // GUARDIANS OF LIGHT (ring 2026-09-09, domain/guardianship mirrored in ./guardianship): a
        // guardian's YES is the tree's validation — when the guardian owns a LIVING lifetree of
        // their own, and when the tree's guardians reach the Light Path's dial
        // (config/limits.guardiansToValidate, one by default). All reads before any write.
        let validatedNow = false;
        let guardiansNeeded = 0;
        // A SECRET tree (./treeKind, ring 2026-10-02) is guarded without a living tree of one's own:
        // the proof protects light and validation, and a secret tree has neither.
        const secret = isSecretTree(tree);
        // …and its only seat is keeping: whoever is let in to see it keeps it.
        if (!secretRoleAllowed(tree, invite.role)) throw new HttpsError("failed-precondition", "secret_keepers_only");
        if (invite.role === "guardian" && !secret) {
            const asMs = (v: any): number | null => (v && typeof v.toMillis === "function" ? v.toMillis() : (typeof v === "number" ? v : null));
            const treeFacts = { treeType: tree.treeType, isNature: tree.isNature, diedAtMs: asMs(tree.diedAt) };
            const mine = await tx.get(db.collection("lifetrees").where("anchorUid", "==", uid).limit(30));
            const ownsLiving = mine.docs.some((d) => { const x = d.data() as any; return isLivingLifetree({ treeType: x.treeType, isNature: x.isNature, diedAtMs: asMs(x.diedAt) }); });
            if (!ownsLiving) throw new HttpsError("failed-precondition", "guard_no_living_tree");
            if (isLivingLifetree(treeFacts)) {
                const standing = await tx.get(db.collection("links").where("rel", "==", "guardian").where("to", "==", invite.lifetreeId));
                const after = standing.docs.filter((d) => (d.data() as any).from !== uid).length + 1;
                const limitsSnap = await tx.get(db.collection("config").doc("limits"));
                const rawDial = Number(limitsSnap.exists ? (limitsSnap.data() as any)?.guardiansToValidate : NaN);
                const dial = Number.isFinite(rawDial) && rawDial >= 1 ? Math.floor(rawDial) : 1;
                const outcome = guardianAnswerOutcome("accept", after, dial);
                guardiansNeeded = Math.max(0, dial - after);
                validatedNow = outcome.validates && !(tree.validated && tree.validatorId);
            }
        }

        // Role + membership are LINKS now (the LIN). The tree/community docs no longer carry the
        // legacy arrays. Deterministic ids keep these writes idempotent.
        // The hand that welcomed (ring 2026-08-21): every acceptance leaves
        // accepter __welcomed_by__ inviter — append-only provenance, granting nothing.
        const setWelcome = (accepterUid: string, inviterUid: string, inviteId: string) => {
            if (!inviterUid || inviterUid === accepterUid) return;
            tx.set(db.collection("links").doc(`${accepterUid}__welcomed_by__${inviterUid}`), {
                lid: mintLid(), type: "link", rel: "welcomed_by", from: accepterUid, to: inviterUid,
                inviteId, createdAt: FieldValue.serverTimestamp(),
            }, { merge: true });
        };
        const setLink = (from: string, rel: string, to: string) => {
            tx.set(db.collection("links").doc(`${from}__${rel}__${to}`), {
                lid: mintLid(),
                type: "link",
                rel,
                from,
                to,
                createdAt: FieldValue.serverTimestamp(),
            });
        };

        const treeUpdate: any = { updatedAt: FieldValue.serverTimestamp() };
        // An anchorless tree cannot form a circle (the seat that is never empty is missing — a stale
        // bundle's birth, refused by the rules since 2026-10-01): say so, never crash on undefined.
        if (invite.role !== "guardian" && (typeof tree.anchorUid !== "string" || !tree.anchorUid)) {
            throw new HttpsError("failed-precondition", "tree_no_anchor");
        }
        let communityId: string = tree.communityId;
        // A GUARDIAN is a lightweight, no-privilege FOLLOW (domain/policy, the rules) — accepting a
        // guardian invitation mints only the guardian link, never a circle community or membership.
        // The caring roles (keeper/steward) form the circle; guardianship watches over it.
        // A secret tree forms NO circle community: a community is world-readable, and its name
        // would betray the tree. Its circle is its links alone.
        if (invite.role !== "guardian" && !secret) {
            if (!communityId) {
                const communityRef = db.collection("communities").doc();
                communityId = communityRef.id;
                tx.set(communityRef, {
                    lid: mintLid(), // a community is a Being; the server-born circle gets its true name too
                    name: `${tree.name || "Lifetree"} Circle`,
                    rootLifetreeId: invite.lifetreeId,
                    anchorUid: tree.anchorUid,
                    formation: "tree_keeping",
                    visibility: "invited",
                    // A tree circle is a PRE-COMMUNITY: a real community Being with NO address.
                    // Its locus is rootLifetreeId; the garden stays the TREE's relation (the
                    // tree's own domain and grows_in links). Inheriting tree.domain here once
                    // made a newborn circle claim a whole face's domain (ring 2026-08-28).
                    domain: "",
                    papers: [],
                    imageUrls: [],
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
                setLink(tree.anchorUid, "member", communityId); // the founder is a member of the circle
                treeUpdate.communityId = communityId;
            }
            setLink(uid, "member", communityId);      // the invitee joins the circle community
        }
        setLink(uid, invite.role, invite.lifetreeId); // ...and takes their tree-circle role (or guardianship)
        setWelcome(uid, String(invite.invitedByUserId || ""), inviteId); // the hand that welcomed
        if (validatedNow) {
            // The stamp the shell already reads (validated + validatorId), set by the guardian's yes —
            // the validatorId names the guardian, so the old badge and the new law say one thing.
            treeUpdate.validated = true;
            treeUpdate.validatorId = uid;
            treeUpdate.validatedAt = FieldValue.serverTimestamp();
            treeUpdate.validatedBy = "guardian";
        }
        // Relations live ONLY in the links collection (the single source of truth the rules +
        // resolveCircleUids read). No legacy role arrays are written.

        tx.update(treeRef, treeUpdate);
        tx.update(inviteRef, {
            status: "accepted",
            acceptedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        return { communityId, lifetreeId: invite.lifetreeId, validated: validatedNow, guardiansNeeded };
    });
});

// ── The keeper circle (ring 2026-08-12, domain/keeperCircle) ─────────────────────────────
// A community is KEPT, and keeping can be shared, handed over, and asked for. The founding
// anchorUid and every `keeper` link holder are FULL PEERS (rules keepsCommunity). Keeper
// links are minted ONLY here — after proving the newcomer owns a living tree — and the one
// invariant these three hands defend together: a community is never keeperless.

// A keeper is a rooted being: at least one living tree of their own (a BED is furniture).
// A rooted being KEEPS a living tree (domain/keeperCircle keeperRefusal, ring 2026-09-29): as
// its first keeper, or as a keeper — a keeper link the first keeper offered and they
// accepted. Co-keeping counts because keeping, not owning, is what roots a being; a bed never does.
const keepsLivingTree = async (uid: string): Promise<boolean> => {
    const own = await db.collection("lifetrees").where("anchorUid", "==", uid).limit(10).get();
    // A bed is furniture and a secret tree grants nothing outside itself: neither roots a being.
    if (own.docs.some((d) => rootsABeing(d.data()))) return true;
    const co = await db.collection("links").where("from", "==", uid).where("rel", "==", "keeper").limit(10).get();
    for (const l of co.docs) {
        const tree = await db.collection("lifetrees").doc(String((l.data() as any).to || "")).get();
        if (tree.exists && rootsABeing(tree.data())) return true;
    }
    return false;
};

const mintKeeperLinks = (tx: FirebaseFirestore.Transaction, uid: string, communityId: string) => {
    // Keeper implies member — a keeper who cannot stand inside their own community is a
    // contradiction. Deterministic ids keep both writes idempotent.
    for (const rel of ["keeper", "member"] as const) {
        tx.set(db.collection("links").doc(`${uid}__${rel}__${communityId}`), {
            lid: mintLid(), type: "link", rel, from: uid, to: communityId,
            createdAt: FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    // THE KEEPER MIRROR (ring 2026-09-07): `keeperUids` on the community document is a
    // server-kept INDEX of the keeper links — never the relationship itself (the LIN link is)
    // — written here and unwritten in resignKeeper, frozen against client hands in
    // firestore.rules. It exists for storage.rules alone: a Storage evaluation may read at most
    // two Firestore documents, and the staff lookup already spends one, so the keeper's proof
    // must ride on the community document it reads anyway.
    tx.set(db.collection("communities").doc(communityId), { keeperUids: FieldValue.arrayUnion(uid) }, { merge: true });
};

// The invitee ACCEPTS a keeper offer (communityKeeperInvites) — consent, never appointment.
export const acceptKeeperInvite = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const uid = request.auth.uid;
    const inviteId = String(request.data?.inviteId || "");
    if (!inviteId) throw new HttpsError("invalid-argument", "inviteId is required.");
    if (!(await keepsLivingTree(uid))) {
        throw new HttpsError("failed-precondition", "no_tree"); // a keeper is a rooted being
    }
    return await db.runTransaction(async (tx) => {
        const inviteRef = db.collection("communityKeeperInvites").doc(inviteId);
        const invite = (await tx.get(inviteRef)).data() as any;
        if (!invite) throw new HttpsError("not-found", "Invite not found.");
        if (invite.invitedUserId !== uid) throw new HttpsError("permission-denied", "This invite is not for you.");
        if (invite.status !== "pending") throw new HttpsError("failed-precondition", "This invite is no longer pending.");
        const community = (await tx.get(db.collection("communities").doc(invite.communityId))).data() as any;
        if (!community) throw new HttpsError("not-found", "Community not found.");
        if (community.anchorUid === uid || (await tx.get(keeperLinkRef(uid, invite.communityId))).exists) {
            throw new HttpsError("failed-precondition", "already_keeper");
        }
        mintKeeperLinks(tx, uid, invite.communityId);
        // The hand that welcomed (ring 2026-08-21) — keepership arrived through this invite.
        const kInviter = String(invite.invitedByUserId || "");
        if (kInviter && kInviter !== uid) {
            tx.set(db.collection("links").doc(`${uid}__welcomed_by__${kInviter}`), {
                lid: mintLid(), type: "link", rel: "welcomed_by", from: uid, to: kInviter,
                inviteId, createdAt: FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        tx.update(inviteRef, { status: "accepted", acceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        return { communityId: invite.communityId };
    });
});

// A sitting keeper ANSWERS a keepership knock (a `keeper_request` link) with yes.
export const acceptKeeperRequest = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const uid = request.auth.uid;
    const communityId = String(request.data?.communityId || "");
    const requesterUid = String(request.data?.requesterUid || "");
    if (!communityId || !requesterUid) throw new HttpsError("invalid-argument", "communityId and requesterUid are required.");
    if (!(await keepsLivingTree(requesterUid))) {
        throw new HttpsError("failed-precondition", "no_tree");
    }
    return await db.runTransaction(async (tx) => {
        const community = (await tx.get(db.collection("communities").doc(communityId))).data() as any;
        if (!community) throw new HttpsError("not-found", "Community not found.");
        const callerIsKeeper = community.anchorUid === uid || (await tx.get(keeperLinkRef(uid, communityId))).exists;
        if (!callerIsKeeper) throw new HttpsError("permission-denied", "Only a keeper answers a keepership knock.");
        const requestRef = db.collection("links").doc(`${requesterUid}__keeper_request__${communityId}`);
        if (!(await tx.get(requestRef)).exists) throw new HttpsError("not-found", "No such request.");
        if (community.anchorUid === requesterUid || (await tx.get(keeperLinkRef(requesterUid, communityId))).exists) {
            throw new HttpsError("failed-precondition", "already_keeper");
        }
        mintKeeperLinks(tx, requesterUid, communityId);
        tx.delete(requestRef); // the knock is answered — the door opened
        return { communityId, keeperUid: requesterUid };
    });
});

// A keeper RESIGNS — only with company (never keeperless). A keeper-link holder simply
// loses their link; the ANCHOR (anchorUid) hands the anchor to the longest-standing keeper
// (oldest link, ties by uid — mirrors domain/keeperCircle.successorAmong exactly).
export const resignKeeper = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const uid = request.auth.uid;
    const communityId = String(request.data?.communityId || "");
    if (!communityId) throw new HttpsError("invalid-argument", "communityId is required.");
    return await db.runTransaction(async (tx) => {
        const communityRef = db.collection("communities").doc(communityId);
        const community = (await tx.get(communityRef)).data() as any;
        if (!community) throw new HttpsError("not-found", "Community not found.");
        const linksSnap = await tx.get(
            db.collection("links").where("rel", "==", "keeper").where("to", "==", communityId));
        const keeperLinks = linksSnap.docs
            .map((d) => ({ from: (d.data() as any).from as string, createdAtMs: (d.data() as any).createdAt?.toMillis?.() || 0, ref: d.ref }))
            .filter((l) => l.from !== community.anchorUid); // a stray anchor-duplicate is not company
        const isAnchor = community.anchorUid === uid;
        const ownLink = keeperLinks.find((l) => l.from === uid);
        if (!isAnchor && !ownLink) throw new HttpsError("permission-denied", "You are not a keeper here.");
        // A link-holder's resignation always leaves the anchor standing; only the anchor
        // needs company (a successor) to leave — the invariant lives in these two branches.
        if (isAnchor) {
            if (keeperLinks.length === 0) throw new HttpsError("failed-precondition", "last_keeper");
            const successor = [...keeperLinks].sort((a, b) =>
                a.createdAtMs - b.createdAtMs || (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))[0];
            tx.update(communityRef, { anchorUid: successor.from, keeperUids: FieldValue.arrayRemove(successor.from), updatedAt: FieldValue.serverTimestamp() });
            tx.delete(successor.ref); // the successor IS the anchor now; the link would double-count them
            return { resigned: uid, successor: successor.from };
        }
        tx.delete(ownLink!.ref); // anchorUid remains — never keeperless by construction
        tx.update(communityRef, { keeperUids: FieldValue.arrayRemove(uid), updatedAt: FieldValue.serverTimestamp() });
        return { resigned: uid, successor: null };
    });
});

// ── A tree's keeper RESIGNS (ring 2026-09-29) — the community's law, on a tree ─────────────
// Keepers are equal, and a tree is never keeperless: a keeper-link holder simply loses their
// link; the ANCHOR (anchorUid — the hand that planted, named by the history) hands the anchor to
// the longest-standing keeper (oldest link, ties by uid — domain/keeperCircle.successorAmong),
// and refuses to leave alone. The rules freeze anchorUid to every client; only this hand moves it.
export const resignTreeKeeper = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const uid = request.auth.uid;
    const treeId = String(request.data?.treeId || "");
    if (!treeId) throw new HttpsError("invalid-argument", "treeId is required.");
    return await db.runTransaction(async (tx) => {
        const treeRef = db.collection("lifetrees").doc(treeId);
        const tree = (await tx.get(treeRef)).data() as any;
        if (!tree) throw new HttpsError("not-found", "Lifetree not found.");
        const linksSnap = await tx.get(db.collection("links").where("rel", "==", "keeper").where("to", "==", treeId));
        const keeperLinks = linksSnap.docs
            .map((d) => ({ from: (d.data() as any).from as string, createdAtMs: (d.data() as any).createdAt?.toMillis?.() || 0, ref: d.ref }))
            .filter((l) => l.from !== tree.anchorUid);
        const isAnchor = tree.anchorUid === uid;
        const ownLink = keeperLinks.find((l) => l.from === uid);
        if (!isAnchor && !ownLink) throw new HttpsError("permission-denied", "You are not a keeper of this tree.");
        if (isAnchor) {
            if (keeperLinks.length === 0) throw new HttpsError("failed-precondition", "tree_last_keeper");
            const successor = [...keeperLinks].sort((a, b) =>
                a.createdAtMs - b.createdAtMs || (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))[0];
            tx.update(treeRef, { anchorUid: successor.from, updatedAt: FieldValue.serverTimestamp() });
            tx.delete(successor.ref); // the successor IS the anchor now; the link would double-count them
            return { resigned: uid, successor: successor.from };
        }
        tx.delete(ownLink!.ref); // anchorUid remains — never keeperless by construction
        return { resigned: uid, successor: null };
    });
});

// ── Circle graduation (domain/treeCircle formCircleRefusal) ─────────────────────────────
// A tree circle GRADUATES into a standing community by the hands that carry it: the keeper
// circle, or a keeper of the root tree. Forming chooses the name, opens visibility, and
// stamps provenance — bornOn = the garden where the root tree stands (presence on that
// face's list WITHOUT claiming its domain), formedAt/formedBy by this hand alone (the
// rules freeze both against clients). Forming grants no keepership: the anchor stays.
export const formCommunityFromCircle = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const uid = request.auth.uid;
    const communityId = String(request.data?.communityId || "");
    const name = String(request.data?.name || "").trim().slice(0, 120);
    if (!communityId) throw new HttpsError("invalid-argument", "communityId is required.");
    const communityRef = db.collection("communities").doc(communityId);
    const community = (await communityRef.get()).data();
    if (!community) throw new HttpsError("not-found", "Community not found.");
    if (community.formation !== "tree_keeping") throw new HttpsError("failed-precondition", "not_circle");
    if (community.formedAt) throw new HttpsError("failed-precondition", "already_formed");
    const rootTreeId = String(community.rootLifetreeId || "");
    const isKeeper = community.anchorUid === uid
        || (await keeperLinkRef(uid, communityId).get()).exists;
    const isTreeKeeper = !!rootTreeId
        && (await db.collection("links").doc(`${uid}__keeper__${rootTreeId}`).get()).exists;
    if (!isKeeper && !isTreeKeeper) throw new HttpsError("permission-denied", "not_hand");
    const tree = rootTreeId ? (await db.collection("lifetrees").doc(rootTreeId).get()).data() : null;
    const bornOn = normalizeAnchorDomain(String(tree?.domain || "")); // the garden, never the claim
    await communityRef.update({
        ...(name ? { name } : {}),
        ...(bornOn ? { bornOn } : {}),
        visibility: "public",
        formedAt: FieldValue.serverTimestamp(),
        formedBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
    });
    return { communityId, name: name || String(community.name || ""), bornOn: bornOn || null };
});

// Request an invitation (callable, may be unauthenticated). With admin rights it checks
// whether a pending invite or request already exists for the email before creating one.
// Returns { status: 'created' | 'pending_invite_exists' | 'already_requested' }.
export const requestInvite = onCall({ cors: true }, async (request) => {
    const email = String(request.data?.email || "").trim().toLowerCase();
    const reason = String(request.data?.reason || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new HttpsError("invalid-argument", "Please provide a valid email.");
    }
    const invites = await db.collection("networkInvites").where("email", "==", email).get();
    if (invites.docs.some((d) => d.data().status === "pending")) {
        return { status: "pending_invite_exists" };
    }
    const reqs = await db.collection("inviteRequests").where("email", "==", email).get();
    if (reqs.docs.some((d) => d.data().status === "pending")) {
        return { status: "already_requested" };
    }
    await db.collection("inviteRequests").add({
        email,
        reason,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
    });
    return { status: "created" };
});
