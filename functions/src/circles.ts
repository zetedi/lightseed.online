// CIRCLES FROM GATHERINGS (rings 2026-09-27). A tree circle grows from shared care (invites.ts
// births it; formCommunityFromCircle graduates it). An EVENT CIRCLE grows from shared presence:
// the trees that stood around a gathering — across its whole LINEAGE — become, by the host's
// hand, a community; the root occurrence remembers the circle, every later occurrence gathers
// its newcomers into it. And the lineage itself is born here: duplicateEvent copies an
// occurrence and mints the one edge (descends_from) no client hand may claim.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { rootsABeing } from "./treeKind";
import { FieldValue, type Transaction, type DocumentSnapshot } from "firebase-admin/firestore";
import { db, isStaffUid, mintLid, keeperLinkRef } from "./core";
import { createBlock } from "./chain";
import { publicNameOf } from "./publicName";
import { judgeEventCircle, eventCircleDraft, eventCircleMemberUids, lineageRootOf, lineageOfCopy } from "./eventCircle";

const DEFAULT_MAX_NODE_COMMUNITIES = 144; // domain/limits DEFAULT_MAX_NODE_COMMUNITIES

// The hand over an event: its author; the keeper (owner or keeper link) of its community; staff.
const readHand = async (t: Transaction, ev: Record<string, unknown>, uid: string, isStaff: boolean): Promise<boolean> => {
    if (isStaff || ev.authorId === uid) return true;
    const communityId = typeof ev.communityId === "string" ? ev.communityId : "";
    if (!communityId) return false;
    const [c, k] = await Promise.all([t.get(db.doc(`communities/${communityId}`)), t.get(keeperLinkRef(uid, communityId))]);
    return c.exists && (c.data()?.anchorUid === uid || k.exists);
};

// The fields a copy carries from its parent: the gathering's own words and frame, never its
// lineage, seal, author, memory of a circle or off-chain state.
const COPIED_EVENT_FIELDS = ['title', 'body', 'content', 'imageUrl', 'imageUrls', 'eventDate', 'eventLocation', 'eventMaxParticipants', 'webLinks', 'visibility', 'communityId', 'communityName', 'domain'] as const;

// ── duplicateEvent: a new occurrence, descending from this one ───────────────────────────
export const duplicateEvent = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const uid = request.auth.uid;
    const eventId = String(request.data?.eventId || "");
    if (!eventId) throw new HttpsError("invalid-argument", "event_circle_not_event");
    const isStaff = await isStaffUid(uid);

    return db.runTransaction(async (t) => {
        const parentSnap = await t.get(db.doc(`pulses/${eventId}`));
        const parent = (parentSnap.data() ?? {}) as Record<string, unknown>;
        if (!parentSnap.exists || parent.type !== "event") throw new HttpsError("not-found", "event_circle_not_event");
        if (!(await readHand(t, parent, uid, isStaff))) throw new HttpsError("permission-denied", "event_duplicate_not_hand");
        const userSnap = await t.get(db.doc(`users/${uid}`));
        const u = (userSnap.data() ?? {}) as Record<string, unknown>;

        const body: Record<string, unknown> = {};
        for (const k of COPIED_EVENT_FIELDS) if (parent[k] !== undefined && parent[k] !== null) body[k] = parent[k];
        const communityId = typeof parent.communityId === "string" ? parent.communityId : "";
        const payload = {
            ...body,
            type: "event",
            visibility: typeof parent.visibility === "string" ? parent.visibility : "public",
            authorId: uid,
            authorName: publicNameOf({ displayName: (u.displayName as string) || (u.name as string), anonymous: !!u.anonymous }) || "A being",
            ...(typeof u.photoURL === "string" && u.photoURL ? { authorPhoto: u.photoURL } : {}),
            ...lineageOfCopy({ id: parentSnap.id, lineageRootId: parent.lineageRootId as string | undefined, generation: parent.generation as number | undefined }),
        };
        const mintedAt = Date.now();
        const root = communityId ? "COMMUNITY_EVENT" : "EVENT"; // the same standalone roots the browser's creators use
        const hash = await createBlock(root, payload, mintedAt);
        const ref = db.collection("pulses").doc();
        const record = { ...payload, lid: mintLid(), id: ref.id, loveCount: 0, commentCount: 0, mintedAt, previousHash: root, hash };
        t.set(ref, { ...record, createdAt: FieldValue.serverTimestamp() });
        // THE EDGE: the copy names what it was copied from — the lineage's one truth.
        t.set(db.collection("links").doc(`${ref.id}__descends_from__${parentSnap.id}`), {
            lid: mintLid(), type: "link", rel: "descends_from", from: ref.id, to: parentSnap.id, createdAt: FieldValue.serverTimestamp(),
        });
        return record;
    });
});

