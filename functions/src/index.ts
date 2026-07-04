import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";

admin.initializeApp();

const db = admin.firestore();

// --- Email via the Firestore `mail` collection (Firebase Trigger Email extension) -------------
// All outbound email stays in-house: writing a doc to `mail` queues it through the installed
// firestore-send-email extension (Nodemailer under the hood, so `message.headers` are forwarded —
// that's how the newsletter's List-Unsubscribe headers reach the recipient).
const EMAIL_FROM = "lightseed <admin@lightseed.online>";

const writeMail = async (params: { to: string | string[]; subject: string; html: string; text?: string; headers?: Record<string, string>; uid?: string }) => {
    const message: any = { from: EMAIL_FROM, subject: params.subject, text: params.text, html: params.html };
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
                const text = response.text();
                
                // Handle potential inline data (like images)
                const candidate = response.candidates?.[0];
                const parts = candidate?.content?.parts || [];
                
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.data) {
                        const mimeType = part.inlineData.mimeType || 'image/png';
                        return { 
                            image: `data:${mimeType};base64,${part.inlineData.data}`,
                            text: text 
                        };
                    }
                }

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
    const model = String(request.data?.model || "claude-sonnet-4-6");
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

const waterMeText = (treeName: string, daysOverdue: number): string => {
    const who = treeName || "This tree";
    if (daysOverdue <= 0) return `I'm ready for watering 💧 — could a guardian tend me today?`;
    if (daysOverdue === 1) return `I'm getting thirsty 💧 — it's been a day past my watering. Could a guardian tend me?`;
    return `I'm thirsty 💧 — it's been ${daysOverdue} days past my watering. Could a guardian tend me? — ${who}`;
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
                    const text = waterMeText(tree.name, daysOver);

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

// --- Admin: delete a user (auth + their data) ------------------------------------------------
// Staff-only. Removes the target's lifetrees/pulses/visions/links/person/user docs and their
// Auth record. Useful for re-testing onboarding. The node owner (superadmin) can't be deleted
// by a non-superadmin.
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

    const deleteWhere = async (coll: string, field: string) => {
        const qs = await db.collection(coll).where(field, "==", targetUid).get();
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
    await db.collection("persons").doc(targetUid).delete().catch(() => undefined);
    await db.collection("users").doc(targetUid).delete().catch(() => undefined);
    try { await admin.auth().deleteUser(targetUid); } catch (e: any) { console.warn("Auth delete failed:", e?.message); }

    return { deleted: true, ...counts };
});
