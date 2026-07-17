import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID, createHash } from "node:crypto";

admin.initializeApp();

const db = admin.firestore();

// --- Email via the Firestore `mail` collection (Firebase Trigger Email extension) -------------
// All outbound email stays in-house: writing a doc to `mail` queues it through the installed
// firestore-send-email extension (Nodemailer under the hood, so `message.headers` are forwarded —
// that's how the newsletter's List-Unsubscribe headers reach the recipient).
const EMAIL_FROM = "lightseed <admin@lightseed.online>";

const writeMail = async (params: { to: string | string[]; subject: string; html: string; text?: string; headers?: Record<string, string>; uid?: string }) => {
    // Firestore rejects any document containing `undefined` (the extension doc write would fail
    // with "Cannot use undefined as a Firestore value"), so optional fields are only set when present.
    const message: any = { from: EMAIL_FROM, subject: params.subject, html: params.html || "" };
    if (params.text) message.text = params.text;
    if (params.headers) message.headers = params.headers;
    await db.collection("mail").add({
        to: Array.isArray(params.to) ? params.to : [params.to],
        uid: params.uid || null,
        message,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
};

// The branded system-email shell, composed SERVER-SIDE so a client can never inject arbitrary
// HTML (previously the client passed a full `html` string — an open phishing relay). Text is
// HTML-escaped; the CTA is only rendered for an already-validated http(s) URL.
const escapeHtml = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const composeSystemEmailHtml = (text: string, ctaUrl: string, ctaLabel: string): string => {
    const body = escapeHtml(text).replace(/\n/g, "<br>");
    const cta = ctaUrl
        ? `<div style="margin:24px 0;"><a href="${ctaUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:9999px;font-size:15px;">${escapeHtml(ctaLabel)}</a></div><p style="font-size:12px;color:#9ca3af;">Or paste this link:<br/><a href="${ctaUrl}" style="color:#059669;word-break:break-all;">${escapeHtml(ctaUrl)}</a></p>`
        : "";
    return `<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;"><h2 style="color: #059669; font-weight: 300; letter-spacing: 1px; margin-bottom: 20px;">.seed</h2><div style="font-size: 16px; margin-bottom: 8px;">${body}</div>${cta}<hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" /><p style="font-size: 12px; color: #9ca3af; text-align: center;">Sent from the <a href="https://lightseed.online" style="color: #059669; text-decoration: none;">Lifetree Network</a></p></div>`;
};

// --- Staff check + server-authoritative daily quotas -----------------------------------------
const isStaffUid = async (uid: string): Promise<boolean> => {
    const [superadmin, adminDoc] = await Promise.all([
        db.collection("config").doc("superadmin").get(),
        db.collection("admins").doc(uid).get(),
    ]);
    return adminDoc.exists || (superadmin.exists && superadmin.data()?.uid === uid);
};

const NODE_AI_TEXT_LIMIT = 21;
const NODE_AI_IMAGE_LIMIT = 3;
const DAILY_EMAIL_LIMIT = 20;

// Atomically check + increment a per-user daily counter in the server-only `usage/{uid}` doc, the
// AUTHORITATIVE gate (the mirrored client counter on the user doc is user-writable, so advisory
// only). Counters reset on the UTC day boundary. Throws resource-exhausted when the cap is hit.
const enforceDailyQuota = async (uid: string, field: string, limit: number): Promise<void> => {
    const ref = db.collection("usage").doc(uid);
    const day = new Date().toISOString().slice(0, 10); // UTC yyyy-mm-dd
    await db.runTransaction(async (t) => {
        const data = (await t.get(ref)).data() as any || {};
        const sameDay = data.day === day;
        const current = sameDay ? (data[field] || 0) : 0;
        if (current >= limit) {
            throw new HttpsError("resource-exhausted", `Daily limit reached (${limit}). It resets at midnight UTC.`);
        }
        if (sameDay) t.set(ref, { [field]: current + 1 }, { merge: true });
        else t.set(ref, { day, [field]: 1 }); // new day: overwrite, clearing yesterday's counters
    });
};

// Secure Gemini API Proxy
export const generateAIContent = onCall({ 
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 300, 
    memory: "1GiB",      
    cors: true 
}, async (request) => {
    // Log request for debugging
    console.log("AI Request received. Authenticated:", !!request.auth);

    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { prompt, contents, model = 'gemini-3.5-flash', config, systemInstruction } = request.data;

    // Server-authoritative free-tier quota (Gemini always runs on the node key). Staff are exempt.
    // Image vs text is INFERRED from the request (image model / IMAGE modality) so a client can't
    // mislabel an image call to draw from the larger text allowance.
    const modalities = Array.isArray(config?.responseModalities)
        ? config.responseModalities.map((m: any) => String(m).toUpperCase()) : [];
    const isImage = /image/i.test(String(model)) || modalities.includes('IMAGE');
    if (!(await isStaffUid(request.auth.uid))) {
        await enforceDailyQuota(
            request.auth.uid,
            isImage ? 'dailyAiImage' : 'dailyAiText',
            isImage ? NODE_AI_IMAGE_LIMIT : NODE_AI_TEXT_LIMIT,
        );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        console.error("GEMINI_API_KEY missing from environment secrets.");
        throw new HttpsError('failed-precondition', 'Gemini API key is not configured on the server.');
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const generativeModel = genAI.getGenerativeModel({
            model: model as string,
            systemInstruction: systemInstruction as string,
            generationConfig: config
        });
        
        const maxRetries = 4; // Increased retries
        let lastError: any;

        for (let i = 0; i <= maxRetries; i++) {
            try {
                console.log(`Attempting generation (${i+1}/${maxRetries+1})...`);
                const formattedContents = contents || [{ role: 'user', parts: [{ text: prompt }] }];
                const result = await generativeModel.generateContent({
                    contents: formattedContents
                });
                
                const response = result.response;

                // Extract an inline image FIRST. Image models return an image part (+ optional text);
                // calling response.text() on a response containing non-text parts throws in this SDK,
                // so pulling the image out before touching .text() is what makes image gen work.
                const candidate = response.candidates?.[0];
                const parts = candidate?.content?.parts || [];

                for (const part of parts) {
                    if (part.inlineData && part.inlineData.data) {
                        const mimeType = part.inlineData.mimeType || 'image/png';
                        let caption = "";
                        try { caption = response.text(); } catch (_) { /* image-only response */ }
                        return {
                            image: `data:${mimeType};base64,${part.inlineData.data}`,
                            text: caption
                        };
                    }
                }

                let text = "";
                try { text = response.text(); } catch (_) { text = ""; }
                return { text: text };
            } catch (error: any) {
                lastError = error;
                const errorText = error.message || "";
                const isRateLimit = errorText.includes('429') || error.status === 429 || errorText.toLowerCase().includes('quota') || errorText.toLowerCase().includes('overwhelmed');
                const isForbidden = errorText.includes('403') || error.status === 403 || errorText.includes('CONSUMER_SUSPENDED');
                
                console.warn(`Attempt ${i+1} failed:`, errorText);

                if (isForbidden) {
                    throw new HttpsError('permission-denied', 'The AI service is currently unavailable. The API key may be suspended or restricted. Please contact support.');
                }

                if (isRateLimit && i < maxRetries) {
                    const delay = Math.pow(2, i) * 2000 + Math.random() * 1000; // Heavier backoff
                    console.warn(`Gemini Rate Limit. Retrying in ${Math.round(delay)}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                if (isRateLimit && i === maxRetries) {
                   throw new HttpsError('resource-exhausted', 'The AI service is currently overwhelmed. Please wait a minute and try again.');
                }
                
                throw error;
            }
        }
        throw lastError;
    } catch (error: any) {
        console.error("Gemini Function Error Final:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message || 'AI Generation failed');
    }
});

// Secure transactional email — queued via the `mail` collection (Trigger Email extension). The
// body is composed SERVER-SIDE from plain text + an optional validated CTA link (the client can
// no longer supply raw HTML), recipients are validated, and each sender is capped per day — so a
// signed-in user can't turn the trusted sender into a phishing/spam relay.
export const sendSystemEmail = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }
    const uid = request.auth.uid;
    const toRaw = request.data?.to;
    const recipients: string[] = (Array.isArray(toRaw) ? toRaw : [toRaw])
        .filter((x: any) => typeof x === 'string' && x.trim())
        .map((x: string) => x.trim());
    const subject = String(request.data?.subject || '').slice(0, 200) || 'A message from lightseed';
    const text = String(request.data?.text || '').slice(0, 4000);
    const ctaUrl = request.data?.ctaUrl ? String(request.data.ctaUrl).slice(0, 500) : '';
    const ctaLabel = request.data?.ctaLabel ? String(request.data.ctaLabel).slice(0, 80) : 'Open';

    const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!recipients.length) throw new HttpsError('invalid-argument', 'A recipient is required.');
    if (recipients.length > 5) throw new HttpsError('invalid-argument', 'Too many recipients.');
    if (!recipients.every((r) => emailRe.test(r))) throw new HttpsError('invalid-argument', 'Invalid recipient address.');
    if (ctaUrl && !/^https?:\/\//i.test(ctaUrl)) throw new HttpsError('invalid-argument', 'Only http(s) links are allowed.');

    if (!(await isStaffUid(uid))) {
        await enforceDailyQuota(uid, 'dailyEmail', DAILY_EMAIL_LIMIT);
    }

    const html = composeSystemEmailHtml(text, ctaUrl, ctaLabel);
    const plain = ctaUrl ? `${text}\n\n${ctaUrl}` : text;
    try {
        await writeMail({ to: recipients, subject, html, text: plain, uid });
        return { success: true };
    } catch (error: any) {
        console.error("Email Error:", error);
        throw new HttpsError('internal', error?.message || 'Failed to queue email.');
    }
});

// Direct-message email delivery: when a reach pulse is created, email the recipient.
// Runs server-side so it can read the recipient's private profile/email (clients cannot
// read other users' docs) without exposing it to the sender. Direct-message email
// notifications are ON by default for everyone (early network) — only an explicit
// users/{uid}.emailNotifications.directMessages === false opts out. Newsletter
// subscription status is intentionally NOT used here.
export const onReachCreated = onDocumentCreated("pulses/{pulseId}", async (event) => {
    const snap = event.data;
    if (!snap) return;
    const pulse = snap.data() as any;

    if (pulse.type !== 'reach') return;

    // Recipients = everyone in the thread for a group reach (participantUids), or the single
    // addressed recipient for a 1:1 (recipientUid). Never the author of the message.
    const participantUids: string[] = Array.isArray(pulse.participantUids) ? pulse.participantUids : [];
    const recipients = (participantUids.length ? participantUids : (pulse.recipientUid ? [pulse.recipientUid] : []))
        .filter((uid: string) => uid && uid !== pulse.authorId);
    if (recipients.length === 0) return;

    // Basic per-thread throttle: at most one DM email per thread per recipient within this
    // window, so a burst of messages in one thread doesn't flood any one inbox.
    // TODO(notifications): consider a digest (e.g. "N new messages") instead of a hard skip.
    const THROTTLE_MS = 10 * 60 * 1000; // 10 minutes
    const threadKey = (pulse.threadId || `${pulse.reachTreeId || ''}_${pulse.lifetreeId || ''}`).replace(/\//g, '_');

    const message: string = pulse.content || pulse.body || '';
    const fromName: string = pulse.authorName || 'A Lifetree';
    const isGroup = participantUids.length > 0 && (pulse.isGroup === true || participantUids.length > 2);
    const audienceName: string = pulse.threadName || pulse.reachTreeName || 'a circle';

    const notify = async (recipientUid: string) => {
        try {
            const userSnap = await db.collection('users').doc(recipientUid).get();
            if (!userSnap.exists) return;
            const user = userSnap.data() as any;

            // Enabled by default; only an explicit false disables direct-message emails.
            if (user?.emailNotifications?.directMessages === false) return;
            const email = user.email;
            if (!email) return;

            const throttleRef = db.collection('mailThrottle').doc(`${recipientUid}__${threadKey}`);
            try {
                const throttleSnap = await throttleRef.get();
                const lastSentAt = throttleSnap.exists ? (throttleSnap.data()?.lastSentAt?.toMillis?.() ?? 0) : 0;
                if (Date.now() - lastSentAt < THROTTLE_MS) return; // recently emailed for this thread
            } catch (e) {
                console.warn("DM email throttle check failed; sending anyway", e);
            }

            const toName: string = isGroup ? audienceName : (pulse.recipientName || pulse.reachTreeName || 'your Lifetree');
            const lead = isGroup
                ? `${fromName} sent a message to ${toName} (a group you're in):`
                : `${fromName} sent a direct message to ${toName}:`;
            const subject = isGroup
                ? `${fromName} messaged ${toName} on lightseed`
                : `${fromName} sent ${toName} a direct message on lightseed`;
            const text = `${lead}\n\n"${message}"\n\nOpen your messages: https://lightseed.online`;
            const html = `<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">` +
                `<h2 style="color: #059669; font-weight: 300; letter-spacing: 1px; margin-bottom: 6px;">.seed</h2>` +
                `<p style="font-size: 13px; color: #9ca3af; margin: 0 0 24px;">A new ${isGroup ? 'group message' : 'direct message'} for <strong style="color:#059669;">${toName}</strong></p>` +
                `<p style="font-size: 15px; margin: 0 0 10px; color:#6b7280;">${lead}</p>` +
                `<blockquote style="font-size: 16px; margin: 0 0 28px; padding: 16px 20px; background:#f0fdf4; border-left: 4px solid #059669; border-radius: 8px; color:#1f2937;">${message.replace(/\n/g, '<br>')}</blockquote>` +
                `<a href="https://lightseed.online" style="display:inline-block; background:#059669; color:#fff; text-decoration:none; font-weight:bold; padding:10px 22px; border-radius:9999px; font-size:14px;">Open your messages</a>` +
                `<hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;" />` +
                `<p style="font-size: 12px; color: #9ca3af;">You receive this because direct-message email notifications are on in your <a href="https://lightseed.online" style="color: #059669; text-decoration: none;">lightseed profile</a>. You can turn this off anytime.</p>` +
                `</div>`;

            await writeMail({ to: [email], subject, html, text, uid: recipientUid });

            // Record the send so the per-thread throttle can skip rapid follow-ups.
            await throttleRef.set({
                lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
                recipientUid,
                threadId: threadKey,
            });
        } catch (error) {
            console.error(`Direct message email to ${recipientUid} failed:`, error);
        }
    };

    await Promise.all(recipients.map(notify));
});

// --- Planting caps, enforced server-side -------------------------------------------------
// The client gate (domain/limits + plantLifetree) is advisory — a direct Firestore write
// bypasses it. This trigger is the backstop: when a tree lands over the node's caps
// (config/limits, defaults 12 lifetrees + 132 guarded per being), the newest over-cap tree
// is uprooted. Quality, not quantity — enforced where it can't be dodged. Staff and the
// system are exempt, mirroring every other quota.
//
// Beds have their own ceilings: exempt from the 12/132 forest caps (furniture is not
// forest), but a HOUSED bed is bounded per Light House — else the open lightHouses create
// plus the bed exemption would reopen an unbounded, cap-exempt write channel into
// `lifetrees` — and a LOOSE bed (no house to bound it) is bounded per keeper.
const MAX_BEDS_PER_LIGHT_HOUSE = 64;
const MAX_LOOSE_BEDS_PER_KEEPER = 32;

// Shared bed-counting, consulted at birth (onLifetreeCreated) and on every home-move
// (onBedHomeMoved). Each count INCLUDES the bed just written, so `> MAX` means the
// ceiling is already breached.
const countBedsInHouse = async (houseId: string): Promise<number> => {
    const beds = await db.collection("lifetrees")
        .where("treeType", "==", "BED")
        .where("lightHouseId", "==", houseId)
        .get();
    return beds.size;
};

// LOOSE beds: the field may be absent or '', so count the keeper's beds and keep only
// the houseless ones.
const countLooseBedsOfKeeper = async (ownerId: string): Promise<number> => {
    const mine = await db.collection("lifetrees")
        .where("treeType", "==", "BED")
        .where("ownerId", "==", ownerId)
        .get();
    return mine.docs.filter((d) => !d.data().lightHouseId).length;
};

export const onLifetreeCreated = onDocumentCreated("lifetrees/{treeId}", async (event) => {
    const snap = event.data;
    if (!snap) return;
    const tree = snap.data() as any;
    const ownerId = tree.ownerId as string;
    if (!ownerId || ownerId === "GENESIS_SYSTEM") return;
    try {
        if (await isStaffUid(ownerId)) return;

        const isBedTree = (t: any) => t.treeType === "BED";

        // Beds (treeType BED, domain/bed.ts) are furniture, not the keeper's personal forest:
        // exempt from the 12/132 caps below, but bounded by their own ceilings. A HOUSED bed
        // counts against its Light House — otherwise anyone could mint a Light House and pour
        // unlimited cap-exempt beds into `lifetrees`. A LOOSE bed (no house — standing at a
        // coordinate under open stars) has no house to bound it, so it counts against its
        // keeper instead. Over either ceiling, the just-created bed is uprooted, mirroring
        // the forest-cap uproot below. (Mass Light-House creation itself remains a broader,
        // pre-existing vector — out of scope here; see root/QUESTIONS.md.)
        if (isBedTree(tree)) {
            const houseId = String(tree.lightHouseId ?? "");
            if (houseId === "") {
                const loose = await countLooseBedsOfKeeper(ownerId);
                if (loose > MAX_LOOSE_BEDS_PER_KEEPER) {
                    await snap.ref.delete();
                    console.warn(`Loose-bed cap enforced: uprooted ${snap.id} (keeper ${ownerId}, ${loose} loose beds vs ${MAX_LOOSE_BEDS_PER_KEEPER}).`);
                }
                return;
            }
            const housed = await countBedsInHouse(houseId);
            if (housed > MAX_BEDS_PER_LIGHT_HOUSE) {
                await snap.ref.delete();
                console.warn(`Bed cap enforced: uprooted ${snap.id} (lightHouse ${houseId}, ${housed} beds vs ${MAX_BEDS_PER_LIGHT_HOUSE}).`);
            }
            return;
        }

        const [limitsSnap, mine] = await Promise.all([
            db.collection("config").doc("limits").get(),
            db.collection("lifetrees").where("ownerId", "==", ownerId).get(),
        ]);
        const num = (v: any, fallback: number) => {
            const n = Number(v);
            return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
        };
        const raw = limitsSnap.exists ? limitsSnap.data() : {};
        const maxLifetrees = num(raw?.maxLifetrees, 12);
        const maxGuardedTrees = num(raw?.maxGuardedTrees, 132);

        const isGuardedTree = (t: any) => t.treeType === "GUARDED" || (!t.treeType && t.isNature === true);
        const trees = mine.docs.map((d) => d.data()).filter((t) => !isBedTree(t));
        const guarded = trees.filter(isGuardedTree).length;
        const lifetrees = trees.length - guarded;
        const over = isGuardedTree(tree) ? guarded > maxGuardedTrees : lifetrees > maxLifetrees;
        if (!over) return;

        await snap.ref.delete();
        console.warn(`Planting cap enforced: uprooted ${snap.id} (owner ${ownerId}, ${lifetrees} lifetrees / ${guarded} guarded vs ${maxLifetrees}/${maxGuardedTrees}).`);
    } catch (e) {
        console.error(`Planting cap check failed for ${snap.id}:`, e);
    }
});

// A bed's home is SOFT — `lightHouseId` may change after birth (loose ↔ housed, house to
// house), so the create-time ceilings above would be paper walls if the edit path could
// walk around them: plant 64 housed beds, edit them all loose, plant 64 more... Every
// HOME-MOVE therefore re-consults the DESTINATION's ceiling. A breaching move is REVERTED
// — the home returns to its prior value — never deleted: an established bed may already
// carry stays and leaves; only the newborn is uprooted (create path above).
//
// Loop-safety: we act only when the home actually changed, and only the DESTINATION is
// consulted — the source held this bed a moment ago, so returning there is within cap in
// the common case, and the revert's own echo-trigger finds its destination within cap and
// rests. If BOTH homes breach (caps crossed by concurrent moves), the bed is left LOOSE
// with a log line rather than ping-ponged between two full houses: loose is the absorbing
// state, so every path converges after at most one revert write.
export const onBedHomeMoved = onDocumentUpdated("lifetrees/{treeId}", async (event) => {
    const before = event.data?.before.data() as any;
    const after = event.data?.after.data() as any;
    if (!before || !after || after.treeType !== "BED") return;
    const beforeHouse = String(before.lightHouseId ?? "");
    const afterHouse = String(after.lightHouseId ?? "");
    if (beforeHouse === afterHouse) return; // no home-move — nothing to guard

    const ownerId = String(after.ownerId ?? "");
    if (!ownerId || ownerId === "GENESIS_SYSTEM") return;
    try {
        if (await isStaffUid(ownerId)) return; // staff stay exempt, mirroring every quota

        // Is the DESTINATION over its ceiling, with this bed now counted inside it?
        const overCap = afterHouse === ""
            ? (await countLooseBedsOfKeeper(ownerId)) > MAX_LOOSE_BEDS_PER_KEEPER
            : (await countBedsInHouse(afterHouse)) > MAX_BEDS_PER_LIGHT_HOUSE;
        if (!overCap) return;

        // Would returning breach the source house too? (+1: the bed would re-enter that count.)
        const sourceWouldBreach = beforeHouse !== ""
            && (await countBedsInHouse(beforeHouse)) + 1 > MAX_BEDS_PER_LIGHT_HOUSE;

        if (afterHouse === "" && sourceWouldBreach) {
            // Both homes breach and the bed already stands loose: leave it under open
            // stars and say so — a write would only ping-pong between two full homes.
            console.warn(`Bed cap: both homes of ${event.params.treeId} breach; left loose (keeper ${ownerId}).`);
            return;
        }
        const revertTo = sourceWouldBreach ? "" : beforeHouse;
        await event.data!.after.ref.update({ lightHouseId: revertTo });
        console.warn(`Bed cap enforced on home-move: ${event.params.treeId} sent home to ${revertTo === "" ? "the open stars (loose)" : revertTo} — destination ${afterHouse === "" ? "loose" : afterHouse} is over its ceiling (keeper ${ownerId}).`);
    } catch (e) {
        console.error(`Bed home-move cap check failed for ${event.params.treeId}:`, e);
    }
});

// --- Beds: availability + the leaves of who stayed -------------------------------------------
// A stay is a request to sleep in a specific BED (domain/stay.ts). Two server duties keep a bed's
// calendar honest and its story permanent.
const stayRangesOverlap = (a: { fromDate: string; toDate: string }, b: { fromDate: string; toDate: string }): boolean =>
    a.fromDate < b.toDate && b.fromDate < a.toDate; // half-open [from, to) — the departure day is free

// When a keeper ACCEPTS a stay: refuse a double-booking (a bed holds one guest at a time), then
// publish the identity-free occupancy so any guest sees busy/free nights. When a stay LEAVES
// 'accepted' (declined or withdrawn/deleted), withdraw that occupancy. Reverting a conflicting
// accept to 'declined' re-fires this trigger (accepted→declined), which finds no occupancy to
// remove and rests — convergent. (In the rare case a keeper accepts two overlapping requests in
// the very same instant, both may be declined; that is safe — a bed is never double-booked — and
// the keeper simply re-accepts one.)
export const onStayWritten = onDocumentWritten("stays/{stayId}", async (event) => {
    const before = event.data?.before?.data() as Record<string, unknown> | undefined;
    const after = event.data?.after?.data() as Record<string, unknown> | undefined;
    const stayId = event.params.stayId;
    const wasAccepted = before?.status === "accepted";
    const isAccepted = after?.status === "accepted";
    try {
        if (isAccepted && !wasAccepted && after) {
            const bedId = String(after.bedId || "");
            if (!bedId) return;
            const range = { fromDate: String(after.fromDate || ""), toDate: String(after.toDate || "") };
            const others = await db.collection("stays")
                .where("bedId", "==", bedId).where("status", "==", "accepted").get();
            const conflict = others.docs.some(d =>
                d.id !== stayId && stayRangesOverlap(d.data() as { fromDate: string; toDate: string }, range));
            if (conflict) {
                await event.data!.after!.ref.update({ status: "declined" });
                console.warn(`Bed double-booking refused: stay ${stayId} on bed ${bedId} overlaps an accepted stay — declined.`);
                return;
            }
            await db.doc(`lifetrees/${bedId}/occupancy/${stayId}`).set(range);
        } else if (wasAccepted && !isAccepted && before) {
            const bedId = String(before.bedId || "");
            if (bedId) await db.doc(`lifetrees/${bedId}/occupancy/${stayId}`).delete().catch(() => { /* already gone */ });
        }
    } catch (e) {
        console.error(`onStayWritten failed for ${stayId}:`, e);
    }
});

// The legacy block hash — sha256(JSON.stringify(pulseData) + previousHash + mintedAt) — the exact
// scheme mintPulse (src/services/firebase/pulses.ts) uses for an UNSEALED chain. A bed is not a
// node, so its chain is unsealed; the same UTF-8 preimage yields the same digest in Node, so a bed
// stays verifiable under src/domain/chain (linkage + height; legacy blocks aren't re-hashed).
const legacyBlockHash = (pulseData: object, previousHash: string, mintedAt: number): string =>
    createHash("sha256").update(JSON.stringify(pulseData) + previousHash + mintedAt).digest("hex");

// Seal ONE completed stay as a leaf on its bed's chain — atomically and idempotently: the mint,
// the bed's new head, and the stay's `leafed` flag ride a single transaction, so a leaf is never
// minted twice and concurrent mints cannot fork the chain (previousHash is always the freshly-read
// head). Mirrors mintPulse: the hashed `pulseData` is the immutable content; the stored doc adds id
// / lid / mintedAt / previousHash / createdAt / hash around it.
const mintStayLeaf = async (stayId: string): Promise<void> => {
    const stayRef = db.doc(`stays/${stayId}`);
    await db.runTransaction(async (t) => {
        const staySnap = await t.get(stayRef);
        const s = staySnap.data() as Record<string, any> | undefined;
        if (!staySnap.exists || !s || s.leafed || s.status !== "accepted") return;
        const bedRef = db.doc(`lifetrees/${s.bedId}`);
        const bedSnap = await t.get(bedRef);
        if (!bedSnap.exists) return;
        const bed = bedSnap.data() as Record<string, any>;
        const prevHash = String(bed.latestHash || bed.genesisHash || "0");
        const mintedAt = Date.now();
        const pulseData: Record<string, unknown> = {
            lifetreeId: s.bedId,
            type: "stay",
            visibility: "node",
            // The leaf wears the guest's chosen tree face only — never their human display name.
            // A guest who picked no tree stays anonymous ("A guest"); the node-visible chain must
            // not become an identity-linked whereabouts record for a real (loose-bed) coordinate.
            title: s.guestTreeName || "A guest",
            body: `stayed ${s.fromDate} → ${s.toDate}`,
            authorId: s.uid,
            authorName: s.guestTreeName || "",
            ...(s.guestTreeGrowthUrl ? { imageUrl: s.guestTreeGrowthUrl } : {}),
        };
        const hash = legacyBlockHash(pulseData, prevHash, mintedAt);
        const pulseRef = db.collection("pulses").doc();
        t.set(pulseRef, {
            ...pulseData,
            lid: randomUUID(),
            id: pulseRef.id,
            loveCount: 0,
            commentCount: 0,
            mintedAt,
            previousHash: prevHash,
            stayId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            hash,
        });
        t.update(bedRef, { latestHash: hash, blockHeight: (bed.blockHeight || 0) + 1 });
        t.update(stayRef, { leafed: true });
    });
};

// Daily: every accepted stay whose departure has passed and that isn't yet leafed becomes a
// permanent leaf on its bed's chain — the record of who stayed.
export const mintStayLeaves = onSchedule("every day 03:00", async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const snap = await db.collection("stays").where("status", "==", "accepted").get();
    for (const d of snap.docs) {
        const s = d.data() as Record<string, any>;
        if (s.leafed || !(String(s.toDate || "") < today)) continue;
        try {
            await mintStayLeaf(d.id);
        } catch (e) {
            console.error(`mintStayLeaf failed for stay ${d.id}:`, e);
        }
    }
});

// Community join requests: when a join_request link lands (someone pressed Join on a
// community), email that community's keeper. Server-side because the keeper's email lives on
// their private user doc, which the requester can never read. The Members tab is where the
// keeper accepts or declines; this email just carries the knock to their door.
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
        const ownerId = community.ownerId as string;
        // Bound the fan-out: a knock reaches the owner and up to a few stewards, never an
        // unbounded blast (each recipient is one queued email against the node's quota).
        const MAX_KNOCK_RECIPIENTS = 6;
        const keeperIds = Array.from(new Set(
            [ownerId, ...stewardSnap.docs.map((d) => (d.data() as any).from as string)]
                .filter((uid) => uid && uid !== link.from),
        )).slice(0, MAX_KNOCK_RECIPIENTS);
        if (keeperIds.length === 0) return;

        const requester = (personSnap.exists && (personSnap.data() as any)?.displayName) || "Someone";
        const communityName = community.name || "your community";
        const text = `${requester} asked to join ${communityName}.\n\nYou can accept or decline on the community's Members tab.`;
        const html = composeSystemEmailHtml(text, "https://lightseed.online", "Open lightseed");
        await Promise.all(keeperIds.map(async (uid) => {
            const keeper = await db.collection("users").doc(uid).get();
            const email = keeper.exists ? (keeper.data() as any)?.email : null;
            if (!email) return;
            await writeMail({
                to: [email],
                subject: `${requester} asked to join ${communityName}`,
                html,
                text: `${text}\n\nhttps://lightseed.online`,
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
    if (!nodeCommunityId || !memberUid || !inviterUid) return; // a plain (nodeless) invite: no membership

    try {
        const [community, inviterMember] = await Promise.all([
            db.collection("communities").doc(nodeCommunityId).get(),
            db.collection("links").doc(`${inviterUid}__member__${nodeCommunityId}`).get(),
        ]);
        if (!community.exists) return;
        const inviterBelongs = (community.data() as any)?.ownerId === inviterUid || inviterMember.exists;
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
                lid: randomUUID(), type: "link", rel, from: memberUid, to: nodeCommunityId,
                inviteId: event.params.inviteId, invitedBy: inviterUid,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            if (!m.exists) tx.set(memberRef, edge("member"));
            if (!p.exists) tx.set(provRef, edge("invited_by"));
        });
    } catch (e) {
        console.error("Node membership mint failed:", e);
    }
});

// --- Tree Circle: accept a co-ownership / guardianship invite -------------------
// Protected multi-document mutation: writes the tree's role array AND the rooted
// community. Runs with admin rights so the invitee never writes those docs directly.
const VALID_ROLES = ["co_owner", "guardian", "observer", "steward"];

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
        const inviteRef = db.collection("treeOwnershipInvites").doc(inviteId);
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

        // Role + membership are LINKS now (the LIN). The tree/community docs no longer carry the
        // legacy arrays. Deterministic ids keep these writes idempotent.
        const setLink = (from: string, rel: string, to: string) => {
            tx.set(db.collection("links").doc(`${from}__${rel}__${to}`), {
                lid: randomUUID(),
                type: "link",
                rel,
                from,
                to,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        };

        const treeUpdate: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        let communityId: string = tree.communityId;
        if (!communityId) {
            const communityRef = db.collection("communities").doc();
            communityId = communityRef.id;
            tx.set(communityRef, {
                name: `${tree.name || "Lifetree"} Circle`,
                rootLifetreeId: invite.lifetreeId,
                founderUserId: tree.ownerId,
                ownerId: tree.ownerId,
                formation: "tree_co_ownership",
                visibility: "invited",
                domain: tree.domain || "",
                vision: "",
                imageUrls: [],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            setLink(tree.ownerId, "member", communityId); // the founder is a member of the circle
            treeUpdate.communityId = communityId;
        }
        setLink(uid, "member", communityId);          // the invitee joins the circle community
        setLink(uid, invite.role, invite.lifetreeId); // ...and takes their tree-circle role
        // Relations live ONLY in the links collection (the single source of truth the rules +
        // resolveCircleUids read). No legacy role arrays are written.

        tx.update(treeRef, treeUpdate);
        tx.update(inviteRef, {
            status: "accepted",
            acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { communityId, lifetreeId: invite.lifetreeId };
    });
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
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { status: "created" };
});

// ---------------------------------------------------------------------------
// Intelligence Commons — provider credentials + live Claude (Anthropic)
//
// SECURITY: provider API keys live ONLY in the `providerCredentials` collection,
// which Firestore rules make completely unreadable/unwritable by clients. Keys
// reach the server over the encrypted callable channel and are read back only
// here, with the Admin SDK. They never touch a browser.
// ---------------------------------------------------------------------------

const credentialDocId = (scope: string, ownerId: string, provider: string) =>
    `${scope}_${ownerId}_${provider}`;

// May the caller set a key for this scope/owner?
//  - user scope:      only for their own uid
//  - community scope: the community owner, or any staff/superadmin
const canManageCredential = async (uid: string, scope: string, ownerId: string): Promise<boolean> => {
    if (scope === "user") return ownerId === uid;
    if (scope === "community") {
        if (!ownerId) return false;
        const [community, superadmin, adminDoc] = await Promise.all([
            db.collection("communities").doc(ownerId).get(),
            db.collection("config").doc("superadmin").get(),
            db.collection("admins").doc(uid).get(),
        ]);
        if (community.exists && community.data()?.ownerId === uid) return true;
        if (superadmin.exists && superadmin.data()?.uid === uid) return true;
        if (adminDoc.exists) return true;
    }
    return false;
};

// Who may SPEND a stored credential (the use path, broader than manage):
//  - user scope:      only the key's owner
//  - community scope: any member of the community (member link), its owner, or staff
// Mirrors the `isCommunityMember` gate in firestore.rules. A caller who fails this check
// is NOT rejected — generateClaudeContent silently falls back to the node key — so
// unauthorized callers simply can't spend someone else's BYO key.
const canUseCredential = async (uid: string, scope: string, ownerId: string): Promise<boolean> => {
    if (!ownerId) return false;
    if (scope === "user") return ownerId === uid;
    if (scope === "community") {
        const [memberLink, community, superadmin, adminDoc] = await Promise.all([
            db.collection("links").doc(`${uid}__member__${ownerId}`).get(),
            db.collection("communities").doc(ownerId).get(),
            db.collection("config").doc("superadmin").get(),
            db.collection("admins").doc(uid).get(),
        ]);
        if (memberLink.exists) return true;
        if (community.exists && community.data()?.ownerId === uid) return true;
        if (superadmin.exists && superadmin.data()?.uid === uid) return true;
        if (adminDoc.exists) return true;
    }
    return false;
};

// Store / rotate / remove a provider key. An empty key removes the credential.
// Returns a non-secret hint the client can display ("connected" + last 4 chars).
export const saveProviderCredential = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    const uid = request.auth.uid;
    const scope = String(request.data?.scope || "");
    const ownerId = String(request.data?.ownerId || "");
    const provider = String(request.data?.provider || "");
    const key = String(request.data?.key || "").trim();
    const intelligenceId = request.data?.intelligenceId ? String(request.data.intelligenceId) : null;

    if (!["user", "community"].includes(scope)) throw new HttpsError("invalid-argument", "Bad scope.");
    if (!["anthropic", "openai", "deepseek", "google"].includes(provider)) throw new HttpsError("invalid-argument", "Unknown provider.");
    if (!(await canManageCredential(uid, scope, ownerId))) throw new HttpsError("permission-denied", "Not allowed to set this key.");

    const ref = db.collection("providerCredentials").doc(credentialDocId(scope, ownerId, provider));

    if (!key) {
        await ref.delete().catch(() => undefined);
        if (intelligenceId) {
            await db.collection("intelligences").doc(intelligenceId)
                .set({ connected: false, keyHint: admin.firestore.FieldValue.delete() }, { merge: true }).catch(() => undefined);
        }
        return { connected: false };
    }

    const keyHint = key.length > 4 ? `…${key.slice(-4)}` : "set";
    await ref.set({
        provider, scope, ownerId, key,
        keyHint,
        updatedBy: uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Mirror the non-secret connection status onto the intelligence so the UI can show it.
    if (intelligenceId) {
        await db.collection("intelligences").doc(intelligenceId)
            .set({ connected: true, keyHint, credentialScope: scope, credentialOwnerId: ownerId }, { merge: true }).catch(() => undefined);
    }
    return { connected: true, keyHint };
});

// Live Claude (Anthropic) proxy. Resolves a BYO key for the given scope/owner,
// falling back to the node-wide ANTHROPIC_API_KEY secret when none is configured.
export const generateClaudeContent = onCall({
    secrets: ["ANTHROPIC_API_KEY"],
    timeoutSeconds: 120,
    memory: "512MiB",
    cors: true,
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");

    const messages = Array.isArray(request.data?.messages) ? request.data.messages : [];
    const systemInstruction = String(request.data?.systemInstruction || "");
    const model = String(request.data?.model || "claude-sonnet-5");
    const credential = request.data?.credential as { scope?: string; ownerId?: string } | undefined;

    // Resolve the key: BYO (user/community) first, node secret as fallback. The caller may
    // only spend a BYO key they're entitled to (own user key, or a community they belong to);
    // otherwise we ignore the named credential and fall through to the node key below.
    let apiKey: string | undefined;
    let usedByoKey = false;
    if (credential?.scope && credential.scope !== "node" && credential.ownerId
        && await canUseCredential(request.auth.uid, credential.scope, credential.ownerId)) {
        const snap = await db.collection("providerCredentials")
            .doc(credentialDocId(credential.scope, credential.ownerId, "anthropic")).get();
        if (snap.exists) { apiKey = snap.data()?.key; usedByoKey = !!apiKey; }
    }
    if (!apiKey) apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new HttpsError("failed-precondition", "No Claude key is connected for this intelligence yet.");
    }
    // The node free-tier quota applies only when spending the node key; BYO keys are unmetered.
    if (!usedByoKey && !(await isStaffUid(request.auth.uid))) {
        await enforceDailyQuota(request.auth.uid, "dailyAiText", NODE_AI_TEXT_LIMIT);
    }

    // Map our transcript (user|model) to Anthropic's (user|assistant); it must open on a user
    // turn. A message may carry image(s) (base64, no data: prefix) for vision — those become
    // Anthropic image content blocks ahead of the text.
    const mapped = messages
        .map((m: any) => {
            const role = m.role === "model" ? "assistant" : "user";
            const imgs = Array.isArray(m.images) ? m.images : (m.image ? [m.image] : []);
            if (imgs.length) {
                const blocks: any[] = imgs
                    .filter((im: any) => im && im.data)
                    .map((im: any) => ({
                        type: "image",
                        source: { type: "base64", media_type: im.mimeType || "image/webp", data: im.data },
                    }));
                if (m.text) blocks.push({ type: "text", text: String(m.text) });
                return { role, content: blocks };
            }
            return { role, content: String(m.text || "") };
        })
        .filter((m: any) => (typeof m.content === "string" ? m.content : m.content.length));
    const firstUser = mapped.findIndex((m: any) => m.role === "user");
    const convo = firstUser === -1 ? [] : mapped.slice(firstUser);
    if (convo.length === 0) return { text: "" };

    try {
        const client = new Anthropic({ apiKey });
        const result = await client.messages.create({
            model,
            max_tokens: 1024,
            system: systemInstruction || undefined,
            messages: convo as any,
        });
        const text = (result.content || [])
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("");
        return { text };
    } catch (error: any) {
        console.error("Claude generation error:", error?.message || error);
        const status = error?.status;
        if (status === 401 || status === 403) {
            throw new HttpsError("permission-denied", "The Claude key was rejected. Please check it in your AI settings.");
        }
        if (status === 429) {
            throw new HttpsError("resource-exhausted", "Claude is rate-limited right now. Please try again in a moment.");
        }
        throw new HttpsError("internal", error?.message || "Claude generation failed.");
    }
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

const tsToMs = (t: any): number =>
    t?.toMillis ? t.toMillis() : (t instanceof Date ? t.getTime() : (typeof t === "number" ? t : 0));

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
    if (daysOverdue <= 0) return `${stage === "potted" ? "I'm a seed in my pot 🌱 and" : "I'm"} ready for watering 💧 — could a guardian tend me today?`;
    if (daysOverdue === 1) return `${stage === "potted" ? "I'm a seed in my pot 🌱 getting thirsty" : "I'm getting thirsty 💧"} — it's been a day past my watering. Could a guardian tend me?`;
    return `${self} — it's been ${daysOverdue} days past my watering. Could a guardian tend me? — ${who}`;
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

                    await db.collection("pulses").add({
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
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    });

                    updates["watering.lastAlertAt"] = admin.firestore.FieldValue.serverTimestamp();
                    updates["watering.alertThreadId"] = threadId;
                }
            }

            await docSnap.ref.update(updates);
        } catch (e) {
            console.error(`Watering check failed for tree ${docSnap.id}:`, e);
        }
    }
});

// --- Newsletter (in-house, via the `mail` collection) ----------------------------------------
// Staff-gated. Fans out one `mail` doc per subscriber with a per-person unsubscribe token +
// List-Unsubscribe headers + a footer, CAN-SPAM/GDPR-safe, on our own pipeline (no third party).
// (isStaffUid is defined once near the top of this file, alongside the quota helpers.)

// Physical postal address for the newsletter footer (CAN-SPAM). TODO: replace with the real
// registered address before sending at volume.
const NEWSLETTER_POSTAL_ADDRESS = "TODO: lightseed — add postal address here";

// Newsletter — in-house fan-out. Staff-only. Writes ONE `mail` doc per recipient (never a shared
// `to:`, which would leak addresses and break per-person unsubscribe), each with that
// subscriber's opaque unsubscribe token in the footer + List-Unsubscribe headers (RFC 8058).
// Writes are committed in throttled batches so a large list doesn't hammer Firestore at once.
export const sendNewsletterEmails = onCall({ timeoutSeconds: 300, memory: "512MiB", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    if (!(await isStaffUid(request.auth.uid))) throw new HttpsError("permission-denied", "Staff only.");
    const subject = String(request.data?.subject || "").trim();
    const html = String(request.data?.html || "").trim();
    if (!subject || !html) throw new HttpsError("invalid-argument", "Subject and content are required.");

    // Authoritative send list: the `subscriptions` collection where active === true.
    const subsSnap = await db.collection("subscriptions").get();
    const subs = subsSnap.docs.filter(d => { const s = d.data() as any; return s.email && s.active === true; });
    if (subs.length === 0) throw new HttpsError("failed-precondition", "No active subscribers.");

    let sent = 0;
    const CHUNK = 100; // commit mail writes (and any token backfills) in throttled batches
    for (let i = 0; i < subs.length; i += CHUNK) {
        const slice = subs.slice(i, i + CHUNK);
        const batch = db.batch();
        for (const doc of slice) {
            const data = doc.data() as any;
            const email = String(data.email);
            // Lazy-generate + persist an opaque unsubscribe token for subscribers without one.
            let token = data.unsubToken as string | undefined;
            if (!token) { token = randomUUID(); batch.set(doc.ref, { unsubToken: token }, { merge: true }); }

            const unsub = `https://lightseed.online/u/${token}`;
            const footer = `<hr style="border:0;border-top:1px solid #eee;margin:28px 0;"/>`
                + `<p style="font-size:12px;color:#9ca3af;line-height:1.6;">You're receiving this because you subscribed to the lightseed newsletter.<br/>`
                + `<a href="${unsub}" style="color:#059669;">Unsubscribe</a> · ${NEWSLETTER_POSTAL_ADDRESS}</p>`;
            const mailRef = db.collection("mail").doc();
            batch.set(mailRef, {
                to: [email],
                uid: data.uid || null,
                message: {
                    from: EMAIL_FROM,
                    subject,
                    html: `${html}${footer}`,
                    headers: {
                        "List-Unsubscribe": `<${unsub}>`,
                        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                    },
                },
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            sent++;
        }
        await batch.commit();
    }
    await db.collection("config").doc("newsletter").set({ lastSentAt: admin.firestore.FieldValue.serverTimestamp(), lastSubject: subject, lastSent: sent }, { merge: true });
    return { sent, total: subs.length };
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
            await doc.ref.set({ active: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            // Mirror onto the user profile toggle if this subscriber has an account.
            const uid = (doc.data() as any).uid;
            if (uid) await db.collection("users").doc(uid).set({ newsletterSubscribed: false }, { merge: true }).catch(() => undefined);
        }
        if (req.method === "POST") { res.status(200).end(); return; } // one-click: no body needed
        res.set("Content-Type", "text/html").status(200).send(
            `<html><body style="font-family:sans-serif;text-align:center;padding:48px;color:#334155;"><h2 style="color:#059669;font-weight:300;letter-spacing:1px;">.seed</h2><p>You have been unsubscribed from the lightseed newsletter.</p><p style="color:#9ca3af;font-size:13px;">You can resubscribe anytime from your profile.</p></body></html>`,
        );
    } catch (e) {
        console.error("Unsubscribe failed", e);
        if (req.method === "POST") { res.status(200).end(); return; } // never fail a one-click POST
        res.status(500).send("Could not unsubscribe. Please try again later.");
    }
});

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
        const u = d.data() as any;
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
async function purgeUserData(uid: string) {
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
    };
    await db.collection("persons").doc(uid).delete().catch(() => undefined);
    await db.collection("users").doc(uid).delete().catch(() => undefined);
    try { await admin.auth().deleteUser(uid); } catch (e: any) { console.warn("Auth delete failed:", e?.message); }
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
    // A farewell before the record is gone (best-effort; never blocks the deletion).
    try {
        const record = await admin.auth().getUser(uid).catch(() => null);
        if (record?.email) {
            const text = "It was wonderful to have you. See you!";
            await writeMail({ to: [record.email], subject: "Goodbye from lightseed", html: composeSystemEmailHtml(text, "https://lightseed.online", "lightseed"), text, uid });
        }
    } catch (e) { console.warn("Goodbye email skipped:", e); }
    const counts = await purgeUserData(uid);
    return { deleted: true, ...counts };
});
