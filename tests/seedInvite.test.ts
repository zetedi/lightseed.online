import { describe, expect, it } from 'vitest';
import { seedInviteCommand } from '../src/domain/seedInvite.mjs';
import { seedRequest } from '../src/domain/seedRequest.mjs';

describe('independent community invitation contracts', () => {
  it('accepts bounded invitations without allowing identity or provenance claims', () => {
    const mint = { action: 'mint', communityId: 'garden', label: 'Friends', expiresAt: '2027-01-01T00:00:00.000Z' };
    expect(seedInviteCommand(mint)).toEqual(mint);
    for (const addition of [{ createdBy: 'other' }, { id: 'chosen' }, { revokedAt: null },
      { expiresAt: '2027-02-30T00:00:00.000Z' }, { expiresAt: 'infinity' }, { label: 'a'.repeat(121) }]) {
      expect(seedInviteCommand({ ...mint, ...addition })).toBeNull();
    }
    expect(seedInviteCommand({ action: 'accept', id: 'token' })).toEqual({ action: 'accept', id: 'token' });
    expect(seedInviteCommand({ action: 'accept', id: 'token', member: 'other' })).toBeNull();
  });
  it('permits public token lookup but requires authentication to list and mutate', () => {
    expect(seedRequest('GET', '/v1/community-invites?id=token', undefined)).toMatchObject({ kind: 'invites', id: 'token' });
    expect(seedRequest('GET', '/v1/community-invites?community=garden', undefined)).toMatchObject({ status: 401 });
    expect(seedRequest('GET', '/v1/community-invites?community=garden&limit=10', 'Bearer valid', true)).toMatchObject({ kind: 'invites', community: 'garden', limit: 10 });
    for (const query of ['', '?id=a&community=b', '?id=a&limit=1', '?id=a&id=b', '?community=a&limit=101', '?id=%00']) {
      expect(seedRequest('GET', '/v1/community-invites' + query, undefined)).toMatchObject({ status: 400 });
    }
    expect(seedRequest('POST', '/v1/community-invites/command', undefined)).toMatchObject({ status: 401 });
    expect(seedRequest('POST', '/v1/community-invites/command', 'Bearer valid', true)).toEqual({ kind: 'inviteCommand' });
  });
});
