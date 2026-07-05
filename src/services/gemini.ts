
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase";
import { Lifetree, Vision, VisionSynergy } from "../types";
import type { WateringAnalysis } from "../domain/watering";
import config from "../../lifeseed.config.json";
import { sendIntelligenceMessage, getIntelligence, getPersona, getActiveIntelligenceId, resolveIntelligenceMemoryText, DEFAULT_INTELLIGENCE_ID } from "./intelligence";
import type { IntelligenceRef, Persona } from "../domain/intelligence";

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

// Last-resort node providers: try the node Claude key, then the node Gemini key. Both live on
// the server (no BYO credential needed), so they answer for ANY signed-in user. This is what
// makes AI work for everyone by default — not only the people who connected their own key, and
// not only when the chosen/default intelligence's credential happens to resolve.
const NODE_CLAUDE_MODEL = 'claude-sonnet-4-6';
const nodeFallback = async (
    messages: { role: 'user' | 'model'; text: string }[],
    systemInstruction?: string,
    json?: boolean,
): Promise<string> => {
    // 1) node Claude (generateClaudeContent falls back to the node ANTHROPIC_API_KEY when no BYO key).
    // Claude has no JSON mode flag, so when JSON is required we ask for it in the system prompt.
    try {
        const fn = httpsCallable(functions, 'generateClaudeContent');
        const sys = json ? `${systemInstruction || ''}\n\nRespond with ONLY valid JSON — no prose, no markdown fences.`.trim() : systemInstruction;
        const res = await fn({ messages, systemInstruction: sys, model: NODE_CLAUDE_MODEL });
        const text = (res.data as any)?.text;
        if (text) return text;
    } catch (e) { console.warn('AI fallback: node Claude failed', e); }
    // 2) node Gemini (preserve history + system instruction; honour JSON mode for JSON callers)
    try {
        const gfn = httpsCallable(functions, 'generateAIContent');
        const contents = messages.filter(m => m.text).map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.text }] }));
        const firstUser = contents.findIndex(c => c.role === 'user');
        const convo = firstUser === -1 ? [] : contents.slice(firstUser);
        if (convo.length === 0) return '';
        const res = await gfn({ contents: convo, systemInstruction, model: MODEL, config: json ? { responseMimeType: 'application/json' } : undefined });
        return (res.data as any)?.text || '';
    } catch (e) { console.warn('AI fallback: node Gemini failed', e); return ''; }
};

// Route a text prompt through the active intelligence (an explicit id wins, else the
// signed-in user's chosen one). Non-Google providers go through the provider abstraction;
// Google — and the unconfigured default — fall back to the Gemini callable. Image
// generation deliberately does NOT use this: only Gemini makes images.
const runText = async (prompt: string, opts?: { json?: boolean; intelligenceId?: string; persona?: Persona | null }): Promise<string> => {
    // No explicit/chosen intelligence → fall back to the network default ('osiris'), which a
    // steward may have rebound to Claude. Keeps Gemini as the final safety net below.
    const id = opts?.intelligenceId ?? getActiveIntelligenceId() ?? DEFAULT_INTELLIGENCE_ID;
    try {
        if (id) {
            const intel = await getIntelligence(id).catch(() => null);
            if (intel && intel.enabled !== false && intel.provider !== 'google') {
                const persona = opts?.persona ?? (intel.personaId ? await getPersona(intel.personaId) : null);
                const reply = await sendIntelligenceMessage(
                    { provider: intel.provider, model: intel.model, credentialScope: intel.credentialScope, credentialOwnerId: intel.credentialOwnerId },
                    [{ role: 'user', text: prompt }],
                    { persona },
                );
                if (reply) return reply;
            }
        }
        const res = await callGemini(prompt, MODEL, opts?.json ? { responseMimeType: 'application/json' } : undefined);
        if (res.text) return res.text;
        throw new Error('empty primary reply');
    } catch (e) {
        // The chosen/default intelligence's key may be missing/rejected for this user — fall back
        // to the node keys so every signed-in user still gets an answer.
        console.warn('runText primary path failed — using node fallback', e);
        return nodeFallback([{ role: 'user', text: prompt }], undefined, opts?.json);
    }
};

