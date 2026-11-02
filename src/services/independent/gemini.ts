// THE INDEPENDENT NODE'S HAND for the model calls — the mirror of ../firebase/gemini.ts (rings
// 2026-11-01/03). Every hand here reaches a MODEL through THE AI ORGAN (POST /v1/ai/command): the
// node decides whose key answers and speaks to the provider; this file only composes the ask (the
// words are the domain's, domain/aiPrompts), routes it through the listener's chosen intelligence
// and falls back to the node's own voices exactly as the origin does. A refusal the node speaks
// by name is spoken here in the reader's tongue; the member-benefit gate wears the word the shell
// already knows (node_ai_validated_only).
import type * as F from '../firebase/gemini';
import { speak } from '../../utils/translations';
import { currentUid } from './core';
import type { Lifetree, Vision, VisionSynergy } from '../../types';
import type { WateringAnalysis } from '../../domain/watering';
import { buildTranslationPrompt, type TranslationRequest, type TranslationResponse } from '../../domain/translation';
import config from '../../../lifeseed.config.json';
import { askModel, credentialOf, sendIntelligenceMessage, getIntelligence, getPersona, getActiveIntelligenceId, resolveIntelligenceMemoryText, DEFAULT_INTELLIGENCE_ID } from './intelligence';
import type { IntelligenceDuty } from '../../domain/intelligenceDuty';
import type { IntelligenceRef, Persona } from '../../domain/intelligence';
import { openingOnUser, type AiTurn } from '../../domain/aiRequest';
import { GENESIS_VISION, ORACLE_PERSONA_PROMPT, ORACLE_QUIET_QUOTE, ORACLE_HOME_QUOTE, NODE_CLAUDE_MODEL, CONNECTION_TEST_QUESTION,
  postTitlePrompt, lifetreeBioPrompt, oracleQuotePrompt, visionImagePrompt, treeVoiceInstruction, treeVoiceFallbackInstruction, wateringWitnessPrompt, synergyPrompt,
  parseJsonArray, parseJsonObject } from '../../domain/aiPrompts';
export type { TranslationRequest, TranslationResponse } from '../../domain/translation';

const MODEL = config.model || 'gemini-3.5-flash';
// The image-capable Gemini model: the text MODEL returns no images, so image generation names it and asks for IMAGE output.
const IMAGE_MODEL = (config as { imageModel?: string }).imageModel || 'gemini-2.5-flash-image';

// The node's refusals come by name; the shell speaks them in the reader's tongue.
const wordOf = (error: unknown): string => (error instanceof Error ? error.message : '');
const SPOKEN = /^(ai_[a-z_]+|credentials_unavailable|backend_unported|api_unavailable|authentication_required|invalid_command)$/;
const spoken = (error: unknown): Error => {
  const word = wordOf(error);
  if (word === 'ai_validated_only') return new Error(speak('node_ai_validated_only'));
  return SPOKEN.test(word) ? new Error(speak(word)) : error instanceof Error ? error : new Error(String(error));
};
const isValidatedOnlyRefusal = (e: unknown): boolean => wordOf(e) === 'ai_validated_only';
// A key the provider refused, or no key at all — the origin's "Forbidden / suspended" family.
const isKeyRefusal = (e: unknown): boolean => ['ai_key_rejected', 'ai_key_missing', 'ai_unavailable'].includes(wordOf(e));
const turnsOf = (history: { role: 'user' | 'model'; text: string }[], message?: string): AiTurn[] =>
  openingOnUser([...history.map(m => ({ role: m.role, text: m.text })), ...(message !== undefined ? [{ role: 'user' as const, text: message }] : [])]);

// Gemini on the node's own key (the origin's generateAIContent callable).
const callGemini = async (messages: AiTurn[], options: { model?: string; system?: string; json?: boolean; image?: boolean } = {}): Promise<{ text?: string; image?: string }> => {
  try {
    return await askModel({ provider: 'google', model: options.model ?? MODEL, system: options.system, messages, json: options.json, image: options.image });
  } catch (error: unknown) {
    console.error('Cloud Gemini Error:', error);
    throw spoken(error);
  }
};

