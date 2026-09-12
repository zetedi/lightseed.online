import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// THE EDITOR'S DOOR (ring 2026-09-13). Quill weighs 142 kB and belongs to the moment someone
// edits, not to every page that can show a vision. ui/RichTextEditor is the one seam: it
// lazy-imports ui/RichTextEditorQuill, and nothing else may reach Quill or that file
// statically — a static import anywhere would pull the editor back into a page chunk.

const SRC = join(__dirname, '..', 'src');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(name) ? [p] : [];
  });

describe('the rich-text editor arrives only when someone edits', () => {
  const files = walk(SRC).map((f) => [f.slice(SRC.length + 1), readFileSync(f, 'utf8')] as const);

  it('only the Quill half imports react-quill', () => {
    const importers = files.filter(([, s]) => /from ['"]react-quill-new/.test(s)).map(([f]) => f);
    expect(importers).toEqual(['components/ui/RichTextEditorQuill.tsx']);
  });

  it('the Quill half is reached only through the seam, and only lazily', () => {
    const staticImporters = files
      .filter(([, s]) => /^import\s[^;]*['"][^'"]*RichTextEditorQuill['"]/m.test(s.replace(/^import type .*$/gm, '')))
      .map(([f]) => f);
    expect(staticImporters).toEqual([]);
    const seam = files.find(([f]) => f === 'components/ui/RichTextEditor.tsx')?.[1] || '';
    expect(seam).toMatch(/lazy\(\(\) => import\('\.\/RichTextEditorQuill'\)\)/);
  });
});
