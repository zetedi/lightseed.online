import { describe, it, expect } from 'vitest';
import {
  BED_TREE_TYPE, BED_DEFAULT_VISIBILITY, isBedTree, isHousedBed, isLooseBed,
  excludeBedTrees, bedBelongsTo, bedPlantingProblem, isRealPlace,
} from '../src/domain/bed';
import { treePlantingGate, DEFAULT_NODE_LIMITS } from '../src/domain/limits';

describe('isBedTree — a bed is a lifetree, housed or loose', () => {
  it('recognises a bed and nothing else', () => {
    expect(isBedTree({ treeType: BED_TREE_TYPE })).toBe(true);
    expect(isBedTree({ treeType: 'LIFETREE' })).toBe(false);
    expect(isBedTree({ treeType: 'GUARDED' })).toBe(false);
    expect(isBedTree({})).toBe(false);
    expect(isBedTree(null)).toBe(false);
    expect(isBedTree(undefined)).toBe(false);
  });

  it('a bed reaches the node by default — visible to guests, absent from the open forest', () => {
    expect(BED_DEFAULT_VISIBILITY).toBe('node');
  });
});

describe('isHousedBed / isLooseBed — home is soft and optional', () => {
  it('a bed with a house is housed; a bed without one stands loose under open stars', () => {
    expect(isHousedBed({ treeType: BED_TREE_TYPE, lightHouseId: 'lh1' })).toBe(true);
    expect(isLooseBed({ treeType: BED_TREE_TYPE, lightHouseId: 'lh1' })).toBe(false);
    expect(isHousedBed({ treeType: BED_TREE_TYPE })).toBe(false);
    expect(isLooseBed({ treeType: BED_TREE_TYPE })).toBe(true);
    expect(isHousedBed({ treeType: BED_TREE_TYPE, lightHouseId: '' })).toBe(false);
    expect(isLooseBed({ treeType: BED_TREE_TYPE, lightHouseId: '' })).toBe(true);
  });

  it('a non-bed is neither — whatever it carries', () => {
    expect(isHousedBed({ treeType: 'LIFETREE', lightHouseId: 'lh1' })).toBe(false);
    expect(isLooseBed({ treeType: 'LIFETREE' })).toBe(false);
    expect(isHousedBed(null)).toBe(false);
    expect(isLooseBed(undefined)).toBe(false);
  });
});

describe('excludeBedTrees — the guard every broad listing applies', () => {
  it('drops every bed — housed or loose — and keeps the forest in order', () => {
    const forest = [
      { id: 'a', treeType: 'LIFETREE' },
      { id: 'b', treeType: BED_TREE_TYPE, lightHouseId: 'lh1' },
      { id: 'c', treeType: 'GUARDED' },
      { id: 'd' }, // legacy tree, no treeType
      { id: 'e', treeType: BED_TREE_TYPE }, // loose — furniture still, not forest
    ];
    expect(excludeBedTrees(forest).map(t => t.id)).toEqual(['a', 'c', 'd']);
  });

  it('an empty forest stays empty', () => {
    expect(excludeBedTrees([])).toEqual([]);
  });
});

describe('bedBelongsTo — a bed stands in exactly one house', () => {
  it('matches only its own house', () => {
    const bed = { treeType: BED_TREE_TYPE, lightHouseId: 'lh1' };
    expect(bedBelongsTo(bed, 'lh1')).toBe(true);
    expect(bedBelongsTo(bed, 'lh2')).toBe(false);
    expect(bedBelongsTo(bed, '')).toBe(false);
  });

  it('a non-bed belongs to no house, whatever it carries', () => {
    expect(bedBelongsTo({ treeType: 'LIFETREE', lightHouseId: 'lh1' }, 'lh1')).toBe(false);
  });
});

