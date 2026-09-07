// HEX COLOUR — the palette's second mouth (ring 2026-09-07). A colour is picked with the eye
// (the native picker) or named with the hand (a hex code); both speak the same value, so
// whichever changes, the other follows. The picker carries only #rrggbb; a hand may write
// #abc, ABC or #AABBCC with stray spaces. normalizeHex settles every lawful spelling into
// the one form the picker and the theme carry (#rrggbb, lowercase) and refuses the rest with
// null — so a half-typed code never reaches the theme, and a typed one always lands.
//
// Plain contract — guaranteed: idempotent on its own output; null for anything that is not
// three or six hex digits (an optional leading #, outer whitespace forgiven). Not guaranteed:
// alpha (#rrggbbaa) or named colours — the theme holds none. Enforced by tests/color.test.ts.
export const normalizeHex = (input: string | null | undefined): string | null => {
  const s = (input ?? '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{6}$/i.test(s)) return `#${s.toLowerCase()}`;
  if (/^[0-9a-f]{3}$/i.test(s)) return `#${s.split('').map((c) => c + c).join('').toLowerCase()}`;
  return null;
};
