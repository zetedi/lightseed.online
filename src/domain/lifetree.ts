import type { Timestamp, GeoPoint } from 'firebase/firestore';

export type LifetreeType = "human" | "ai" | "community" | "project" | "LIFETREE" | "GUARDED" | "FAMILY";

// The Entity/Blockchain container / Living Identity
export interface Lifetree {
  id: string;
  ownerId: string; // Legacy
  name: string;
  shortTitle?: string; // Legacy
  body: string; // The Vision (Legacy)
  imageUrl?: string;
  latestGrowthUrl?: string; // URL of the most recent growth pulse image
  
  // V2 Fields
  type?: LifetreeType;
  visionIds?: string[];
  pulseIds?: string[];
  guardianIds?: string[];
  // Tree Circle roles (shared care). `guardians` (below) remains the active guardian list.
  coOwnerIds?: string[];
  observerIds?: string[];
  stewardIds?: string[];
  communityId?: string; // The Tree Circle community rooted in this tree, once formed.
  updatedAt?: Timestamp;
  parentTreeIds?: string[];
  childTreeIds?: string[];
  aiTokenBalance?: number;
  coherenceScore?: number;

  // Legacy location
  latitude?: number;
  longitude?: number;
  locationName?: string;
  // V2 location
  location?: GeoPoint;

  domain?: string; // Associated website domain, e.g. "example.com"
  createdAt: Timestamp;

  // Contact privacy — mirrored from the owner's users/{uid}.onlyValidatedCanReach so
  // the world-readable tree carries the flag and the reach gate needs no cross-user read.
  onlyValidatedCanReach?: boolean;

  // Validation Logic
  validated: boolean;
  validatorId?: string | null;

  // Nature & Guardian Logic (Legacy)
  isNature?: boolean;
  treeType?: LifetreeType; // Legacy
  guardians?: string[]; // Array of User IDs (Legacy)
  status?: 'HEALTHY' | 'DANGER';

  // Blockchain Props
  genesisHash: string;
  latestHash: string; 
  blockHeight: number;
}
