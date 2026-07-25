import { describe, expect, it } from 'vitest';
import {
  crownName,
  dataAuthorityOf,
  deriveCrownRole,
  type CrownRole,
  type DataAuthority,
} from '../src/domain/dataAuthority';

const NODE_LID = '019f63a2-f8e5-7f80-bea2-54d7cc8ef01a';
const HOST_LID = '019f63a3-0000-7000-8000-000000000001';
const authority: DataAuthority = { version: 1, nodeLid: NODE_LID };

describe('data authority — the backend names its custodian', () => {
  it('accepts only a versioned, canonical node LID', () => {
    expect(dataAuthorityOf(authority)).toEqual(authority);
    expect(dataAuthorityOf({ version: 2, nodeLid: NODE_LID })).toBeNull();
    expect(dataAuthorityOf({ version: 1, nodeLid: 'a-firestore-id' })).toBeNull();
    expect(dataAuthorityOf({ version: 1, nodeLid: NODE_LID.toUpperCase() })).toBeNull();
    expect(dataAuthorityOf({ nodeLid: NODE_LID })).toBeNull();
    expect(dataAuthorityOf(null)).toBeNull();
  });
});

describe('the crown — a complete truth table, never hostname inference', () => {
  it('waits at About until both a hosting community and authority are explicit', () => {
    expect(deriveCrownRole(null, authority)).toBe('about');
    expect(deriveCrownRole({ lid: NODE_LID, domain: '' }, authority)).toBe('about');
    expect(deriveCrownRole({ lid: NODE_LID, domain: 'lightseed.online' }, null)).toBe('about');
    expect(deriveCrownRole({ domain: 'lightseed.online' }, authority)).toBe('about');
    expect(deriveCrownRole(
      { lid: NODE_LID, domain: 'lightseed.online' },
      { version: 1, nodeLid: 'malformed' } as DataAuthority,
    )).toBe('about');
  });

  it('names a community domain on its parent node database The Host', () => {
    expect(deriveCrownRole(
      { lid: HOST_LID, domain: 'perauset.com', reflectsPublic: false },
      authority,
    )).toBe('host');
    // Reflection remains the community's choice, but cannot turn hosted data into a hub.
    expect(deriveCrownRole(
      { lid: HOST_LID, domain: 'perauset.com', reflectsPublic: true },
      authority,
    )).toBe('host');
  });

  it('names the governing community The Node while scoped', () => {
    expect(deriveCrownRole(
      { lid: NODE_LID, domain: 'lightseed.online', reflectsPublic: false },
      authority,
    )).toBe('node');
    expect(deriveCrownRole(
      { lid: NODE_LID, domain: 'lightseed.online' },
      authority,
    )).toBe('node');
  });

  it('names that same node The Hub only when its community reflects', () => {
    expect(deriveCrownRole(
      { lid: NODE_LID, domain: 'lightseed.online', reflectsPublic: true },
      authority,
    )).toBe('hub');
  });

  it('keeps the four public names exact', () => {
    const roles: CrownRole[] = ['about', 'host', 'node', 'hub'];
    expect(roles.map(crownName))
      .toEqual(['About', 'The Host', 'The Node', 'The Hub']);
  });
});
