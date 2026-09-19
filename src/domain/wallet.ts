import { coinOf, type Coin } from './coin';

// THE WALLET (ring 2026-09-19). A being's rays were kindled in places, and each place names
// the face of its light: care at Per Auset kindles BLUE, care at lightseed kindles Light. The
// wallet lists the coins a being holds — one row per place, the community's name and domain
// beside the coin so two coins with one word are never confused — and the units of each.
// The physics underneath is one: rays are rays, and a row's units are the same units the
// glow and the prisms count. Pure: the caller resolves each ray's place; this only gathers.
//
// Plain contract — guaranteed: every ray lands in exactly one row (its place's coin, or the
// node's Light when it has no place); rows are ordered by units, largest first, the node's
// Light last among equals; units are summed exactly. Not guaranteed: that a place still
// exists (a ray from a dissolved community rides as Light until the place is known again).

export interface RayLike { units: number; communityId?: string | null; treeId?: string | null }
export interface PlaceLike { id: string; name?: string | null; domain?: string | null; logoUrl?: string | null; coin?: { name?: string | null; code?: string | null } | null }
export interface WalletRow {
  key: string;            // the place's id, or 'node'
  coin: Coin;
  units: number;
  rays: number;
  placeName: string | null;
  place: string | null;   // the domain
}

export const walletOf = <R extends RayLike>(
  rays: readonly R[],
  placeOf: (ray: R) => PlaceLike | null | undefined,
  node: { name: string; domain: string },
): WalletRow[] => {
  const rows = new Map<string, WalletRow>();
  for (const ray of rays) {
    const place = placeOf(ray) ?? null;
    const key = place ? place.id : 'node';
    let row = rows.get(key);
    if (!row) {
      row = place
        ? { key, coin: coinOf(place), units: 0, rays: 0, placeName: (place.name || '').trim() || null, place: (place.domain || '').trim().toLowerCase() || null }
        : { key, coin: coinOf(null), units: 0, rays: 0, placeName: node.name, place: node.domain };
      rows.set(key, row);
    }
    row.units += Math.max(0, Math.floor(ray.units || 0));
    row.rays += 1;
  }
  return [...rows.values()].sort((a, b) => b.units - a.units || (a.key === 'node' ? 1 : b.key === 'node' ? -1 : 0));
};
