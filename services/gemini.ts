
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase";
import { Lifetree, Vision, VisionSynergy } from "../types";
import config from "../lifeseed.config.json";

// Default model as requested: gemini-3.5-flash
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
        
        // Graceful handling of Forbidden (403) / Suspended API keys
        if (error.code === 'permission-denied' || error.message?.includes('403') || error.message?.includes('suspended')) {
            throw new Error("AI Service is currently suspended or unavailable (Forbidden). Please check back later.");
        }
        
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
    return res.text || "A soul taking root in the digital forest.";
  } catch (error: any) {
    console.error("Gemini Bio Error:", error);
    if (error.message.includes("Forbidden") || error.message.includes("suspended")) {
        return "The forest is currently dreaming... (AI Service Suspended)";
    }
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
        // Only attempt AI call if user is signed in to avoid 401/403 errors on landing
        if (!auth.currentUser) {
            return '"The clearest way into the Universe is through a forest wilderness." - John Muir';
        }

        const prompt = `Based on the following vision: "${GENESIS_VISION}", select a short, profound quote from classic literature, philosophy, or poetry that resonates with these themes. Return ONLY the quote and the author in this format: "Quote" - Author.`;
        const res = await callGemini(prompt);
        return res.text || '"Nature is not a place to visit. It is home." - Gary Snyder';
    } catch (e) {
        return '"The clearest way into the Universe is through a forest wilderness." - John Muir';
    }
}

// New Chat Interface (Stateless)
export const sendMessageToOracle = async (message: string, history: {role: 'user' | 'model', text: string}[]) => {
  try {
    const generateAIContent = httpsCallable(functions, 'generateAIContent');
    
    const systemInstruction = `You are the Oracle, embodied as Osiris in the form of a 10-year-old boy. 
    Your tone is kind, childlike, innocent, and filled with wonder. 
    You speak simply but profoundly, as if you see the magic in all living things.
    Use the following Vision of the Genesis Tree as your core context and philosophy:
    "${GENESIS_VISION}"
    
    Answer questions by weaving in these themes of connection, nature, and the original vision of Lightseed. 
    Be helpful and supportive, like a wise but playful friend. Keep your answers concise and warm.`;

    // Map history to Gemini format, ensuring it starts with a 'user' role
    // Many versions of the Gemini API require the first message in contents/history to be from 'user'
    let contents = history.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
    }));

    // Find first 'user' message index
    const firstUserIndex = contents.findIndex(c => c.role === 'user');
    if (firstUserIndex !== -1) {
        contents = contents.slice(firstUserIndex);
    } else {
        // If no user message found in history, clear it (it was just the model greeting)
        contents = [];
    }

    contents.push({ role: 'user', parts: [{ text: message }] });

    const result = await generateAIContent({ 
        contents, 
        systemInstruction,
        model: MODEL
    });
    
    return (result.data as any).text || "";
  } catch (error: any) {
    console.error("Oracle Chat Error:", error);
    if (error.message.includes("Forbidden") || error.message.includes("suspended")) {
        return "The Oracle is currently in deep meditation. Please come back later.";
    }
    return "I'm sorry, my connection to the forest is a bit weak right now.";
  }
}

export const sendMessageToTree = async (message: string, history: {role: 'user' | 'model', text: string}[], tree: Lifetree) => {
  try {
    const generateAIContent = httpsCallable(functions, 'generateAIContent');
    const systemInstruction = `You are speaking as the living voice of a Lifetree in the Lightseed network.
    Tree name: ${tree.name}
    Short title: ${tree.shortTitle || "None"}
    Vision/body: ${tree.body || "No vision provided"}
    Location: ${tree.locationName || "Unknown"}
    Type: ${tree.treeType || tree.type || "Lifetree"}

    Speak in first person as this tree, but stay grounded and helpful.
    Use the tree's vision, location, and role as your context.
    Keep replies concise, sensory, practical, and poetic without pretending to know private facts.
    If the seeker asks for action, suggest one clear next step they can take with or for this tree.`;

    let contents = history.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
    }));

    const firstUserIndex = contents.findIndex(c => c.role === 'user');
    contents = firstUserIndex !== -1 ? contents.slice(firstUserIndex) : [];
    contents.push({ role: 'user', parts: [{ text: message }] });

    const result = await generateAIContent({
        contents,
        systemInstruction,
        model: MODEL
    });

    return (result.data as any).text || "";
  } catch (error: any) {
    console.error("Tree Chat Error:", error);
    if (error.message.includes("Forbidden") || error.message.includes("suspended")) {
        return "My roots are quiet right now. Please come back later.";
    }
    return "The signal through my branches is weak right now.";
  }
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

// Living Intelligence Network - Translation Depth System
export interface TranslationRequest {
    senderTreeName: string;
    receiverTreeName: string;
    message: string;
    depth: number;
    context?: string; // Community history, shared values, prior pulses
}

export interface TranslationResponse {
    interpretation: string;
    confidence: number;
    alternatives: string[];
    growthSuggestion?: string;
}

export const translatePulse = async (req: TranslationRequest): Promise<TranslationResponse> => {
    const { senderTreeName, receiverTreeName, message, depth, context } = req;
    
    let depthInstructions = "";
    switch(depth) {
        case 1: depthInstructions = "Provide a raw summary of the message."; break;
        case 2: depthInstructions = "Focus on the underlying intent of the message."; break;
        case 3: depthInstructions = "Reveal the underlying pulse or emotion driving this message."; break;
        case 4: depthInstructions = "Contextualize this message within their broader vision or direction of growth."; break;
        case 5: depthInstructions = "Contextualize this message regarding the relationship between the sender and receiver."; break;
        case 6: depthInstructions = "Evaluate this message based on community context and shared values."; break;
        case 7: depthInstructions = "Provide an initiation-level reflection, offering profound insight into what this message means for the spiritual or holistic growth of the network."; break;
        default: depthInstructions = "Provide a basic interpretation.";
    }

    const prompt = `
        You are the Translation engine of the Living Intelligence Network.
        Your goal is to help life recognize life, reduce misunderstanding, and amplify coherence.
        
        Sender: ${senderTreeName}
        Receiver: ${receiverTreeName}
        Message: "${message}"
        Depth Level: ${depth}
        Instruction for this Depth: ${depthInstructions}
        Additional Context (Integrator Trees): ${context || "None"}
        
        Respond with a JSON object in this exact structure:
        {
            "interpretation": "Your primary translated understanding of the message.",
            "confidence": 95, // a number 1-100
            "alternatives": ["alternative meaning 1", "alternative meaning 2"],
            "growthSuggestion": "Optional suggestion on how the receiver might constructively respond."
        }
    `;

    try {
        const res = await callGemini(prompt, MODEL, {
            responseMimeType: "application/json"
        });

        if (res.text) {
            return JSON.parse(res.text) as TranslationResponse;
        }
        throw new Error("Empty translation response.");
    } catch (e) {
        console.error("Translation error", e);
        throw e;
    }
}
