import type { Timestamp } from 'firebase/firestore';
import type { Being } from './being';

export interface Community extends Being {
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
  // Reflections shown in the signed-out home carousel — an editable list curated by the admin.
  carouselQuotes?: string[];
  // Custom landing: the domain greets visitors with the community's own full-screen hero page
  // (sign-in + events only) instead of the seed shell; a corner seed-logo toggles into the app.
  // The doorway for organisations bringing their own webpage onto the seed.
  customLanding?: boolean;
  // The landing's own pages (menu panels): authored rich text — a food menu, an About, an
  // offering list. Data, not code: every organisation shapes its own site from these blocks.
  landingPages?: { id: string; label: string; html: string }[];
  // The "big red stamp": once a node locks, new blocks are sealed with the canonical, verifiable
  // hash (src/domain/chain). Off by default; the shell syncs it into the chain-lock flag on load.
  chainLocked?: boolean;
  // Whether this node runs the AI-token ("Attention-Energy") economy. Off by default; the shell
  // syncs it into the tokenisation flag (src/domain/tokenisation.ts) on load.
  tokenisationEnabled?: boolean;
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
  // Membership lives in the `links` collection ('member' rel) — the legacy memberIds array
  // is gone from both the type and the data (dropLegacyArrays cleared the docs).
  formation?: 'tree_co_ownership' | 'project' | 'organization' | 'manual';
  visibility?: 'private' | 'invited' | 'public';
  // The DOOR — who may join, and how (domain/communityDoor.ts). Distinct from `visibility`
  // (who may see). Absent = 'invite': the pre-door behaviour (knock, a keeper accepts).
  door?: import('./communityDoor').CommunityDoor;
  // COMMONS mode: whether this node (a community owning a domain) reflects the whole instance's
  // public forest/feed, or shows only its own domain. Per-node choice (Indra's net). Absent =
  // the legacy default (the canonical hub domains reflect, others stay scoped) — zero migration.
  reflectsPublic?: boolean;
  // STRICT scope: when scoped (not reflecting), also hide the viewer's OWN trees from other
  // domains (suppress the creator-sees-their-own-trees merge) — a clean "this place only" view.
  // No effect while reflecting. Absent = the owner-merge stays (today's behaviour).
  strictScope?: boolean;
}
