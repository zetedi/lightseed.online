// Vision ↔ community matching — pure resonance arithmetic, no AI needed for v1: the words
// a being plants in its visions, weighed against the words each community lives by. Honest
// and inspectable: every match shows WHICH words carried it. (An intelligence can deepen
// this later; the shape of the answer — scored communities with shared ground — stays.)

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its', 'this', 'that', 'these',
  'those', 'as', 'we', 'our', 'ours', 'you', 'your', 'yours', 'i', 'my', 'me', 'they',
  'their', 'them', 'he', 'she', 'his', 'her', 'not', 'no', 'so', 'if', 'then', 'than',
  'from', 'into', 'about', 'all', 'each', 'every', 'will', 'would', 'can', 'could', 'have',
  'has', 'had', 'do', 'does', 'did', 'one', 'more', 'most', 'other', 'some', 'such', 'only',
  'own', 'same', 'too', 'very', 'just', 'also', 'there', 'here', 'when', 'where', 'how',
  'what', 'who', 'whom', 'which', 'why', 'because', 'while', 'through', 'over', 'under',
]);

// Plain words out of living text: HTML stripped, lowercased, letters kept (unicode-aware),
// stopwords and stubs dropped.
export const tokenize = (text: string): string[] =>
  (text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ') // entities (&nbsp; &amp; …) are glue, not words
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));

const frequencies = (tokens: string[]): Map<string, number> => {
  const f = new Map<string, number>();
  for (const t of tokens) f.set(t, (f.get(t) || 0) + 1);
  return f;
};

export interface CommunityMatch<C> {
  community: C;
  // 0..1 — the weighted overlap between the being's visions and the community's vision.
  score: number;
  // The words that carried the match, strongest first (at most five).
  shared: string[];
}

// Top matches between a being's vision texts and the communities' visions. Weighted-Jaccard
// on token frequencies: shared weight over total weight — a community whose whole vision
// resonates beats one that merely mentions a word once.
export function matchCommunities<C extends { vision?: string; name?: string }>(
  myVisionTexts: string[],
  communities: C[],
  top = 3,
): CommunityMatch<C>[] {
  const mine = frequencies(tokenize(myVisionTexts.join(' ')));
  if (mine.size === 0) return [];

  const scored: CommunityMatch<C>[] = [];
  for (const community of communities) {
    const theirs = frequencies(tokenize(`${community.name || ''} ${community.vision || ''}`));
    if (theirs.size === 0) continue;

    let sharedWeight = 0;
    let totalWeight = 0;
    const sharedWords: { word: string; w: number }[] = [];
    const words = new Set([...mine.keys(), ...theirs.keys()]);
    for (const w of words) {
      const a = mine.get(w) || 0;
      const b = theirs.get(w) || 0;
      sharedWeight += Math.min(a, b);
      totalWeight += Math.max(a, b);
      if (a > 0 && b > 0) sharedWords.push({ word: w, w: Math.min(a, b) });
    }
    if (sharedWeight === 0) continue;

    scored.push({
      community,
      score: totalWeight > 0 ? sharedWeight / totalWeight : 0,
      shared: sharedWords.sort((x, y) => y.w - x.w).slice(0, 5).map(x => x.word),
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, top);
}
