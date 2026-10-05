// THE PICTURES A RECORD WEARS (ring 2026-10-05). A record born with one picture carries `imageUrl`;
// one born with many carries `imageUrls`, in the order its author arranged (domain/order), with
// `imageUrl` kept equal to the first so every seat that knows only one picture — a card, an OG
// card, a tree's latestGrowthUrl — still sees the face. These two readers are the ONE place that
// law is spelled out; before them it was written by hand in seven seats.
export interface PicturedRecord { imageUrl?: string | null; imageUrls?: readonly string[] | null }

// Every picture, in order: the list when there is one, else the single picture, else none.
export const picturesOf = (r: PicturedRecord | null | undefined): string[] => {
  if (!r) return [];
  if (Array.isArray(r.imageUrls) && r.imageUrls.length) return r.imageUrls.filter((u): u is string => typeof u === 'string' && u !== '');
  return r.imageUrl ? [r.imageUrl] : [];
};

// The face: the first picture, or '' when there is none.
export const faceOf = (r: PicturedRecord | null | undefined): string => picturesOf(r)[0] || '';

// What a record WRITES from an arranged list: the list, and the face beside it — so a record
// with no picture stores neither as a lie ('' for the face, [] for the list).
export const picturesToStore = (images: readonly string[]): { imageUrl: string; imageUrls: string[] } => {
  const clean = images.filter(u => typeof u === 'string' && u !== '');
  return { imageUrl: clean[0] || '', imageUrls: clean };
};
