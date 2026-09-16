// domains.ts — split from index.ts (ring 2026-09-16); every function keeps its name, trigger and options.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { doorKind, doorClaimRefusal, doorChallengeId, normalizeDoor } from "./doors";
import { staffHandOn } from "./staffHands";
import { db, isStaffUid, keeperLinkRef, normalizeAnchorDomain } from "./core";

// ── Domain verification (root/INTERBEING_MATRIX.md) ─────────────────────────────────────
// A DNS-01-style control proof (RFC 8555 §8.4) in an underscored namespace (RFC 8552):
// the server mints a single-use >=128-bit token bound to the community and its exact
// normalized domain; a keeper places it as a TXT record; the server OBSERVES it and writes
// the mark — the one hand the rules allow. DNS proves control of the anchor, never worth.
// Mirror of src/domain/domainVerification.ts + interbeingMatrix.normalizeAnchorDomain
// (functions/rootDir is isolated — keep the constants in sync with those laws' tests).
const DOMAIN_CHALLENGE_LABEL = "_lightseed-challenge";
const DOMAIN_CHALLENGE_PREFIX = "lightseed-verification=v1:";
const DOMAIN_CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Caller must keep this community; returns the doc data or throws.
const communityKeptBy = async (communityId: string, uid: string) => {
    const community = (await db.collection("communities").doc(communityId).get()).data();
    if (!community) throw new HttpsError("not-found", "Community not found.");
    const isKeeper = community.ownerId === uid
        || (await keeperLinkRef(uid, communityId).get()).exists;
    if (!isKeeper) throw new HttpsError("permission-denied", "Only a keeper verifies the anchor.");
    return community;
};

// Get-or-mint the challenge — one live challenge per community. RESUME, never invalidate:
// a keeper places the TXT record and may return days later; reminting on every ask would
// orphan the record they already planted. The standing challenge is returned while it
// lives (unused, unexpired, same domain — mirror of domain/domainVerification
// challengeIsLive); only a used, expired, or moved-domain challenge is superseded.
export const startDomainVerification = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const communityId = String(request.data?.communityId || "");
    if (!communityId) throw new HttpsError("invalid-argument", "communityId is required.");
    const community = await communityKeptBy(communityId, request.auth.uid);
    const domain = normalizeAnchorDomain(String(community.domain || ""));
    if (!domain) throw new HttpsError("failed-precondition", "no_domain");
    const challengeRef = db.collection("domainChallenges").doc(communityId);
    const standing = (await challengeRef.get()).data();
    if (standing && !standing.usedAt && standing.domain === domain
        && Date.now() - (standing.createdAt?.toMillis?.() ?? 0) < DOMAIN_CHALLENGE_TTL_MS) {
        return {
            domain,
            recordName: `${DOMAIN_CHALLENGE_LABEL}.${domain}`,
            recordValue: `${DOMAIN_CHALLENGE_PREFIX}${standing.token}`,
        };
    }
    const token = randomBytes(16).toString("hex"); // 128 bits, opaque, single-use
    await challengeRef.set({
        communityId, lid: community.lid || null, domain, token,
        createdBy: request.auth.uid, createdAt: FieldValue.serverTimestamp(), usedAt: null,
    });
    return {
        domain,
        recordName: `${DOMAIN_CHALLENGE_LABEL}.${domain}`,
        recordValue: `${DOMAIN_CHALLENGE_PREFIX}${token}`,
    };
});

