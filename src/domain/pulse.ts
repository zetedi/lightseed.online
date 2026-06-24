import type { Timestamp } from 'firebase/firestore';
import type { Entity } from './entity';
import type { ReachAudience } from './reach';

export type LegacyPulseType = 'STANDARD' | 'GROWTH';
export type PulseType = 'observation' | 'dream' | 'offering' | 'request' | 'translation' | 'validation' | 'event' | 'growth' | 'reach' | LegacyPulseType;

// Who may see a pulse, relative to where it is rooted (its scope: tree / community / node).
// 'public' = anyone; 'node' = any signed-in member; 'community' = members of its community;
// 'circle' = guardians of its tree; 'private' = author (and staff) only. Absence = 'public'.
// The audience is generated and enforced by src/domain/pulseVisibility.ts + Firestore rules.
export type PulseVisibility = 'public' | 'node' | 'community' | 'circle' | 'private';

export interface PulseInterpretation {
    depth: number;
    interpretation: string;
    confidence: number;
    alternatives?: string[];
    growthSuggestion?: string;
}

// The fundamental unit of the network
export interface Pulse extends Entity {
  id: string;
  lifetreeId?: string; // canonical — the tree this pulse belongs to
  visionId?: string;
  communityId?: string; // Set on community-scoped pulses (community events, decisions).
  type: PulseType;
  // Audience. Absent = 'public' (every legacy pulse reads as public). See PulseVisibility.
  visibility?: PulseVisibility;
  
  // Data Payload
  title: string; // canonical
  body: string;  // canonical
  content?: string;
  imageUrl?: string;
  imageUrls?: string[];
  eventDate?: string;
  eventLocation?: string;
  reachTreeId?: string;
  reachTreeName?: string;
  reachResponse?: string; // The reached tree's reply, kept so reach threads persist.
  recipientUid?: string | null; // Owner of the reached tree — drives 1:1 inbox routing + email delivery.
  recipientName?: string;
  seenBy?: string[];
  threadId?: string; // Deterministic id for a reach thread: [fromTreeId, toTreeId].sort().join('__') (1:1) or grp__<treeId>__<audience>__<initiator> (group).
  // Everyone in this reach thread (author + recipients). The single source of truth for
  // who may read/reply — drives both the Firestore read rule and the inbox query. Present
  // on every private reach (1:1 and group); absent on minted, public "reach" reflections.
  participantUids?: string[];
  audience?: ReachAudience; // For group reaches: which slice of the tree's circle was addressed.
  threadName?: string;      // Display name for a group thread, e.g. "Oak · Guardians".
  isGroup?: boolean;        // True for circle/group reaches (a shared, multi-person thread).
  mintNotice?: boolean;     // A system line in a thread announcing someone minted the conversation.
  
  // V2 AI
  aiInterpretation?: PulseInterpretation;
  validationScore?: number;

  // Alignment Logic (On Chain) (Legacy)
  isMatch?: boolean;
  matchedLifetreeId?: string;
  matchId?: string; // Link to the handshake
  
  // Metadata
  authorId: string;
  authorName: string;        // for reaches this is the sender's TREE name (the conversation face)
  authorPersonName?: string; // the human behind it — shown under the tree name in DMs
  authorPhoto?: string;
  createdAt: Timestamp;
  
  // Interactions (Off Chain)
  loveCount: number;
  commentCount: number;

  // Immutable chain Ledger
  previousHash: string;
  hash: string;
}
