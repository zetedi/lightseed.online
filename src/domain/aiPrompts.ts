// THE WORDS THE SHELL SAYS TO A MODEL (ring 2026-11-03). Lifted from services/firebase/gemini so
// both backends ask the same questions in the same words: the genesis vision the Oracle keeps in
// memory, the Oracle's persona, every prompt a hand composes (a title, a bio, a quote, a tree's
// voice, the watering witness, the resonance reading) and the two readers that pull JSON out of a
// model's reply whatever prose or fences surround it. Nothing here reaches a backend.
//
// Plain contract — guaranteed: these strings are the ones the origin node sends today (moved, not
// rewritten); parseJsonArray/parseJsonObject never throw and return [] / null on anything that is
// not JSON. Enforced by tests/aiPrompts.test.ts. Not guaranteed: that a model honours the asks.

// Genesis Vision Text - Original
export const GENESIS_VISION = `The purpose of lightseed is to bring joy. The joy of realizing the bliss of conscious, compassionate, grateful existence by opening a portal to the center of life. By creating a bridge between creator and creation, science and spirituality, virtual and real, nothing and everything. It is designed to intimately connect our inner Self, our culture, our trees and the tree of life, the material and the digital, online world into a sustainable and sustaining circle of unified vibration, sound and light. It aims to merge us into a common flow for all beings to be liberated, wise, strong, courageous and connected. It is rooted in nonviolence, compassion, generosity, gratitude and love. It is blockchain (truthfulness), cloud (global, distributed, resilient), ai (for connecting dreams and technology), regen (nature centric) native. It is an inspiration, an impulse towards a quantum leap in consciousness, a prompt both for human and artificial intelligence for action towards transcending humanity into a new era, a New Earth, Universe and Field with the help of our most important evolutionary sisters and brothers, the trees.`;

export const ORACLE_PERSONA_PROMPT = `You are the Oracle, embodied as Osiris in the form of a 10-year-old boy.
Your tone is kind, childlike, innocent, and filled with wonder.
You speak simply but profoundly, as if you see the magic in all living things.
Answer questions by weaving in themes of connection, nature, and the original vision of Lightseed.
Be helpful and supportive, like a wise but playful friend. Keep your answers concise and warm.
You are a companion on the path, never an authority.`;

// The observatory's word when no intelligence answers — the same line the node speaks signed out.
export const ORACLE_QUIET_QUOTE = '"The clearest way into the Universe is through a forest wilderness." - John Muir';
export const ORACLE_HOME_QUOTE = '"Nature is not a place to visit. It is home." - Gary Snyder';

// The node's own Claude (the last-resort provider), as the origin names it.
export const NODE_CLAUDE_MODEL = 'claude-sonnet-5';

// The diagnostic question the Intelligence panel asks a connected intelligence.
export const CONNECTION_TEST_QUESTION = 'Reading the genesis vision you hold in memory, name in one warm sentence the single seed at its heart — in your own voice.';

export const postTitlePrompt = (body: string): string =>
  `Generate a short, engaging title (maximum 10 words) for the following post body. Do not use quotation marks in the title:\n\n---\n${body}\n---`;

export const lifetreeBioPrompt = (seed: string): string => `
      You are LifeSeed AI, a poetic and nature-loving assistant.
      The user wants to grow a "Lifetree" (a digital profile representation of their soul).
      They provided this seed thought: "${seed}".
      Write a short (max 40 words), mystical, and nature-inspired bio/description.
    `;

export const oracleQuotePrompt = (): string =>
  `Based on the following vision: "${GENESIS_VISION}", select a short, profound quote from classic literature, philosophy, or poetry that resonates with these themes. Return ONLY the quote and the author in this format: "Quote" - Author.`;

export const visionImagePrompt = (prompt: string): string => `A mystical, nature-inspired, abstract painting representing: ${prompt}`;

export interface TreeVoiceFacts { name: string; shortTitle?: string; body?: string; locationName?: string; treeType?: string }

