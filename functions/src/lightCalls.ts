// lightCalls.ts — SPENDING IS A GATE, NOT A NUMBER (ring 2026-09-30; the season of roots, item 2).
// The two ways light moves beyond its kindling, both on server ground, both refused to every client
// by the rules (rays, gifts, spends, glow: write false). The LAW is the pure judge in ./spend.ts
// (mirror of src/domain/spend, held by tests/spend.test.ts); this file owns only the transaction
// plumbing: it gathers facts from the documents, asks the judge, and applies — one transaction each,
// so nothing is ever half-moved and conservation holds to the last unit.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { db, mintLid, communityIdOfDomain } from "./core";
import { judgeAppreciation, judgeSpend, type HeldRayFact, type SpendRefusal } from "./spend";
import { decisionIdentity, verifiedDecisionSigners, type DecisionNature, type RecordedDecisionSignature, type SignerFacts } from "./decisionSeal";
import type { KeyEpoch, KeyEvent } from "./keyEpoch";

const REFUSAL_CODE: Record<SpendRefusal, "invalid-argument" | "failed-precondition" | "permission-denied" | "not-found" | "already-exists"> = {
    gift_nothing: "invalid-argument", gift_whole_units: "invalid-argument", gift_needs_both: "invalid-argument",
    gift_own_offering: "failed-precondition", gift_resting: "failed-precondition", gift_hold_less: "failed-precondition",
    appreciate_offering_gone: "not-found", appreciate_not_received: "permission-denied", appreciate_already: "already-exists",
    appreciate_coin_refused: "failed-precondition",
    spend_no_decision: "not-found", spend_not_purchase: "failed-precondition", spend_no_offering: "not-found",
    spend_nothing: "invalid-argument", spend_no_standing: "permission-denied", spend_not_passed: "failed-precondition",
    spend_listening: "failed-precondition", spend_unsigned: "failed-precondition", spend_already: "already-exists",
    spend_coin_refused: "failed-precondition", spend_glow_short: "failed-precondition",
};

const msOf = (v: unknown): number | null => (v && typeof (v as { toMillis?: unknown }).toMillis === "function") ? (v as { toMillis: () => number }).toMillis() : null;

// The place an offering stands in: the community it names, else the one rooted at its domain.
const placeOfOffering = async (o: Record<string, unknown>): Promise<string | null> =>
    (typeof o.communityId === "string" && o.communityId) ? o.communityId : ((await communityIdOfDomain(o.domain)) ?? null);

// The places a place accepts the coin of: its own accepts_coin_of links (from = the place).
const acceptedPlacesOf = async (t: Transaction, place: string | null): Promise<string[]> => {
    if (!place) return [];
    const qs = await t.get(db.collection("links").where("from", "==", place).where("rel", "==", "accepts_coin_of"));
    return qs.docs.map((d) => String(d.data().to || "")).filter(Boolean);
};

// Does the hand stand for the community — its anchor, or a keeper link?
const keepsCommunity = async (t: Transaction, uid: string, communityId: string): Promise<boolean> => {
    const com = (await t.get(db.doc(`communities/${communityId}`))).data();
    if (!com) return false;
    if (com.anchorUid === uid) return true;
    return (await t.get(db.doc(`links/${uid}__keeper__${communityId}`))).exists;
};

