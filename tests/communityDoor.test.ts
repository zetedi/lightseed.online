import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DOOR, doorOf, joinAffordance, checkInvite, inviteStatus, signupRequiresInvite,
  reflectsInstancePublic, communityInviteUrl, inviteIdFromPath,
  type CommunityInviteCheck,
} from '../src/domain/communityDoor';

const NOW = 1783382400000;

// A live invitation to `c1`, created by its keeper — the base each test bends.
const invite = (over: Partial<CommunityInviteCheck> = {}): CommunityInviteCheck => ({
  communityId: 'c1',
  createdBy: 'keeper',
  ...over,
});

describe('doorOf', () => {
  it('defaults to invite — exactly the pre-door behaviour (knock, keeper accepts)', () => {
    expect(DEFAULT_DOOR).toBe('invite');
    expect(doorOf(undefined)).toBe('invite');
    expect(doorOf(null)).toBe('invite');
    expect(doorOf({})).toBe('invite');
    expect(doorOf({ door: null })).toBe('invite');
  });
  it('passes known doors through', () => {
    expect(doorOf({ door: 'open' })).toBe('open');
    expect(doorOf({ door: 'invite' })).toBe('invite');
    expect(doorOf({ door: 'closed' })).toBe('closed');
  });
  it('treats an unknown value as the default, never as open', () => {
    expect(doorOf({ door: 'ajar' })).toBe('invite');
    expect(doorOf({ door: '' })).toBe('invite');
  });
});

describe('joinAffordance', () => {
  it('open door: join directly', () => expect(joinAffordance('open')).toBe('join'));
  it('invite door: knock', () => expect(joinAffordance('invite')).toBe('request'));
  it('closed door: nothing to offer', () => expect(joinAffordance('closed')).toBe('none'));
});

describe('checkInvite', () => {
  it('a live invitation opens its community', () => {
    expect(checkInvite(invite(), 'c1', 'invite', NOW)).toEqual({ usable: true });
  });
  it('works while the door is open too — provenance still worth recording', () => {
    expect(checkInvite(invite(), 'c1', 'open', NOW)).toEqual({ usable: true });
  });
  it('never opens a different community', () => {
    expect(checkInvite(invite(), 'c2', 'invite', NOW)).toEqual({ usable: false, reason: 'wrong_community' });
  });
  it('revoked is revoked', () => {
    expect(checkInvite(invite({ revokedAtMs: NOW - 5 }), 'c1', 'invite', NOW)).toEqual({ usable: false, reason: 'revoked' });
  });
  it('expiry is a moment, not a suggestion', () => {
    expect(checkInvite(invite({ expiresAtMs: NOW }), 'c1', 'invite', NOW)).toEqual({ usable: false, reason: 'expired' });
    expect(checkInvite(invite({ expiresAtMs: NOW + 1 }), 'c1', 'invite', NOW)).toEqual({ usable: true });
  });
  it('a closed door closes ALL ways in — even a valid invitation waits', () => {
    expect(checkInvite(invite(), 'c1', 'closed', NOW)).toEqual({ usable: false, reason: 'door_closed' });
  });
  it('checks in order: belonging before liveness', () => {
    expect(checkInvite(invite({ revokedAtMs: NOW - 5 }), 'c2', 'closed', NOW))
      .toEqual({ usable: false, reason: 'wrong_community' });
  });
});

describe('signupRequiresInvite (identity is open; only a closed door gates sign-up)', () => {
  it('only a CLOSED node requires an invitation to create an account on its domain', () => {
    expect(signupRequiresInvite({ door: 'closed' })).toBe(true);
  });
  it('open, invite, and the absent default all leave sign-up open — identity is open', () => {
    expect(signupRequiresInvite({ door: 'open' })).toBe(false);
    expect(signupRequiresInvite({ door: 'invite' })).toBe(false);
    expect(signupRequiresInvite({})).toBe(false);
    expect(signupRequiresInvite(null)).toBe(false);
    expect(signupRequiresInvite(undefined)).toBe(false);
  });
});

describe('reflectsInstancePublic (a node reflects the instance, or stays a scoped pond)', () => {
  it('an explicit flag wins in both directions', () => {
    expect(reflectsInstancePublic(true, false)).toBe(true);   // a scoped domain chose to reflect
    expect(reflectsInstancePublic(false, true)).toBe(false);  // a reflecting domain chose to scope
  });
  it('unset falls back to the hub default — zero migration', () => {
    expect(reflectsInstancePublic(undefined, true)).toBe(true);   // hub reflects by default
    expect(reflectsInstancePublic(undefined, false)).toBe(false); // others stay scoped
    expect(reflectsInstancePublic(null, true)).toBe(true);
  });
});

describe('inviteStatus', () => {
  it('live when neither revoked nor past its deadline', () => {
    expect(inviteStatus({}, NOW)).toBe('live');
    expect(inviteStatus({ expiresAtMs: NOW + 1 }, NOW)).toBe('live');
  });
  it('revoked wins even over an unexpired deadline', () => {
    expect(inviteStatus({ revokedAtMs: NOW - 1, expiresAtMs: NOW + 1000 }, NOW)).toBe('revoked');
  });
  it('expired the instant the deadline is reached', () => {
    expect(inviteStatus({ expiresAtMs: NOW }, NOW)).toBe('expired');
    expect(inviteStatus({ expiresAtMs: NOW + 1 }, NOW)).toBe('live');
  });
});

describe('invite URLs', () => {
  it('builds /i/<id> beside the /b/<lid> door', () => {
    expect(communityInviteUrl('https://lightseed.online', 'AbC123xyz789')).toBe('https://lightseed.online/i/AbC123xyz789');
    expect(communityInviteUrl('https://lightseed.online/', 'AbC123xyz789')).toBe('https://lightseed.online/i/AbC123xyz789');
  });
  it('reads the id back from a path', () => {
    expect(inviteIdFromPath('/i/AbC123xyz789')).toBe('AbC123xyz789');
    expect(inviteIdFromPath('/i/AbC123xyz789/')).toBe('AbC123xyz789');
  });
  it('rejects paths that are not invitation doors', () => {
    expect(inviteIdFromPath('/b/019f6381-48fd-7fcc-9382-e99d923f38f4')).toBeNull();
    expect(inviteIdFromPath('/i/short')).toBeNull();
    expect(inviteIdFromPath('/i/')).toBeNull();
    expect(inviteIdFromPath('/')).toBeNull();
    expect(inviteIdFromPath('/i/has spaces here')).toBeNull();
  });
});
