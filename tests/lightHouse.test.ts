import { describe, it, expect } from 'vitest';
import { canViewLightHouse, lightHouseVisibility } from '../src/domain/lightHouse';

// LightHouses are private by default: absent visibility reads as 'community'.
// The three levels — community (members), node (anyone signed in), public (the world).

const sanctum = (over: Record<string, unknown> = {}) =>
  ({ ownerId: 'keeper', communityId: 'per-auset', ...over }) as any;

describe('lightHouseVisibility', () => {
  it('absent visibility means community — private by default', () => {
    expect(lightHouseVisibility({})).toBe('community');
    expect(lightHouseVisibility({ visibility: 'public' })).toBe('public');
  });
});

describe('canViewLightHouse', () => {
  it('public lightHouses greet everyone, even the signed-out', () => {
    expect(canViewLightHouse(sanctum({ visibility: 'public' }), {})).toBe(true);
  });

  it('node lightHouses need a signed-in viewer', () => {
    expect(canViewLightHouse(sanctum({ visibility: 'node' }), {})).toBe(false);
    expect(canViewLightHouse(sanctum({ visibility: 'node' }), { uid: 'anyone' })).toBe(true);
  });

  it('community lightHouses (the default) open only to members, the keeper, and staff', () => {
    const s = sanctum(); // no visibility field — the default case
    expect(canViewLightHouse(s, {})).toBe(false);
    expect(canViewLightHouse(s, { uid: 'stranger' })).toBe(false);
    expect(canViewLightHouse(s, { uid: 'member', memberCommunityIds: new Set(['per-auset']) })).toBe(true);
    expect(canViewLightHouse(s, { uid: 'keeper' })).toBe(true);
    expect(canViewLightHouse(s, { uid: 'admin', isStaff: true })).toBe(true);
    expect(canViewLightHouse(s, { uid: 'other', memberCommunityIds: new Set(['elsewhere']) })).toBe(false);
  });

  it('a lightHouse sheltering many communities (LIN homes) opens to a member of any of them', () => {
    const homes = ['per-auset', 'second-grove']; // read from lightHouse __shelters__ links
    expect(canViewLightHouse(sanctum(), { uid: 'm', memberCommunityIds: new Set(['second-grove']) }, homes)).toBe(true);
  });

  it('falls back to the primary communityId when no homes are supplied', () => {
    expect(canViewLightHouse(sanctum(), { uid: 'm', memberCommunityIds: new Set(['per-auset']) })).toBe(true);
    expect(canViewLightHouse(sanctum(), { uid: 'm', memberCommunityIds: new Set() })).toBe(false);
  });
});