// ── APPRECIATION: a receiver's light moves to the offering it received ────────────────────────
// appreciateOffering({ offeringId, units }) — the hand that ACCEPTED an offering of care (the receipt
// the server minted) gives whole units of its own light. Oldest accepted rays travel first; the
// offering's place takes its glow share; the rest is SUSPENDED at the offering for whoever comes
// next (the caffè sospeso). The offerer is never paid. Once per receipt (gifts/{offeringId}__{uid}).
export const appreciateOffering = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to appreciate an offering.");
    const giverUid = request.auth.uid;
    const offeringId = request.data?.offeringId;
    const units = request.data?.units;
    if (!offeringId || typeof offeringId !== "string") throw new HttpsError("invalid-argument", "offeringId is required.");
    if (typeof units !== "number") throw new HttpsError("invalid-argument", "units is required.");

    // The place of each unstamped ray is resolved by its tree's domain, before the transaction
    // (older rays predate the server's stamp; the wallet resolves them the same way).
    const heldSnap = await db.collection("rays").where("holderUid", "==", giverUid).get();
    const treeIds = [...new Set(heldSnap.docs.filter((d) => !d.data().communityId).map((d) => String(d.data().treeId || "")).filter(Boolean))];
    const placeByTree = new Map<string, string | null>();
    await Promise.all(treeIds.map(async (id) => {
        const tree = (await db.doc(`lifetrees/${id}`).get()).data();
        placeByTree.set(id, tree ? ((typeof tree.communityId === "string" && tree.communityId) ? tree.communityId : ((await communityIdOfDomain(tree.domain)) ?? null)) : null);
    }));

    return db.runTransaction(async (t) => {
        const offeringRef = db.doc(`pulses/${offeringId}`);
        const offeringSnap = await t.get(offeringRef);
        const o = (offeringSnap.data() ?? {}) as Record<string, unknown>;
        const place = offeringSnap.exists ? await placeOfOffering(o) : null;
        const acceptsPlaces = await acceptedPlacesOf(t, place);
        const giftRef = db.doc(`gifts/${offeringId}__${giverUid}`);
        const alreadyGiven = (await t.get(giftRef)).exists;
        // The rays are re-read INSIDE the transaction: their units are what moves.
        const raysSnap = await t.get(db.collection("rays").where("holderUid", "==", giverUid));
        const rays: HeldRayFact[] = raysSnap.docs.map((d) => {
            const r = d.data();
            const stamped = typeof r.communityId === "string" && r.communityId ? r.communityId : null;
            return { id: d.id, units: typeof r.units === "number" ? r.units : 0, place: stamped ?? placeByTree.get(String(r.treeId || "")) ?? null, dayKey: String(r.dayKey || "") };
        });

        const judgment = judgeAppreciation({
            giverUid, units,
            offering: {
                exists: offeringSnap.exists, type: o.type, status: o.offeringStatus, active: o.offeringActive,
                authorId: typeof o.authorId === "string" ? o.authorId : "", answeredBy: o.offeringAnsweredBy,
                place, acceptsPlaces,
            },
            rays, alreadyGiven,
        });
        if (judgment.outcome === "reject") throw new HttpsError(REFUSAL_CODE[judgment.refusal], judgment.refusal);

        // ── writes: the rays dim, the gift is born, the glow brightens, the offering holds the pot ──
        for (const take of judgment.take) {
            t.update(db.doc(`rays/${take.id}`), { units: FieldValue.increment(-take.units), givenAt: FieldValue.serverTimestamp() });
        }
        const glowHome = judgment.glowHome ?? "NODE";
        t.set(giftRef, {
            lid: mintLid(), offeringId, giverUid, units, glow: judgment.glow, suspended: judgment.suspended,
            glowHome, ...(place ? { communityId: place } : {}),
            rays: judgment.take, createdAt: FieldValue.serverTimestamp(),
        });
        if (judgment.glow > 0) t.set(db.doc(`glow/${glowHome}`), { units: FieldValue.increment(judgment.glow), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        t.update(offeringRef, {
            offeringSuspendedLight: FieldValue.increment(judgment.suspended),
            offeringAppreciations: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { units, glow: judgment.glow, suspended: judgment.suspended };
    });
});

// ── THE SPEND: the commons moves by a signed purchase decision ─────────────────────────────────
// spendGlow({ decisionId }) — a keeper of the community (or the proposer) carries out a PASSED
// purchase decision whose quorum of signatures the SERVER re-verifies (decisionSeal): the named
// units leave the community's glow, pass the prism of the offering's place, and wait at the
// offering. Once per decision (spends/{decisionId}). The decision's `spend` was frozen at birth by
// the rules, so the amount the signers saw is the amount that moves.
const readSignerFacts = async (t: Transaction, uid: string, communityId: string): Promise<SignerFacts> => {
    const personRef = db.doc(`persons/${uid}`);
    const [personSnap, keysSnap, eventsSnap, memberSnap, comSnap] = await Promise.all([
        t.get(personRef), t.get(personRef.collection("keys")), t.get(personRef.collection("keyEvents")),
        t.get(db.doc(`links/${uid}__member__${communityId}`)), t.get(db.doc(`communities/${communityId}`)),
    ]);
    const person = (personSnap.data() ?? {}) as Record<string, unknown>;
    const personLid = typeof person.lid === "string" ? person.lid : "";
    const lineage = new Map<string, string>();
    for (const k of keysSnap.docs) if (typeof k.data().pubkey === "string") lineage.set(k.id, k.data().pubkey);
    const events: KeyEvent[] = eventsSnap.docs.flatMap((d) => {
        const e = d.data() as Record<string, unknown>;
        const recordedAtMs = msOf(e.recordedAt);
        if (!["anchor", "rotate", "freeze", "recover"].includes(String(e.type)) || e.lid !== personLid
            || typeof e.epochId !== "string" || typeof e.keyFingerprint !== "string" || !recordedAtMs) return [];
        const suspected = msOf(e.suspectedSince);
        return [{
            eventId: d.id, type: e.type as KeyEvent["type"], epochId: e.epochId, keyFingerprint: e.keyFingerprint, recordedAtMs,
            ...(typeof e.previousFingerprint === "string" ? { previousFingerprint: e.previousFingerprint } : {}),
            ...(suspected ? { suspectedSinceMs: suspected } : {}),
        }];
    });
    const epochs: KeyEpoch[] = events
        .filter((e) => e.type === "anchor" || e.type === "rotate" || e.type === "recover")
        .map((e) => ({ epochId: e.epochId, fingerprint: e.keyFingerprint, anchoredAtMs: e.recordedAtMs }));
    return {
        publicKeyPem: typeof person.publicKeyPem === "string" ? person.publicKeyPem : "",
        currentFingerprint: typeof person.signingKeyFingerprint === "string" ? person.signingKeyFingerprint : "",
        lineage, epochs, events,
        member: memberSnap.exists || comSnap.data()?.anchorUid === uid,
    };
};

export const spendGlow = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to carry out a decision.");
    const callerUid = request.auth.uid;
    const decisionId = request.data?.decisionId;
    if (!decisionId || typeof decisionId !== "string") throw new HttpsError("invalid-argument", "decisionId is required.");

    return db.runTransaction(async (t) => {
        const decisionRef = db.doc(`pulses/${decisionId}`);
        const decisionSnap = await t.get(decisionRef);
        const d = (decisionSnap.data() ?? {}) as Record<string, unknown>;
        const communityId = typeof d.communityId === "string" ? d.communityId : "";
        const spend = d.spend as { offeringId?: unknown; units?: unknown } | undefined;
        const offeringId = spend && typeof spend.offeringId === "string" ? spend.offeringId : "";

        // The seal, re-verified: every signature against the frozen identity, every key at its receipt time.
        let verifiedSigners = 0;
        if (decisionSnap.exists && communityId && typeof d.lid === "string") {
            const sigsSnap = await t.get(decisionRef.collection("signatures"));
            const sigs: RecordedDecisionSignature[] = sigsSnap.docs.map((s) => {
                const v = s.data() as Record<string, unknown>;
                return { uid: s.id, sig: String(v.sig || ""), pubkey: String(v.pubkey || ""), position: v.position, version: v.version, keyFingerprint: v.keyFingerprint, epochId: v.epochId, recordedAtMs: msOf(v.recordedAt) };
            });
            const signers = new Map<string, SignerFacts>();
            for (const uid of new Set(sigs.map((s) => s.uid))) signers.set(uid, await readSignerFacts(t, uid, communityId));
            const identity = decisionIdentity({
                lid: d.lid, communityId, nature: d.nature as DecisionNature, title: String(d.title || ""),
                body: typeof d.body === "string" ? d.body : "", votesRequired: Number(d.votesRequired) || 0,
            });
            verifiedSigners = verifiedDecisionSigners(identity, d.mode === "consensus" ? "consensus" : "threshold", sigs, signers).size;
        }

        const callerStands = !!communityId && (d.proposedBy === callerUid || await keepsCommunity(t, callerUid, communityId));
        const offeringSnap = offeringId ? await t.get(db.doc(`pulses/${offeringId}`)) : null;
        const o = (offeringSnap?.data() ?? {}) as Record<string, unknown>;
        const place = offeringSnap?.exists ? await placeOfOffering(o) : null;
        const acceptsPlaces = await acceptedPlacesOf(t, place);
        const glowRef = communityId ? db.doc(`glow/${communityId}`) : null;
        const glowUnits = glowRef ? (Number((await t.get(glowRef)).data()?.units) || 0) : 0;
        const spendRef = db.doc(`spends/${decisionId}`);
        const alreadySpent = (await t.get(spendRef)).exists;

        const judgment = judgeSpend({
            callerUid, callerStands,
            decision: {
                exists: decisionSnap.exists, type: d.type, nature: d.nature, status: d.status, listening: d.listening,
                communityId, votesRequired: Number(d.votesRequired) || 0, verifiedSigners, spend: d.spend, alreadySpent,
            },
            offering: { exists: !!offeringSnap?.exists, type: o.type, active: o.offeringActive, place, acceptsPlaces },
            glowUnits,
        });
        if (judgment.outcome === "reject") throw new HttpsError(REFUSAL_CODE[judgment.refusal], judgment.refusal);
        if (!glowRef || !offeringSnap) throw new HttpsError("failed-precondition", "spend_no_offering");

        // ── writes: the glow gives, the prism takes, the offering holds, the decision is marked ──
        const glowHome = judgment.glowHome ?? "NODE";
        // One write per glow doc: the spending glow may also be the receiving one.
        const delta = new Map<string, number>([[communityId, -judgment.units]]);
        if (judgment.glow > 0) delta.set(glowHome, (delta.get(glowHome) || 0) + judgment.glow);
        for (const [home, units] of delta) {
            if (units === 0) continue;
            t.set(db.doc(`glow/${home}`), { units: FieldValue.increment(units), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
        t.set(spendRef, {
            lid: mintLid(), decisionId, communityId, offeringId, units: judgment.units, glow: judgment.glow, suspended: judgment.suspended,
            glowHome, verifiedSigners, spentBy: callerUid, createdAt: FieldValue.serverTimestamp(),
        });
        t.update(db.doc(`pulses/${offeringId}`), {
            offeringSuspendedLight: FieldValue.increment(judgment.suspended),
            offeringAppreciations: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
        });
        t.update(decisionRef, { spentAt: FieldValue.serverTimestamp(), spentBy: callerUid, spendId: spendRef.id });
        return { units: judgment.units, glow: judgment.glow, suspended: judgment.suspended, verifiedSigners };
    });
});
