// light.ts — split from index.ts (ring 2026-09-16); every function keeps its name, trigger and options.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { judgeWitness, kindleDayKeyFromMs } from "./mint";
import { db, mintLid, tsToMs } from "./core";

// ── THE MINT: light kindled from witnessed care (the sun ring; domain/light.ts) ────────────────
// Light enters the world ONLY through a GUARDIAN witnessing care for the living — and the mint is a
// SERVER CALLABLE (witnessWatering) that trusts nothing the client can forge: the witness is the
// AUTHENTICATED caller (not a stored field), the day is derived from the watering's own server
// timestamp, and the whole mint (carer's ray + witness's seventh + the pulse's confirmation) rides
// ONE transaction, so nothing is half-minted. Rays live in the server-only `rays` collection; no
// client may write one. This replaced trigger-based minting, which trusted client-supplied
// authorId / wateringConfirmedBy / mintedAt and could be driven with forged pulses (Lumo's review,
// 2026-07-20). The LAW itself (every accept/reject branch and the allocation) is the pure
// judgeWitness in ./mint.ts, mirror-tested against src/domain/light.ts from the root suite; this
// function owns only the transaction plumbing.

// The immutable body of a ray. The doc id is DETERMINISTIC (rays/{treeId}__{dayKey}__{role}), which
// enforces ONE KINDLE PER TREE PER DAY (life is the central bank) and idempotency in one stroke.
const rayDoc = (
    ray: { holderUid: string; role: "carer" | "witness"; units: number },
    sourceUid: string, treeId: string, communityId: string | undefined, dayKey: string, pulseId: string,
) => ({
    lid: mintLid(),
    holderUid: ray.holderUid,
    role: ray.role,
    sourceUid,     // whose witnessed care kindled it (the carer)
    treeId,
    dayKey,        // the calendar day this care kindled (the once-a-day bound)
    ...(communityId ? { communityId } : {}), // provenance; a solo carer's tree may have none
    units: ray.units,
    pulseId,       // provenance: the watering pulse that occasioned it
    kindledAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
});

