import { describe, it, expect } from 'vitest';
import { canViewSanctuary, sanctuaryVisibility } from '../src/domain/sanctuary';

// Sanctuaries are private by default: absent visibility reads as 'community'.
// The three levels — community (members), node (anyone signed in), public (the world).

const sanctum = (over: Record<string, unknown> = {}) =>
  ({ ownerId: 'keeper', communityId: 'per-auset', communityIds: ['per-auset'], ...over }) as any;

describe('sanctuaryVisibility', () => {
  it('absent visibility means community — private by default', () => {
    expect(sanctuaryVisibility({})).toBe('community');
    expect(sanctuaryVisibility({ visibility: 'public' })).toBe('public');
  });
});

describe('canViewSanctuary', () => {
  it('public sanctuaries greet everyone, even the signed-out', () => {
    expect(canViewSanctuary(sanctum({ visibility: 'public' }), {})).toBe(true);
  });

  it('node sanctuaries need a signed-in viewer', () => {
    expect(canViewSanctuary(sanctum({ visibility: 'node' }), {})).toBe(false);
    expect(canViewSanctuary(sanctum({ visibility: 'node' }), { uid: 'anyone' })).toBe(true);
  });

  it('community sanctuaries (the default) open only to members, the keeper, and staff', () => {
    const s = sanctum(); // no visibility field — the default case
    expect(canViewSanctuary(s, {})).toBe(false);
    expect(canViewSanctuary(s, { uid: 'stranger' })).toBe(false);
    expect(canViewSanctuary(s, { uid: 'member', memberCommunityIds: new Set(['per-auset']) })).toBe(true);
    expect(canViewSanctuary(s, { uid: 'keeper' })).toBe(true);
    expect(canViewSanctuary(s, { uid: 'admin', isStaff: true })).toBe(true);
    expect(canViewSanctuary(s, { uid: 'other', memberCommunityIds: new Set(['elsewhere']) })).toBe(false);
  });

  it('a sanctuary of many communities opens to a member of any of them', () => {
    const shared = sanctum({ communityIds: ['per-auset', 'second-grove'] });
    expect(canViewSanctuary(shared, { uid: 'm', memberCommunityIds: new Set(['second-grove']) })).toBe(true);
  });

  it('falls back to the primary communityId when the list is absent', () => {
    const bare = sanctum({ communityIds: undefined });
    expect(canViewSanctuary(bare, { uid: 'm', memberCommunityIds: new Set(['per-auset']) })).toBe(true);
    expect(canViewSanctuary(bare, { uid: 'm', memberCommunityIds: new Set() })).toBe(false);
  });
});
