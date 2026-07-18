import type { Timestamp } from 'firebase/firestore';
import type { Being } from './being';
import type { WateringSchedule } from './watering';

// The kind of a tree — the value persisted in `treeType`. All uppercase; absent = 'LIFETREE'.
//   'LIFETREE' — a being's own tree · 'GUARDED' — a real tree in nature, stood for ·
//   'BED' — a place to sleep (see src/domain/bed.ts): a full Being with its own chain, housed
//     in a Light House or loose under open stars, but furniture rather than forest — never
//     listed among the trees.
export type LifetreeType = "LIFETREE" | "GUARDED" | "BED";

// The Being / immutable-chain container / Living Identity
export interface Lifetree extends Being {
  // Provenance — the REAL planting moment (from the birth photo's EXIF): when the being
  // was touched and cut from its parent, and where. createdAt stays the doc's own birth.
  plantedAt?: Timestamp;
  plantedLatitude?: number;
  plantedLongitude?: number;
  plantedAltitudeM?: number;
  id: string;
  ownerId: string; // canonical owner — load-bearing (rules + queries)
  name: string;
  shortTitle?: string;
  body: string; // the tree's vision text (canonical)
  imageUrl?: string;
  latestGrowthUrl?: string; // URL of the most recent growth pulse image
  
  // Tree Circle roles (guardian / co_owner / steward / observer) live in the `links`
  // collection (the LIN) — see src/domain/link.ts. The legacy per-role arrays are gone
  // from both the type and the data (dropLegacyArrays cleared the docs).
  communityId?: string; // The Tree Circle community rooted in this tree, once formed.
  updatedAt?: Timestamp;
  aiTokenBalance?: number;
  coherenceScore?: number;

  // Location
  latitude?: number;
  longitude?: number;
  locationName?: string;

  domain?: string; // Associated website domain, e.g. "example.com"
  // The Light House a BED stands in — set only when treeType === 'BED' and the bed is HOUSED;
  // a loose bed (under open stars, at a coordinate) carries none. Soft and mutable, not frozen:
  // a bed may graduate (see src/domain/bed.ts and the 2026-07-17 ring). Single-owner
  // containment, so a denormalised scalar is permitted (like Stay.lightHouseId); shared
  // belonging stays LIN links. A bed carries NO `domain`, so domain-scoped forest queries
  // never surface it.
  lightHouseId?: string;
  createdAt: Timestamp;

  // Who can see this tree. 'public' = the whole world (the forest); 'node' = signed-in members
  // of this node; 'private' = only the owner and its circle. Absent = public (legacy default).
  visibility?: 'public' | 'node' | 'private';

  // Contact privacy — mirrored from the owner's users/{uid}.onlyValidatedCanReach so
  // the world-readable tree carries the flag and the reach gate needs no cross-user read.
  onlyValidatedCanReach?: boolean;

  // Validation Logic — validation is LIVING: it stays lit only while the tree is tended
  // (a growth pulse or an explicit confirm) within a year. Untended, it dims; re-tending re-lights it.
  validated: boolean;
  validatorId?: string | null;
  lastTendedAt?: Timestamp;

  // Nature & Guardian Logic — guardianship is a 'guardian' link in the LIN (no array here).
  isNature?: boolean;
  treeType?: LifetreeType;
  status?: 'HEALTHY' | 'DANGER';

  // Watering — scheduled tending of a (usually guarded) tree. Absent = no schedule.
  // The daily sweep flags `watering.overdue`; a confirmed watering clears it and re-lights
  // the tree's living validation. See src/domain/watering.ts.
  watering?: WateringSchedule;

  // Immutable chain Props
  genesisHash: string;
  latestHash: string; 
  blockHeight: number;
}