// witnessWatering — the CIRCLE witnesses a watering, kindling the light. Everything is server-derived
// or server-verified: the witness is the authenticated caller; the carer is the pulse's (create-time
// auth-bound) author; the witness's standing (a guardian / co_owner / steward link, or keepership)
// must exist AND predate the watering (tenure — a sock account minted for the occasion has no voice,
// mirroring the guardian veto); the day is the
// watering's own; and the carer's ray, the witness's seventh, and the pulse's confirmation all ride
// ONE transaction. No client field decides who is paid, how much, or when — the facts gathered here
// go through judgeWitness (./mint.ts), the pure law the tests hold to the domain.
export const witnessWatering = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to witness a watering.");
    const witnessUid = request.auth.uid;
    const pulseId = request.data?.pulseId;
    if (!pulseId || typeof pulseId !== "string") throw new HttpsError("invalid-argument", "pulseId is required.");

    return db.runTransaction(async (t) => {
        // ── all reads first (transaction rule): gather the facts the judgment needs ──
        const pulseRef = db.doc(`pulses/${pulseId}`);
        const pulseSnap = await t.get(pulseRef);
        const pulse = (pulseSnap.data() ?? {}) as Record<string, any>;
        const carerUid = typeof pulse.authorId === "string" ? pulse.authorId : "";
        const treeId = typeof pulse.lifetreeId === "string" ? pulse.lifetreeId : "";
        const createdAtMs: number | null =
            (pulse.createdAt && typeof pulse.createdAt.toMillis === "function") ? pulse.createdAt.toMillis() : null;

        let witnessSinceMs: number | null = null;
        let treeFacts: { exists: boolean; treeType?: unknown; diedAtMs: number | null } = { exists: false, diedAtMs: null };
        let communityId: string | undefined;
        let carerRef: FirebaseFirestore.DocumentReference | null = null;
        let witnessRef: FirebaseFirestore.DocumentReference | null = null;
        let carerRayExists = false;
        let witnessRayExists = false;

        if (pulseSnap.exists && treeId) {
            // Standing = the earliest circle link the witness holds on this tree. A link without a
            // birth time predates the pulse by convention (old links).
            const msOf = (v: any): number => (v && typeof v.toMillis === "function") ? v.toMillis() : 0;
            const standing = (since: number) => { witnessSinceMs = witnessSinceMs === null ? since : Math.min(witnessSinceMs, since); };
            const linkSnaps = await Promise.all(["guardian", "co_owner", "steward"].map((rel) =>
                t.get(db.doc(`links/${witnessUid}__${rel}__${treeId}`))));
            for (const snap of linkSnaps) if (snap.exists) standing(msOf((snap.data() as any)?.createdAt));
            const treeSnap = await t.get(db.doc(`lifetrees/${treeId}`));
            if (treeSnap.exists) {
                const tree = treeSnap.data() as Record<string, any>;
                // The keeper stands in the circle from the tree's birth.
                if (tree.ownerId === witnessUid) standing(msOf(tree.createdAt));
                treeFacts = {
                    exists: true,
                    treeType: tree.treeType,
                    diedAtMs: (tree.diedAt && typeof tree.diedAt.toMillis === "function") ? tree.diedAt.toMillis() : null,
                };
                communityId = tree.communityId ? String(tree.communityId) : undefined;
            }
            if (createdAtMs !== null) {
                const dayKey = kindleDayKeyFromMs(createdAtMs);
                carerRef = db.doc(`rays/${treeId}__${dayKey}__carer`);
                witnessRef = db.doc(`rays/${treeId}__${dayKey}__witness`);
                carerRayExists = (await t.get(carerRef)).exists;
                witnessRayExists = (await t.get(witnessRef)).exists;
            }
        }

        const judgment = judgeWitness({
            witnessUid,
            pulse: {
                exists: pulseSnap.exists,
                care: pulse.care,
                wateringConfirmedBy: pulse.wateringConfirmedBy,
                carerUid, treeId, createdAtMs,
            },
            witnessSinceMs,
            tree: treeFacts,
            carerRayExists,
            witnessRayExists,
        });

        if (judgment.outcome === "reject") throw new HttpsError(judgment.code, judgment.message);
        if (judgment.outcome === "already") return { kindled: false, witnessUnits: 0, already: true };

        // ── writes ── (atomic: confirmation + both rays in this one transaction)
        t.update(pulseRef, {
            wateringConfirmedBy: "guardian",
            "wateringConfirmation.confirmedByUid": witnessUid,
            "wateringConfirmation.confirmedAt": FieldValue.serverTimestamp(),
        });
        if (judgment.carerRay && carerRef) t.set(carerRef, rayDoc(judgment.carerRay, carerUid, treeId, communityId, judgment.dayKey, pulseId));
        if (judgment.witnessRay && witnessRef) t.set(witnessRef, rayDoc(judgment.witnessRay, carerUid, treeId, communityId, judgment.dayKey, pulseId));

        return { kindled: judgment.carerRay !== null, witnessUnits: judgment.witnessRay ? judgment.witnessRay.units : 0 };
    });
});

// ---------------------------------------------------------------------------
// Watering — the daily routine over all guarded trees.
//
// A tree carries an optional `watering` schedule { mode, intervalDays, lastWateredAt, ... }.
// Once a day this sweep finds the trees that are overdue and, at most once per day per tree,
// posts a tree-voiced "water me" reach into that tree's guardians thread — which the existing
// onReachCreated trigger then emails to the guardians. A *confirmed* watering (done client-side
// via a growth pulse) clears `watering.overdue` and re-lights the tree's living validation.
//
// The alert is a reach (a message), NOT a chain block: it carries the `WATER_ALERT` sentinel
// previousHash so it never advances the tree's immutable chain (mirrors how decisions/events
// are rooted). Reaches are excluded from tree timelines + the pulse feed, so this stays a DM.
// ---------------------------------------------------------------------------

