import { describe, it, expect } from 'vitest';
import { DOMAIN_KEYS, spokenLine, line } from '../src/domain/words';
import { translations, speak, setActiveLanguage } from '../src/utils/translations';

// The words contract (ring 2026-08-14): the domain owns the manifest of every key its laws
// speak; the dictionary proves coverage. The compile half lives in translations.ts
// (DomainKey extends TranslationKey); this is the runtime belt — and the proof that the
// spoken-line format has one owner shared by both layers.

describe('every word the domain speaks exists in every language', () => {
  for (const lang of ['en', 'ar', 'zh'] as const) {
    it(`${lang} covers the whole manifest`, () => {
      for (const key of DOMAIN_KEYS) {
        expect(translations[lang][key], `${lang} is missing '${key}'`).toBeTruthy();
      }
    });
  }
});

describe('the spoken-line format has one owner', () => {
  it('domain spokenLine and the raw line agree exactly', () => {
    expect(spokenLine('stay_max_nights', { max: 12 })).toBe(line('stay_max_nights', { max: 12 }));
    expect(spokenLine('lid62_length', { n: 22 })).toBe('lid62_length::{"n":22}');
  });

  it('speak() understands what the domain composes — end to end, params filled', () => {
    setActiveLanguage('en');
    const said = speak(spokenLine('limit_lifetrees', { max: 21 }));
    expect(said).toBe(translations.en.limit_lifetrees.split('{max}').join('21'));
    expect(said).not.toContain('{max}');
    expect(said).not.toContain('::');
  });
});
