
// Fix: Use proper type imports to resolve "no exported member" errors in some TS environments.
import type { User as FirebaseUser } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';

export * from './src/domain/lifetree';
export * from './src/domain/pulse';
export * from './src/domain/reach';
export * from './src/domain/link';
export * from './src/domain/community';

export type Lightseed = Pick<FirebaseUser, 'uid' | 'email' | 'displayName' | 'photoURL'>;

export type VisionStatus = "seed" | "growing" | "flowering" | "dormant";

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