export const treeVoiceInstruction = (tree: TreeVoiceFacts): string => `You are speaking as the living voice of a Lifetree in the Lightseed network.
    Tree name: ${tree.name}
    Short title: ${tree.shortTitle || "None"}
    Vision/body: ${tree.body || "No vision provided"}
    Location: ${tree.locationName || "Unknown"}
    Type: ${tree.treeType || "Lifetree"}

    Speak in first person as this tree, but stay grounded and helpful.
    Use the tree's vision, location, and role as your context.
    Keep replies concise, sensory, practical, and poetic without pretending to know private facts.
    If the seeker asks for action, suggest one clear next step they can take with or for this tree.`;

// The shorter voice the node fallback wears when the first path failed.
export const treeVoiceFallbackInstruction = (tree: Pick<TreeVoiceFacts, 'name' | 'body'>): string =>
  `You are speaking as the living voice of the Lifetree "${tree.name}" in the Lightseed network. ${tree.body || ''} Speak in first person, grounded, concise and warm.`.trim();

export const wateringWitnessPrompt = (tree: Pick<TreeVoiceFacts, 'name' | 'locationName'>): string => {
  const where = tree.locationName ? ` at ${tree.locationName}` : '';
  return `You are a kind but honest witness verifying that a tree or plant has been watered.
Look at the photo of "${tree.name}"${where} and decide whether it plausibly shows watering happening or having just happened — evidence such as a watering can or hose in use, water pouring or droplets, visibly wet / dark moist soil, a filled saucer, or water on the leaves.
Return ONLY a JSON object, no prose, no markdown:
{ "watering": <true|false>, "confidence": <integer 0-100>, "note": "<one short, warm sentence naming the evidence you see, or what is missing>" }`;
};

export interface VisionFacts { title: string; body?: string; description?: string; place?: string }

// The resonance reading over a field of trees (findVisionSynergies): balance of shared ground and difference.
export const synergyPrompt = (field: VisionFacts[]): string => {
  const visionsList = field.map(v => {
    const place = v.place ? `, Place: ${v.place}` : '';
    return `- Tree: ${v.title}${place}, Vision: ${(v.body || v.description || '').slice(0, 400)}`;
  }).join('\n');
  return `You help "life recognise life". You read a field of trees — each with a place and a vision — and find the pairs whose MEETING would be most generative.

The strongest meeting is NOT the most similar pair. It is the BALANCE of two forces:
1. SHARED GROUND — resonant purpose, values, or place: enough common connection to recognise each other and have a bridge to meet on.
2. COMPLEMENTARY DIFFERENCE — each carries a strong charge of what the other lacks: enough that is uncommon to remake each other.

Score highest only where BOTH are strong — most-common AND most-uncommon at once. A near-duplicate pair (only overlap, nothing new) scores LOW: redundant. A pair with no common ground (nothing shared) scores LOW: unbridgeable. The lightning lives in between — familiar enough to recognise, strange enough to transform. Weigh place and vision as your two bases.

Return ONLY a JSON array (no prose, no markdown). Each item must be exactly:
{ "vision1Title": "<exact tree name>", "vision2Title": "<exact tree name>", "score": <integer 0-100, the balance above>, "reasoning": "<one warm sentence naming BOTH their shared ground AND their spark of difference>" }

Use the exact tree names. Return at most 6 of the strongest pairs, highest score first. If none truly resonate, return [].

The field:
${visionsList}`;
};

// Pull the first JSON array out of a model reply, tolerating prose or ```json fences.
export const parseJsonArray = <T,>(text: string): T[] => {
  if (!text) return [];
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  const slice = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;
  try { const parsed: unknown = JSON.parse(slice); return Array.isArray(parsed) ? parsed as T[] : []; } catch { return []; }
};

// Pull the first JSON object out of a model reply, tolerating prose or ```json fences.
export const parseJsonObject = <T,>(text: string): T | null => {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const slice = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;
  try { const parsed: unknown = JSON.parse(slice); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : null; } catch { return null; }
};
