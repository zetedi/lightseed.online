import { describe, it, expect, afterEach } from 'vitest';
import { speak, setActiveLanguage, getActiveLanguage, isTranslationKey, translations } from '../src/utils/translations';

// THE SPEAKING LAYER — the one boundary that lets the domain and the services carry KEYS
// instead of English ("no more English in the code", 2026-08-10). A key says itself in the
// reader's language; anything else passes through untouched, so legacy strings and composed
// sentences never break while the sweep converges.

afterEach(() => setActiveLanguage('en'));

describe('speak', () => {
  it('a key says itself in the active language, and follows a change', () => {
    expect(speak('cancel')).toBe('Cancel');
    setActiveLanguage('ar');
    expect(speak('cancel')).toBe(translations.ar.cancel);
    setActiveLanguage('zh');
    expect(speak('cancel')).toBe(translations.zh.cancel);
    expect(getActiveLanguage()).toBe('zh');
  });

  it('what is not a key passes through untouched — never swallowed, never mangled', () => {
    expect(speak('A perfectly ordinary sentence.')).toBe('A perfectly ordinary sentence.');
    expect(speak('')).toBe('');
    setActiveLanguage('ar');
    expect(speak('Composed: 3 of 7 done')).toBe('Composed: 3 of 7 done');
  });

  it('fills {placeholder} holes after translation, every occurrence', () => {
    expect(speak('invite_as_role', { role: 'Guardian' })).toBe('as Guardian');
    expect(speak('{n} + {n} = 2×{n}', { n: 4 })).toBe('4 + 4 = 2×4');
  });

  it('a language whose dictionary misses a key falls back to English rather than silence', () => {
    setActiveLanguage('es'); // Spanish spreads baseKeys — every key resolves, worst case English
    expect(speak('ok').length).toBeGreaterThan(0);
  });

  it('isTranslationKey tells keys from prose, and inherited object props are not keys', () => {
    expect(isTranslationKey('cancel')).toBe(true);
    expect(isTranslationKey('definitely not a key')).toBe(false);
    expect(isTranslationKey(undefined)).toBe(false);
    // `in` would see Object.prototype members on a plain object — the dictionaries are object
    // literals, so constructor IS inherited; the guard must still say no.
    expect(isTranslationKey('constructor')).toBe(false);
  });
});
