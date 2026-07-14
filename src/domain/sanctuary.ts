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
  communityId?: string;    // primary community — a denormalised scalar the rules read.
                           // FURTHER belonging lives in the LIN: sanctuary __shelters__ community.
  // Absent = 'community' — private by default; opening it up is a deliberate act.
  visibility?: SanctuaryVisibility;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  // A 3D door: a Gaussian-splat scene (viewer URL) one can step into from the map.
  splatUrl?: string;
  // Beds — the physical welcome: how many can sleep here and what staying is like.
  // No money shown: booking details finalise through the existing channels (a Reach
  // can seal it); the care economy's rail joins later.
  beds?: number;
  bedNote?: string;
  createdAt: Timestamp;
}

export const sanctuaryVisibility = (s: Pick<Sanctuary, 'visibility'>): SanctuaryVisibility =>
  s.visibility || 'community';

// May this viewer see this sanctuary? Mirrors canViewTree's shape (client-side gate for the
// UI; firestore.rules hides non-public docs from the signed-out at the query level).
// `homes` = the communities sheltering this sanctuary, read from its LIN edges
// (sanctuary __shelters__ community); when absent, the primary communityId stands alone.
export function canViewSanctuary(
  s: Pick<Sanctuary, 'visibility' | 'ownerId' | 'communityId'>,
  viewer: { uid?: string; isStaff?: boolean; memberCommunityIds?: Set<string> },
  homes?: string[],
): boolean {
  const v = sanctuaryVisibility(s);
  if (v === 'public') return true;
  if (viewer.isStaff) return true;
  if (viewer.uid && s.ownerId === viewer.uid) return true;
  if (v === 'node') return !!viewer.uid;
  const circle = homes?.length ? homes : (s.communityId ? [s.communityId] : []);
  return !!viewer.uid && circle.some(id => viewer.memberCommunityIds?.has(id));
}
