
// Fix: Use proper type imports to resolve "no exported member" errors in some TS environments.
import type { User as FirebaseUser } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';
import type { Entity } from './src/domain/entity';

export * from './src/domain/entity';
export * from './src/domain/person';
export * from './src/domain/lifetree';
export * from './src/domain/pulse';
export * from './src/domain/reach';
export * from './src/domain/link';
export * from './src/domain/community';
export * from './src/domain/decision';
export * from './src/domain/intelligence';
export * from './src/domain/sanctuary';
export * from './src/domain/treeCircle';

export type Lightseed = Pick<FirebaseUser, 'uid' | 'email' | 'displayName' | 'photoURL'>;

export type VisionStatus = "seed" | "growing" | "flowering" | "dormant";

// A direction of growth
export interface Vision extends Entity {
  id: string;
  lifetreeId?: string; // canonical — the tree this vision belongs to
  authorId: string;    // canonical author — load-bearing (rules + query)
  title: string;
  body: string;        // the vision text (canonical)
  description?: string;
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
    // The trees behind each side of the resonance, so a conversation can be started with them.
    tree1Id?: string;
    tree2Id?: string;
}