// Observe the TXT record; on proof, write the server-only mark and retire the challenge.
export const checkDomainVerification = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const communityId = String(request.data?.communityId || "");
    if (!communityId) throw new HttpsError("invalid-argument", "communityId is required.");
    const community = await communityKeptBy(communityId, request.auth.uid);
    const challengeRef = db.collection("domainChallenges").doc(communityId);
    const challenge = (await challengeRef.get()).data();
    if (!challenge) throw new HttpsError("failed-precondition", "no_challenge");
    if (challenge.usedAt) throw new HttpsError("failed-precondition", "challenge_used");
    const createdAtMs = challenge.createdAt?.toMillis?.() ?? 0;
    if (Date.now() - createdAtMs >= DOMAIN_CHALLENGE_TTL_MS) {
        throw new HttpsError("failed-precondition", "challenge_expired");
    }
    // The proof binds to the EXACT domain the challenge named — a community that moved
    // since must start over; nothing verifies an address it no longer claims.
    if (normalizeAnchorDomain(String(community.domain || "")) !== challenge.domain) {
        throw new HttpsError("failed-precondition", "domain_changed");
    }
    let records: string[][];
    try {
        records = await resolveTxt(`${DOMAIN_CHALLENGE_LABEL}.${challenge.domain}`);
    } catch {
        throw new HttpsError("failed-precondition", "txt_not_found");
    }
    const expected = `${DOMAIN_CHALLENGE_PREFIX}${challenge.token}`;
    if (!records.some((chunks) => chunks.join("") === expected)) {
        throw new HttpsError("failed-precondition", "txt_mismatch");
    }
    const batch = db.batch();
    batch.update(db.collection("communities").doc(communityId), {
        domainVerification: {
            domain: challenge.domain, method: "dns_txt",
            verifiedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
    });
    // The consumed token is residue — the durable truth (domain, method, verifiedAt) lives
    // on the community doc; nothing is served by storing spent challenges.
    batch.delete(challengeRef);
    await batch.commit();
    return { verified: true, domain: challenge.domain };
});

// --- THE DOORS OF A PLACE (ring 2026-09-09, domain/doors mirrored in ./doors) ---------------
// A keeper claims a door (an alias hostname) by PROOF — a TXT record at the door's own name —
// or, for a face door of this node, the node's steward GRANTS it (staff hand door_grant).
// On claim the alias is written and every being stamped with the door comes home to the
// community's canonical domain (the rehome-door script's law, now a server hand).
const otherClaimantOf = async (door: string, communityId: string): Promise<{ id: string } | null> => {
    const byDomain = await db.collection("communities").where("domain", "==", door).limit(2).get();
    for (const d of byDomain.docs) if (d.id !== communityId) return { id: d.id };
    const byAlias = await db.collection("communities").where("domainAliases", "array-contains", door).limit(2).get();
    for (const d of byAlias.docs) if (d.id !== communityId) return { id: d.id };
    return null;
};
const rehomeDoorBeings = async (door: string, home: string, communityId: string): Promise<number> => {
    let moved = 0;
    const batch = db.batch();
    for (const col of ["pulses", "lifetrees", "visions"]) {
        const snap = await db.collection(col).where("domain", "==", door).get();
        for (const d of snap.docs) {
            batch.set(d.ref, { domain: home, ...(col === "visions" ? { communityId } : {}), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
            moved++;
        }
    }
    if (moved) await batch.commit();
    return moved;
};
const claimDoorFor = async (communityId: string, door: string): Promise<{ moved: number }> => {
    const ref = db.collection("communities").doc(communityId);
    const community = (await ref.get()).data() as Record<string, any>;
    await ref.set({ domainAliases: FieldValue.arrayUnion(door), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const moved = await rehomeDoorBeings(door, String(community.domain || ""), communityId);
    await db.collection("doorChallenges").doc(doorChallengeId(communityId, door)).delete().catch(() => undefined);
    return { moved };
};

// The keeper asks for a door: a custom one gets a challenge (TXT to place), a face one a
// standing request for the steward's grant.
export const startDoorClaim = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const communityId = String(request.data?.communityId || "");
    const door = normalizeDoor(String(request.data?.door || ""));
    if (!communityId || !door) throw new HttpsError("invalid-argument", "communityId and door are required.");
    const community = await communityKeptBy(communityId, request.auth.uid);
    const kind = doorKind(door);
    const refusal = doorClaimRefusal({ door, kind, community: { id: communityId, domain: community.domain, domainAliases: community.domainAliases }, claimedBy: await otherClaimantOf(door, communityId) });
    if (refusal) throw new HttpsError("failed-precondition", refusal);
    const challengeRef = db.collection("doorChallenges").doc(doorChallengeId(communityId, door));
    const standing = (await challengeRef.get()).data();
    if (kind === "face") {
        if (!standing) await challengeRef.set({ communityId, door, kind, createdBy: request.auth.uid, createdAt: FieldValue.serverTimestamp() });
        return { door, kind };
    }
    const fresh = standing && standing.token && Date.now() - (standing.createdAt?.toMillis?.() ?? 0) < DOMAIN_CHALLENGE_TTL_MS;
    const token = fresh ? standing.token : randomBytes(16).toString("hex");
    if (!fresh) await challengeRef.set({ communityId, door, kind, token, createdBy: request.auth.uid, createdAt: FieldValue.serverTimestamp() });
    return { door, kind, recordName: `${DOMAIN_CHALLENGE_LABEL}.${door}`, recordValue: `${DOMAIN_CHALLENGE_PREFIX}${token}` };
});

// The keeper asks the server to observe the TXT; on proof the door is claimed.
export const checkDoorClaim = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const communityId = String(request.data?.communityId || "");
    const door = normalizeDoor(String(request.data?.door || ""));
    if (!communityId || !door) throw new HttpsError("invalid-argument", "communityId and door are required.");
    await communityKeptBy(communityId, request.auth.uid);
    const challenge = (await db.collection("doorChallenges").doc(doorChallengeId(communityId, door)).get()).data();
    if (!challenge || !challenge.token) throw new HttpsError("failed-precondition", "no_challenge");
    if (Date.now() - (challenge.createdAt?.toMillis?.() ?? 0) >= DOMAIN_CHALLENGE_TTL_MS) throw new HttpsError("failed-precondition", "challenge_expired");
    let records: string[][];
    try { records = await resolveTxt(`${DOMAIN_CHALLENGE_LABEL}.${door}`); } catch { throw new HttpsError("failed-precondition", "txt_not_found"); }
    if (!records.some((chunks) => chunks.join("") === `${DOMAIN_CHALLENGE_PREFIX}${challenge.token}`)) throw new HttpsError("failed-precondition", "txt_mismatch");
    if (await otherClaimantOf(door, communityId)) throw new HttpsError("failed-precondition", "door_taken");
    const { moved } = await claimDoorFor(communityId, door);
    return { claimed: true, door, moved };
});

