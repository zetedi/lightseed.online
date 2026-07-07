import { describe, it, expect } from 'vitest';
import { tabTone, tabTint } from '../src/utils/tabTheme';

describe('tabTone — one pigment for pill and band', () => {
  it('falls back to the fixed palette without a theme', () => {
    expect(tabTone('events')).toBe('#0d9488');
    expect(tabTone('pulses')).toBe('#ea580c');
    expect(tabTone('unknown-tab')).toBe('#334155');
  });

  it('events takes theme.secondary but pulses stays orange (they must differ)', () => {
    const theme = { primary: '#111111', secondary: '#222222', accent: '#333333' };
    expect(tabTone('events', theme)).toBe('#222222');
    expect(tabTone('pulses', theme)).toBe('#ea580c');
    expect(tabTone('events', theme)).not.toBe(tabTone('pulses', theme));
  });

  it('visions maps to accent, forest to primary', () => {
    const theme = { primary: '#111111', secondary: '#222222', accent: '#333333' };
    expect(tabTone('visions', theme)).toBe('#333333');
    expect(tabTone('forest', theme)).toBe('#111111');
  });
});

describe('tabTint — the quiet version of the same hue', () => {
  it('mixes toward white deterministically', () => {
    expect(tabTint('#000000', 0.5)).toBe('#808080');
    expect(tabTint('#ffffff')).toBe('#ffffff');
  });

  it('passes through malformed input untouched', () => {
    expect(tabTint('teal')).toBe('teal');
  });
});
