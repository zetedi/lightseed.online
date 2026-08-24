import type { Stamp } from './time';
import type { Being } from './being';

// A lightHouse is a sacred place / platform that holds a community's lifetrees —
// e.g. "The Secret Sun" for lightseed. Like the first tree, it is data-driven per
// domain: each node shows its own first lightHouse, generically "The LightHouse".
// An Being like every other being — it carries a lid (backfilled by migrateBackfillLids).
// Who may see a lightHouse: its community's members (the default — a lightHouse is private
// until deliberately opened), anyone signed in on the node, or the whole world.
export type LightHouseVisibility = 'community' | 'node' | 'public';

// THE KINDS a Light House may be consecrated as (ring 2026-08-21) — a REGISTRY, like the
// section kinds: Temple (devotion at the center), Ashram (shared living and service),
// Sanctuary (shelter and rest). EXTENSIBLE by adding here + the words in translations.ts
// (the DOMAIN_KEYS manifest holds the mirror true at compile time). `kind` stays a plain
// string on the doc so an older client never chokes on a kind minted after it shipped;
// isLightHouseKind narrows, and unknown kinds still filter/display by their raw name.
export const LIGHT_HOUSE_KINDS = ['temple', 'ashram', 'sanctuary'] as const;
export type LightHouseKind = (typeof LIGHT_HOUSE_KINDS)[number];
export const isLightHouseKind = (k: unknown): k is LightHouseKind =>
  typeof k === 'string' && (LIGHT_HOUSE_KINDS as readonly string[]).includes(k);
// The words live in translations.ts — the domain exports only typed key references
// (the role_* precedent; i18n owns the copy, never the domain).
export const lightHouseKindKey = (k: LightHouseKind) => `lh_kind_${k}` as const;
export const lightHouseKindDescKey = (k: LightHouseKind) => `lh_kind_${k}_desc` as const;

// CARE FOR A LIGHT HOUSE (ring 2026-08-24) — and, through it, for the community it holds.
// A care act is a PULSE on the one ledger (previousHash sentinel LIGHT_HOUSE_ROOT — a
// standalone record, the house has no chain): consecration and a community's step-in are
// the FOUNDING cares, minted automatically by those acts; plain care may follow. One
// gesture warms two beings: the house's lastCaredAt and the community's move together.
// A consecration STANDS OBSERVED only when witnessed by ONE KEEPER of that community who
// is NOT the consecrator (Zoltán's quorum, the watering precedent) — witnesses are
// own-slot subcollection docs (pulses/{id}/witnesses is the signatures pattern: doc id =
// the mortal uid the rules verify, body carries the LID, the true name that survives the
// crossing). Until observed, the record says so honestly: a ceremony awaiting eyes.
export const LIGHT_HOUSE_ROOT = 'LIGHT_HOUSE';
export type LightHouseCareAct = 'consecration' | 'step_in' | 'care';
// Observation is DERIVED, never stored (the guardian-veto ethic): one non-consecrating
// keeper's witness slot makes the ceremony stand.
export const consecrationObserved = (witnessUids: string[], consecratorUid: string): boolean =>
  witnessUids.some(uid => uid !== consecratorUid);

export interface LightHouse extends Being {
  id: string;
  name: string;
  shortTitle?: string;
  body: string;
  imageUrl?: string;
  ownerId?: string;        // who consecrated it (rules: owner or staff may edit)
  kind?: string;           // temple | ashram | sanctuary | a kind minted later (see LIGHT_HOUSE_KINDS)
  lastCaredAt?: Stamp;     // refreshed by every care pulse (consecration, step-in, plain care)
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
  createdAt: Stamp;
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
