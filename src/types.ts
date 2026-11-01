
import type { Being } from './domain/being';
import type { Stamp } from './domain/time';

export * from './domain/being';
export * from './domain/person';
export * from './domain/lifetree';
export * from './domain/pulse';
export * from './domain/reach';
export * from './domain/link';
export * from './domain/community';
export * from './domain/communityDoor';
export * from './domain/dataAuthority';
export * from './domain/interbeingMatrix';
export * from './domain/domainVerification';
export * from './domain/decision';
export * from './domain/intelligence';
export * from './domain/lightHouse';
export * from './domain/treeCircle';

// THE SIGNED-IN HAND as the shell knows it (ring 2026-11-01): four fields, named by no vendor.
// Firebase's User satisfies this; the independent session supplies the same four from its OIDC
// identity and local profile. Nothing else of a provider's user object reaches the app.
export interface Lightseed { uid: string; email: string | null; displayName: string | null; photoURL: string | null }

export type VisionStatus = "seed" | "growing" | "flowering" | "dormant";

// A direction of growth
export interface Vision extends Being {
  id: string;
  lifetreeId?: string; // canonical — the tree this vision belongs to
  authorId: string;    // canonical author — load-bearing (rules + query)
  title: string;
  body: string;        // the vision text (canonical)
  description?: string;
  link?: string;
  imageUrl?: string;
  // Many pictures, in the author's order (domain/pictures): imageUrl stays the first.
  imageUrls?: string[];
  createdAt: Stamp;
  // Joins live in the `links` collection ('joined' rel) — the legacy joinedUserIds array
  // is gone from both the type and the data (dropLegacyArrays cleared the docs).
  // Grounding — where this vision is rooted. lifetreeId (above) is the tree; these link it to a
  // community/site. `domain` was already stamped at write-time; `communityId` is the resolved link.
  domain?: string;
  communityId?: string;
  // Visibility — protect early, fragile visions. Mirrors Lifetree.visibility.
  // Absent = 'public' (legacy default). 'node' = signed-in only; 'private' = author + staff.
  visibility?: 'public' | 'node' | 'private';

  // The vision's OWN chain — the idea-twin grows by CONTRIBUTIONS, sealed here (not on the
  // rooted tree). Born the same moment as the tree (createVision seals a genesis), then diverges.
  // Frozen genesis; latestHash/blockHeight advance as contributions accrue. Legacy visions gain
  // these via the backfillVisionChains migration.
  genesisHash?: string;
  latestHash?: string;
  blockHeight?: number;

  // V2
  status?: VisionStatus;
  resonanceScore?: number;
}

// A note in an alignment's discussion — the back-and-forth before it's finalised.
export interface AlignmentNote {
  by: string;   // author uid (must be one of the two participants)
  text: string;
  at: Stamp;
}

// Off-Chain Alignment Handshake (Former MatchProposal) — a Being like every other.
export interface Alignment extends Being {
  id: string;
  initiatorPulseId: string;
  initiatorTreeId: string;
  initiatorUid: string;

  targetPulseId: string; // The pulse being matched WITH
  targetTreeId: string;
  targetUid: string; // The target tree's anchor, who accepts

  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  // The discussion thread: whoever the match reached first acknowledges (initiates), the other
  // responds, and it stays open (recursive) until the target finalises with Accept. Lives while
  // PENDING; ACCEPTED means finalised (a sync-block is on both chains).
  messages?: AlignmentNote[];
  createdAt: Stamp;
}

export interface Comment {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: Stamp;
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
