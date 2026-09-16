// letters.ts — split from index.ts (ring 2026-09-16); every function keeps its name, trigger and options.
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { charter, NODE_ORIGIN, mailFromOf, charterOwnDomains } from "./charter";
import { audienceOf, newsletterSendRefusal } from "./newsletter";
import { db, escapeHtml, isStaffUid, placeOfCommunity, voiceOf } from "./core";

// --- Newsletter (in-house, via the `mail` collection) ----------------------------------------
// Staff-gated. Fans out one `mail` doc per subscriber with a per-person unsubscribe token +
// List-Unsubscribe headers + a footer, CAN-SPAM/GDPR-safe, on our own pipeline (no third party).
// (isStaffUid is defined once near the top of this file, alongside the quota helpers.)

// Newsletter — in-house fan-out. Staff-only. Writes ONE `mail` doc per recipient (never a shared
// `to:`, which would leak addresses and break per-person unsubscribe), each with that
// subscriber's opaque unsubscribe token in the footer + List-Unsubscribe headers (RFC 8058).
// Writes are committed in throttled batches so a large list doesn't hammer Firestore at once.
export const sendNewsletterEmails = onCall({ timeoutSeconds: 300, memory: "512MiB", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    const uid = request.auth.uid;
    const subject = String(request.data?.subject || "").trim();
    const html = String(request.data?.html || "").trim();
    const communityId = String(request.data?.communityId || "").trim();
    if (!subject || !html) throw new HttpsError("invalid-argument", "Subject and content are required.");
    if (!communityId) throw new HttpsError("invalid-argument", "A place is required.");

    // THE LETTER OF A PLACE (ring 2026-09-08, domain/newsletter mirrored in ./newsletter): the
    // letter is the community's; its keepers (the founding ownerId or a keeper link) send it,
    // the node's staff send the node's own; the audience is those who SUBSCRIBED at the place.
    const communitySnap = await db.collection("communities").doc(communityId).get();
    if (!communitySnap.exists) throw new HttpsError("not-found", "That place does not exist.");
    const community = communitySnap.data() as Record<string, any>;
    const home = String(community.domain || "").toLowerCase();
    const keeperLink = await db.collection("links").doc(`${uid}__keeper__${communityId}`).get();
    const isKeeper = community.ownerId === uid || keeperLink.exists;
    const isStaff = await isStaffUid(uid);
    const isNodePlace = charterOwnDomains(charter).includes(home);

    const subsSnap = await db.collection("subscriptions").where("domain", "==", home).get();
    type SubRow = { ref: FirebaseFirestore.DocumentReference; email?: unknown; active?: unknown; domain?: unknown; unsubToken?: unknown; uid?: unknown };
    const subs = audienceOf(subsSnap.docs.map((d): SubRow => ({ ref: d.ref, ...(d.data() as Record<string, unknown>) })), home);
    const refusal = newsletterSendRefusal({ isKeeper, isStaff, isNodePlace, audience: subs.length });
    if (refusal === "newsletter_not_keeper") throw new HttpsError("permission-denied", refusal);
    if (refusal) throw new HttpsError("failed-precondition", refusal);

    const place = { name: String(community.name || home), domain: home };
    const from = mailFromOf(charter, place);
    // The footer wears the place's voice (ring 2026-09-16): its primary on the unsubscribe
    // link, its own footer line under it (the node's postal line while it has none).
    const voice = voiceOf(placeOfCommunity(community as Record<string, unknown>, home));
    let sent = 0;
    const CHUNK = 100; // commit mail writes (and any token backfills) in throttled batches
    for (let i = 0; i < subs.length; i += CHUNK) {
        const slice = subs.slice(i, i + CHUNK);
        const batch = db.batch();
        for (const sub of slice) {
            const email = String(sub.email);
            // Lazy-generate + persist an opaque unsubscribe token for subscribers without one.
            let token = sub.unsubToken as string | undefined;
            if (!token) { token = randomUUID(); batch.set(sub.ref, { unsubToken: token }, { merge: true }); }

            const unsub = `${NODE_ORIGIN}/u/${token}`;
            const footer = `<hr style="border:0;border-top:1px solid #eee;margin:28px 0;"/>`
                + `<p style="font-size:12px;color:#9ca3af;line-height:1.6;">You're receiving this because you subscribed to the letter of ${escapeHtml(place.name)}.<br/>`
                + `<a href="${unsub}" style="color:${voice.primary};">Unsubscribe</a> · ${escapeHtml(voice.footer)}</p>`;
            const mailRef = db.collection("mail").doc();
            // `from` and `headers` at the TOP level — where the extension reads them (see writeMail).
            batch.set(mailRef, {
                to: [email],
                uid: (sub.uid as string | undefined) || null,
                from,
                headers: {
                    "List-Unsubscribe": `<${unsub}>`,
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                },
                message: {
                    subject,
                    html: `${html}${footer}`,
                },
                createdAt: FieldValue.serverTimestamp(),
            });
            sent++;
        }
        await batch.commit();
    }

    // The place's own stamp; the node's legacy stamp keeps moving for the node.
    await communitySnap.ref.set({ newsletterLastSentAt: FieldValue.serverTimestamp(), newsletterLastSubject: subject, newsletterLastSent: sent }, { merge: true });
    if (isNodePlace) await db.collection("config").doc("newsletter").set({ lastSentAt: FieldValue.serverTimestamp(), lastSubject: subject, lastSent: sent }, { merge: true });
    return { sent };
});

// One-click unsubscribe endpoint (the List-Unsubscribe target), rewritten in firebase.json as
// /u/**. Looks up by TOKEN only (never a uid — uids are guessable). Accepts GET (browser link,
// shows a confirmation page) and POST (RFC 8058 one-click, returns 200 with no body).
export const unsubscribe = onRequest({ cors: true }, async (req, res) => {
    // Path is /u/{token}; fall back to ?token= just in case.
    const fromPath = (req.path || "").split("/").filter(Boolean).pop() || "";
    const token = String(fromPath || (req.query.token as string) || "").trim();
    if (!token || token === "u") { res.status(400).send("Missing unsubscribe token."); return; }
    try {
        const snap = await db.collection("subscriptions").where("unsubToken", "==", token).limit(1).get();
        if (!snap.empty) {
            const doc = snap.docs[0];
            await doc.ref.set({ active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
            // Mirror onto the profile toggle if this subscriber has an account — the place's own
            // switch (newsletterPlaces[domain]), and the legacy boolean for the node's letter.
            const data = doc.data() as Record<string, unknown>;
            const uid = typeof data.uid === "string" ? data.uid : null; const domain = String(data.domain || charter.domain);
            if (uid) await db.collection("users").doc(uid).set({ newsletterPlaces: { [domain]: false }, ...(charterOwnDomains(charter).includes(domain) ? { newsletterSubscribed: false } : {}) }, { merge: true }).catch(() => undefined);
        }
        if (req.method === "POST") { res.status(200).end(); return; } // one-click: no body needed
        res.set("Content-Type", "text/html").status(200).send(
            `<html><body style="font-family:sans-serif;text-align:center;padding:48px;color:#334155;"><h2 style="color:#059669;font-weight:300;letter-spacing:1px;">.seed</h2><p>You have been unsubscribed from this letter.</p><p style="color:#9ca3af;font-size:13px;">You can resubscribe anytime from your profile.</p></body></html>`,
        );
    } catch (e) {
        console.error("Unsubscribe failed", e);
        if (req.method === "POST") { res.status(200).end(); return; } // never fail a one-click POST
        res.status(500).send("Could not unsubscribe. Please try again later.");
    }
});
