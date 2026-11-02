import { describe, expect, it } from 'vitest';
import { parseJsonArray, parseJsonObject, synergyPrompt, treeVoiceInstruction, wateringWitnessPrompt, postTitlePrompt, lifetreeBioPrompt, oracleQuotePrompt, GENESIS_VISION, treeVoiceFallbackInstruction } from '../src/domain/aiPrompts';

describe('the readers of a model reply', () => {
  it('pull the first array out of prose and fences, and answer [] to anything else', () => {
    expect(parseJsonArray('Here you go:\n```json\n[{"a":1},{"a":2}]\n```\nHope it helps')).toEqual([{ a: 1 }, { a: 2 }]);
    expect(parseJsonArray('[1,2]')).toEqual([1, 2]);
    expect(parseJsonArray('')).toEqual([]);
    expect(parseJsonArray('no brackets here')).toEqual([]);
    expect(parseJsonArray('[not json')).toEqual([]);
    expect(parseJsonArray('{"a":1}')).toEqual([]);
  });
  it('pull the first object out of prose and fences, and answer null to anything else', () => {
    expect(parseJsonObject<{ watering: boolean }>('Sure! ```json {"watering": true, "confidence": 80, "note": "wet soil"} ```')).toEqual({ watering: true, confidence: 80, note: 'wet soil' });
    expect(parseJsonObject('')).toBeNull();
    expect(parseJsonObject('[1,2]')).toBeNull();
    expect(parseJsonObject('{broken')).toBeNull();
    expect(parseJsonObject('null')).toBeNull();
  });
});

describe('the prompts', () => {
  it('name the tree, its place and the exact asks the origin sends', () => {
    expect(treeVoiceInstruction({ name: 'Nur' })).toContain('Tree name: Nur');
    expect(treeVoiceInstruction({ name: 'Nur' })).toContain('Short title: None');
    expect(treeVoiceInstruction({ name: 'Nur', treeType: 'SECRET' })).toContain('Type: SECRET');
    expect(treeVoiceFallbackInstruction({ name: 'Nur' })).toBe('You are speaking as the living voice of the Lifetree "Nur" in the Lightseed network.  Speak in first person, grounded, concise and warm.');
    expect(wateringWitnessPrompt({ name: 'Nur', locationName: 'Kataragama' })).toContain('"Nur" at Kataragama');
    expect(wateringWitnessPrompt({ name: 'Nur' })).toContain('"Nur" and decide');
    expect(postTitlePrompt('a body')).toContain('---\na body\n---');
    expect(lifetreeBioPrompt('light')).toContain('seed thought: "light"');
    expect(oracleQuotePrompt()).toContain(GENESIS_VISION);
  });
  it('lay the field out one tree per line with its place and a bounded vision', () => {
    const prompt = synergyPrompt([{ title: 'A', place: 'Brussels', body: 'x'.repeat(500) }, { title: 'B', description: 'd' }]);
    expect(prompt).toContain(`- Tree: A, Place: Brussels, Vision: ${'x'.repeat(400)}\n- Tree: B, Vision: d`);
    expect(prompt).toContain('Return at most 6');
  });
});
