// THE AI ORGAN'S LAW (ring 2026-11-03): what the independent node decides before and after it
// reaches a model on a hand's behalf — the mirror of functions/src/ai.ts, pure. Which key a call
// may spend (a kept credential the hand may use, else the node's own), whether the node's key is
// a member benefit this hand has earned (nodeAiRefusal), which daily counter the call draws on
// (aiKindOf: an image model or an image ask counts as an image), how a transcript is shaped for
// each rail (opening on a user turn, images ahead of text), how a provider's failure speaks
// (aiRailRefusal) and how a kept key is named and hinted without ever being shown.
//
// Plain contract — guaranteed: every function here is total over its inputs and never reaches a
// network, a store or a clock; the node-key gate refuses exactly when the origin's gateNodeAi
// throws (not staff, dial on, not validated); the counters and limits are the ones the origin
// enforces (21 texts, 3 images a day). Enforced by tests/aiRequest.test.ts and, end to end,
// tests/seed/ai.postgres-test.ts. Not guaranteed: the model's answer, its latency or its cost.
import { AI_DAILY_TEXT_LIMIT, AI_DAILY_IMAGE_LIMIT } from './aiAccess';

export type AiRailProvider = 'google' | 'anthropic';
export type AiKind = 'text' | 'image';
export type AiCredentialScope = 'user' | 'community';
export interface AiImage { mimeType: string; data: string }
export interface AiTurn { role: 'user' | 'model'; text?: string; images?: AiImage[] }

// The rails this organ can grow; the providers whose keys a hand may keep (the origin's list).
export const AI_RAIL_PROVIDERS: readonly AiRailProvider[] = ['google', 'anthropic'];
export const AI_CREDENTIAL_PROVIDERS = ['anthropic', 'openai', 'deepseek', 'google'] as const;
export const AI_DEFAULT_MODEL: Record<AiRailProvider, string> = { google: 'gemini-3.5-flash', anthropic: 'claude-sonnet-5' };
// Room for a reply (the origin sends 1024; thinking shares this budget on current Claude models, so the node leaves more).
export const AI_MAX_TOKENS = 4096;
// A rate-limited Gemini call is retried with the origin's patience: 2 s, 4 s, 8 s, 16 s (plus up to a second of jitter).
export const AI_RATE_LIMIT_RETRIES = 4;
export const aiRetryDelayMs = (attempt: number): number => Math.pow(2, Math.max(0, attempt)) * 2000;
// The daily counters in seed.usage (the origin's usage/{uid} field names) and their limits.
export const AI_KIND_COUNTER: Record<AiKind, string> = { text: 'dailyAiText', image: 'dailyAiImage' };
export const AI_KIND_LIMIT: Record<AiKind, number> = { text: AI_DAILY_TEXT_LIMIT, image: AI_DAILY_IMAGE_LIMIT };
// The instruction Claude is given when a caller needs JSON (Claude has no JSON mode flag).
export const JSON_ONLY_INSTRUCTION = 'Respond with ONLY valid JSON — no prose, no markdown fences.';

// A transcript opens on a user turn (Gemini and Claude both require it): everything before is dropped.
export const openingOnUser = <T extends { role: 'user' | 'model' }>(turns: T[]): T[] => {
  const first = turns.findIndex(t => t.role === 'user');
  return first === -1 ? [] : turns.slice(first);
};

// The node's key is a member benefit (ring 2026-08-25): staff always, everyone when the dial is off,
// else only a validated member (an initiate or the owner of a validated tree).
export const nodeAiRefusal = (facts: { staff?: boolean; validatedOnly?: boolean; validated?: boolean }): 'ai_validated_only' | null =>
  facts.staff === true || facts.validatedOnly === false || facts.validated === true ? null : 'ai_validated_only';

// Which allowance a call draws on, inferred from the ask so a client cannot mislabel an image call.
export const aiKindOf = (ask: { model?: string | null; imageOut?: boolean }): AiKind =>
  ask.imageOut === true || /image/i.test(String(ask.model ?? '')) ? 'image' : 'text';

