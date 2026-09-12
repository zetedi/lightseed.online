
// 'xnz' is Mattokki (Kenzi), the Nubian of the Aswan reach — see dictionaries/xnz.ts.
import { line, type DomainKey } from '../domain/words';
import en, { type Dictionary } from './dictionaries/en';

// Every tongue the shell can speak. The list IS the type: a new seat needs a file under
// dictionaries/ and a loader below, and the compiler refuses a seat without one.
export const LANGUAGES = ['en', 'es', 'hu', 'qu', 'sa', 'ja', 'ar', 'sw', 'zh', 'xnz'] as const;
export type Language = (typeof LANGUAGES)[number];
export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);

// THE DICTIONARIES ARRIVE ONE AT A TIME (ring 2026-09-13). English rides with the shell: it is
// the fallback every other tongue reads through, and the type of every key. Every other
// dictionary is its own chunk under dictionaries/<lang>.ts, holding only what it overrides, and
// arrives the first time a reader chooses it — or at boot, for the tongue localStorage
// remembers, before React mounts. Arabic and Chinese alone weighed 185 kB inside every first
// paint of every reader; now a reader carries the language they read.
type Overrides = Partial<Dictionary>;
const LOADERS: Record<Exclude<Language, 'en'>, () => Promise<{ default: Overrides }>> = {
  es: () => import('./dictionaries/es'),
  hu: () => import('./dictionaries/hu'),
  qu: () => import('./dictionaries/qu'),
  sa: () => import('./dictionaries/sa'),
  ja: () => import('./dictionaries/ja'),
  ar: () => import('./dictionaries/ar'),
  sw: () => import('./dictionaries/sw'),
  zh: () => import('./dictionaries/zh'),
  xnz: () => import('./dictionaries/xnz'),
};

// The live registry: English always, every other tongue once it has arrived. No reader indexes a
// tongue that is not there — dictionaryOf answers English until the words land, exactly the
// key-by-key fallback t() and speak() always had.
export const translations: { en: Dictionary } & Partial<Record<Language, Dictionary>> = { en };
export const dictionaryOf = (lang: Language): Dictionary => translations[lang] ?? en;
export const isLanguageLoaded = (lang: Language): boolean => Object.prototype.hasOwnProperty.call(translations, lang);

// Fetch a tongue once; a second ask while the first is in flight shares the same promise. The
// merged dictionary is complete (English under the overrides), so a key a tongue has not
// translated reads English rather than nothing.
const inFlight = new Map<Language, Promise<Dictionary>>();
export const loadLanguage = (lang: Language): Promise<Dictionary> => {
  const held = translations[lang];
  if (held) return Promise.resolve(held);
  let pending = inFlight.get(lang);
  if (!pending) {
    pending = LOADERS[lang as Exclude<Language, 'en'>]()
      .then(({ default: overrides }) => {
        const dict: Dictionary = { ...en, ...overrides };
        translations[lang] = dict;
        return dict;
      })
      .finally(() => inFlight.delete(lang));
    inFlight.set(lang, pending);
  }
  return pending;
};


// ── THE SPEAKING LAYER ─────────────────────────────────────────────────────────────────────
// The reader's language, readable OUTSIDE React: the imperative dialog (ui/Dialog) and thrown
// errors have no hook to call. LanguageContext is the WRITER (setActiveLanguage on init and on
// every change); localStorage seeds it before React mounts, so the first dialog already speaks.
let activeLanguage: Language = (() => {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('lifeseed_lang') : null;
    return isLanguage(stored) ? stored : 'en';
  } catch { return 'en'; }
})();

// Started here, before React mounts: the remembered tongue's words are on their way while the
// shell boots; until they land, every reader speaks English key by key.
void loadLanguage(activeLanguage);

export const setActiveLanguage = (lang: Language): void => { activeLanguage = lang; };
export const getActiveLanguage = (): Language => activeLanguage;

export type TranslationKey = keyof Dictionary;
// Own-property, never `in`: the dictionaries are object literals, so `'constructor' in` would
// answer yes from the prototype and speak() would mangle an innocent word (same guard as
// domain/beingIndex.isBeingKind).
export const isTranslationKey = (value: unknown): value is TranslationKey =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(translations.en, value);

// SPEAK — say a message in the reader's language when it is a KEY, and let anything else pass
// through untouched. This is the one boundary that lets the domain and the services throw KEYS
// ("no more English in the code") while legacy strings and composed sentences still display.
// `params` fills {placeholder} holes after translation, so dynamic values survive the border.
export const speak = (message: string, params?: Record<string, string | number>): string => {
  // A SPOKEN LINE may carry its own params: `key::{"n":5}` — the compact convention that lets a
  // pure domain function return one string that still says "at most 12 nights" in any tongue.
  let key = message;
  let inlineParams: Record<string, string | number> | undefined;
  const sep = message.indexOf('::');
  if (sep > 0) {
    try {
      const parsed = JSON.parse(message.slice(sep + 2));
      if (parsed && typeof parsed === 'object') { key = message.slice(0, sep); inlineParams = parsed; }
    } catch { /* not a spoken line — leave the message whole */ }
  }
  let out = isTranslationKey(key)
    ? (dictionaryOf(activeLanguage)[key] || translations.en[key])
    : message;
  for (const [k, v] of Object.entries({ ...inlineParams, ...params })) out = out.split(`{${k}}`).join(String(v));
  return out;
};

// The APP's half of the convention: compose a spoken line without knowing any language. The
// format itself has ONE owner — domain/words.line — shared with the domain's own spokenLine,
// so the `key::{json}` shape can never fork between the two layers.
export const spokenLine = (key: TranslationKey, params: Record<string, string | number>): string =>
  line(key, params);

// THE WORDS CONTRACT, held: every key the domain's laws speak (domain/words DOMAIN_KEYS)
// exists in this dictionary — the compiler is the mirror test. A key added to the manifest
// without words here turns this line red; tests/words.test.ts is the runtime belt (and holds
// ar/zh completeness the same way the dictionary tests always have).
const _domainWordsCovered: DomainKey extends TranslationKey ? true : never = true;
void _domainWordsCovered;
