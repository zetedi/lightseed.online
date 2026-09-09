import { describe, it, expect } from 'vitest';
import { doorKind, doorClaimRefusal, doorChallengeId, doorRows, normalizeDoor } from '../src/domain/doors';
import { doorKind as sDoorKind, doorClaimRefusal as sDoorClaimRefusal } from '../functions/src/doors';
import { DOMAIN_KEYS } from '../src/domain/words';

// The doors of a place (ring 2026-09-09): claimed by proof, or granted for a face door.
const c = { domain: 'lightseed.online', aliases: ['lifeseed.online'], firebase: { projectId: 'lifeseed-75dfe' } as never,
  faces: [{ target: 'perauset', site: 'perauset', door: 'perauset.web.app', domains: ['perauset.com'] }] } as never;

describe('doorKind — node, face or custom, from the charter alone', () => {
  it('names each kind', () => {
    expect(doorKind('lightseed.online', c)).toBe('node');
    expect(doorKind('www.lifeseed.online', c)).toBe('node');
    expect(doorKind('perauset.web.app', c)).toBe('face');
    expect(doorKind('perauset.firebaseapp.com', c)).toBe('face');
    expect(doorKind('lifeseed-75dfe.web.app', c)).toBe('face');
    expect(doorKind('seed.perauset.org', c)).toBe('custom');
  });
});

describe('doorClaimRefusal — what a keeper may claim', () => {
  const community = { id: 'per-auset', domain: 'perauset.web.app', domainAliases: ['seed.perauset.org'] };
  it('a custom hostname no one names is claimable', () => {
    expect(doorClaimRefusal({ door: 'HTTPS://door.perauset.org/', kind: 'custom', community, claimedBy: null })).toBeNull();
  });
  it('refuses by name: not a hostname, the node, its own domain, already a door, another place\'s', () => {
    expect(doorClaimRefusal({ door: 'not a host', kind: 'custom', community, claimedBy: null })).toBe('door_not_hostname');
    expect(doorClaimRefusal({ door: 'lightseed.online', kind: 'node', community, claimedBy: null })).toBe('door_is_node');
    expect(doorClaimRefusal({ door: 'perauset.web.app', kind: 'face', community, claimedBy: null })).toBe('door_is_domain');
    expect(doorClaimRefusal({ door: 'seed.perauset.org', kind: 'custom', community, claimedBy: null })).toBe('door_already');
    expect(doorClaimRefusal({ door: 'seed.theohouse.org', kind: 'custom', community, claimedBy: { id: 'theohouse' } })).toBe('door_taken');
    expect(doorClaimRefusal({ door: 'x.perauset.org', kind: 'custom', community, claimedBy: { id: 'per-auset' } })).toBeNull();
    for (const k of ['door_not_hostname', 'door_is_node', 'door_is_domain', 'door_already', 'door_taken'] as const) expect(DOMAIN_KEYS).toContain(k);
  });
  it('the challenge id and the rows the panel shows', () => {
    expect(doorChallengeId('per-auset', 'Seed.Perauset.org')).toBe('per-auset__seed.perauset.org');
    expect(normalizeDoor('https://www.X.org/path')).toBe('x.org');
    expect(doorRows({ domainAliases: ['a.org'] }, [{ door: 'a.org', kind: 'custom' }, { door: 'b.org', kind: 'custom', recordName: 'n', recordValue: 'v' }, { door: 'perauset.web.app', kind: 'face' }]))
      .toEqual([{ door: 'a.org', state: 'open', kind: 'custom' }, { door: 'b.org', state: 'waiting_proof', kind: 'custom', recordName: 'n', recordValue: 'v' }, { door: 'perauset.web.app', state: 'waiting_grant', kind: 'face', recordName: undefined, recordValue: undefined }]);
  });
});

describe('the functions mirror stays true', () => {
  it('kinds and refusals agree', () => {
    for (const d of ['lightseed.online', 'perauset.web.app', 'seed.perauset.org', 'lifeseed-75dfe.firebaseapp.com']) expect(sDoorKind(d, c)).toBe(doorKind(d, c));
    const community = { id: 'p', domain: 'p.org', domainAliases: ['a.org'] };
    for (const f of [{ door: 'a.org', kind: 'custom' as const }, { door: 'q.org', kind: 'custom' as const }, { door: 'nope', kind: 'custom' as const }]) {
      expect(sDoorClaimRefusal({ ...f, community, claimedBy: null })).toBe(doorClaimRefusal({ ...f, community, claimedBy: null }));
    }
  });
});
