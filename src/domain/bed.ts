// Beds as beings — the last link of the chain of a new world (GENESIS: "a tree, a circle,
// a community, a domain, a bed — and a way to start a new world from there").
//
// A BED is a Lifetree with treeType 'BED': a full Being with a lid, its own genesis chain, a
// face and a welcome — but it is furniture, not forest. Its home is OPTIONAL and SOFT: a bed
// may stand HOUSED inside a Light House (`lightHouseId`) or LOOSE under open stars at a GPS
// coordinate (latitude+longitude, no home) — principle 10, "the internet has no weather": a
// bed under the sky is as real as one under a roof. Housed or loose, it carries NO `domain`
// (so domain-scoped queries never surface it) and every broad tree listing excludes it
// explicitly (excludeBedTrees). The house binding is the `lightHouseId` scalar —
// single-owner containment, the one shape where a denormalised scalar is permitted (like
// Stay.lightHouseId); shared belonging stays LIN links. Soft, not frozen: a loose bed that
// gathers can one day graduate (seed → bed → gathering → Light House).
//
// This is the foundation only: calendars and per-bed reservations come later, on top of the
// overlap/availability helpers already living in domain/stay.ts. The count-based beds on a
// Light House (lightHouse.beds + bedNote) and the existing stays flow are untouched.

export const BED_TREE_TYPE = 'BED';

// A bed reaches as far as the node and no further by default: signed-in beings may find a
// place to sleep, but the open forest never lists one (private would hide it from the very
// guests it exists to welcome).
export const BED_DEFAULT_VISIBILITY = 'node' as const;

export interface BedLike {
  treeType?: string;
  lightHouseId?: string;
}

export const isBedTree = (t: BedLike | null | undefined): boolean => t?.treeType === BED_TREE_TYPE;

// The one guard every broad tree listing applies (forest grid + map, network stats, the
// session's own-trees split, domain lists, the mini-map's mother trees, the digest).
export const excludeBedTrees = <T extends BedLike>(trees: T[]): T[] => trees.filter(t => !isBedTree(t));

// HOUSED: the bed stands inside a Light House. LOOSE: it stands at a coordinate, no home.
export const isHousedBed = (t: BedLike | null | undefined): boolean =>
  isBedTree(t) && !!t?.lightHouseId;
export const isLooseBed = (t: BedLike | null | undefined): boolean =>
  isBedTree(t) && !t?.lightHouseId;

// Does this bed stand in THIS house?
export const bedBelongsTo = (t: BedLike, lightHouseId: string): boolean =>
  isBedTree(t) && lightHouseId !== '' && t.lightHouseId === lightHouseId;

// A REAL place on Earth: finite numbers inside the coordinate ranges. NaN and Infinity are
// nowhere; latitude 999 is no place either. The edges of the map are still places — the
// poles (±90) and the antimeridian (±180) welcome a bed. (Mirrored in firestore.rules,
// where NaN fails every comparison and Infinity fails the range.)
export const isRealPlace = (latitude?: number, longitude?: number): boolean =>
  typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
  && typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;

// Why this bed cannot be planted — or null when it may. A bed needs a name and somewhere to
// stand: a Light House (housed) OR a REAL coordinate under open stars (loose — a non-place
// like NaN or latitude 999 is nowhere, so it counts as no place at all). Refused only when
// it has NEITHER a home nor a place. (The keeper gate is the Firestore rules' law; this is
// the courteous refusal before the write.)
export const bedPlantingProblem = (
  draft: { name?: string; lightHouseId?: string; latitude?: number; longitude?: number },
): string | null => {
  if (!draft.name?.trim()) return 'Give the bed a name.';
  const housed = !!draft.lightHouseId;
  const placed = isRealPlace(draft.latitude, draft.longitude);
  if (!housed && !placed) {
    return 'A bed stands somewhere — inside a Light House, or loose at a place under open stars.';
  }
  return null;
};
