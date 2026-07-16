import type { Timestamp } from 'firebase/firestore';
import type { Being } from './being';

// A lightHouse is a sacred place / platform that holds a community's lifetrees —
// e.g. "The Secret Sun" for lightseed. Like the first tree, it is data-driven per
// domain: each node shows its own first lightHouse, generically "The LightHouse".
// An Being like every other being — it carries a lid (backfilled by migrateBackfillLids).
// Who may see a lightHouse: its community's members (the default — a lightHouse is private
// until deliberately opened), anyone signed in on the node, or the whole world.
export type LightHouseVisibility = 'community' | 'node' | 'public';

export interface LightHouse extends Being {
  id: string;
  name: string;
  shortTitle?: string;
  body: string;
  imageUrl?: string;
  ownerId?: string;        // who consecrated it (rules: owner or staff may edit)
  domain?: string;         // the domain it is rooted in (map + tab scoping)
  communityId?: string;    // primary community — a denormalised scalar the rules read.
                           // FURTHER belonging lives in the LIN: lightHouse __shelters__ community.
  // Absent = 'community' — private by default; opening it up is a deliberate act.
  visibility?: LightHouseVisibility;
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

export const lightHouseVisibility = (s: Pick<LightHouse, 'visibility'>): LightHouseVisibility =>
  s.visibility || 'community';

// May this viewer see this lightHouse? Mirrors canViewTree's shape (client-side gate for the
// UI; firestore.rules hides non-public docs from the signed-out at the query level).
// `homes` = the communities sheltering this lightHouse, read from its LIN edges
// (lightHouse __shelters__ community); when absent, the primary communityId stands alone.
export function canViewLightHouse(
  s: Pick<LightHouse, 'visibility' | 'ownerId' | 'communityId'>,
  viewer: { uid?: string; isStaff?: boolean; memberCommunityIds?: Set<string> },
  homes?: string[],
): boolean {
  const v = lightHouseVisibility(s);
  if (v === 'public') return true;
  if (viewer.isStaff) return true;
  if (viewer.uid && s.ownerId === viewer.uid) return true;
  if (v === 'node') return !!viewer.uid;
  const circle = homes?.length ? homes : (s.communityId ? [s.communityId] : []);
  return !!viewer.uid && circle.some(id => viewer.memberCommunityIds?.has(id));
}
