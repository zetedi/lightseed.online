import type { Timestamp } from 'firebase/firestore';
import type { Entity } from './entity';

export interface Community extends Entity {
  id: string;
  ownerId: string;
  name: string;
  domain: string; // The link to Lifetree
  vision: string; // Rich text
  imageUrls: string[]; // For carousel
  logoUrl?: string;       // Square brand mark (avatar) — shown in lists and the hero badge
  heroImageUrl?: string;  // Wide banner image shown behind the community page hero
  theme?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    neutral?: string;
    background?: string;
    mode?: 'light' | 'dark';
    surface?: string;
    text?: string;
  };
  // Public links shown in the site footer — set by the community admin / node owner.
  socialLinks?: {
    instagram?: string;
    telegram?: string;
    whatsapp?: string;
    website?: string;
  };
  createdAt: Timestamp;
  updatedAt?: Timestamp;

  // Intelligence Commons — which intelligences this community has enabled, which is
  // the default, and which memories they may draw on. Communities remain sovereign.
  defaultIntelligenceId?: string;
  availableIntelligenceIds?: string[];
  memoryIds?: string[];

  // Tree Circle — communities that emerged from shared care of a Lifetree.
  rootLifetreeId?: string;       // the living anchor this community grew from
  founderUserId?: string;
  memberIds?: string[];
  formation?: 'tree_co_ownership' | 'project' | 'organization' | 'manual';
  visibility?: 'private' | 'invited' | 'public';
}
