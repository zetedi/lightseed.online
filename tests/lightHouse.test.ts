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

  // Parity with the read rule (firestore.rules:604): the DOC-read law is permissive —
  // `visibility=='public' || isSignedIn()`. The client (canViewLightHouse) is deliberately
  // STRICTER for the community tier: it narrows to actual members (the ratified SOFT gate — see
  // root/DECISIONS 2026-07-17 "Rules-parity, and the one soft gate we keep"). Two invariants must
  // hold: (a) the client NEVER shows what the rule would deny (clientAllows ⇒ ruleAllowsDoc), so
  // no signed-out viewer ever sees a non-public house; (b) the only place client < rule is the
  // community tier for a signed-in NON-member (the soft gate), never node or public.
  describe('parity with the doc-read rule', () => {
    // The rule as law: what the SERVER lets a viewer read the raw doc.
    const ruleAllowsDoc = (visibility: string | undefined, signedIn: boolean) =>
      (visibility ?? 'community') === 'public' || signedIn;

    const member = { uid: 'm', memberCommunityIds: new Set(['per-auset']) };
    const nonMember = { uid: 'x', memberCommunityIds: new Set(['elsewhere']) };
    const keeper = { uid: 'keeper' };
    const staff = { uid: 'a', isStaff: true };
    const signedOut = {};

    const rows: Array<[string | undefined, Parameters<typeof canViewLightHouse>[1], boolean, boolean]> = [
      // [visibility, viewer, clientAllows(expected), signedIn]
      // public — client and rule agree: everyone.
      ['public', signedOut, true, false], ['public', nonMember, true, true],
      // node — client matches the rule for the signed-in; both deny the signed-out.
      ['node', signedOut, false, false], ['node', nonMember, true, true],
      // community (default) — the SOFT gate: rule lets any signed-in READ the doc, client shows
      // only members/keeper/staff. Signed-out denied by both.
      [undefined, signedOut, false, false],
      [undefined, nonMember, false, true],   // client STRICTER than rule here (the soft gate)
      [undefined, member, true, true],
      [undefined, keeper, true, true],
      [undefined, staff, true, true],
    ];

    it.each(rows)('visibility=%s → client gate is exact, and never exceeds the rule', (visibility, viewer, clientAllows, signedIn) => {
      const s = sanctum(visibility === undefined ? {} : { visibility });
      const got = canViewLightHouse(s, viewer);
      expect(got).toBe(clientAllows);
      // Invariant (a): the client never shows what the rule would deny.
      if (got) expect(ruleAllowsDoc(visibility, signedIn)).toBe(true);
    });

    it('the ONLY client<rule divergence is a signed-in non-member on the community tier (soft gate)', () => {
      // Community tier, signed-in non-member: the rule WOULD serve the doc; the client hides it.
      expect(ruleAllowsDoc(undefined, true)).toBe(true);
      expect(canViewLightHouse(sanctum(), nonMember)).toBe(false);
      // node/public never diverge downward for a signed-in viewer.
      expect(canViewLightHouse(sanctum({ visibility: 'node' }), nonMember)).toBe(true);
      expect(canViewLightHouse(sanctum({ visibility: 'public' }), nonMember)).toBe(true);
    });
  });
});