describe('bedPlantingProblem — the courteous refusal before the write', () => {
  it('needs a name, whether housed or loose', () => {
    expect(bedPlantingProblem({ lightHouseId: 'lh1' })).toMatch(/name/);
    expect(bedPlantingProblem({ name: '   ', lightHouseId: 'lh1' })).toMatch(/name/);
    expect(bedPlantingProblem({ latitude: 6.03, longitude: 81.33 })).toMatch(/name/);
  });

  it('refuses only a bed with NEITHER a house NOR a place', () => {
    expect(bedPlantingProblem({ name: 'Cedar bed' })).toMatch(/somewhere/);
    expect(bedPlantingProblem({ name: 'Cedar bed', lightHouseId: '' })).toMatch(/somewhere/);
    // Half a coordinate is no place.
    expect(bedPlantingProblem({ name: 'Cedar bed', latitude: 6.03 })).toMatch(/somewhere/);
    expect(bedPlantingProblem({ name: 'Cedar bed', longitude: 81.33 })).toMatch(/somewhere/);
  });

  it('a named bed in a real house may be planted', () => {
    expect(bedPlantingProblem({ name: 'Cedar bed', lightHouseId: 'lh1' })).toBeNull();
  });

  it('a named bed at a coordinate under open stars may be planted — no home needed', () => {
    expect(bedPlantingProblem({ name: 'Star bed', latitude: 6.03, longitude: 81.33 })).toBeNull();
    // Zero is a real place (the equator, the meridian).
    expect(bedPlantingProblem({ name: 'Null Island bed', latitude: 0, longitude: 0 })).toBeNull();
  });

  it('a NON-place is nowhere: NaN, Infinity, and off-Earth coordinates are refused', () => {
    expect(bedPlantingProblem({ name: 'Ghost bed', latitude: NaN, longitude: NaN })).toMatch(/somewhere/);
    expect(bedPlantingProblem({ name: 'Ghost bed', latitude: Infinity, longitude: 81.33 })).toMatch(/somewhere/);
    expect(bedPlantingProblem({ name: 'Ghost bed', latitude: 6.03, longitude: -Infinity })).toMatch(/somewhere/);
    expect(bedPlantingProblem({ name: 'Off-map bed', latitude: 91, longitude: 81.33 })).toMatch(/somewhere/);
    expect(bedPlantingProblem({ name: 'Off-map bed', latitude: 6.03, longitude: 181 })).toMatch(/somewhere/);
    expect(bedPlantingProblem({ name: 'Off-map bed', latitude: 999, longitude: -999 })).toMatch(/somewhere/);
  });

  it('the edges of the map are still places: the poles and the antimeridian welcome a bed', () => {
    expect(bedPlantingProblem({ name: 'North Pole bed', latitude: 90, longitude: 0 })).toBeNull();
    expect(bedPlantingProblem({ name: 'South Pole bed', latitude: -90, longitude: 0 })).toBeNull();
    expect(bedPlantingProblem({ name: 'Antimeridian bed', latitude: 0, longitude: 180 })).toBeNull();
    expect(bedPlantingProblem({ name: 'Antimeridian bed', latitude: 0, longitude: -180 })).toBeNull();
  });
});

describe('isRealPlace — finite, on-Earth coordinates only', () => {
  it('accepts real coordinates, including zero and the boundary values', () => {
    expect(isRealPlace(6.03, 81.33)).toBe(true);
    expect(isRealPlace(0, 0)).toBe(true);
    expect(isRealPlace(90, 180)).toBe(true);
    expect(isRealPlace(-90, -180)).toBe(true);
  });

  it('refuses NaN, Infinity, out-of-range, and the missing', () => {
    expect(isRealPlace(NaN, NaN)).toBe(false);
    expect(isRealPlace(Infinity, 0)).toBe(false);
    expect(isRealPlace(0, -Infinity)).toBe(false);
    expect(isRealPlace(90.0001, 0)).toBe(false);
    expect(isRealPlace(0, 180.0001)).toBe(false);
    expect(isRealPlace(999, -999)).toBe(false);
    expect(isRealPlace(undefined, 0)).toBe(false);
    expect(isRealPlace(0, undefined)).toBe(false);
    expect(isRealPlace()).toBe(false);
  });
});

describe('the planting caps ignore beds — furniture is not forest', () => {
  const beds = (n: number) => Array.from({ length: n }, () => ({ treeType: BED_TREE_TYPE }));
  const lifetrees = (n: number) => Array.from({ length: n }, () => ({ treeType: 'LIFETREE' }));

  it('a keeper full of beds may still plant their personal forest', () => {
    expect(treePlantingGate(beds(144), 'LIFETREE', DEFAULT_NODE_LIMITS)).toBeNull();
    expect(treePlantingGate(beds(144), 'GUARDED', DEFAULT_NODE_LIMITS)).toBeNull();
  });

  it('beds neither hide nor lift a full personal forest', () => {
    const full = [...lifetrees(DEFAULT_NODE_LIMITS.maxLifetrees), ...beds(3)];
    expect(treePlantingGate(full, 'LIFETREE', DEFAULT_NODE_LIMITS)).toMatch(/quality/);
    expect(treePlantingGate(full, 'GUARDED', DEFAULT_NODE_LIMITS)).toBeNull();
  });
});
