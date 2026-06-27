import type { Timestamp } from 'firebase/firestore';
import type { Entity } from './entity';
import type { WateringSchedule } from './watering';

export type LifetreeType = "human" | "ai" | "community" | "project" | "LIFETREE" | "GUARDED" | "FAMILY";

// The Entity / immutable-chain container / Living Identity
export interface Lifetree extends Entity {
  id: string;
  ownerId: string; // canonical owner — load-bearing (rules + queries)
  name: string;
  shortTitle?: string;
  body: string; // the tree's vision text (canonical)
  imageUrl?: string;
  latestGrowthUrl?: string; // URL of the most recent growth pulse image
  
  visionIds?: string[];
  pulseIds?: string[];
  // Tree Circle roles (shared care). `guardians` (below) is the active guardian list.
  coOwnerIds?: string[];
  observerIds?: string[];
  stewardIds?: string[];
  communityId?: string; // The Tree Circle community rooted in this tree, once formed.
  updatedAt?: Timestamp;
  aiTokenBalance?: number;
  coherenceScore?: number;

  // Location
  latitude?: number;
  longitude?: number;
  locationName?: string;

  domain?: string; // Associated website domain, e.g. "example.com"
  createdAt: Timestamp;

  // Contact privacy — mirrored from the owner's users/{uid}.onlyValidatedCanReach so
  // the world-readable tree carries the flag and the reach gate needs no cross-user read.
  onlyValidatedCanReach?: boolean;

  // Validation Logic — validation is LIVING: it stays lit only while the tree is tended
  // (a growth pulse or an explicit confirm) within a year. Untended, it dims; re-tending re-lights it.
  validated: boolean;
  validatorId?: string | null;
  lastTendedAt?: Timestamp;

  // Nature & Guardian Logic
  isNature?: boolean;
  treeType?: LifetreeType;
  guardians?: string[]; // guardianship (user ids); → links in Phase 2
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
