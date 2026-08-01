import { describe, it, expect } from 'vitest';
import { translations, type Language } from '../src/utils/translations';

// A language is a promise: choose it and the app speaks it. Every dictionary spreads the English
// baseKeys, so a missing key does not crash — it silently reads English, and the promise breaks
// quietly. These tests name the languages we claim are COMPLETE and hold them to it. Adding a key
// to baseKeys without translating it here fails the gate rather than reaching a reader as English.
const COMPLETE: Language[] = ['ar', 'zh'];

// A value counts as translated when it differs from the English one. Values with no Latin letters
// (a lone symbol, a number) are language-neutral and may legitimately be identical.
const untranslated = (lang: Language) =>
    (Object.keys(translations.en) as (keyof typeof translations.en)[])
        .filter(k => /[A-Za-z]/.test(translations.en[k]) && translations[lang][k] === translations.en[k]);

describe('the languages we claim to speak', () => {
    it.each(COMPLETE)('%s has its own words for every key', (lang) => {
        expect(untranslated(lang)).toEqual([]);
    });

    it.each(COMPLETE)('%s keeps every {placeholder} the English string carries', (lang) => {
        const broken = (Object.keys(translations.en) as (keyof typeof translations.en)[])
            .filter(k => {
                const holes = (s: string) => (s.match(/\{[a-z]+\}/g) || []).sort().join(',');
                return holes(translations.en[k]) !== holes(translations[lang][k]);
            });
        expect(broken).toEqual([]);
    });

    it('no dictionary carries an empty string', () => {
        for (const lang of Object.keys(translations) as Language[]) {
            const empty = Object.entries(translations[lang]).filter(([, v]) => !String(v).trim());
            expect({ lang, empty }).toEqual({ lang, empty: [] });
        }
    });
});
