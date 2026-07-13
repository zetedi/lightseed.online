import type { Lifetree } from '../lifetree';

// A spatial facet of the LIN: the forest's placeable trees → marker view-models (the facts
// that drive a marker's appearance). Pure — no backend, no Leaflet. The map renders these;
// clustering/interaction still use the trees themselves.
export interface ForestMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status?: 'HEALTHY' | 'DANGER';
  kind: 'nature' | 'tree';
  imageUrl: string;
  growthUrl: string;
  guardianCount: number; // an edge-count: how many guardians tend this tree
  validated: boolean;
}

// A tree's coordinates — reads latitude/longitude plus the legacy lat/lng spelling (no code
// writes lat/lng anymore, but old documents may still carry it) — or null if unplaceable.
export function treeCoordinates(tree: Pick<Lifetree, 'latitude' | 'longitude'>): { lat: number; lng: number } | null {
  const t = tree as any;
  const lat = Number(t.latitude ?? t.lat);
  const lng = Number(t.longitude ?? t.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

// Can this viewer see a tree, given its visibility? 'public' = everyone; 'node' = any signed-in
// member; 'private' = owner, its guardians, or staff. (Client-side gate for the forest UI; rules
// hardening is a separate step.)
export function canViewTree(
  tree: Pick<Lifetree, 'ownerId' | 'visibility'> & { id?: string },
  viewer: { uid?: string; isStaff?: boolean; guardedIds?: Set<string> },
): boolean {
  const v = tree.visibility || 'public';
  if (v === 'public') return true;
  if (viewer.isStaff) return true;
  if (viewer.uid && tree.ownerId === viewer.uid) return true;
  if (tree.id && viewer.guardedIds?.has(tree.id)) return true;
  if (v === 'node') return !!viewer.uid;
  return false; // private, and not owner / guardian / staff
}

// Can this viewer see a vision, given its visibility? Mirrors canViewTree, but the author is the
// owner (visions have no ownerId/guardians). 'public' = everyone; 'node' = any signed-in member;
// 'private' = author or staff. (Client-side gate; firestore.rules is the hardening counterpart.)
export function canViewVision(
  vision: { authorId?: string; visibility?: 'public' | 'node' | 'private' },
  viewer: { uid?: string; isStaff?: boolean },
): boolean {
  const v = vision.visibility || 'public';
  if (v === 'public') return true;
  if (viewer.isStaff) return true;
  if (viewer.uid && vision.authorId === viewer.uid) return true;
  if (v === 'node') return !!viewer.uid;
  return false; // private, and not author / staff
}

export interface ForestFilter { showNature: boolean; showUser: boolean; showValidated: boolean; }

// Pure predicate for the forest filter toggles. `isValidated` is injected so this domain view
// stays decoupled from the validation util. (The text-search filter is generic and stays in the
// shell.) Extracted from App.tsx so the rule is testable and reusable.
export function passesForestFilter(
  tree: Pick<Lifetree, 'isNature'>,
  filter: ForestFilter,
  isValidated: (t: any) => boolean,
): boolean {
  if (!filter.showNature && tree.isNature) return false;
  if (!filter.showUser && !tree.isNature) return false;
  if (filter.showValidated && !isValidated(tree)) return false;
  return true;
}

// guardianCounts maps treeId → its guardian-edge count (the LIN, via guardian links). Optional so
// the prism stays usable without it; absent → 0 (the legacy array is no longer consulted).
export function forestMarkers(trees: Lifetree[], guardianCounts?: Map<string, number>): ForestMarker[] {
  const out: ForestMarker[] = [];
  for (const t of trees) {
    const c = treeCoordinates(t);
    if (!c) continue;
    out.push({
      id: t.id,
      name: t.name || '',
      lat: c.lat,
      lng: c.lng,
      status: t.status,
      kind: t.isNature ? 'nature' : 'tree',
      imageUrl: t.imageUrl || '',
      growthUrl: t.latestGrowthUrl || '',
      guardianCount: guardianCounts?.get(t.id) || 0,
      validated: !!t.validated,
    });
  }
  return out;
}
