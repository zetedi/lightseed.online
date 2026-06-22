import type { Lifetree } from '../lifetree';

// A spatial facet of the LIN: the forest's placeable trees → marker view-models (the facts
// that drive a marker's appearance). Pure — no backend, no Leaflet. The map renders these;
// clustering/interaction still use the trees themselves.
export interface ForestMarker {
  id: string;
  lat: number;
  lng: number;
  status?: 'HEALTHY' | 'DANGER';
  kind: 'nature' | 'tree';
  imageUrl: string;
  growthUrl: string;
  guardianCount: number; // an edge-count: how many guardians tend this tree
  validated: boolean;
}

// A tree's coordinates (handling the legacy lat/lng + lat/lng spellings), or null if unplaceable.
export function treeCoordinates(tree: Pick<Lifetree, 'latitude' | 'longitude'>): { lat: number; lng: number } | null {
  const t = tree as any;
  const lat = Number(t.latitude ?? t.lat);
  const lng = Number(t.longitude ?? t.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
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