export const jsonSystemOf = (system: string | undefined, json: boolean): string | undefined => {
  const base = (system ?? '').trim();
  if (!json) return base || undefined;
  return `${base}\n\n${JSON_ONLY_INSTRUCTION}`.trim();
};

// The transcript as Anthropic's Messages API takes it: user|assistant, images as blocks ahead of the text, empty turns dropped.
export type AnthropicBlock = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };
export type AnthropicTurn = { role: 'user' | 'assistant'; content: string | AnthropicBlock[] };
export const anthropicTurnsOf = (turns: AiTurn[]): AnthropicTurn[] => {
  const mapped: AnthropicTurn[] = turns.map(turn => {
    const role = turn.role === 'model' ? 'assistant' as const : 'user' as const;
    const images = (turn.images ?? []).filter(image => image && image.data);
    if (images.length) {
      const blocks: AnthropicBlock[] = images.map(image => ({ type: 'image', source: { type: 'base64', media_type: image.mimeType || 'image/webp', data: image.data } }));
      if (turn.text) blocks.push({ type: 'text', text: String(turn.text) });
      return { role, content: blocks };
    }
    return { role, content: String(turn.text ?? '') };
  }).filter(turn => typeof turn.content === 'string' ? turn.content.length > 0 : turn.content.length > 0);
  const first = mapped.findIndex(turn => turn.role === 'user');
  return first === -1 ? [] : mapped.slice(first);
};

// The transcript as Gemini's generateContent takes it: role user|model, inline images as parts ahead of the text.
export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
export type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };
export const geminiContentsOf = (turns: AiTurn[]): GeminiContent[] => {
  const mapped: GeminiContent[] = turns.map(turn => {
    const parts: GeminiPart[] = (turn.images ?? []).filter(image => image && image.data).map(image => ({ inlineData: { mimeType: image.mimeType || 'image/webp', data: image.data } }));
    if (turn.text) parts.push({ text: String(turn.text) });
    return { role: turn.role, parts };
  }).filter(content => content.parts.length > 0);
  return openingOnUser(mapped);
};

// A provider's failure, read from its HTTP status (or the status its message carries), without trusting the shape.
export const providerStatusOf = (error: { status?: unknown; message?: unknown } | null | undefined): number | null => {
  if (!error) return null;
  if (typeof error.status === 'number' && Number.isInteger(error.status) && error.status >= 100 && error.status < 600) return error.status;
  const message = typeof error.message === 'string' ? error.message : '';
  const bracketed = /\[(\d{3})[\s\]]/.exec(message);
  if (bracketed) return Number(bracketed[1]);
  if (/CONSUMER_SUSPENDED|\b403\b/.test(message)) return 403;
  if (/\b429\b|quota|overwhelmed/i.test(message)) return 429;
  return null;
};

// Gemini answers an invalid key with a 400 that names the reason; that is a rejected key, not a plain failure.
export const providerKeyRejected = (error: { status?: unknown; message?: unknown } | null | undefined): boolean => {
  const message = typeof error?.message === 'string' ? error.message : '';
  return /API_KEY_INVALID|API key not valid|invalid x-api-key|authentication_error/i.test(message);
};

// How a rail's failure speaks at the edge: a rejected key, a rate limit, or a plain failure.
export const aiRailRefusal = (status: number | null, keyRejected = false): { refusal: 'ai_key_rejected' | 'ai_rate_limited' | 'ai_failed'; status: number } =>
  status === 401 || status === 403 || keyRejected ? { refusal: 'ai_key_rejected', status: 403 }
    : status === 429 ? { refusal: 'ai_rate_limited', status: 429 }
      : { refusal: 'ai_failed', status: 502 };

// A kept key's row name (the origin's providerCredentials doc id) and the hint a shell may show.
export const credentialIdOf = (scope: AiCredentialScope, holderId: string, provider: string): string => `${scope}_${holderId}_${provider}`;
export const keyHintOf = (key: string): string => (key.length > 4 ? `…${key.slice(-4)}` : 'set');