const WATER_DAY_MS = 24 * 60 * 60 * 1000;

const sameUtcDay = (a: number, b: number): boolean => {
    if (!a || !b) return false;
    const da = new Date(a), dbb = new Date(b);
    return da.getUTCFullYear() === dbb.getUTCFullYear()
        && da.getUTCMonth() === dbb.getUTCMonth()
        && da.getUTCDate() === dbb.getUTCDate();
};

// Resolve a guarded tree's circle (co-guardians + guardians) from the LIN links — the single
// source of truth (also what the Firestore rules read). Legacy role arrays are not consulted.
const resolveGuardianUids = async (treeId: string): Promise<string[]> => {
    const links = await db.collection("links").where("to", "==", treeId).get();
    const fromLinks = links.docs
        .map((d) => d.data())
        .filter((x: any) => x.rel === "guardian" || x.rel === "co_owner")
        .map((x: any) => x.from as string);
    return Array.from(new Set(fromLinks.filter(Boolean)));
};

// Stage-aware voice: a potted seed speaks as a seed (mirrors the client's stage story).
const waterMeText = (treeName: string, daysOverdue: number, stage?: string): string => {
    const who = treeName || "This tree";
    const self = stage === "potted" ? "I'm a seed in my pot 🌱" : "I'm thirsty 💧";
    if (daysOverdue <= 0) return `${stage === "potted" ? "I'm a seed in my pot 🌱 and" : "I'm"} ready for watering 💧 — could a guardian care me today?`;
    if (daysOverdue === 1) return `${stage === "potted" ? "I'm a seed in my pot 🌱 getting thirsty" : "I'm getting thirsty 💧"} — it's been a day past my watering. Could a guardian care me?`;
    return `${self} — it's been ${daysOverdue} days past my watering. Could a guardian care me? — ${who}`;
};

