// AUTOSAVE — what changed, and nothing else (ring 2026-09-07). An appearance is edited live:
// every dial applies as it turns, and the change persists on its own a breath after the hand
// rests. The law here is the WHAT: given what the store holds and what the hand has shaped,
// the patch is exactly the fields that differ — so a write carries only real change, a write
// of nothing never happens, and two edits in one breath ride one write. The WHEN (the breath,
// the timer, the in-flight write) is the hook's (hooks/useAutosave); the law knows no clock.
//
// Plain contract — guaranteed: patchOf compares each named field by VALUE (canonical JSON,
// object keys sorted, so {a,b} and {b,a} are one), undefined and a missing field are one,
// and returns only the differing fields with the draft's values. Not guaranteed: any
// normalisation of the values themselves (trim, theme fill) — the caller shapes the draft
// before asking. Enforced by tests/autosave.test.ts.

// The breath between the last edit and its write.
export const AUTOSAVE_DELAY_MS = 600;

// One spelling for a value, whatever the key order.
export const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.keys(val).sort().reduce<Record<string, unknown>>((o, k) => { o[k] = (val as Record<string, unknown>)[k]; return o; }, {})
      : val,
  ) ?? 'undefined';

export const sameValue = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);

// The fields of `draft` (among `keys`) that differ from `persisted`, with the draft's values.
export const patchOf = <T extends object>(persisted: T, draft: T, keys: readonly (keyof T)[]): Partial<T> => {
  const patch: Partial<T> = {};
  for (const k of keys) if (!sameValue(persisted[k], draft[k])) patch[k] = draft[k];
  return patch;
};

// When the store speaks anew (a save landed, another hand wrote), the draft must follow it
// WITHOUT dropping what this hand is still shaping: a field the hand has not touched since
// the last adoption (draft equals what was adopted) takes the fresh value; a touched field
// keeps the draft, and the law's next patch carries it to the store. Without this, a save
// landing mid-word would put the store's older word back under the hand.
export const reconcile = <T extends object>(adopted: T, fresh: T, draft: T, keys: readonly (keyof T)[]): T => {
  const next = { ...draft };
  for (const k of keys) if (sameValue(draft[k], adopted[k])) next[k] = fresh[k];
  return next;
};

// The appearance a community edits live — the fields the Appearance tab may change.
export const COMMUNITY_APPEARANCE_FIELDS = [
  'name', 'theme', 'logoUrl', 'heroImageUrl', 'imageUrls', 'socialLinks', 'carouselQuotes',
  'customLanding', 'showStats', 'landingPages',
] as const;

// The appearance a person edits live — the personal site theme.
export const PERSONAL_APPEARANCE_FIELDS = ['siteTheme'] as const;

export type AutosaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';
