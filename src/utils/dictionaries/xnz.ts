import type { Dictionary } from './en';
import ar from './ar';

// THE NUBIAN DOOR (2026-08-01). Mattokki (Kenzi), the Nubian spoken along the Aswan reach where
// this node's first trees stand, has a seat in the language picker before it has its words: an
// intelligence should not invent someone's language. Every string here is the Arabic one, which
// the same readers read, and each Mattokki word REPLACES one as a speaker gives it — Latin
// transliteration, the writing most Nubians use for their language today.
// docs/mattokki-review.md is the sheet a speaker fills in; the picker says the words are still
// being gathered, so the seat is an invitation and never a claim. A word given replaces the
// Arabic one here, in this object.
const xnz = {
  ...ar,
} satisfies Partial<Dictionary>;

export default xnz;
