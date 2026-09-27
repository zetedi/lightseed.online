// CIRCLES FROM GATHERINGS (ring 2026-09-27). A tree circle grows from shared care (invites.ts,
// acceptTreeInvite births it; formCommunityFromCircle graduates it). An EVENT CIRCLE grows
// from shared presence: the trees that stood around an event become, by the event's own
// hand, a community — server-born like the tree circle, members and trees minted as links in
// one transaction, the event remembering its circle so it forms once.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db, isStaffUid, mintLid, keeperLinkRef } from "./core";
import { formEventCircleRefusal, eventCircleDraft, eventCircleMemberUids } from "./eventCircle";

const DEFAULT_MAX_NODE_COMMUNITIES = 144; // domain/limits DEFAULT_MAX_NODE_COMMUNITIES

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
        // The hand: the author; the keeper (owner or keeper link) of the event's community; staff.
        let isHand = isStaff || ev.authorId === uid;
        const communityId = typeof ev.communityId === "string" ? ev.communityId : "";
        if (!isHand && communityId) {
            const [c, k] = await Promise.all([t.get(db.doc(`communities/${communityId}`)), t.get(keeperLinkRef(uid, communityId))]);
            isHand = c.exists && (c.data()?.ownerId === uid || k.exists);
        }
        const links = isEvent ? await t.get(db.collection("links").where("to", "==", eventId).where("rel", "==", "participant")) : null;
        const treeIds = links ? links.docs.map((d) => String((d.data() as Record<string, unknown>).from || "")).filter(Boolean) : [];
        const trees = await Promise.all(treeIds.map((id) => t.get(db.doc(`lifetrees/${id}`))));
        const standing = trees.filter((s) => s.exists && (s.data() as Record<string, unknown>).treeType !== "BED");

        const refusal = formEventCircleRefusal({ isEvent, isHand, circleCommunityId: ev.circleCommunityId, participantTreeCount: standing.length });
        if (refusal) throw new HttpsError(refusal === "event_circle_not_hand" ? "permission-denied" : refusal === "event_circle_not_event" ? "not-found" : "failed-precondition", refusal);

        // THE FULLNESS GATE (domain/limits nodeCapacityGate): a founded circle counts toward the
        // node's communities; auto-born tree circles do not. The refusal says: time to seed.
        // (Counted in code, as createCommunity does: a Firestore != query would drop every
        // community that carries no `formation` field at all — most founded ones.)
        const [limitsSnap, all] = await Promise.all([
            t.get(db.collection("config").doc("limits")),
            t.get(db.collection("communities").limit(200)),
        ]);
        const hostedCount = all.docs.filter((d) => (d.data() as Record<string, unknown>).formation !== "tree_co_ownership").length;
        const rawMax = Number(limitsSnap.exists ? (limitsSnap.data() as Record<string, unknown>)?.maxNodeCommunities : NaN);
        const max = Number.isFinite(rawMax) && rawMax >= 1 ? Math.floor(rawMax) : DEFAULT_MAX_NODE_COMMUNITIES;
        if (hostedCount >= max) throw new HttpsError("resource-exhausted", `node_full_seed::{"max":${max}}`);

        // ── writes: the circle, its members, its trees, the event's memory — one transaction ──
        const draft = eventCircleDraft({ eventId, eventTitle: ev.title, eventDomain: ev.domain, eventImageUrl: ev.imageUrl, formerUid: uid, name });
        const communityRef = db.collection("communities").doc();
        t.set(communityRef, { ...draft, lid: mintLid(), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        const setLink = (from: string, rel: string, to: string) =>
            t.set(db.collection("links").doc(`${from}__${rel}__${to}`), { lid: mintLid(), type: "link", rel, from, to, createdAt: FieldValue.serverTimestamp() });
        const owners = standing.map((s) => (s.data() as Record<string, unknown>).ownerId as string | undefined);
        for (const member of eventCircleMemberUids(uid, owners)) setLink(member, "member", communityRef.id);
        for (const s of standing) setLink(s.id, "participant", communityRef.id);
        t.update(eventRef, { circleCommunityId: communityRef.id, updatedAt: FieldValue.serverTimestamp() });
        return { communityId: communityRef.id, name: draft.name, members: eventCircleMemberUids(uid, owners).length };
    });
});
