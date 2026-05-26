import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";

admin.initializeApp();

const db = admin.firestore();

// Secure Gemini API Proxy
export const generateAIContent = onCall({ secrets: ["GEMINI_API_KEY"] }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { prompt, contents, model = 'gemini-2.5-flash', config, systemInstruction } = request.data;
    
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        throw new HttpsError('failed-precondition', 'Gemini API key is not configured on the server.');
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        const maxRetries = 5; // Increased retries for better rate limit handling
        let lastError: any;

        for (let i = 0; i <= maxRetries; i++) {
            try {
                const result = await ai.models.generateContent({
                    model: model as string,
                    contents: contents || prompt,
                    config: {
                        systemInstruction: systemInstruction as string,
                        ...config
                    }
                });
                
                const text = result.text;
                
                // Handle potential inline data (like images)
                const parts = result.candidates?.[0]?.content?.parts || [];
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
                const isRateLimit = error.message?.includes('429') || error.status === 429 || error.message?.includes('quota');
                
                if (isRateLimit && i < maxRetries) {
                    const delay = Math.pow(2, i) * 2000 + Math.random() * 1000; // Increased base delay
                    console.warn(`Gemini Rate Limit (429). Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                if (isRateLimit && i === maxRetries) {
                   throw new HttpsError('resource-exhausted', 'The AI service is currently overwhelmed. Please try again in a few moments.');
                }
                
                throw error;
            }
        }
        throw lastError;
    } catch (error: any) {
        console.error("Gemini Error:", error);
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
