import type { Timestamp } from 'firebase/firestore';
import type { Being } from './being';

// A sanctuary is a sacred place / platform that holds a community's lifetrees —
// e.g. "The Secret Sun" for lightseed. Like the first tree, it is data-driven per
// domain: each node shows its own first sanctuary, generically "The Sanctuary".
// An Being like every other being — it carries a lid (backfilled by migrateBackfillLids).
// Who may see a sanctuary: its community's members (the default — a sanctuary is private
// until deliberately opened), anyone signed in on the node, or the whole world.
export type SanctuaryVisibility = 'community' | 'node' | 'public';

export interface Sanctuary extends Being {
  id: string;
  name: string;
  shortTitle?: string;
  body: string;
  imageUrl?: string;
  ownerId?: string;        // who consecrated it (rules: owner or staff may edit)
  domain?: string;         // the domain it is rooted in (map + tab scoping)
  communityId?: string;    // primary community (the rules' membership check reads this)
  communityIds?: string[]; // a sanctuary can belong to MANY communities
  // Absent = 'community' — private by default; opening it up is a deliberate act.
  visibility?: SanctuaryVisibility;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  // A 3D door: a Gaussian-splat scene (viewer URL) one can step into from the map.
  splatUrl?: string;
  createdAt: Timestamp;
}

export const sanctuaryVisibility = (s: Pick<Sanctuary, 'visibility'>): SanctuaryVisibility =>
  s.visibility || 'community';

// May this viewer see this sanctuary? Mirrors canViewTree's shape (client-side gate for the
// UI; firestore.rules hides non-public docs from the signed-out at the query level).
export function canViewSanctuary(
  s: Pick<Sanctuary, 'visibility' | 'ownerId' | 'communityId' | 'communityIds'>,
  viewer: { uid?: string; isStaff?: boolean; memberCommunityIds?: Set<string> },
): boolean {
  const v = sanctuaryVisibility(s);
  if (v === 'public') return true;
  if (viewer.isStaff) return true;
  if (viewer.uid && s.ownerId === viewer.uid) return true;
  if (v === 'node') return !!viewer.uid;
  const homes = s.communityIds?.length ? s.communityIds : (s.communityId ? [s.communityId] : []);
  return !!viewer.uid && homes.some(id => viewer.memberCommunityIds?.has(id));
}
