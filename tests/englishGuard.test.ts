import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// THE ENGLISH GUARD (ring 2026-08-10): after the great sweep, no user-facing string may be born
// in English inside the code again — the words live in translations.ts (ar+zh complete, held by
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
