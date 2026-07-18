import { describe, it, expect } from 'vitest';
import { tokenize, matchCommunities } from '../src/domain/match';

// Vision ↔ community resonance — the matcher's arithmetic, testable without any backend.

describe('tokenize', () => {
  it('strips html, lowercases, drops stopwords and stubs', () => {
    expect(tokenize('<p>The Garden of SOULS — a garden!</p>')).toEqual(['garden', 'souls', 'garden']);
    expect(tokenize('is a of to')).toEqual([]);
    expect(tokenize('')).toEqual([]);
  });
  it('speaks unicode', () => {
    expect(tokenize('Erdő és fény')).toContain('erdő');
  });
  it('entities are glue, not words', () => {
    expect(tokenize('garden&nbsp;of&nbsp;souls &amp; trees')).toEqual(['garden', 'souls', 'trees']);
  });
});

describe('matchCommunities', () => {
  const communities = [
    { name: 'Per Auset', vision: 'A garden of souls — regeneration, trees, and care for the living land.' },
    { name: 'Techno Hub', vision: 'Blockchain synergy ventures and disruptive scaling.' },
    { name: 'Forest School', vision: 'Children learning under trees, care and slow growth.' },
    { name: 'Empty', vision: '' },
  ];

  it('ranks by resonance and names the shared ground', () => {
    const m = matchCommunities(['My dream: a garden where souls tend trees with care.'], communities, 3);
    expect(m.length).toBeGreaterThanOrEqual(2);
    expect(m[0].community.name).toBe('Per Auset');
    expect(m[0].shared).toContain('garden');
    expect(m[0].score).toBeGreaterThan(0);
    expect(m.map(x => x.community.name)).not.toContain('Techno Hub');
  });

  it('caps at the asked top and orders descending', () => {
    const m = matchCommunities(['trees care garden souls learning'], communities, 2);
    expect(m.length).toBeLessThanOrEqual(2);
    if (m.length === 2) expect(m[0].score).toBeGreaterThanOrEqual(m[1].score);
  });

  it('no visions, no matches — and communities without words never appear', () => {
    expect(matchCommunities([], communities)).toEqual([]);
    expect(matchCommunities(['garden'], communities).map(x => x.community.name)).not.toContain('Empty');
  });
});
