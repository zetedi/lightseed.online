import type { DomainKey } from './words';

// A PERSON'S NAME (ring 2026-09-07). The name a being wears in the shell, on its pulses'
// authorName, in the letters the node writes about it. It is the being's to change — and the
// law here only keeps it a NAME: something is written, it fits a line, it carries no control
// characters, its whitespace is one breath wide. Nothing about uniqueness (names are not
// identity; the lid is), nothing about propriety (that is the community's, not a regex's).
//
// Plain contract — guaranteed: normalizePersonName trims and collapses inner whitespace;
// personNameProblem answers a DOMAIN key for an empty, over-long or control-charactered name
// and null for a name that stands. Enforced by tests/personName.test.ts.
export const PERSON_NAME_MAX = 60;

export const normalizePersonName = (raw: string | null | undefined): string =>
  (raw ?? '').replace(/\s+/g, ' ').trim();

// The point is to refuse control characters, written as escapes so none rides in the source.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export const personNameProblem = (raw: string | null | undefined): DomainKey | null => {
  const name = normalizePersonName(raw);
  if (!name) return 'name_empty';
  if (name.length > PERSON_NAME_MAX) return 'name_long';
  if (CONTROL_CHARS.test(name)) return 'name_chars';
  return null;
};
