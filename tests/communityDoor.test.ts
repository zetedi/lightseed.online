import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DOOR, doorOf, joinAffordance, checkInvite, inviteStatus, signupRequiresInvite,
  communitiesOnView,
  motherDoorUrl,
  dataDomainFor, reflectsInstancePublic, communityInviteUrl, inviteIdFromPath,
  showsPlaceOfRecord, normalizePlaceOfRecord, leaveRefusal,
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
  it('opens only through an explicit community decision', () => {
    expect(reflectsInstancePublic(true)).toBe(true);
    expect(reflectsInstancePublic(false)).toBe(false);
  });
  it('absent is scoped — no hostname inherits an open canopy', () => {
    expect(reflectsInstancePublic(undefined)).toBe(false);
    expect(reflectsInstancePublic(null)).toBe(false);
  });
  it('passes the domain only while scoped, including the former hub alias', () => {
    expect(dataDomainFor('lightseed.online', undefined)).toBe('lightseed.online');
    expect(dataDomainFor('lightseed.online', false)).toBe('lightseed.online');
    expect(dataDomainFor('lightseed.online', true)).toBeUndefined();
    expect(dataDomainFor('perauset.com', true)).toBeUndefined();
  });
});

describe('place of record (the domain stamp — staff sight, staff mend)', () => {
  it('shows only to staff', () => {
    expect(showsPlaceOfRecord(true, undefined)).toBe(true);
    expect(showsPlaceOfRecord(false, undefined)).toBe(false);
    expect(showsPlaceOfRecord(false, false)).toBe(false);
  });
  it('never on a strict-scoped host — one place by definition, so the stamp is noise', () => {
    expect(showsPlaceOfRecord(true, true)).toBe(false);
    expect(showsPlaceOfRecord(true, false)).toBe(true);
    expect(showsPlaceOfRecord(true, null)).toBe(true);
  });
  it('normalizes a hand-typed domain: scheme, www, port and path stripped, lowercased', () => {
    expect(normalizePlaceOfRecord('https://www.TheOHouse.org/events?x=1')).toBe('theohouse.org');
    expect(normalizePlaceOfRecord(' perauset.web.app ')).toBe('perauset.web.app');
    expect(normalizePlaceOfRecord('localhost:5173')).toBe('localhost');
    expect(normalizePlaceOfRecord('hernan-wachuma.com')).toBe('hernan-wachuma.com');
  });
  it('returns null for junk — the old stamp survives a bad hand', () => {
    expect(normalizePlaceOfRecord('')).toBeNull();
    expect(normalizePlaceOfRecord('   ')).toBeNull();
    expect(normalizePlaceOfRecord('not a domain')).toBeNull();
    expect(normalizePlaceOfRecord('nodots')).toBeNull();
    expect(normalizePlaceOfRecord('https://')).toBeNull();
  });
  it('validates each DNS label, not just the overall shape (Lumo, 2026-08-11)', () => {
    expect(normalizePlaceOfRecord('a..com')).toBeNull();      // empty label
    expect(normalizePlaceOfRecord('a-.com')).toBeNull();      // trailing hyphen in label
    expect(normalizePlaceOfRecord('a.-com')).toBeNull();      // leading hyphen in label
    expect(normalizePlaceOfRecord('a.com-')).toBeNull();      // trailing hyphen in TLD
    expect(normalizePlaceOfRecord('.a.com')).toBeNull();      // leading dot
    expect(normalizePlaceOfRecord('a.com.')).toBeNull();      // trailing dot
    expect(normalizePlaceOfRecord('a.c')).toBeNull();         // one-letter TLD
    expect(normalizePlaceOfRecord(`${'x'.repeat(64)}.com`)).toBeNull();  // label over 63
    expect(normalizePlaceOfRecord(`${`${'x'.repeat(63)}.`.repeat(4)}com`)).toBeNull(); // name over 253
    expect(normalizePlaceOfRecord('xn--nxasmq6b.com')).toBe('xn--nxasmq6b.com'); // punycode lives
    expect(normalizePlaceOfRecord('a.b.c.example.co.uk')).toBe('a.b.c.example.co.uk');
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

describe('communitiesOnView — a strict portal lists only its own garden (ring 2026-08-21)', () => {
  const HERE = 'perauset.web.app';
  const communities = [
    { id: 'host', domain: HERE },                                  // the host face itself
    { id: 'bornHere', domain: 'their-own.org', bornOn: HERE },     // founded on this portal
    { id: 'elsewhere', domain: 'lightseed.online' },               // the wide network
    { id: 'bornElsewhere', domain: 'x.org', bornOn: 'lightseed.online' },
    { id: 'unstamped', domain: 'y.org' },                          // pre-stamp era: no bornOn
  ];

  it('strict: the host and what was born here — nothing else, unstamped stays home', () => {
    const seen = communitiesOnView(communities, { domain: HERE, strictScope: true, reflectsPublic: false });
    expect(seen.map(c => c.id)).toEqual(['host', 'bornHere']);
  });

  it('lenient and reflecting hosts keep the wide view; strictness needs a domain to bite', () => {
    expect(communitiesOnView(communities, { domain: HERE, strictScope: false }).length).toBe(5);
    expect(communitiesOnView(communities, { domain: HERE, strictScope: true, reflectsPublic: true }).length).toBe(5);
    expect(communitiesOnView(communities, { strictScope: true }).length).toBe(5);
    expect(communitiesOnView(communities, {}).length).toBe(5);
  });
});

describe('motherDoorUrl — the seed cradle wears a door home (ring 2026-08-22)', () => {
  const theo = { domain: 'theohouse.org', seedCradle: true };

  it('a cradle portal at another name points home', () => {
    expect(motherDoorUrl(theo, 'seed.theohouse.org')).toBe('https://theohouse.org');
    expect(motherDoorUrl(theo, 'theohouse.web.app')).toBe('https://theohouse.org');
  });

  it('at the mother name itself, no door — and www is the same name', () => {
    expect(motherDoorUrl(theo, 'theohouse.org')).toBeNull();
    expect(motherDoorUrl(theo, 'www.theohouse.org')).toBeNull();
  });

  it('no cradle, no domain, no community — no door', () => {
    expect(motherDoorUrl({ domain: 'perauset.web.app' }, 'perauset.web.app')).toBeNull();
    expect(motherDoorUrl({ domain: 'perauset.web.app', seedCradle: false }, 'x.org')).toBeNull();
    expect(motherDoorUrl({ seedCradle: true }, 'seed.x.org')).toBeNull();
    expect(motherDoorUrl(null, 'seed.x.org')).toBeNull();
  });
});

describe('leaving — the door\'s other direction', () => {
  it('a plain member and a steward may lay their membership down', () => {
    expect(leaveRefusal({ isAnchor: false, holdsKeeperLink: false })).toBeNull();
  });

  it('the anchor is refused: the community is never keeperless', () => {
    expect(leaveRefusal({ isAnchor: true, holdsKeeperLink: false })).toBe('anchor');
    expect(leaveRefusal({ isAnchor: true, holdsKeeperLink: true })).toBe('anchor');
  });

  it('a keeper-link peer resigns keepership before membership', () => {
    expect(leaveRefusal({ isAnchor: false, holdsKeeperLink: true })).toBe('keeper');
  });
});
