// ai.ts — split from index.ts (ring 2026-09-16); every function keeps its name, trigger and options.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { sealSecret, openSecret } from "./credentialCipher";
import { db, enforceDailyQuota, isStaffUid } from "./core";

const NODE_AI_TEXT_LIMIT = 21;
const NODE_AI_IMAGE_LIMIT = 3;
// Atomically check + increment a per-user daily counter in the server-only `usage/{uid}` doc, the
// AUTHORITATIVE gate (the mirrored client counter on the user doc is user-writable, so advisory
// only). Counters reset on the UTC day boundary. Throws resource-exhausted when the cap is hit.
// NODE-PAID AI IS A MEMBER BENEFIT (ring 2026-08-25): when a call spends the NODE's own key
// (no BYO key, not staff), the caller must be a VALIDATED MEMBER — an initiate (git ledger)
// or the owner of a validated tree. Reversible per node via config/limits.nodeAiValidatedOnly
// (default ON). BYO-key users and staff are never gated here. Throws a clear, client-shown
// refusal so an unvalidated visitor is told to connect their own key or get their tree
// validated, never left with a silent empty answer.
const isValidatedMember = async (uid: string): Promise<boolean> => {
    const initiate = await db.collection("initiates").doc(uid).get();
    if (initiate.exists) return true;
    const vt = await db.collection("lifetrees").where("ownerId", "==", uid).where("validated", "==", true).limit(1).get();
    return !vt.empty;
};
const nodeAiValidatedOnly = async (): Promise<boolean> => {
    try {
        const snap = await db.collection("config").doc("limits").get();
        const v = snap.exists ? (snap.data() as { nodeAiValidatedOnly?: boolean }).nodeAiValidatedOnly : undefined;
        return v !== false; // default ON: absent or true = restrict
    } catch { return true; }
};
const gateNodeAi = async (uid: string): Promise<void> => {
    if (await isStaffUid(uid)) return;
    if (!(await nodeAiValidatedOnly())) return;
    if (await isValidatedMember(uid)) return;
    throw new HttpsError("permission-denied", "node_ai_validated_only");
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
        ? config.responseModalities.map((m: unknown) => String(m).toUpperCase()) : [];
    const isImage = /image/i.test(String(model)) || modalities.includes('IMAGE');
    await gateNodeAi(request.auth.uid); // node-paid AI: validated members only (config-dialed)
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
        let lastError: unknown;

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
            } catch (e: unknown) {
                lastError = e;
                const error = (e ?? {}) as { message?: string; status?: number };
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
    } catch (error: unknown) {
        console.error("Gemini Function Error Final:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', (error instanceof Error && error.message) || 'AI Generation failed');
    }
});

// ---------------------------------------------------------------------------
// Intelligence Commons — provider credentials + live Claude (Anthropic)
//
// SECURITY: provider API keys live ONLY in the `providerCredentials` collection,
// which Firestore rules make completely unreadable/unwritable by clients. Keys
// reach the server over the encrypted callable channel and are read back only
// here, with the Admin SDK. They never touch a browser. And since ring 2026-09-09
// they rest as CIPHERTEXT under the node's Cloud KMS key (./credentialCipher):
// a console read or an export yields nothing usable; a row still carrying a
// plaintext `key` from before is sealed the first time it is read.
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
                .set({ connected: false, keyHint: FieldValue.delete() }, { merge: true }).catch(() => undefined);
        }
        return { connected: false };
    }

    const keyHint = key.length > 4 ? `…${key.slice(-4)}` : "set";
    const sealed = await sealSecret(key);
    await ref.set({
        provider, scope, ownerId,
        ...sealed,
        key: FieldValue.delete(), // never plaintext again, even over an old row
        keyHint,
        updatedBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
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
        if (snap.exists) {
            const row = snap.data() as Record<string, unknown>;
            if (typeof row.keyCiphertext === "string" && row.keyCiphertext) {
                apiKey = await openSecret(row.keyCiphertext);
            } else if (typeof row.key === "string" && row.key) {
                // A row from before the cipher: use it this once, and seal it in passing.
                apiKey = row.key;
                sealSecret(row.key).then((sealed) => snap.ref.set({ ...sealed, key: FieldValue.delete() }, { merge: true })).catch((e) => console.warn("sealing a legacy key failed:", e?.message || e));
            }
            usedByoKey = !!apiKey;
        }
    }
    if (!apiKey) apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new HttpsError("failed-precondition", "No Claude key is connected for this intelligence yet.");
    }
    // The node free-tier quota applies only when spending the node key; BYO keys are unmetered.
    if (!usedByoKey) {
        await gateNodeAi(request.auth.uid); // node-paid AI: validated members only (config-dialed)
        if (!(await isStaffUid(request.auth.uid))) {
            await enforceDailyQuota(request.auth.uid, "dailyAiText", NODE_AI_TEXT_LIMIT);
        }
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
    } catch (e: unknown) {
        const error = (e ?? {}) as { message?: string; status?: number };
        console.error("Claude generation error:", error.message || e);
        const status = error.status;
        if (status === 401 || status === 403) {
            throw new HttpsError("permission-denied", "The Claude key was rejected. Please check it in your AI settings.");
        }
        if (status === 429) {
            throw new HttpsError("resource-exhausted", "Claude is rate-limited right now. Please try again in a moment.");
        }
        throw new HttpsError("internal", error?.message || "Claude generation failed.");
    }
});