// The node's steward grants a face door (staff hand door_grant, switchable in config/staffHands).
export const grantDoor = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const communityId = String(request.data?.communityId || "");
    const door = normalizeDoor(String(request.data?.door || ""));
    if (!communityId || !door) throw new HttpsError("invalid-argument", "communityId and door are required.");
    if (!(await isStaffUid(request.auth.uid))) throw new HttpsError("permission-denied", "Staff only.");
    const switches = (await db.collection("config").doc("staffHands").get()).data();
    if (!staffHandOn(switches, "door_grant")) throw new HttpsError("permission-denied", "hand_withdrawn");
    const snap = await db.collection("communities").doc(communityId).get();
    if (!snap.exists) throw new HttpsError("not-found", "That community does not exist.");
    const community = snap.data() as Record<string, any>;
    const kind = doorKind(door);
    if (kind !== "face") throw new HttpsError("failed-precondition", "door_not_face");
    const refusal = doorClaimRefusal({ door, kind, community: { id: communityId, domain: community.domain, domainAliases: community.domainAliases }, claimedBy: await otherClaimantOf(door, communityId) });
    if (refusal) throw new HttpsError("failed-precondition", refusal);
    const { moved } = await claimDoorFor(communityId, door);
    return { claimed: true, door, moved };
});

// The keeper withdraws a door; beings stamped with the canonical domain stay where they are.
export const withdrawDoor = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const communityId = String(request.data?.communityId || "");
    const door = normalizeDoor(String(request.data?.door || ""));
    if (!communityId || !door) throw new HttpsError("invalid-argument", "communityId and door are required.");
    await communityKeptBy(communityId, request.auth.uid);
    await db.collection("communities").doc(communityId).set({ domainAliases: FieldValue.arrayRemove(door), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("doorChallenges").doc(doorChallengeId(communityId, door)).delete().catch(() => undefined);
    return { withdrawn: true, door };
});

// The claims in flight for a community — what the panel shows beside the open doors.
export const listDoorClaims = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const communityId = String(request.data?.communityId || "");
    if (!communityId) throw new HttpsError("invalid-argument", "communityId is required.");
    await communityKeptBy(communityId, request.auth.uid);
    const snap = await db.collection("doorChallenges").where("communityId", "==", communityId).get();
    return { claims: snap.docs.map((d) => { const x = d.data(); return { door: x.door, kind: x.kind, ...(x.token ? { recordName: `${DOMAIN_CHALLENGE_LABEL}.${x.door}`, recordValue: `${DOMAIN_CHALLENGE_PREFIX}${x.token}` } : {}) }; }) };
});
