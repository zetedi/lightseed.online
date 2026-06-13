import type { Timestamp } from 'firebase/firestore';

export type LegacyPulseType = 'STANDARD' | 'GROWTH';
export type PulseType = 'observation' | 'dream' | 'offering' | 'request' | 'translation' | 'validation' | 'event' | 'growth' | 'reach' | LegacyPulseType;

export interface PulseInterpretation {
    depth: number;
    interpretation: string;
    confidence: number;
    alternatives?: string[];
    growthSuggestion?: string;
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
  imageUrls?: string[];
  eventDate?: string;
  eventLocation?: string;
  reachTreeId?: string;
  reachTreeName?: string;
  reachResponse?: string; // The reached tree's reply, kept so reach threads persist.
  recipientUid?: string | null; // Owner of the reached tree — drives inbox routing + email delivery.
  recipientName?: string;
  seenBy?: string[];
  threadId?: string; // Deterministic id for a reach thread: [fromTreeId, toTreeId].sort().join('__').
  
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

  // Immutable chain Ledger
  previousHash: string;
  hash: string;
}
