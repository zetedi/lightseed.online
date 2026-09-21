import type { DomainKey } from './words';

// PAPERS (ring 2026-09-21). A place has words of its own — its vision, its way, its house
// rules — and they are DATA on the community, never code: an ordered list of chapters, each a
// stable key, a title, rich text, and the surfaces it shows on. The vision is the FIRST paper
// (key 'vision'); it was a field of its own and is one no longer (no legacy: the field is
// migrated, then retired, and no code reads it again). The seed's own constitution (root/*.md)
// is NOT a paper: it is reviewed in git and served by the deploy; a fork wears another face.
//
// Plain contract — guaranteed: papersOf reads only lawful chapters (a key of letters, digits,
// dashes; a title within PAPER_TITLE_MAX; html a string) and answers the vision first, each key
// once, at most PAPERS_MAX chapters; visionOf is the vision paper's html or ''; withVision sets
// the vision paper without disturbing the rest; paperProblem names the first refusal by key.
// Not guaranteed: that html is safe to render (sanitizeRichText stays the reader's duty), or
// that a paper exists (a place may have no words yet).

export type PaperSurface = 'community' | 'landing' | 'about';
export interface Paper { key: string; title: string; html: string; shows?: PaperSurface[] }

export const VISION_KEY = 'vision';
export const PAPERS_MAX = 24;
export const PAPER_TITLE_MAX = 80;
export const PAPER_SURFACES = ['community', 'landing', 'about'] as const;
const KEY_RE = /^[a-z][a-z0-9_-]{0,39}$/;

const clean = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

export const paperProblem = (p: Partial<Paper> | null | undefined): DomainKey | null => {
  if (!p || !KEY_RE.test(String(p.key || ''))) return 'paper_key_bad';
  if (clean(p.title).length > PAPER_TITLE_MAX) return 'paper_title_long';
  return null;
};

export const papersOf = (raw: unknown): Paper[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Paper[] = [];
  for (const item of raw) {
    const p = item as Partial<Paper> | null;
    if (paperProblem(p)) continue;
    const key = String(p!.key);
    if (seen.has(key)) continue;
    seen.add(key);
    const shows = Array.isArray(p!.shows) ? p!.shows.filter((s): s is PaperSurface => (PAPER_SURFACES as readonly string[]).includes(String(s))) : undefined;
    out.push({ key, title: clean(p!.title), html: typeof p!.html === 'string' ? p!.html : '', ...(shows && shows.length ? { shows } : {}) });
    if (out.length >= PAPERS_MAX) break;
  }
  const vision = out.filter(p => p.key === VISION_KEY);
  return [...vision, ...out.filter(p => p.key !== VISION_KEY)];
};

export const visionOf = (c: { papers?: unknown } | null | undefined): string =>
  papersOf(c?.papers).find(p => p.key === VISION_KEY)?.html || '';

export const withVision = (papers: unknown, html: string, title = ''): Paper[] => {
  const rest = papersOf(papers).filter(p => p.key !== VISION_KEY);
  const current = papersOf(papers).find(p => p.key === VISION_KEY);
  return [{ key: VISION_KEY, title: title || current?.title || '', html }, ...rest];
};

// A new chapter's key from its title — letters, digits, dashes; unique among the given papers.
export const paperKeyFor = (title: string, papers: readonly Paper[]): string => {
  const base = clean(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'paper';
  const stem = /^[a-z]/.test(base) ? base : `p-${base}`;
  const taken = new Set(papers.map(p => p.key));
  let key = stem; let n = 2;
  while (taken.has(key) || key === VISION_KEY) key = `${stem}-${n++}`;
  return key;
};
