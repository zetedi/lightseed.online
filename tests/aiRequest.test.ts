import { describe, expect, it } from 'vitest';
import { nodeAiRefusal, aiKindOf, openingOnUser, anthropicTurnsOf, geminiContentsOf, providerStatusOf, providerKeyRejected, aiRailRefusal, credentialIdOf, keyHintOf, jsonSystemOf, aiRetryDelayMs, AI_KIND_LIMIT, AI_KIND_COUNTER, JSON_ONLY_INSTRUCTION } from '../src/domain/aiRequest';

describe('the node-key gate', () => {
  it('refuses exactly when the origin would: not staff, dial on, not validated', () => {
    expect(nodeAiRefusal({ staff: false, validatedOnly: true, validated: false })).toBe('ai_validated_only');
    expect(nodeAiRefusal({})).toBe('ai_validated_only');
    expect(nodeAiRefusal({ staff: true })).toBeNull();
    expect(nodeAiRefusal({ validatedOnly: false })).toBeNull();
    expect(nodeAiRefusal({ validated: true })).toBeNull();
  });
  it('infers the allowance from the ask, so an image call cannot draw on the text allowance', () => {
    expect(aiKindOf({ model: 'gemini-3.5-flash' })).toBe('text');
    expect(aiKindOf({ model: 'gemini-2.5-flash-image' })).toBe('image');
    expect(aiKindOf({ model: 'gemini-3.5-flash', imageOut: true })).toBe('image');
    expect(aiKindOf({})).toBe('text');
    expect(AI_KIND_LIMIT).toEqual({ text: 21, image: 3 });
    expect(AI_KIND_COUNTER).toEqual({ text: 'dailyAiText', image: 'dailyAiImage' });
  });
});

describe('the transcript for each rail', () => {
  const turns = [{ role: 'model' as const, text: 'hello' }, { role: 'user' as const, text: 'hi', images: [{ mimeType: 'image/webp', data: 'QUJD' }] }, { role: 'model' as const, text: '' }, { role: 'user' as const, text: 'again' }];
  it('opens on a user turn', () => {
    expect(openingOnUser(turns).length).toBe(3);
    expect(openingOnUser([{ role: 'model' as const }])).toEqual([]);
  });
  it('speaks Anthropic: assistant for model, images as blocks ahead of the text, empty turns dropped', () => {
    expect(anthropicTurnsOf(turns)).toEqual([
      { role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/webp', data: 'QUJD' } }, { type: 'text', text: 'hi' }] },
      { role: 'user', content: 'again' },
    ]);
    expect(anthropicTurnsOf([{ role: 'model', text: 'x' }])).toEqual([]);
  });
  it('speaks Gemini: inline data ahead of the text, parts never empty', () => {
    expect(geminiContentsOf(turns)).toEqual([
      { role: 'user', parts: [{ inlineData: { mimeType: 'image/webp', data: 'QUJD' } }, { text: 'hi' }] },
      { role: 'user', parts: [{ text: 'again' }] },
    ]);
  });
  it('asks Claude for JSON in the system prompt, since it has no JSON flag', () => {
    expect(jsonSystemOf('Be kind.', true)).toBe(`Be kind.\n\n${JSON_ONLY_INSTRUCTION}`);
    expect(jsonSystemOf(undefined, true)).toBe(JSON_ONLY_INSTRUCTION);
    expect(jsonSystemOf('  ', false)).toBeUndefined();
    expect(jsonSystemOf('Be kind.', false)).toBe('Be kind.');
  });
});

describe('how a provider\'s failure speaks', () => {
  it('reads the status from the error or its message', () => {
    expect(providerStatusOf({ status: 429 })).toBe(429);
    expect(providerStatusOf({ message: '[403 Forbidden] CONSUMER_SUSPENDED' })).toBe(403);
    expect(providerStatusOf({ message: 'Resource has been exhausted (quota)' })).toBe(429);
    expect(providerStatusOf({ message: 'socket hang up' })).toBeNull();
    expect(providerStatusOf(null)).toBeNull();
  });
  it('names a rejected key, a rate limit, or a plain failure', () => {
    expect(aiRailRefusal(401)).toEqual({ refusal: 'ai_key_rejected', status: 403 });
    expect(aiRailRefusal(403)).toEqual({ refusal: 'ai_key_rejected', status: 403 });
    expect(aiRailRefusal(429)).toEqual({ refusal: 'ai_rate_limited', status: 429 });
    expect(aiRailRefusal(500)).toEqual({ refusal: 'ai_failed', status: 502 });
    expect(aiRailRefusal(null)).toEqual({ refusal: 'ai_failed', status: 502 });
    expect(aiRailRefusal(400, true)).toEqual({ refusal: 'ai_key_rejected', status: 403 });
    expect(providerKeyRejected({ message: '[400 Bad Request] API key not valid. [reason: API_KEY_INVALID]' })).toBe(true);
    expect(providerKeyRejected({ message: 'overloaded' })).toBe(false);
  });
  it('waits with the origin\'s patience', () => {
    expect([0, 1, 2, 3].map(aiRetryDelayMs)).toEqual([2000, 4000, 8000, 16000]);
  });
});

describe('a kept key', () => {
  it('is named as the origin names it and hinted without being shown', () => {
    expect(credentialIdOf('community', 'c1', 'anthropic')).toBe('community_c1_anthropic');
    expect(keyHintOf('sk-ant-abcdef')).toBe('…cdef');
    expect(keyHintOf('abcd')).toBe('set');
  });
});