// Last-resort node providers: the node Claude, then the node Gemini. Both answer for ANY signed-in
// hand the node admits (the organ gates and counts them) — not only the people who connected a key.
const nodeFallback = async (messages: AiTurn[], systemInstruction?: string, json?: boolean): Promise<string> => {
  // 1) node Claude (the organ asks for JSON in the system prompt when a caller needs it).
  try {
    const res = await askModel({ provider: 'anthropic', model: NODE_CLAUDE_MODEL, system: systemInstruction, messages, json });
    if (res.text) return res.text;
  } catch (e) {
    if (isValidatedOnlyRefusal(e)) throw new Error(speak('node_ai_validated_only'));
    console.warn('AI fallback: node Claude failed', e);
  }
  // 2) node Gemini (history and system instruction preserved; JSON mode honoured for JSON callers)
  try {
    const convo = openingOnUser(messages.filter(m => m.text || m.images?.length));
    if (convo.length === 0) return '';
    const res = await askModel({ provider: 'google', model: MODEL, system: systemInstruction, messages: convo, json });
    return res.text || '';
  } catch (e) {
    if (isValidatedOnlyRefusal(e)) throw new Error(speak('node_ai_validated_only'));
    console.warn('AI fallback: node Gemini failed', e); return '';
  }
};

// Route a text prompt through the active intelligence (an explicit id wins, else the one ordered to
// this duty, else the listening one, else the network default). Non-Google providers go through the
// provider abstraction; Google — and the unconfigured default — through the Gemini rail. Image
// generation deliberately does NOT use this: only Gemini makes images.
const runText = async (prompt: string, opts?: { json?: boolean; intelligenceId?: string; persona?: Persona | null; duty?: IntelligenceDuty }): Promise<string> => {
  const id = opts?.intelligenceId ?? getActiveIntelligenceId(opts?.duty) ?? DEFAULT_INTELLIGENCE_ID;
  try {
    if (id) {
      const intel = await getIntelligence(id).catch(() => null);
      if (intel && intel.enabled !== false && intel.provider !== 'google') {
        const persona = opts?.persona ?? (intel.personaId ? await getPersona(intel.personaId) : null);
        const reply = await sendIntelligenceMessage(
          { provider: intel.provider, model: intel.model, credentialScope: intel.credentialScope, credentialHolderUid: intel.credentialHolderUid },
          [{ role: 'user', text: prompt }],
          { persona },
        );
        if (reply) return reply;
      }
    }
    const res = await callGemini([{ role: 'user', text: prompt }], { json: opts?.json });
    if (res.text) return res.text;
    throw new Error('err_reply_empty');
  } catch (e) {
    // The chosen/default intelligence's key may be missing or rejected for this hand — the node keys answer.
    console.warn('runText primary path failed — using node fallback', e);
    return nodeFallback([{ role: 'user', text: prompt }], undefined, opts?.json);
  }
};