export const checkWateringSchedules = onSchedule({
    schedule: "every day 08:00",
    timeZone: "Europe/Brussels",
    timeoutSeconds: 300,
    memory: "512MiB",
}, async () => {
    const now = Date.now();
    // Only the trees actually on a schedule — avoids reading the whole forest each day.
    const treesSnap = await db.collection("lifetrees").where("watering.mode", "==", "scheduled").get();

    for (const docSnap of treesSnap.docs) {
        try {
            const tree = docSnap.data() as any;
            const w = tree.watering;
            if (!w || w.mode !== "scheduled" || !w.intervalDays) continue;

            const lastWatered = tsToMs(w.lastWateredAt) || tsToMs(tree.createdAt) || 0;
            const nextDue = tsToMs(w.nextDueAt) || (lastWatered + Math.max(1, w.intervalDays) * WATER_DAY_MS);
            const overdue = now >= nextDue;

            if (!overdue) {
                if (w.overdue) await docSnap.ref.update({ "watering.overdue": false });
                continue;
            }

            const updates: Record<string, any> = { "watering.overdue": true };

            // At most one ping per tree per day (shared idempotency with the client check).
            if (!sameUtcDay(tsToMs(w.lastAlertAt), now)) {
                const ownerUid = tree.ownerId as string;
                const guardianUids = await resolveGuardianUids(docSnap.id);
                const participantUids = Array.from(new Set([ownerUid, ...guardianUids].filter(Boolean)));

                // Only ping if someone other than the author (the owner) will receive it.
                if (participantUids.filter((u) => u !== ownerUid).length > 0) {
                    const threadId = ["grp", docSnap.id, "guardians", ownerUid].join("__");
                    const daysOver = Math.max(0, Math.floor((now - nextDue) / WATER_DAY_MS));
                    const text = waterMeText(tree.name, daysOver, w.stage);

                    // ONE STANDING ASK (mirrors domain/watering.standingAlertId): while the
                    // tree's ask stands — raised, and no watering since — rewrite it so a week
                    // of thirst is one line that keeps count, not seven identical lines.
                    const standingId = w.alertPulseId
                        && tsToMs(w.lastAlertAt)
                        && tsToMs(w.lastWateredAt) <= tsToMs(w.lastAlertAt)
                        ? String(w.alertPulseId) : null;
                    if (standingId) {
                        const standing = await db.collection("pulses").doc(standingId).get();
                        if (standing.exists) {
                            await standing.ref.update({
                                body: text, content: text, createdAt: FieldValue.serverTimestamp(),
                            });
                            updates["watering.lastAlertAt"] = FieldValue.serverTimestamp();
                            updates["watering.alertThreadId"] = threadId;
                            await docSnap.ref.update(updates);
                            continue;
                        }
                    }

                    const raised = await db.collection("pulses").add({
                        lid: mintLid(), // even a nudge is a pulse, and a pulse is a Being (mirrors the client twin)
                        lifetreeId: docSnap.id,
                        type: "reach",
                        visibility: "private",
                        careAlert: "watering",
                        title: `Reach: ${tree.name} -> ${tree.name} (Guardians)`,
                        body: text,
                        content: text,
                        reachTreeId: docSnap.id,
                        reachTreeName: tree.name,
                        recipientName: tree.name,
                        recipientUid: null,
                        participantUids,
                        threadId,
                        threadName: `${tree.name} · Guardians`,
                        audience: "guardians",
                        isGroup: true,
                        seenBy: [],
                        authorId: ownerUid,            // the tree speaks through its principal
                        authorName: tree.name,         // the conversation face is the tree
                        authorPhoto: tree.imageUrl || null,
                        domain: tree.domain || "",
                        loveCount: 0,
                        commentCount: 0,
                        previousHash: "WATER_ALERT",   // a notification, not a chain block
                        hash: randomUUID(),
                        createdAt: FieldValue.serverTimestamp(),
                    });

                    updates["watering.lastAlertAt"] = FieldValue.serverTimestamp();
                    updates["watering.alertThreadId"] = threadId;
                    updates["watering.alertPulseId"] = raised.id;
                }
            }

            await docSnap.ref.update(updates);
        } catch (e) {
            console.error(`Watering check failed for tree ${docSnap.id}:`, e);
        }
    }
});

// RESET LIGHT (ring 2026-07-21) — the testing-phase restart: empties the WHOLE light economy,
// every ray and every glow, in one stroke. NODE OWNER ONLY (not staff): this erases value, so
// only the hand that answers for the instance may pull it. Nothing else is touched; the care
// was real and remains on the chains and caring records — the deleted light leaves the trees
// in better shape, so it is not lost. Light re-enters only through witnessed care.
export const resetLight = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    const superadmin = await db.collection("config").doc("superadmin").get();
    if (!(superadmin.exists && superadmin.data()?.uid === request.auth.uid)) {
        throw new HttpsError("permission-denied", "Only the node owner may reset the light.");
    }
    const burn = async (coll: string): Promise<{ docs: number; units: number }> => {
        const qs = await db.collection(coll).get();
        let units = 0;
        for (let i = 0; i < qs.docs.length; i += 400) {
            const batch = db.batch();
            qs.docs.slice(i, i + 400).forEach(d => {
                units += typeof d.data().units === "number" ? d.data().units : 0;
                batch.delete(d.ref);
            });
            await batch.commit();
        }
        return { docs: qs.size, units };
    };
    const rays = await burn("rays");
    const glow = await burn("glow");
    console.log(`Light reset by ${request.auth.uid}: ${rays.docs} rays (${rays.units} units), ${glow.docs} glow homes (${glow.units} units).`);
    return { rays: rays.docs, rayUnits: rays.units, glowHomes: glow.docs, glowUnits: glow.units };
});
