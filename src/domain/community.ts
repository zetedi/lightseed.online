import type { Timestamp } from 'firebase/firestore';

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
    mode?: 'light' | 'dark';
    surface?: string;
    text?: string;
  };
  createdAt: Timestamp;
  updatedAt?: Timestamp;

  // Intelligence Commons — which intelligences this community has enabled, which is
  // the default, and which memories they may draw on. Communities remain sovereign.
  defaultIntelligenceId?: string;
  availableIntelligenceIds?: string[];
  memoryIds?: string[];
}
