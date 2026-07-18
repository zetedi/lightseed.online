import { describe, it, expect } from 'vitest';
import {
  buildTranslationPrompt, clampTranslationDepth,
  TRANSLATION_DEPTH_MIN, TRANSLATION_DEPTH_MAX,
} from '../src/domain/translation';

const req = (over: Partial<Parameters<typeof buildTranslationPrompt>[0]> = {}) => ({
  senderTreeName: 'The Aspen',
  receiverTreeName: 'The Willow',
  message: 'You promised the grove would be tended. It was not.',
  depth: 3,
  ...over,
});

describe('buildTranslationPrompt — the NVC reading, with its fidelity commitments', () => {
  it('asks for all five distinctions in the response schema', () => {
    const p = buildTranslationPrompt(req());
    for (const field of ['"happened"', '"feeling"', '"inference"', '"need"', '"asks"', '"alternatives"']) {
      expect(p).toContain(field);
    }
  });

  it('is grounded in Nonviolent Communication and reads, never judges', () => {
    const p = buildTranslationPrompt(req());
    expect(p).toContain('Nonviolent Communication');
    expect(p).toContain('a reader, not a judge');
    expect(p).toContain('never a verdict');
  });

  it('carries the fidelity commitments — intensity preserved, no manufactured peace', () => {
    const p = buildTranslationPrompt(req());
    expect(p).toContain('Preserve intensity');
    expect(p).toContain('Never counsel reconciliation, forgiveness or calm');
    expect(p).toContain('a line was crossed');
    expect(p).toContain('never a replacement'); // the speaker's own words stay
  });

  it('treats depth as context breadth, never speculation', () => {
    const p = buildTranslationPrompt(req());
    expect(p).toContain('never the speculation');
    expect(buildTranslationPrompt(req({ depth: 1 }))).toContain('the message alone');
    expect(buildTranslationPrompt(req({ depth: 4 }))).toContain('subgraph');
  });

  it('embeds the message, the beings, and the gathered context (or None)', () => {
    const p = buildTranslationPrompt(req({ context: 'Shared circle: the grove keepers' }));
    expect(p).toContain('The Aspen');
    expect(p).toContain('The Willow');
    expect(p).toContain('It was not.');
    expect(p).toContain('the grove keepers');
    expect(buildTranslationPrompt(req({ context: undefined }))).toContain('Living context provided: None');
  });

  it('clamps depth to the defined range', () => {
    expect(clampTranslationDepth(0)).toBe(TRANSLATION_DEPTH_MIN);
    expect(clampTranslationDepth(-3)).toBe(TRANSLATION_DEPTH_MIN);
    expect(clampTranslationDepth(9)).toBe(TRANSLATION_DEPTH_MAX);
    expect(clampTranslationDepth(2.4)).toBe(2);
    expect(clampTranslationDepth(NaN)).toBe(TRANSLATION_DEPTH_MIN);
  });
});
