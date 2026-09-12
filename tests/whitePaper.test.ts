import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { WHITE_PAPER_CHAPTERS, rootPaperPath, isPaperContentType } from '../src/domain/whitePaper';

// The book names only chapters that exist, opens them at one fixed door, and refuses to read
// anything the server does not declare as text (the SPA fallback answers HTML for a missing path).
describe('the white paper', () => {
  it('every chapter is a real root/ file', () => {
    for (const c of WHITE_PAPER_CHAPTERS) expect(existsSync(join(__dirname, '..', 'root', `${c}.md`)), `${c}.md`).toBe(true);
  });

  it('a chapter has one fixed same-origin door under /root/', () => {
    expect(rootPaperPath('GENESIS')).toBe('/root/GENESIS.md');
    for (const c of WHITE_PAPER_CHAPTERS) expect(rootPaperPath(c)).toMatch(/^\/root\/[A-Z_]+\.md$/);
  });

  it('only text is a paper — HTML from the catch-all rewrite is not', () => {
    expect(isPaperContentType('text/markdown; charset=utf-8')).toBe(true);
    expect(isPaperContentType('text/plain')).toBe(true);
    expect(isPaperContentType('TEXT/MARKDOWN')).toBe(true);
    expect(isPaperContentType('text/html; charset=utf-8')).toBe(false);
    expect(isPaperContentType('application/json')).toBe(false);
    expect(isPaperContentType(null)).toBe(false);
    expect(isPaperContentType(undefined)).toBe(false);
    expect(isPaperContentType('')).toBe(false);
  });
});
