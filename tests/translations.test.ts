import { describe, it, expect } from 'vitest';
import en from '../src/utils/dictionaries/en';
import ar from '../src/utils/dictionaries/ar';
import zh from '../src/utils/dictionaries/zh';
import { LANGUAGES, loadLanguage, dictionaryOf } from '../src/utils/translations';

// A language is a promise: choose it and the app speaks it. Every tongue reads English under its
// own words, so a missing key never crashes — it silently reads English, and the promise breaks
// quietly. These tests name the languages we claim are COMPLETE and hold them to it, reading each
// tongue's own file (what it overrides), not the merged dictionary that would hide the hole.
// Adding a key to English without translating it here fails the gate rather than reaching a
// reader as English.
const COMPLETE = { ar, zh } as const;
type Complete = keyof typeof COMPLETE;
const KEYS = Object.keys(en) as (keyof typeof en)[];
const own = (lang: Complete) => COMPLETE[lang] as Partial<Record<keyof typeof en, string>>;

describe('the languages we claim to speak', () => {
    it.each(Object.keys(COMPLETE) as Complete[])('%s names every key English has', (lang) => {
        expect(KEYS.filter(k => !(k in own(lang)))).toEqual([]);
    });

    // A value counts as translated when it differs from the English one. Values with no Latin
    // letters (a lone symbol, a number) are language-neutral and may legitimately be identical.
    it.each(Object.keys(COMPLETE) as Complete[])('%s has its own words for every key', (lang) => {
        expect(KEYS.filter(k => /[A-Za-z]/.test(en[k]) && own(lang)[k] === en[k])).toEqual([]);
    });

    it.each(Object.keys(COMPLETE) as Complete[])('%s keeps every {placeholder} the English string carries', (lang) => {
        const holes = (s: string | undefined) => ((s || '').match(/\{[a-z]+\}/g) || []).sort().join(',');
        expect(KEYS.filter(k => holes(en[k]) !== holes(own(lang)[k]))).toEqual([]);
    });

    it('no dictionary carries an empty string, and every seat has a file', async () => {
        for (const lang of LANGUAGES) {
            await loadLanguage(lang);
            const empty = Object.entries(dictionaryOf(lang)).filter(([, v]) => !String(v).trim());
            expect({ lang, empty }).toEqual({ lang, empty: [] });
        }
    });
});
