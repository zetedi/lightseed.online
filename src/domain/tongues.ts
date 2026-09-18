// THE TONGUES the shell can speak (moved here from utils/translations, ring 2026-09-18, so a
// desire may name one without the domain reaching up into the shell). The list IS the type: a
// new seat needs a dictionary file under utils/dictionaries/ and a loader in
// utils/translations, and the compiler refuses a seat without one. 'xnz' is Mattokki (Kenzi),
// the Nubian of the Aswan reach.
export const LANGUAGES = ['en', 'es', 'hu', 'qu', 'sa', 'ja', 'ar', 'sw', 'zh', 'xnz'] as const;
export type Language = (typeof LANGUAGES)[number];
export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
