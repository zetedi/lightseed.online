import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";

admin.initializeApp();

const db = admin.firestore();

// Secure Gemini API Proxy
export const generateAIContent = onCall(async (request) => {
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
        
        const response = await ai.models.generateContent({
            model: model as string,
            contents: contents || [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                ...(config || {}),
                systemInstruction: systemInstruction as string
            }
        });
        
        // Handle potential inline data (like images)
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                const mimeType = part.inlineData.mimeType || 'image/png';
                return { 
                    image: `data:${mimeType};base64,${part.inlineData.data}`,
                    text: response.text 
                };
            }
        }

        return { text: response.text };
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
