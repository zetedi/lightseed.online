import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PALETTE_REACH_ATTR, paletteReaches } from '../src/domain/paletteReach';

describe('the palette reaches the page', () => {
  it('the dial is one boolean, off unless turned', () => {
    expect(paletteReaches({ paletteReach: true })).toBe(true);
    expect(paletteReaches({ paletteReach: 'true' })).toBe(false);
    expect(paletteReaches({})).toBe(false);
    expect(paletteReaches(null)).toBe(false);
  });
  it('the stylesheet carries the remap under the one attribute: ink by day, primary day and night', () => {
    const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
    const on = `[data-palette="${PALETTE_REACH_ATTR}"]`;
    expect(css).toContain(`:root${on}[data-mode="light"] :is(.text-slate-950, .text-slate-900, .text-slate-800) { color: var(--color-text); }`);
    expect(css).toContain(`:root${on} :is(.bg-emerald-600, .hover\\:bg-emerald-600:hover, .bg-emerald-400) { background-color: var(--color-primary); }`);
    expect(css).toContain(`:root${on}[data-mode="dark"] .dark\\:text-emerald-300 { color: var(--primary-300); }`);
    // The ink never reaches by night: no night rule touches the slate text.
    expect(css).not.toMatch(/\[data-mode="dark"\][^\n]*\.text-slate-/);
  });
});