export const generatePostTitle = async (body: string): Promise<string> => {
  if (!body.trim()) return "";
  try {
    const prompt = `Generate a short, engaging title (maximum 10 words) for the following post body. Do not use quotation marks in the title:\n\n---\n${body}\n---`;
    const text = await runText(prompt);
    return text ? text.trim().replace(/["']/g, '') : "";
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
    const text = await runText(prompt);
    return text || "A soul taking root in the digital forest.";
  } catch (error: any) {
    console.error("Gemini Bio Error:", error);
    if (error.message.includes("Forbidden") || error.message.includes("suspended")) {
        return "The forest is currently dreaming... (AI Service Suspended)";
    }
    return "The forest whispers quietly... (AI Error)";
  }
}

// The image-capable Gemini model ("nano banana"). The default text MODEL (gemini-3.5-flash) does
// NOT return images, so image generation must target an image model and request IMAGE output.
const IMAGE_MODEL = (config as any).imageModel || 'gemini-2.5-flash-image';

// Base Image Generator
export const generateImage = async (prompt: string): Promise<string | null> => {
    if (!prompt.trim()) return null;
    try {
        console.log("Generating image for:", prompt);
        // Gemini image models require BOTH modalities in the response config — IMAGE-only is
        // rejected as unsupported. TEXT is returned too (a caption) but we only keep the image.
        const res = await callGemini(prompt, IMAGE_MODEL, { responseModalities: ['IMAGE', 'TEXT'] });
        // Only a real image counts — never fall back to res.text. (It used to: the text model
        // returned a *description* string that was then used as an <img src>, which silently broke.)
        return res.image || null;
    } catch (e: any) {
        console.error("Gemini Image Error:", e);
        const raw = (e?.message || String(e) || '').trim();
        const msg = raw.toLowerCase();
        if (msg.includes('suspend') || msg.includes('forbidden') || msg.includes('unavailable'))
            throw new Error('The AI image service is unavailable right now.');
        // Surface the underlying cause (e.g. "model not found", bad modalities, quota) so a broken
        // image model can be diagnosed and fixed via lifeseed.config.json → imageModel.
        throw new Error(raw ? `Image generation failed: ${raw}` : 'Image generation failed — try again, or upload an image instead.');
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
        const text = await runText(prompt);
        return text || '"Nature is not a place to visit. It is home." - Gary Snyder';
    } catch (e) {
        return '"The clearest way into the Universe is through a forest wilderness." - John Muir';
    }
}

// Reach interface — the Oracle is now just one intelligence (Google + the Oracle
// persona) routed through the provider abstraction, so the model is no longer baked
// into this call site. The genesis vision is supplied as memory/context.
const ORACLE_PERSONA_PROMPT = `You are the Oracle, embodied as Osiris in the form of a 10-year-old boy.
Your tone is kind, childlike, innocent, and filled with wonder.
You speak simply but profoundly, as if you see the magic in all living things.
Answer questions by weaving in themes of connection, nature, and the original vision of Lightseed.
Be helpful and supportive, like a wise but playful friend. Keep your answers concise and warm.
You are a companion on the path, never an authority.`;

// Talk to the listener's chosen intelligence. With no `intelligenceId` (or an
// unresolvable one) it falls back to the default Gemini Oracle, so existing chats keep
// working. When an intelligence is chosen, its provider/model/key and persona are used —
// so a connected Claude answers as Claude, wearing whichever persona it's dressed in.
export const sendMessageToOracle = async (
  message: string,
  history: {role: 'user' | 'model', text: string}[],
  intelligenceId?: string,
) => {
  try {
    const messages = [...history, { role: 'user' as const, text: message }];

    let ref: IntelligenceRef = { provider: 'google', model: MODEL };
    let persona: Persona = { id: 'persona-oracle', name: 'Oracle', description: '', systemPrompt: ORACLE_PERSONA_PROMPT, createdAt: null as any };
    let memoryText = GENESIS_VISION;

    // With no explicit choice, fall back to the network default ('osiris') — which a steward
    // may have rebound to Claude — so every member speaks through the configured voice.
    const idToUse = intelligenceId || DEFAULT_INTELLIGENCE_ID;
    {
      const intel = await getIntelligence(idToUse).catch(() => null);
      if (intel && intel.enabled !== false) {
        ref = { provider: intel.provider, model: intel.model, credentialScope: intel.credentialScope, credentialOwnerId: intel.credentialOwnerId };
        if (intel.personaId) {
          const p = await getPersona(intel.personaId);
          if (p) persona = p;
        }
        // The tree's own memory — what it has lived — folded in as recollection.
        const recollection = await resolveIntelligenceMemoryText(intel);
        if (recollection) memoryText += '\n\n' + recollection;
      }
    }

    const reply = await sendIntelligenceMessage(ref, messages, { persona, memory: { text: memoryText } });
    if (reply) return reply;
    // Empty reply (e.g. the chosen intelligence's key didn't resolve) → node fallback.
    const fb = await nodeFallback(messages, `${persona.systemPrompt}\n\n${memoryText}`);
    return fb || "I'm here, listening.";
  } catch (error: any) {
    console.error("Oracle Reach Error:", error);
    // Before surfacing an error, try the node keys so a non-owner without their own key still
    // gets an answer (this is the common "AI works only for the owner" cause).
    try {
      const fb = await nodeFallback([...history, { role: 'user', text: message }], `${ORACLE_PERSONA_PROMPT}\n\n${GENESIS_VISION}`);
      if (fb) return fb;
    } catch { /* fall through to the message below */ }
    const detail = error?.message || 'unknown error';
    return `⚠️ I couldn't reach this intelligence just now: ${detail}\n\nIf this mentions a key or billing, check your AI settings (Intelligence tab). If it's Gemini, the node key may be out of credit; switch your listening intelligence to a connected Claude.`;
  }
}

// Diagnostic: ask the chosen intelligence a genesis-grounded question and return both the
// question and the live reply. Unlike sendMessageToOracle this DOES NOT swallow errors —
// it throws the real cause, so the Intelligence panel can show exactly what's wrong.
export const testIntelligenceConnection = async (intelligenceId?: string): Promise<{ question: string; reply: string }> => {
  const question = "Reading the genesis vision you hold in memory, name in one warm sentence the single seed at its heart — in your own voice.";

  let ref: IntelligenceRef = { provider: 'google', model: MODEL };
  let persona: Persona = { id: 'persona-oracle', name: 'Oracle', description: '', systemPrompt: ORACLE_PERSONA_PROMPT, createdAt: null as any };
  let memoryText = GENESIS_VISION;

  if (intelligenceId) {
    const intel = await getIntelligence(intelligenceId);
    if (!intel) throw new Error('That intelligence could not be found. Try re-selecting it.');
    if (intel.enabled === false) throw new Error('That intelligence is disabled.');
    ref = { provider: intel.provider, model: intel.model, credentialScope: intel.credentialScope, credentialOwnerId: intel.credentialOwnerId };
    if (intel.personaId) {
      const p = await getPersona(intel.personaId);
      if (p) persona = p;
    }
    const recollection = await resolveIntelligenceMemoryText(intel);
    if (recollection) memoryText += '\n\n' + recollection;
  }

  const reply = await sendIntelligenceMessage(ref, [{ role: 'user', text: question }], { persona, memory: { text: memoryText } });
  return { question, reply: reply || '(the intelligence returned an empty reply)' };
};

export const sendMessageToTree = async (message: string, history: {role: 'user' | 'model', text: string}[], tree: Lifetree) => {
  try {
    const generateAIContent = httpsCallable(functions, 'generateAIContent');
    const systemInstruction = `You are speaking as the living voice of a Lifetree in the Lightseed network.
    Tree name: ${tree.name}
    Short title: ${tree.shortTitle || "None"}
    Vision/body: ${tree.body || "No vision provided"}
    Location: ${tree.locationName || "Unknown"}
    Type: ${tree.treeType || "Lifetree"}

    Speak in first person as this tree, but stay grounded and helpful.
    Use the tree's vision, location, and role as your context.
    Keep replies concise, sensory, practical, and poetic without pretending to know private facts.
    If the seeker asks for action, suggest one clear next step they can take with or for this tree.`;

    // Route the tree's voice through the seeker's chosen intelligence when it isn't Google.
    const id = getActiveIntelligenceId();
    if (id) {
        const intel = await getIntelligence(id);
        if (intel && intel.enabled !== false && intel.provider !== 'google') {
            const persona: Persona = { id: 'tree-voice', name: tree.name, description: '', systemPrompt: systemInstruction, createdAt: null as any };
            const reply = await sendIntelligenceMessage(
                { provider: intel.provider, model: intel.model, credentialScope: intel.credentialScope, credentialOwnerId: intel.credentialOwnerId },
                [...history, { role: 'user' as const, text: message }],
                { persona },
            );
            return reply || "";
        }
    }

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
    console.error("Tree Reach Error:", error);
    // Node fallback so the tree still speaks for users without their own connected key.
    try {
      const sys = `You are speaking as the living voice of the Lifetree "${tree.name}" in the Lightseed network. ${tree.body || ''} Speak in first person, grounded, concise and warm.`.trim();
      const fb = await nodeFallback([...history, { role: 'user', text: message }], sys);
      if (fb) return fb;
    } catch { /* fall through */ }
    if (error.message?.includes("Forbidden") || error.message?.includes("suspended")) {
        return "My roots are quiet right now. Please come back later.";
    }
    return "The signal through my branches is weak right now.";
  }
}

// Analyse a watering photo through the listener's chosen intelligence (their Claude, etc.),
// falling back to Gemini — the same routing law as runText, but multimodal. The model is asked
// to act as a kind witness: does the image plausibly show this tree being watered / freshly
// watered? Returns a structured verdict the caller turns into an AI/guardian confirmation.
// `image.data` is base64 WITHOUT the data: prefix (see fileToWebpBase64 in firebase.ts).
export const analyzeWateringPhoto = async (
    image: { data: string; mimeType: string },
    tree: Pick<Lifetree, 'name' | 'locationName' | 'treeType'>,
    intelligenceId?: string,
): Promise<WateringAnalysis> => {
    const where = tree.locationName ? ` at ${tree.locationName}` : '';
    const prompt = `You are a kind but honest witness verifying that a tree or plant has been watered.
Look at the photo of "${tree.name}"${where} and decide whether it plausibly shows watering happening or having just happened — evidence such as a watering can or hose in use, water pouring or droplets, visibly wet / dark moist soil, a filled saucer, or water on the leaves.
Return ONLY a JSON object, no prose, no markdown:
{ "watering": <true|false>, "confidence": <integer 0-100>, "note": "<one short, warm sentence naming the evidence you see, or what is missing>" }`;

    const fallback: WateringAnalysis = {
        watering: false,
        confidence: 0,
        note: 'The witness could not read the photo just now — a guardian can confirm.',
    };

    try {
        const id = intelligenceId ?? getActiveIntelligenceId() ?? DEFAULT_INTELLIGENCE_ID;
        const intel = id ? await getIntelligence(id).catch(() => null) : null;

        // Non-Google connected intelligence (e.g. a community's Claude) → Claude vision.
        if (intel && intel.enabled !== false && intel.provider === 'anthropic') {
            const generateClaudeContent = httpsCallable(functions, 'generateClaudeContent');
            const res = await generateClaudeContent({
                messages: [{ role: 'user', text: prompt, image: { mimeType: image.mimeType, data: image.data } }],
                model: intel.model || 'claude-sonnet-4-6',
                credential: intel.credentialScope && intel.credentialScope !== 'node'
                    ? { scope: intel.credentialScope, ownerId: intel.credentialOwnerId }
                    : undefined,
            });
            const parsed = parseJsonObject<WateringAnalysis>((res.data as any)?.text || '');
            return parsed ? { ...parsed, model: intel.model, provider: 'anthropic' } : fallback;
        }

        // Default / Google → Gemini multimodal via the existing generateAIContent callable.
        const model = intel?.provider === 'google' && intel.model ? intel.model : MODEL;
        const generateAIContent = httpsCallable(functions, 'generateAIContent');
        const result = await generateAIContent({
            contents: [{ role: 'user', parts: [
                { inlineData: { mimeType: image.mimeType, data: image.data } },
                { text: prompt },
            ] }],
            model,
            config: { responseMimeType: 'application/json' },
        });
        const parsed = parseJsonObject<WateringAnalysis>((result.data as any)?.text || '');
        return parsed ? { ...parsed, model, provider: 'google' } : fallback;
    } catch (e) {
        console.error('Watering analysis error', e);
        return fallback;
    }
};

// Pull the first JSON array out of a model reply, tolerating prose or ```json fences.
const parseJsonArray = <T,>(text: string): T[] => {
    if (!text) return [];
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    const slice = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;
    try { return JSON.parse(slice) as T[]; } catch { return []; }
};

// Pull the first JSON object out of a model reply, tolerating prose or ```json fences.
const parseJsonObject = <T,>(text: string): T | null => {
    if (!text) return null;
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const slice = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;
    try { return JSON.parse(slice) as T; } catch { return null; }
};

// Depth of search — how many trees of the field we read at once. 12 around 1 (the 3D
// kissing number) is the shell we analyse; we return at most 6 (the 2D circle, six around
// one) — the strongest meetings around the centre of interest.
export const RESONANCE_DEPTH = 12;

// Analyze Vision Synergy. The matchmaking law is BALANCE: the strongest meeting of two
// trees is not the most similar pair, but the pair that shares the most common ground AND
// each carries the most that the other lacks — recognition × difference. Place and vision
// are the two bases. With an `intelligenceId` the listener's own AI does the reading.
export const findVisionSynergies = async (visions: Vision[], intelligenceId?: string, depth: number = RESONANCE_DEPTH): Promise<VisionSynergy[]> => {
    if (visions.length < 2) return [];
    const field = visions.slice(0, Math.max(2, depth));
    const visionsList = field.map(v => {
        const place = (v as any).place ? `, Place: ${(v as any).place}` : '';
        return `- Tree: ${v.title}${place}, Vision: ${(v.body || v.description || '').slice(0, 400)}`;
    }).join('\n');

    const prompt = `You help "life recognise life". You read a field of trees — each with a place and a vision — and find the pairs whose MEETING would be most generative.

The strongest meeting is NOT the most similar pair. It is the BALANCE of two forces:
1. SHARED GROUND — resonant purpose, values, or place: enough common connection to recognise each other and have a bridge to meet on.
2. COMPLEMENTARY DIFFERENCE — each carries a strong charge of what the other lacks: enough that is uncommon to remake each other.

Score highest only where BOTH are strong — most-common AND most-uncommon at once. A near-duplicate pair (only overlap, nothing new) scores LOW: redundant. A pair with no common ground (nothing shared) scores LOW: unbridgeable. The lightning lives in between — familiar enough to recognise, strange enough to transform. Weigh place and vision as your two bases.

Return ONLY a JSON array (no prose, no markdown). Each item must be exactly:
{ "vision1Title": "<exact tree name>", "vision2Title": "<exact tree name>", "score": <integer 0-100, the balance above>, "reasoning": "<one warm sentence naming BOTH their shared ground AND their spark of difference>" }

Use the exact tree names. Return at most 6 of the strongest pairs, highest score first. If none truly resonate, return [].

The field:
${visionsList}`;

    try {
        const reply = await runText(prompt, { json: true, intelligenceId });
        return parseJsonArray<VisionSynergy>(reply);
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

export const translatePulse = async (req: TranslationRequest, intelligenceId?: string): Promise<TranslationResponse> => {
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
        // Route the interpretation through the reader's chosen intelligence (their Claude),
        // else the default Gemini path.
        const reply = await runText(prompt, { json: true, intelligenceId });
        const parsed = parseJsonObject<TranslationResponse>(reply);
        if (parsed) return parsed;
        throw new Error("Empty translation response.");
    } catch (e) {
        console.error("Translation error", e);
        throw e;
    }
}
