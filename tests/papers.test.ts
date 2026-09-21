import { describe, it, expect } from 'vitest';
import { PAPERS_MAX, PAPER_TITLE_MAX, VISION_KEY, paperKeyFor, paperProblem, papersOf, visionOf, withVision } from '../src/domain/papers';

describe('papers — a place\'s words are data, the vision first', () => {
  it('reads lawful chapters, the vision first, each key once, at most the cap', () => {
    const raw = [
      { key: 'way', title: 'Our way', html: '<p>slow</p>' },
      { key: 'vision', title: '', html: '<p>a garden</p>', shows: ['community', 'nope'] },
      { key: 'way', title: 'dupe', html: '' },
      { key: 'Bad Key', title: 'x', html: '' },
      { key: 'long', title: 'x'.repeat(PAPER_TITLE_MAX + 1), html: '' },
      'not a paper',
    ];
    const papers = papersOf(raw);
    expect(papers.map(p => p.key)).toEqual(['vision', 'way']);
    expect(papers[0].shows).toEqual(['community']);
    expect(papersOf(Array.from({ length: PAPERS_MAX + 5 }, (_, i) => ({ key: `k${i}`, title: '', html: '' })))).toHaveLength(PAPERS_MAX);
    expect(papersOf(undefined)).toEqual([]);
  });
  it('the vision is the first paper\'s html, or nothing', () => {
    expect(visionOf({ papers: [{ key: 'way', title: '', html: 'w' }, { key: VISION_KEY, title: '', html: '<p>v</p>' }] })).toBe('<p>v</p>');
    expect(visionOf({ papers: [] })).toBe('');
    expect(visionOf(null)).toBe('');
  });
  it('withVision sets the vision without disturbing the rest', () => {
    const next = withVision([{ key: 'way', title: 'Way', html: 'w' }], '<p>new</p>');
    expect(next.map(p => p.key)).toEqual(['vision', 'way']);
    expect(next[0].html).toBe('<p>new</p>');
    expect(withVision([{ key: 'vision', title: 'Vision', html: 'old' }], 'new')[0]).toEqual({ key: 'vision', title: 'Vision', html: 'new' });
  });
  it('refuses a bad key or a long title, and mints unique keys from titles', () => {
    expect(paperProblem({ key: 'Our Way', title: '' })).toBe('paper_key_bad');
    expect(paperProblem({ key: 'way', title: 'x'.repeat(PAPER_TITLE_MAX + 1) })).toBe('paper_title_long');
    expect(paperProblem({ key: 'way', title: 'Our way' })).toBe(null);
    expect(paperKeyFor('House Rules!', [])).toBe('house-rules');
    expect(paperKeyFor('House Rules', [{ key: 'house-rules', title: '', html: '' }])).toBe('house-rules-2');
    expect(paperKeyFor('Vision', [])).toBe('vision-2');
    expect(paperKeyFor('', [])).toBe('paper');
  });
});
