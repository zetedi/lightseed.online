// THE NAME IN THE HEADER (ring 2026-10-19). The header has one narrow seat beside the logo; a
// name that fits reads in one line at full size, and a longer one — "Enlightened Nations" —
// used to end in an ellipsis. Now a long name breaks into TWO LINES at a word boundary, the
// break chosen so the lines are as even as they can be, and reads at a smaller size; a single
// long word has no boundary and only shrinks. The name is never altered — split only at its own
// spaces — so it still renders exactly as the keeper wrote it.
//
// Plain contract — GUARANTEED: at most two lines; a name within the one-line limit is one line
// at full size; the lines joined by one space give back the (whitespace-collapsed) name; the
// chosen break minimises the longer line. Enforced by tests/brandName.test.ts.

export const BRAND_ONE_LINE_MAX = 12;

export interface BrandLines {
  lines: string[];
  small: boolean; // read at the smaller size
}

export const brandLinesOf = (name: string, oneLineMax = BRAND_ONE_LINE_MAX): BrandLines => {
  const clean = (name || '').trim().replace(/\s+/g, ' ');
  if (clean.length <= oneLineMax) return { lines: [clean], small: false };
  const words = clean.split(' ');
  if (words.length < 2) return { lines: [clean], small: true };
  let best: string[] = [clean];
  let bestLongest = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const longest = Math.max(a.length, b.length);
    if (longest < bestLongest) { bestLongest = longest; best = [a, b]; }
  }
  return { lines: best, small: true };
};
