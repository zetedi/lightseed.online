import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { translations } from '../src/utils/translations';

// THE ENGLISH GUARD (ring 2026-08-10): after the great sweep, no user-facing string may be born
// in English inside the code again — the words live in utils/dictionaries/ (ar+zh complete, held by
// translations.test.ts), and the code carries KEYS. This test walks src/ and fails on the
// patterns the sweep converted: a sentence-cased literal handed to the dialog, the toast, or a
// placeholder. A key is snake_case and lowercase, so ANY capitalised literal in these seats is a
// regression. (Free JSX text is swept by review — a regex over JSX cannot tell prose from a
// proper noun — but the imperative seats below are exact.)

const ROOT = join(__dirname, '..', 'src');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });

// A sentence-cased literal in a speaking seat. `[A-Z][a-z]` start + length ≥ 4 keeps single
// words like 'OK' sentinels and non-Latin text out of scope; keys never match (lowercase).
const FORBIDDEN: [string, RegExp][] = [
  ['showAlert with English literal', /showAlert\(\s*['"`][A-Z][a-z][^'"`]{2,}/],
  ['showConfirm with English literal', /showConfirm\(\s*['"`][A-Z][a-z][^'"`]{2,}/],
  ['notify with English literal', /notify\(\s*['"`][A-Z][a-z][^'"`]{2,}/],
  ['throw new Error with English literal', /throw new Error\(\s*['"`][A-Z][a-z][^'"`]{2,}/],
  ['placeholder with English literal', /placeholder="[A-Z][a-z][^"]{2,}"/],
];

// The few lawful exceptions, each with its reason:
const ALLOWED_FILES = new Set([
  'index.tsx',                 // root-mount failure: programmer error, no UI exists yet to speak
  'components/ui/Dialog.tsx',  // its doc-comment shows example usage
  'components/ui/Toast.tsx',   // same
  'contexts/LanguageContext.tsx', // hook guard: programmer error, unreachable by readers
  'contexts/SessionContext.tsx',  // same
]);

const isComment = (line: string) => {
  const s = line.trim();
  return s.startsWith('//') || s.startsWith('*') || s.startsWith('/*');
};

describe('no English is born in the code', () => {
  it('every speaking seat carries a key, never a sentence', () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
      if (ALLOWED_FILES.has(rel)) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (isComment(line)) return;
        for (const [what, re] of FORBIDDEN) {
          if (re.test(line)) offenders.push(`${rel}:${i + 1} — ${what}`);
        }
      });
    }
    expect(offenders, `English literals found:\n${offenders.join('\n')}`).toEqual([]);
  });
});

// THE OTHER HALF OF THE GUARD (ring 2026-09-10): a seat that carries a KEY is only translated if
// the key EXISTS. speak() passes an unknown string through untouched, so a mistyped or never-added
// key ships silently and the reader sees `err_council_voice` where a sentence should stand. This
// walks the same speaking seats for snake_case literals and demands each one be a real key. It
// found 18 the day it was written (the i18n sweep's keys, referenced before they were added, and
// one — err_generic — latent since the offering ring).
const KEY_SEATS: RegExp[] = [
  /(?:showAlert|showConfirm|notify|speak)\(\s*(?:[a-zA-Z0-9_.?]+\s*(?:\|\||\?\?)\s*)?['"`]([a-z][a-z0-9_]{3,})['"`]/g,
  /\b(?:title|confirmText|cancelText):\s*['"`]([a-z][a-z0-9_]{3,})['"`]/g,
];

describe('a key in a speaking seat is a key that exists', () => {
  it('every snake_case literal handed to a dialog, a toast or speak() is in the table', () => {
    const known = new Set(Object.keys(translations.en));
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
      if (rel === 'utils/translations.ts' || rel.startsWith('utils/dictionaries/')) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (isComment(line)) return;
        for (const re of KEY_SEATS) {
          for (const m of line.matchAll(re)) {
            const key = m[1];
            // A spoken line (`key::{json}`) is parsed by speak(); its key half is what must exist.
            const bare = key.split('::')[0];
            if (!known.has(bare)) offenders.push(`${rel}:${i + 1} — '${bare}' is not in translations`);
          }
        }
      });
    }
    expect(offenders, `keys referenced but never written:\n${offenders.join('\n')}`).toEqual([]);
  });
});