// ── formCircleFromEvent: form at the root, or gather the lineage's people into the circle ──
export const formCircleFromEvent = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const uid = request.auth.uid;
    const eventId = String(request.data?.eventId || "");
    const name = typeof request.data?.name === "string" ? request.data.name : "";
    if (!eventId) throw new HttpsError("invalid-argument", "event_circle_not_event");
    const isStaff = await isStaffUid(uid);

    return db.runTransaction(async (t) => {
        // ── all reads first ──
        const eventRef = db.doc(`pulses/${eventId}`);
        const eventSnap = await t.get(eventRef);
        const ev = (eventSnap.data() ?? {}) as Record<string, unknown>;
        const isEvent = eventSnap.exists && ev.type === "event";
        const isHand = isEvent ? await readHand(t, ev, uid, isStaff) : false;

        // The lineage: the root occurrence and every occurrence descending from it.
        const rootId = lineageRootOf({ id: eventSnap.id, lineageRootId: ev.lineageRootId as string | undefined });
        const rootSnap = rootId === eventSnap.id ? eventSnap : await t.get(db.doc(`pulses/${rootId}`));
        const root = (rootSnap.data() ?? {}) as Record<string, unknown>;
        const descendants = isEvent ? await t.get(db.collection("pulses").where("lineageRootId", "==", rootId)) : null;
        const occurrenceIds = Array.from(new Set([rootId, ...(descendants ? descendants.docs.map((d) => d.id) : [])]));
        const linkSnaps = await Promise.all(occurrenceIds.map((id) => t.get(db.collection("links").where("to", "==", id).where("rel", "==", "participant"))));
        const treeIds = Array.from(new Set(linkSnaps.flatMap((s) => s.docs.map((d) => String((d.data() as Record<string, unknown>).from || ""))).filter(Boolean)));
        const trees = await Promise.all(treeIds.map((id) => t.get(db.doc(`lifetrees/${id}`))));
        const standing: DocumentSnapshot[] = trees.filter((s) => s.exists && rootsABeing(s.data()));

        const judgment = judgeEventCircle({ isEvent, isHand, rootCircleCommunityId: root.circleCommunityId, participantTreeCount: standing.length });
        if (judgment.outcome === "reject") {
            throw new HttpsError(judgment.refusal === "event_circle_not_hand" ? "permission-denied" : judgment.refusal === "event_circle_not_event" ? "not-found" : "failed-precondition", judgment.refusal);
        }
        const owners = standing.map((s) => (s.data() as Record<string, unknown>).anchorUid as string | undefined);
        const members = eventCircleMemberUids(uid, owners);

        if (judgment.outcome === "gather") {
            // The circle stands at the root: gather the newcomers, remember it on this occurrence.
            const communityId = judgment.communityId;
            const existing = await Promise.all(members.map((m) => t.get(db.doc(`links/${m}__member__${communityId}`))));
            const standingLinks = await Promise.all(standing.map((s) => t.get(db.doc(`links/${s.id}__participant__${communityId}`))));
            const communitySnap = await t.get(db.doc(`communities/${communityId}`));
            let gathered = 0;
            members.forEach((m, i) => { if (!existing[i].exists) { gathered++; setLink(t, m, "member", communityId); } });
            standing.forEach((s, i) => { if (!standingLinks[i].exists) setLink(t, s.id, "participant", communityId); });
            if (!ev.circleCommunityId) t.update(eventRef, { circleCommunityId: communityId, updatedAt: FieldValue.serverTimestamp() });
            return { communityId, name: String(communitySnap.data()?.name || ""), members: gathered, gathered: true };
        }

        // THE FULLNESS GATE (domain/limits nodeCapacityGate): a founded circle counts toward the
        // node's communities; auto-born tree circles do not. The refusal says: time to seed.
        // (Counted in code, as createCommunity does: a Firestore != query would drop every
        // community that carries no `formation` field at all — most founded ones.)
        const [limitsSnap, all] = await Promise.all([
            t.get(db.collection("config").doc("limits")),
            t.get(db.collection("communities").limit(200)),
        ]);
        const hostedCount = all.docs.filter((d) => (d.data() as Record<string, unknown>).formation !== "tree_keeping").length;
        const rawMax = Number(limitsSnap.exists ? (limitsSnap.data() as Record<string, unknown>)?.maxNodeCommunities : NaN);
        const max = Number.isFinite(rawMax) && rawMax >= 1 ? Math.floor(rawMax) : DEFAULT_MAX_NODE_COMMUNITIES;
        if (hostedCount >= max) throw new HttpsError("resource-exhausted", `node_full_seed::{"max":${max}}`);

        // ── writes: the circle at the ROOT, its members, its trees, the memory — one transaction ──
        const draft = eventCircleDraft({ eventId: rootId, eventTitle: root.title, eventDomain: root.domain, eventImageUrl: root.imageUrl, formerUid: uid, name });
        const communityRef = db.collection("communities").doc();
        t.set(communityRef, { ...draft, lid: mintLid(), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        for (const member of members) setLink(t, member, "member", communityRef.id);
        for (const s of standing) setLink(t, s.id, "participant", communityRef.id);
        t.update(rootSnap.ref, { circleCommunityId: communityRef.id, updatedAt: FieldValue.serverTimestamp() });
        if (rootSnap.id !== eventSnap.id) t.update(eventRef, { circleCommunityId: communityRef.id, updatedAt: FieldValue.serverTimestamp() });
        return { communityId: communityRef.id, name: draft.name, members: members.length, gathered: false };
    });
});

const setLink = (t: Transaction, from: string, rel: string, to: string) =>
    t.set(db.collection("links").doc(`${from}__${rel}__${to}`), { lid: mintLid(), type: "link", rel, from, to, createdAt: FieldValue.serverTimestamp() });
