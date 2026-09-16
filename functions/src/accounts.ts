// accounts.ts — split from index.ts (ring 2026-09-16); every function keeps its name, trigger and options.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { releaseRay } from "./mint";
import { charter, NODE_ORIGIN } from "./charter";
import { composeSystemEmailHtml, db, isStaffUid, writeMail } from "./core";

// --- Admin: browse users (for the deletion tool) ----------------------------------------------
// Staff-only. Returns a lightweight roster of user profiles (uid, email, name, createdAt) so an
// admin can pick who to delete without hunting for uids. Reads the `users` collection with admin
// rights (clients can't read other users' docs), newest first.
export const listUsersAsAdmin = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    if (!(await isStaffUid(request.auth.uid))) throw new HttpsError("permission-denied", "Staff only.");

    const snap = await db.collection("users").orderBy("createdAt", "desc").limit(200).get();
    const superadmin = await db.collection("config").doc("superadmin").get();
    const superUid = superadmin.exists ? superadmin.data()?.uid : null;
    const users = snap.docs.map((d) => {
        const u = d.data() as { email?: string; displayName?: string; createdAt?: { toMillis?: () => number } };
        return {
            uid: d.id,
            email: u.email || null,
            displayName: u.displayName || "",
            createdAt: u.createdAt?.toMillis?.() ?? null,
            isSuperAdmin: d.id === superUid,
        };
    });
    return { users };
});

