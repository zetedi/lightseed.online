import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// THE DOOR GUARD (ring 2026-09-11). Every link built from STORED data goes through OutwardLink,
// which asks domain/webLink three questions no screen should answer twice: is the href absolute
// (a bare `example.com` is a PATH — that is how a vision's door once opened onto our own shell),
// is it a web scheme at all, and does it leave this house (a new tab, opener sealed) or lead
// back into it (the same tab). A hand-written `<a href={…}>` around a value skips all three.
//
// Allowed without the component: an href that is a LITERAL (a constant, a mailto, an in-app
// path), because a literal is read by the person writing it, and the named exceptions below.

const ROOT = join(__dirname, '..', 'src');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(name) ? [p] : [];
  });

// `<a href={expression}` — an anchor whose target is computed. Literal hrefs (href="…") pass.
const DATA_HREF = /<a\s[^>]*href=\{/;

const ALLOWED = new Map<string, string>([
  // The map's popups are raw HTML strings handed to Leaflet, where a React component cannot go;
  // the href there is passed through safeImageUrl (http(s) or nothing).
  ['components/ForestMap.tsx', 'Leaflet popup HTML, guarded by safeImageUrl'],
  // The QR download is a data: URL the page just made, saved by the reader's own browser.
  ['components/ui/BeingQr.tsx', 'a data: URL for download, made in the page'],
  // The component itself.
  ['components/ui/OutwardLink.tsx', 'the guard'],
  // beingPath() is an in-app path (/b/<lid>) — this shell's own door, which belongs in this tab.
  ['components/lifetree/TreeConnections.tsx', 'beingPath: an in-app path'],
]);

describe('every door built from stored data goes through OutwardLink', () => {
  it('no hand-written anchor takes a computed href', () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
      if (ALLOWED.has(rel)) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
        // an in-app path or a mailto written inline is not an outward door
        if (/href=\{`\//.test(line) || /href=\{'\//.test(line) || /mailto:/.test(line)) return;
        if (DATA_HREF.test(line)) offenders.push(`${rel}:${i + 1} — ${line.trim().slice(0, 90)}`);
      });
    }
    expect(offenders, `anchors that skip the law:\n${offenders.join('\n')}`).toEqual([]);
  });
});
