import { describe, it, expect } from 'vitest';
import { tabTone, tabTint, tabFg, SPECTRUM, SPECTRUM_DEEP } from '../src/utils/tabTheme';

// The spectral grammar (prototype 2026-07-25): the seven destinations ascend root to crown in
// deep mineral tones, stable across nodes so the menu is learned orientation. Sub-destinations
// stay inside the parent's hue family. Node themes keep identity elsewhere, never in the menu.
describe('tabTone: the spectrum is one source and stable across nodes', () => {
  it('the seven destinations ascend root to crown in balanced chakra tones', () => {
    expect(tabTone('forest')).toBe('#b3152f');      // root · crimson garnet
    expect(tabTone('visions')).toBe('#c94b0c');     // sacral · vivid sienna
    expect(tabTone('events')).toBe('#e39c10');      // solar · true gold
    expect(tabTone('offerings')).toBe('#298442');   // heart · leaf green
    expect(tabTone('collab')).toBe('#1d5cc7');      // throat · azure lapis
    expect(tabTone('communities')).toBe('#463585'); // third eye · deep violet-indigo
    expect(tabTone('about')).toBe('#71269e');       // crown · plum amethyst
  });

  it('every destination speaks white except the solar gold, which takes dark text', () => {
    expect(tabFg('events')).toBe('#451a03');
    for (const tab of ['forest', 'visions', 'offerings', 'collab', 'communities', 'about']) {
      expect(tabFg(tab)).toBe('#ffffff');
    }
  });

  it('a node theme does NOT bend a destination: the spine reads the same on every node', () => {
    const theme = { primary: '#111111', secondary: '#222222', accent: '#333333' };
    expect(tabTone('forest', theme)).toBe(SPECTRUM.forest);
    expect(tabTone('visions', theme)).toBe(SPECTRUM.visions);
    expect(tabTone('events', theme)).toBe(SPECTRUM.events);
    expect(tabTone('about', theme)).toBe(SPECTRUM.about);
  });

  it('sub-destinations stay inside the parent hue family, one deeper step', () => {
    expect(tabTone('alignments')).toBe(SPECTRUM_DEEP.alignments);
    expect(tabTone('beds')).toBe(SPECTRUM_DEEP.beds);
    expect(tabTone('organisations')).toBe(SPECTRUM_DEEP.organisations);
    // The first sub-tab of Cocreate keeps the parent lapis exactly.
    expect(tabTone('intelligences')).toBe(SPECTRUM.collab);
  });

  it('off-spectrum surfaces keep fixed tones; the unknown falls to slate', () => {
    expect(tabTone('pulses')).toBe('#ea580c');
    expect(tabTone('inspiration')).toBe('#0369a1'); // the whisper side of the voice
    expect(tabTone('unknown-tab')).toBe('#334155');
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
