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
exports.sendSystemEmail = exports.generateAIContent = void 0;
const https_1 = require("firebase-functions/v2/https");
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
                console.warn(`Attempt ${i + 1} failed:`, errorText);
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
//# sourceMappingURL=index.js.map