// --- Admin: delete a user (auth + their data) ------------------------------------------------
// Staff-only. Removes the target's lifetrees/pulses/visions/links/person/user docs and their
// Auth record. Useful for re-testing onboarding. The node owner (superadmin) can't be deleted
// by a non-superadmin.
// Erase a being's data and Auth record, server-side and in order: content first, then the
// profile docs, then the Auth user LAST (admin SDK — no `requires-recent-login`, the failure
// mode that leaves a half-deleted account in limbo when done from the client). Shared by the
// admin path and the self-serve path so both delete the same things the same way.
// THE LAST SPEND (ring 2026-07-21): the departing being's light moves one final time. With a
// chosen heir the rays transfer through the prism (the glow keeps the default seventh); with
// none, each ray dissolves into its provenance community's glow, or the node's (glow/NODE).
// Rays held by OTHERS but sourced from the departed keep their units and lose the uid.
// Conservation to the last unit; the glow ledger (server-only) receives the commons' share.
async function releaseDepartingLight(uid: string, heirUid?: string): Promise<{ rays: number; unitsToHeir: number; unitsToGlow: number }> {
    let batch = db.batch();
    let ops = 0;
    const flush = async () => { if (ops > 0) { await batch.commit(); batch = db.batch(); ops = 0; } };
    const step = async () => { if (++ops >= 400) await flush(); };

    const held = await db.collection("rays").where("holderUid", "==", uid).get();
    const glowAdds = new Map<string, number>();
    let unitsToHeir = 0;
    let unitsToGlow = 0;
    for (const d of held.docs) {
        const r = d.data() as Record<string, any>;
        const release = releaseRay(
            { units: typeof r.units === "number" ? r.units : 0, communityId: r.communityId ? String(r.communityId) : null },
            !!heirUid,
        );
        if (release.glow > 0) {
            glowAdds.set(release.glowHome, (glowAdds.get(release.glowHome) || 0) + release.glow);
            unitsToGlow += release.glow;
        }
        if (heirUid && release.toHeir > 0) {
            unitsToHeir += release.toHeir;
            batch.update(d.ref, {
                holderUid: heirUid,
                units: release.toHeir,
                inheritedAt: FieldValue.serverTimestamp(),
                ...(r.sourceUid === uid ? { sourceUid: "departed" } : {}),
            });
        } else {
            batch.delete(d.ref);
        }
        await step();
    }
    for (const [home, units] of glowAdds) {
        batch.set(db.doc(`glow/${home}`), {
            units: FieldValue.increment(units),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        await step();
    }
    // The witness sevenths (and gifts) others hold keep shining; only the departed uid unlinks.
    const sourced = await db.collection("rays").where("sourceUid", "==", uid).get();
    for (const d of sourced.docs) {
        if ((d.data() as Record<string, any>).holderUid === uid) continue; // released above
        batch.update(d.ref, { sourceUid: "departed" });
        await step();
    }
    await flush();
    return { rays: held.size, unitsToHeir, unitsToGlow };
}

async function purgeUserData(uid: string, heirUid?: string) {
    // The light first (the last spend), while the rest of the record still exists.
    const light = await releaseDepartingLight(uid, heirUid);
    const deleteWhere = async (coll: string, field: string) => {
        const qs = await db.collection(coll).where(field, "==", uid).get();
        for (let i = 0; i < qs.docs.length; i += 400) {
            const batch = db.batch();
            qs.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
        return qs.size;
    };
    const counts = {
        lifetrees: await deleteWhere("lifetrees", "ownerId"),
        pulses: await deleteWhere("pulses", "authorId"),
        visions: await deleteWhere("visions", "authorId"),
        links: await deleteWhere("links", "from"),
        ...light,
    };
    await db.collection("persons").doc(uid).delete().catch(() => undefined);
    await db.collection("users").doc(uid).delete().catch(() => undefined);
    try {
        await getAuth().deleteUser(uid);
    } catch (raw: unknown) {
        const e = (raw ?? {}) as { code?: string; message?: string };
        // A missing Auth record is already the goal state (idempotent re-runs land here). Any
        // OTHER failure must surface: reporting success while the sign-in survives would leave
        // a live key to a purged account (Lumo's review, 2026-07-21). The data deletes above are
        // idempotent, so the caller simply runs the deletion again.
        if (e.code !== "auth/user-not-found") {
            throw new HttpsError("internal", `The data was removed but the sign-in could not be: ${e.message || raw}. Run the deletion again.`);
        }
    }
    return counts;
}

export const deleteUserAsAdmin = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    const callerUid = request.auth.uid;
    const targetUid = String(request.data?.uid || "").trim();
    if (!targetUid) throw new HttpsError("invalid-argument", "A target uid is required.");

    const superadmin = await db.collection("config").doc("superadmin").get();
    const callerIsSuper = superadmin.exists && superadmin.data()?.uid === callerUid;
    if (!(callerIsSuper || (await db.collection("admins").doc(callerUid).get()).exists)) {
        throw new HttpsError("permission-denied", "Staff only.");
    }
    if (superadmin.exists && superadmin.data()?.uid === targetUid && !callerIsSuper) {
        throw new HttpsError("permission-denied", "The node owner cannot be deleted.");
    }
    // Only the node owner may delete a fellow admin (protects the admin hierarchy).
    if (!callerIsSuper && (await db.collection("admins").doc(targetUid).get()).exists) {
        throw new HttpsError("permission-denied", "Only the node owner can delete an admin.");
    }

    const counts = await purgeUserData(targetUid);
    return { deleted: true, ...counts };
});

// Self-serve account deletion — the being erases itself. Server-side (admin) so the Auth user is
// removed cleanly regardless of how recently they signed in; the client used to delete the docs
// first and then fail on `requires-recent-login`, leaving the Auth user alive with no profile.
export const deleteMyAccount = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    const uid = request.auth.uid;
    // The last spend's chosen heir (optional): must be another, existing being. Only the
    // SELF-SERVE path may name one; an admin deletion always follows the community cascade.
    let heirUid: string | undefined;
    const heirRaw = request.data?.heirUid;
    if (heirRaw !== undefined && heirRaw !== null && heirRaw !== "") {
        if (typeof heirRaw !== "string" || heirRaw === uid) throw new HttpsError("invalid-argument", "The heir must be another being.");
        const heirSnap = await db.collection("persons").doc(heirRaw).get();
        if (!heirSnap.exists) throw new HttpsError("not-found", "The chosen heir was not found.");
        heirUid = heirRaw;
    }
    // A farewell before the record is gone (best-effort; never blocks the deletion).
    try {
        const record = await getAuth().getUser(uid).catch(() => null);
        if (record?.email) {
            const text = "It was wonderful to have you. See you!";
            await writeMail({ to: [record.email], subject: `Goodbye from ${charter.name}`, html: composeSystemEmailHtml(text, NODE_ORIGIN, "lightseed"), text, uid });
        }
    } catch (e) { console.warn("Goodbye email skipped:", e); }
    const counts = await purgeUserData(uid, heirUid);
    return { deleted: true, ...counts };
});

// --- The SSO door's mint (ring 2026-09-02) ----------------------------------------------------
// A signed-in caller receives a custom token for their OWN uid — no privilege moves, the token
// only re-speaks the session's identity — so a mother page beside a seed face (theohouse.org
// beside seed.theohouse.org) can sign in as the same person. WHO may ask is the door's law
// (src/domain/ssoDoor.ts + the /sso.html frame); this hand only ever answers with the asker's
// own name, so an unexpected caller gains nothing they do not already hold.
// Deploy hand, once: createCustomToken signs via IAM signBlob, so the functions runtime
// service account needs roles/iam.serviceAccountTokenCreator on itself.
export const mintSsoToken = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "The mint answers only the signed-in.");
    const token = await getAuth().createCustomToken(request.auth.uid);
    return { token };
});
