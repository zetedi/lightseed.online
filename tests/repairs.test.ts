// THE LAST HANDS (ring 2026-11-03): the issuer's doors shaped, the alignment a sync block names, and the
// repair command's claims — the pure laws beneath the thirteen hands that no longer refuse.
import { describe, expect, it } from 'vitest';
import { issuerSigninArgs, issuerRegistrationEndpoint, issuerResetUrl, ISSUER_CLIENT_ID } from '../src/domain/issuerDoors';
import { alignmentForSyncBlock } from '../src/domain/alignmentMatch';
import { seedRepairCommand, SEED_REPAIR_KINDS } from '../src/domain/seedOrgans.mjs';
import { seedRequest } from '../src/domain/seedRequest.mjs';

describe('the issuer\'s doors', () => {
  it('shapes the hint, the provider and the action, and leaves out what is none of them', () => {
    expect(issuerSigninArgs()).toEqual({ extraQueryParams: {} });
    expect(issuerSigninArgs({ hint: '  ann@example.org ' })).toEqual({ login_hint: 'ann@example.org', extraQueryParams: {} });
    expect(issuerSigninArgs({ provider: 'google', action: 'VERIFY_EMAIL' })).toEqual({ extraQueryParams: { kc_idp_hint: 'google', kc_action: 'VERIFY_EMAIL' } });
    expect(issuerSigninArgs({ hint: 'two words', provider: 'Google!', action: 'DELETE_EVERYTHING' as never })).toEqual({ extraQueryParams: {} });
    expect(issuerSigninArgs({ hint: 'x'.repeat(255) })).toEqual({ extraQueryParams: {} });
    expect(issuerSigninArgs({ hint: 'a\u0000b' })).toEqual({ extraQueryParams: {} });
  });
  it('names the realm\'s registration and forgotten-password doors beside the issuer', () => {
    expect(issuerRegistrationEndpoint('https://identity.example/realms/lightseed/')).toBe('https://identity.example/realms/lightseed/protocol/openid-connect/registrations');
    expect(issuerResetUrl('https://identity.example/realms/lightseed')).toBe(`https://identity.example/realms/lightseed/login-actions/reset-credentials?client_id=${ISSUER_CLIENT_ID}`);
    expect(issuerResetUrl('https://identity.example/realms/lightseed', 'a b')).toContain('client_id=a%20b');
  });
});

describe('the alignment a sync block names', () => {
  const a = (id: string, status: string, createdAtMs: number) => ({ id, status, createdAtMs });
  it('takes the newest accepted alignment proposed before the block, else the newest accepted at all, never a pending one', () => {
    const pool = [a('old', 'ACCEPTED', 100), a('new', 'ACCEPTED', 300), a('later', 'ACCEPTED', 500), a('pending', 'PENDING', 400)];
    expect(alignmentForSyncBlock(pool, 350)?.id).toBe('new');
    expect(alignmentForSyncBlock(pool)?.id).toBe('later');
    expect(alignmentForSyncBlock(pool, 50)?.id).toBe('later');
    expect(alignmentForSyncBlock([a('pending', 'PENDING', 1)], 10)).toBeNull();
    expect(alignmentForSyncBlock([], 10)).toBeNull();
    expect(alignmentForSyncBlock([a('twin', 'ACCEPTED', 100), a('twin', 'ACCEPTED', 100)], 200)?.id).toBe('twin');
  });
});

describe('the repair command', () => {
  it('admits the seven names and the index audit\'s apply, nothing else', () => {
    expect(SEED_REPAIR_KINDS).toEqual(['pulse_visibility', 'pulse_type_casing', 'tree_visibility', 'vision_chains', 'lids', 'match_ids', 'lid_index']);
    for (const kind of SEED_REPAIR_KINDS) expect(seedRepairCommand({ kind })).toEqual({ kind });
    expect(seedRepairCommand({ kind: 'lid_index', apply: true })).toEqual({ kind: 'lid_index', apply: true });
    for (const value of [null, 'lids', [], {}, { kind: 'drop_everything' }, { kind: 'lids', extra: 1 }, { kind: 'lids', apply: 'yes' }]) expect(seedRepairCommand(value)).toBeNull();
  });
  it('is a signed-in door of the organs', () => {
    expect(seedRequest('POST', '/v1/repairs/command', 'Bearer x', true)).toEqual({ kind: 'repairCommand' });
    expect(seedRequest('POST', '/v1/repairs/command', null, false)).toMatchObject({ status: 401 });
    expect(seedRequest('GET', '/v1/repairs/command', 'Bearer x', true)).toMatchObject({ status: 405 });
  });
});
