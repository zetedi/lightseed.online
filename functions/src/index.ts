import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";

admin.initializeApp();

const db = admin.firestore();

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
    
    console.log(`Model: ${model}`);

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

// Secure Email Trigger
export const sendSystemEmail = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
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
    } catch (error: any) {
        console.error("Email Error:", error);
        throw new HttpsError('internal', 'Failed to queue email.');
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

    // Only real reaches addressed to a specific person, and never self-sent messages.
    if (pulse.type !== 'reach') return;
    const recipientUid: string | undefined = pulse.recipientUid || undefined;
    if (!recipientUid || recipientUid === pulse.authorId) return;

    try {
        const userSnap = await db.collection('users').doc(recipientUid).get();
        if (!userSnap.exists) return;
        const user = userSnap.data() as any;

        // Enabled by default; only an explicit false disables direct-message emails.
        if (user?.emailNotifications?.directMessages === false) return;
        const email = user.email;
        if (!email) return;

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
            if (Date.now() - lastSentAt < THROTTLE_MS) return; // recently emailed for this thread
        } catch (e) {
            console.warn("DM email throttle check failed; sending anyway", e);
        }

        const message: string = pulse.content || pulse.body || '';
        const fromName: string = pulse.authorName || 'A Lifetree';
        const toName: string = pulse.recipientName || pulse.reachTreeName || 'your Lifetree';
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
    } catch (error) {
        console.error("Direct message email trigger failed:", error);
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

    // Resolve the key: BYO (user/community) first, node secret as fallback.
    let apiKey: string | undefined;
    if (credential?.scope && credential.scope !== "node" && credential.ownerId) {
        const snap = await db.collection("providerCredentials")
            .doc(credentialDocId(credential.scope, credential.ownerId, "anthropic")).get();
        if (snap.exists) apiKey = snap.data()?.key;
    }
    if (!apiKey) apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new HttpsError("failed-precondition", "No Claude key is connected for this intelligence yet.");
    }

    // Map our transcript (user|model) to Anthropic's (user|assistant); it must open on a user turn.
    const mapped = messages
        .map((m: any) => ({ role: m.role === "model" ? "assistant" : "user", content: String(m.text || "") }))
        .filter((m: any) => m.content);
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
