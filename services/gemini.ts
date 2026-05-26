
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { Vision, VisionSynergy } from "../types";
import config from "../lifeseed.config.json";

const MODEL = config.model || 'gemini-3.5-flash';


// Genesis Vision Text - Original
const GENESIS_VISION = `The purpose of lightseed is to bring joy. The joy of realizing the bliss of conscious, compassionate, grateful existence by opening a portal to the center of life. By creating a bridge between creator and creation, science and spirituality, virtual and real, nothing and everything. It is designed to intimately connect our inner Self, our culture, our trees and the tree of life, the material and the digital, online world into a sustainable and sustaining circle of unified vibration, sound and light. It aims to merge us into a common flow for all beings to be liberated, wise, strong, courageous and connected. It is rooted in nonviolence, compassion, generosity, gratitude and love. It is blockchain (truthfulness), cloud (global, distributed, resilient), ai (for connecting dreams and technology), regen (nature centric) native. It is an inspiration, an impulse towards a quantum leap in consciousness, a prompt both for human and artificial intelligence for action towards transcending humanity into a new era, a New Earth, Universe and Field with the help of our most important evolutionary sisters and brothers, the trees.`;

const callGemini = async (prompt: string, model: string = MODEL, config?: any): Promise<{text?: string, image?: string}> => {
    try {
        const generateAIContent = httpsCallable(functions, 'generateAIContent');
        const result = await generateAIContent({ prompt, model, config });
        return result.data as any;
    } catch (error: any) {
        console.error("Cloud Gemini Error:", error);
        throw error;
    }
}

export const generatePostTitle = async (body: string): Promise<string> => {
  if (!body.trim()) return "";
  try {
    const prompt = `Generate a short, engaging title (maximum 10 words) for the following post body. Do not use quotation marks in the title:\n\n---\n${body}\n---`;
    const res = await callGemini(prompt);
    return res.text ? res.text.trim().replace(/["']/g, '') : ""; 
  } catch (error) {
    console.error("Gemini Title Error:", error);
    return "";
  }
};

export const generateLifetreeBio = async (seed: string): Promise<string> => {
  if (!seed.trim()) return "";
  try {
    const prompt = `
      You are LifeSeed AI, a poetic and nature-loving assistant.
      The user wants to grow a "Lifetree" (a digital profile representation of their soul).
      They provided this seed thought: "${seed}".
      Write a short (max 40 words), mystical, and nature-inspired bio/description.
    `;
    const res = await callGemini(prompt);
    return res.text || "";
  } catch (error) {
    console.error("Gemini Bio Error:", error);
    return "The forest whispers quietly... (AI Error)";
  }
}

// Base Image Generator
export const generateImage = async (prompt: string): Promise<string | null> => {
    if (!prompt.trim()) return null;
    try {
        console.log("Generating image for:", prompt);
        const res = await callGemini(prompt, MODEL, { imageConfig: { aspectRatio: "1:1" } });
        return res.image || res.text || null; 
    } catch (e: any) {
        console.error("Gemini Image Error:", e);
        throw new Error("AI Generation Failed. Please try again.");
    }
}

// Wrapper for Vision Style Images (Nano Banana)
export const generateVisionImage = async (prompt: string): Promise<string | null> => {
    return generateImage(`A mystical, nature-inspired, abstract painting representing: ${prompt}`);
}

export const generateOracleQuote = async (): Promise<string> => {
    try {
        const prompt = `Based on the following vision: "${GENESIS_VISION}", select a short, profound quote from classic literature, philosophy, or poetry that resonates with these themes. Return ONLY the quote and the author in this format: "Quote" - Author.`;
        const res = await callGemini(prompt);
        return res.text || '"Nature is not a place to visit. It is home." - Gary Snyder';
    } catch (e) {
        return '"The clearest way into the Universe is through a forest wilderness." - John Muir';
    }
}

// New Chat Interface (Stateless)
export const sendMessageToOracle = async (message: string, history: {role: 'user' | 'model', text: string}[]) => {
    const generateAIContent = httpsCallable(functions, 'generateAIContent');
    
    const systemInstruction = `You are the Oracle. 
    Your tone is neutral, friendly, and grounded. 
    Use the following Vision of the Genesis Tree as your core context and philosophy:
    "${GENESIS_VISION}"
    
    Answer questions by weaving in these themes of connection, nature, blockchain, and the original vision of Lightseed. Keep your tone accessible and kind.`;

    // Map history to Gemini format
    const contents = [
        ...history.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        })),
        { role: 'user', parts: [{ text: message }] }
    ];

    const result = await generateAIContent({ 
        contents, 
        systemInstruction,
        model: MODEL
    });
    
    return (result.data as any).text || "";
}

// Analyze Vision Synergy
export const findVisionSynergies = async (visions: Vision[]): Promise<VisionSynergy[]> => {
    if (visions.length < 2) return [];
    const visionsList = visions.map(v => `- Title: ${v.title}, Body: ${v.body}`).join('\n');

    try {
        const prompt = `Analyze the following list of Visions and identify potential collaborations or thematic synergies between them. 
            Return a JSON array of pairs that match well.
            
            Visions:
            ${visionsList}`;
        
        const res = await callGemini(prompt, MODEL, {
            responseMimeType: "application/json"
        });

        if (res.text) {
            return JSON.parse(res.text) as VisionSynergy[];
        }
        return [];
    } catch (e) {
        console.error("Matchmaking error", e);
        return [];
    }
}
