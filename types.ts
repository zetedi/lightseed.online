
// Fix: Use proper type imports to resolve "no exported member" errors in some TS environments.
import type { User as FirebaseUser } from 'firebase/auth';
import type { Timestamp, GeoPoint } from 'firebase/firestore';

export type Lightseed = Pick<FirebaseUser, 'uid' | 'email' | 'displayName' | 'photoURL'>;

export type LegacyPulseType = 'STANDARD' | 'GROWTH';
export type PulseType = 'observation' | 'dream' | 'offering' | 'request' | 'translation' | 'validation' | LegacyPulseType;
export type LifetreeType = "human" | "ai" | "community" | "project" | "LIFETREE" | "GUARDED" | "FAMILY";
export type VisionStatus = "seed" | "growing" | "flowering" | "dormant";

export interface PulseInterpretation {
    depth: number;
    interpretation: string;
    confidence: number;
    alternatives?: string[];
    growthSuggestion?: string;
}

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

// A direction of growth
export interface Vision {
  id: string;
  lifetreeId?: string; // Legacy
  treeId?: string; // V2
  authorId: string; // Legacy
  title: string;
  body: string; // Legacy
  description?: string; // V2
  link?: string;
  imageUrl?: string;
  createdAt: Timestamp;
  joinedUserIds?: string[]; // List of users who joined this vision
  
  // V2
  status?: VisionStatus;
  resonanceScore?: number;
}

// The fundamental unit of the network
export interface Pulse {
  id: string;
  lifetreeId?: string; // Legacy
  treeId?: string; // V2
  visionId?: string; // V2
  type: PulseType;
  
  // Data Payload
  title: string; // Legacy
  body: string; // Legacy
  content?: string; // V2
  imageUrl?: string;
  
  // V2 AI
  aiInterpretation?: PulseInterpretation;
  validationScore?: number;

  // Alignment Logic (On Chain) (Legacy)
  isMatch?: boolean;
  matchedLifetreeId?: string;
  matchId?: string; // Link to the handshake
  
  // Metadata
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  createdAt: Timestamp;
  
  // Interactions (Off Chain)
  loveCount: number;
  commentCount: number;

  // Blockchain Ledger
  previousHash: string;
  hash: string;
}

// Off-Chain Alignment Handshake (Former MatchProposal)
export interface Alignment {
  id: string;
  initiatorPulseId: string;
  initiatorTreeId: string;
  initiatorUid: string;
  
  targetPulseId: string; // The pulse being matched WITH
  targetTreeId: string;
  targetUid: string; // The owner who needs to accept

  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: Timestamp;
}

export interface Comment {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
}

export interface VisionSynergy {
    vision1Title: string;
    vision2Title: string;
    reasoning: string;
    score: number;
}

export interface Community {
  id: string;
  ownerId: string;
  name: string;
  domain: string; // The link to Lifetree
  vision: string; // Rich text
  imageUrls: string[]; // For carousel
  logoUrl?: string;
  theme?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    neutral?: string;
    background?: string;
  };
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
