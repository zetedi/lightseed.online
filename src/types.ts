
// Fix: Use proper type imports to resolve "no exported member" errors in some TS environments.
import type { User as FirebaseUser } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';
import type { Entity } from './domain/entity';

export * from './domain/entity';
export * from './domain/person';
export * from './domain/lifetree';
export * from './domain/pulse';
export * from './domain/reach';
export * from './domain/link';
export * from './domain/community';
export * from './domain/decision';
export * from './domain/intelligence';
export * from './domain/sanctuary';
export * from './domain/treeCircle';

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
  // Grounding — where this vision is rooted. lifetreeId (above) is the tree; these link it to a
  // community/site. `domain` was already stamped at write-time; `communityId` is the resolved link.
  domain?: string;
  communityId?: string;
  // Visibility — protect early, fragile visions. Mirrors Lifetree.visibility.
  // Absent = 'public' (legacy default). 'node' = signed-in only; 'private' = author + staff.
  visibility?: 'public' | 'node' | 'private';

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