export const generatePostTitle: typeof F.generatePostTitle = async (body) => {
  if (!body.trim()) return '';
  try {
    const text = await runText(postTitlePrompt(body), { duty: 'writing' });
    return text ? text.trim().replace(/["']/g, '') : '';
  } catch (error) {
    console.error('Gemini Title Error:', error);
    return '';
  }
};

export const generateLifetreeBio: typeof F.generateLifetreeBio = async (seed) => {
  if (!seed.trim()) return '';
  try {
    const text = await runText(lifetreeBioPrompt(seed), { duty: 'writing' });
    return text || 'A soul taking root in the digital forest.';
  } catch (error: unknown) {
    console.error('Gemini Bio Error:', error);
    if (isKeyRefusal(error)) return 'The forest is currently dreaming... (AI Service Suspended)';
    return 'The forest whispers quietly... (AI Error)';
  }
};

export const generateImage: typeof F.generateImage = async (prompt) => {
  if (!prompt.trim()) return null;
  try {
    const res = await callGemini([{ role: 'user', text: prompt }], { model: IMAGE_MODEL, image: true });
    // Only a real image counts — never the caption.
    return res.image || null;
  } catch (e: unknown) {
    console.error('Gemini Image Error:', e);
    if (isKeyRefusal(e)) throw new Error('err_ai_image_unavailable');
    const raw = (wordOf(e) || String(e) || '').trim();
    throw new Error(raw ? `Image generation failed: ${raw}` : 'Image generation failed — try again, or upload an image instead.');
  }
};

export const generateVisionImage: typeof F.generateVisionImage = (prompt) => generateImage(visionImagePrompt(prompt));

export const generateOracleQuote: typeof F.generateOracleQuote = async () => {
  try {
    // Only ask when signed in — the observatory speaks its own line to a visitor.
    if (!currentUid()) return ORACLE_QUIET_QUOTE;
    const text = await runText(oracleQuotePrompt(), { duty: 'writing' });
    return text || ORACLE_HOME_QUOTE;
  } catch {
    return ORACLE_QUIET_QUOTE;
  }
};

// Talk to the listener's chosen intelligence; with no choice, the network default, which a steward
// may have rebound to Claude. The genesis vision rides as memory, the tree's own recollection after it.
export const sendMessageToOracle: typeof F.sendMessageToOracle = async (message, history, intelligenceId) => {
  try {
    const messages = [...history, { role: 'user' as const, text: message }];
    let ref: IntelligenceRef = { provider: 'google', model: MODEL };
    let persona: Persona = { id: 'persona-oracle', name: 'Oracle', description: '', systemPrompt: ORACLE_PERSONA_PROMPT };
    let memoryText = GENESIS_VISION;
    const idToUse = intelligenceId || getActiveIntelligenceId('whisper') || DEFAULT_INTELLIGENCE_ID;
    {
      const intel = await getIntelligence(idToUse).catch(() => null);
      if (intel && intel.enabled !== false) {
        ref = { provider: intel.provider, model: intel.model, credentialScope: intel.credentialScope, credentialHolderUid: intel.credentialHolderUid };
        if (intel.personaId) {
          const p = await getPersona(intel.personaId);
          if (p) persona = p;
        }
        const recollection = await resolveIntelligenceMemoryText(intel);
        if (recollection) memoryText += '\n\n' + recollection;
      }
    }
    const reply = await sendIntelligenceMessage(ref, messages, { persona, memory: { text: memoryText } });
    if (reply) return reply;
    const fb = await nodeFallback(turnsOf(history, message), `${persona.systemPrompt}\n\n${memoryText}`);
    return fb || "I'm here, listening.";
  } catch (error: unknown) {
    console.error('Oracle Reach Error:', error);
    try {
      const fb = await nodeFallback(turnsOf(history, message), `${ORACLE_PERSONA_PROMPT}\n\n${GENESIS_VISION}`);
      if (fb) return fb;
    } catch { /* fall through to the message below */ }
    const detail = spoken(error).message || 'unknown error';
    return `⚠️ I couldn't reach this intelligence just now: ${detail}\n\nIf this mentions a key or billing, check your AI settings (Intelligence tab). If it's Gemini, the node key may be out of credit; switch your listening intelligence to a connected Claude.`;
  }
};

// Diagnostic: ask the chosen intelligence a genesis-grounded question and return both the question and
// the live reply. Unlike sendMessageToOracle this DOES NOT swallow errors — the real cause is spoken.
export const testIntelligenceConnection: typeof F.testIntelligenceConnection = async (intelligenceId) => {
  const question = CONNECTION_TEST_QUESTION;
  let ref: IntelligenceRef = { provider: 'google', model: MODEL };
  let persona: Persona = { id: 'persona-oracle', name: 'Oracle', description: '', systemPrompt: ORACLE_PERSONA_PROMPT };
  let memoryText = GENESIS_VISION;
  if (intelligenceId) {
    const intel = await getIntelligence(intelligenceId);
    if (!intel) throw new Error('err_intelligence_not_found');
    if (intel.enabled === false) throw new Error('err_intelligence_disabled');
    ref = { provider: intel.provider, model: intel.model, credentialScope: intel.credentialScope, credentialHolderUid: intel.credentialHolderUid };
    if (intel.personaId) {
      const p = await getPersona(intel.personaId);
      if (p) persona = p;
    }
    const recollection = await resolveIntelligenceMemoryText(intel);
    if (recollection) memoryText += '\n\n' + recollection;
  }
  try {
    const reply = await sendIntelligenceMessage(ref, [{ role: 'user', text: question }], { persona, memory: { text: memoryText } });
    return { question, reply: reply || '(the intelligence returned an empty reply)' };
  } catch (e) { throw spoken(e); }
};

export const sendMessageToTree: typeof F.sendMessageToTree = async (message, history, tree) => {
  try {
    const systemInstruction = treeVoiceInstruction(tree);
    // The tree's voice goes through the intelligence ordered to tree talk (else the listening one) when it isn't Google.
    const id = getActiveIntelligenceId('tree_talk');
    if (id) {
      const intel = await getIntelligence(id);
      if (intel && intel.enabled !== false && intel.provider !== 'google') {
        const persona: Persona = { id: 'tree-voice', name: tree.name, description: '', systemPrompt: systemInstruction };
        const reply = await sendIntelligenceMessage(
          { provider: intel.provider, model: intel.model, credentialScope: intel.credentialScope, credentialHolderUid: intel.credentialHolderUid },
          [...history, { role: 'user' as const, text: message }],
          { persona },
        );
        return reply || '';
      }
    }
    const res = await askModel({ provider: 'google', model: MODEL, system: systemInstruction, messages: turnsOf(history, message) });
    return res.text || '';
  } catch (error: unknown) {
    console.error('Tree Reach Error:', error);
    try {
      const fb = await nodeFallback(turnsOf(history, message), treeVoiceFallbackInstruction(tree));
      if (fb) return fb;
    } catch { /* fall through */ }
    if (isKeyRefusal(error)) return 'My roots are quiet right now. Please come back later.';
    return 'The signal through my branches is weak right now.';
  }
};

// Analyse a watering photo through the listener's chosen intelligence, falling back to Gemini — the
// same routing law as runText, but multimodal. `image.data` is base64 WITHOUT the data: prefix.
export const analyzeWateringPhoto: typeof F.analyzeWateringPhoto = async (image, tree, intelligenceId) => {
  const prompt = wateringWitnessPrompt(tree);
  const fallback: WateringAnalysis = { watering: false, confidence: 0, note: 'The witness could not read the photo just now — a guardian can confirm.' };
  try {
    const id = intelligenceId ?? getActiveIntelligenceId('watering') ?? DEFAULT_INTELLIGENCE_ID;
    const intel = id ? await getIntelligence(id).catch(() => null) : null;
    const turn: AiTurn = { role: 'user', text: prompt, images: [{ mimeType: image.mimeType, data: image.data }] };
    // A connected Claude (the listener's or a community's) → Claude vision.
    if (intel && intel.enabled !== false && intel.provider === 'anthropic') {
      const res = await askModel({ provider: 'anthropic', model: intel.model || NODE_CLAUDE_MODEL, messages: [turn], credential: credentialOf(intel) });
      const parsed = parseJsonObject<WateringAnalysis>(res.text || '');
      return parsed ? { ...parsed, model: intel.model, provider: 'anthropic' } : fallback;
    }
    // Default / Google → Gemini multimodal on the node's key.
    const model = intel?.provider === 'google' && intel.model ? intel.model : MODEL;
    const res = await askModel({ provider: 'google', model, messages: [turn], json: true });
    const parsed = parseJsonObject<WateringAnalysis>(res.text || '');
    return parsed ? { ...parsed, model, provider: 'google' } : fallback;
  } catch (e) {
    console.error('Watering analysis error', e);
    return fallback;
  }
};

// Depth of search — 12 around 1 (the 3D kissing number) is the shell we analyse; at most 6 come back.
export const RESONANCE_DEPTH: typeof F.RESONANCE_DEPTH = 12;

// The matchmaking law is BALANCE: shared ground AND complementary difference (domain/aiPrompts synergyPrompt).
export const findVisionSynergies: typeof F.findVisionSynergies = async (visions: Vision[], intelligenceId, depth = RESONANCE_DEPTH) => {
  if (visions.length < 2) return [];
  const field = visions.slice(0, Math.max(2, depth)).map(v => ({ title: v.title, body: v.body, description: v.description, place: (v as { place?: string }).place }));
  try {
    const reply = await runText(synergyPrompt(field), { json: true, intelligenceId, duty: 'resonance' });
    return parseJsonArray<VisionSynergy>(reply);
  } catch (e) {
    console.error('Matchmaking error', e);
    return [];
  }
};

// Human-to-Human Translation: the reading lives in domain/translation; this is only the engine call.
export const translatePulse: typeof F.translatePulse = async (req: TranslationRequest, intelligenceId): Promise<TranslationResponse> => {
  const prompt = buildTranslationPrompt(req);
  try {
    const reply = await runText(prompt, { json: true, intelligenceId, duty: 'translation' });
    const parsed = parseJsonObject<TranslationResponse>(reply);
    if (parsed) return parsed;
    throw new Error('err_translation_empty');
  } catch (e) {
    console.error('Translation error', e);
    throw e;
  }
};

// The tree facts the voice needs, so the type law holds for the shell's Lifetree.
export type TreeVoice = Pick<Lifetree, 'name' | 'shortTitle' | 'body' | 'locationName' | 'treeType'>;
