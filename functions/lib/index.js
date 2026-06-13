"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestInvite = exports.acceptTreeInvite = exports.onReachCreated = exports.sendSystemEmail = exports.generateAIContent = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
admin.initializeApp();
const db = admin.firestore();
// Secure Gemini API Proxy
exports.generateAIContent = (0, https_1.onCall)({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 300,
    memory: "1GiB",
    cors: true
}, async (request) => {
    // Log request for debugging
    console.log("AI Request received. Authenticated:", !!request.auth);
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const { prompt, contents, model = 'gemini-3.5-flash', config, systemInstruction } = request.data;
    console.log(`Model: ${model}`);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY missing from environment secrets.");
        throw new https_1.HttpsError('failed-precondition', 'Gemini API key is not configured on the server.');
    }
    try {
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const generativeModel = genAI.getGenerativeModel({
            model: model,
            systemInstruction: systemInstruction,
            generationConfig: config
        });
        const maxRetries = 4; // Increased retries
        let lastError;
        for (let i = 0; i <= maxRetries; i++) {
            try {
                console.log(`Attempting generation (${i + 1}/${maxRetries + 1})...`);
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
            }
            catch (error) {
                lastError = error;
                const errorText = error.message || "";
                const isRateLimit = errorText.includes('429') || error.status === 429 || errorText.toLowerCase().includes('quota') || errorText.toLowerCase().includes('overwhelmed');
                const isForbidden = errorText.includes('403') || error.status === 403 || errorText.includes('CONSUMER_SUSPENDED');
                console.warn(`Attempt ${i + 1} failed:`, errorText);
                if (isForbidden) {
                    throw new https_1.HttpsError('permission-denied', 'The AI service is currently unavailable. The API key may be suspended or restricted. Please contact support.');
                }
                if (isRateLimit && i < maxRetries) {
                    const delay = Math.pow(2, i) * 2000 + Math.random() * 1000; // Heavier backoff
                    console.warn(`Gemini Rate Limit. Retrying in ${Math.round(delay)}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                if (isRateLimit && i === maxRetries) {
                    throw new https_1.HttpsError('resource-exhausted', 'The AI service is currently overwhelmed. Please wait a minute and try again.');
                }
                throw error;
            }
        }
        throw lastError;
    }
    catch (error) {
        console.error("Gemini Function Error Final:", error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('internal', error.message || 'AI Generation failed');
    }
});
// Secure Email Trigger
exports.sendSystemEmail = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const { to, subject, text, html } = request.data;
    const uid = request.auth.uid;
    try {
        await db.collection('mail').add({
            to: Array.isArray(to) ? to : [to],
            uid: uid,
            message: {
                from: "lightseed <admin@lightseed.online>",
                subject: subject,
                text: text,
                html: html
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    }
    catch (error) {
        console.error("Email Error:", error);
        throw new https_1.HttpsError('internal', 'Failed to queue email.');
    }
});
// Direct-message email delivery: when a reach pulse is created, email the recipient.
// Runs server-side so it can read the recipient's private profile/email (clients cannot
// read other users' docs) without exposing it to the sender. Direct-message email
// notifications are ON by default for everyone (early network) — only an explicit
// users/{uid}.emailNotifications.directMessages === false opts out. Newsletter
// subscription status is intentionally NOT used here.
exports.onReachCreated = (0, firestore_1.onDocumentCreated)("pulses/{pulseId}", async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const pulse = snap.data();
    // Only real reaches addressed to a specific person, and never self-sent messages.
    if (pulse.type !== 'reach')
        return;
    const recipientUid = pulse.recipientUid || undefined;
    if (!recipientUid || recipientUid === pulse.authorId)
        return;
    try {
        const userSnap = await db.collection('users').doc(recipientUid).get();
        if (!userSnap.exists)
            return;
        const user = userSnap.data();
        // Enabled by default; only an explicit false disables direct-message emails.
        if (user?.emailNotifications?.directMessages === false)
            return;
        const email = user.email;
        if (!email)
            return;
        // Basic per-thread throttle: at most one DM email per thread per recipient within
        // this window, so a burst of messages in one thread doesn't flood the inbox.
        // TODO(notifications): consider a digest (e.g. "N new messages") instead of a hard
        // skip, and make the window configurable per user.
        const THROTTLE_MS = 10 * 60 * 1000; // 10 minutes
        const threadKey = (pulse.threadId || `${pulse.reachTreeId || ''}_${pulse.lifetreeId || ''}`).replace(/\//g, '_');
        const throttleRef = db.collection('mailThrottle').doc(`${recipientUid}__${threadKey}`);
        try {
            const throttleSnap = await throttleRef.get();
            const lastSentAt = throttleSnap.exists ? (throttleSnap.data()?.lastSentAt?.toMillis?.() ?? 0) : 0;
            if (Date.now() - lastSentAt < THROTTLE_MS)
                return; // recently emailed for this thread
        }
        catch (e) {
            console.warn("DM email throttle check failed; sending anyway", e);
        }
        const message = pulse.content || pulse.body || '';
        const fromName = pulse.authorName || 'A Lifetree';
        const toName = pulse.recipientName || pulse.reachTreeName || 'your Lifetree';
        const subject = `${fromName} sent ${toName} a direct message on lightseed`;
        const text = `${fromName} sent a direct message to ${toName}:\n\n"${message}"\n\nOpen your messages: https://lightseed.online`;
        const html = `<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">` +
            `<h2 style="color: #059669; font-weight: 300; letter-spacing: 1px; margin-bottom: 6px;">.seed</h2>` +
            `<p style="font-size: 13px; color: #9ca3af; margin: 0 0 24px;">A new direct message for <strong style="color:#059669;">${toName}</strong></p>` +
            `<p style="font-size: 15px; margin: 0 0 10px; color:#6b7280;"><strong>${fromName}</strong> sent you a direct message:</p>` +
            `<blockquote style="font-size: 16px; margin: 0 0 28px; padding: 16px 20px; background:#f0fdf4; border-left: 4px solid #059669; border-radius: 8px; color:#1f2937;">${message.replace(/\n/g, '<br>')}</blockquote>` +
            `<a href="https://lightseed.online" style="display:inline-block; background:#059669; color:#fff; text-decoration:none; font-weight:bold; padding:10px 22px; border-radius:9999px; font-size:14px;">Open your messages</a>` +
            `<hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;" />` +
            `<p style="font-size: 12px; color: #9ca3af;">You receive this because direct-message email notifications are on in your <a href="https://lightseed.online" style="color: #059669; text-decoration: none;">lightseed profile</a>. You can turn this off anytime.</p>` +
            `</div>`;
        await db.collection('mail').add({
            to: [email],
            uid: recipientUid,
            message: {
                from: "lightseed <admin@lightseed.online>",
                subject,
                text,
                html
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // Record the send so the per-thread throttle can skip rapid follow-ups.
        await throttleRef.set({
            lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
            recipientUid,
            threadId: threadKey,
        });
    }
    catch (error) {
        console.error("Direct message email trigger failed:", error);
    }
});
// --- Tree Circle: accept a co-ownership / guardianship invite -------------------
// Protected multi-document mutation: writes the tree's role array AND the rooted
// community. Runs with admin rights so the invitee never writes those docs directly.
const treeRoleToField = {
    co_owner: "coOwnerIds",
    guardian: "guardians",
    observer: "observerIds",
    steward: "stewardIds",
};
exports.acceptTreeInvite = (0, https_1.onCall)({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be signed in.");
    }
    const uid = request.auth.uid;
    const inviteId = request.data?.inviteId;
    if (!inviteId) {
        throw new https_1.HttpsError("invalid-argument", "inviteId is required.");
    }
    return await db.runTransaction(async (tx) => {
        const inviteRef = db.collection("treeOwnershipInvites").doc(inviteId);
        const inviteSnap = await tx.get(inviteRef);
        if (!inviteSnap.exists) {
            throw new https_1.HttpsError("not-found", "Invite not found.");
        }
        const invite = inviteSnap.data();
        if (invite.invitedUserId !== uid) {
            throw new https_1.HttpsError("permission-denied", "This invite is not for you.");
        }
        if (invite.status !== "pending") {
            throw new https_1.HttpsError("failed-precondition", "This invite is no longer pending.");
        }
        const treeRef = db.collection("lifetrees").doc(invite.lifetreeId);
        const treeSnap = await tx.get(treeRef);
        if (!treeSnap.exists) {
            throw new https_1.HttpsError("not-found", "Lifetree not found.");
        }
        const tree = treeSnap.data();
        const field = treeRoleToField[invite.role];
        if (!field) {
            throw new https_1.HttpsError("invalid-argument", "Unknown role.");
        }
        const treeUpdate = {
            [field]: admin.firestore.FieldValue.arrayUnion(uid),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        let communityId = tree.communityId;
        if (!communityId) {
            const communityRef = db.collection("communities").doc();
            communityId = communityRef.id;
            tx.set(communityRef, {
                name: `${tree.name || "Lifetree"} Circle`,
                rootLifetreeId: invite.lifetreeId,
                founderUserId: tree.ownerId,
                ownerId: tree.ownerId,
                memberIds: [tree.ownerId, uid],
                formation: "tree_co_ownership",
                visibility: "invited",
                domain: tree.domain || "",
                vision: "",
                imageUrls: [],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            treeUpdate.communityId = communityId;
        }
        else {
            const communityRef = db.collection("communities").doc(communityId);
            tx.update(communityRef, {
                memberIds: admin.firestore.FieldValue.arrayUnion(uid),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
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
exports.requestInvite = (0, https_1.onCall)({ cors: true }, async (request) => {
    const email = String(request.data?.email || "").trim().toLowerCase();
    const reason = String(request.data?.reason || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new https_1.HttpsError("invalid-argument", "Please provide a valid email.");
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
//# sourceMappingURL=index.js.map