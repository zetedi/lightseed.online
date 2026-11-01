import { describe, expect, it } from 'vitest';
import { seedAuthConfig } from '../src/domain/seedAuth.mjs';
import { createAuthenticator } from '../seed/api/auth.mjs';
import { authFixture } from './seed/auth-fixture.mjs';
import { seedRequest } from '../src/domain/seedRequest.mjs';

const fixture = authFixture();
describe('independent identity trust', () => {
  it('maps only verified issuer subjects, ignoring supplied local UID, email and staff claims', async () => {
    const authenticate = await createAuthenticator(fixture.config);
    expect(await authenticate('Bearer ' + fixture.token({ uid: 'root', email: 'root@example.test', role: 'admin' }))).toBe('alice');
    expect(await authenticate('Bearer ' + fixture.token({ sub: 'issuer-bob' }))).toBe('bob');
    expect(await authenticate('Bearer ' + fixture.token({ sub: 'alice', email: 'alice@example.test' }))).toBeNull();
    expect(await authenticate('Basic credentials')).toBeNull();
    expect(await authenticate('Bearer ' + 'x'.repeat(8000))).toBeNull();
    expect(await authenticate('Bearer ' + authFixture().token())).toBeNull();
  });
  it.each([
    { iss: 'https://other.example.test' }, { aud: 'other-api' }, { aud: ['lightseed-test-api', 'other'] },
    { exp: 1 }, { iat: 1 }, { iat: Math.floor(Date.now() / 1000) + 60 },
    { exp: Math.floor(Date.now() / 1000) + 3600 }, { nbf: Math.floor(Date.now() / 1000) + 60 },
    { sub: undefined }, { exp: undefined }, { iat: undefined }, { scope: '' }, { scope: 'lightseed:api-admin' },
  ])('rejects invalid or wrong-purpose claims %j', async claims => {
    const authenticate = await createAuthenticator(fixture.config);
    expect(await authenticate('Bearer ' + fixture.token(claims))).toBeNull();
  });
  it.each([{ alg: 'none' }, { alg: 'HS256' }, { typ: 'JWT' }, { kid: 'unknown' }, { kid: undefined }])('rejects invalid headers %j', async header => {
    const authenticate = await createAuthenticator(fixture.config);
    expect(await authenticate('Bearer ' + fixture.token({}, header))).toBeNull();
  });
  it('rejects ambiguous binding, insecure issuer and private signing material', async () => {
    expect(() => seedAuthConfig({ ...fixture.config, issuer: 'http://identity.example.test' })).toThrow();
    expect(() => seedAuthConfig({ ...fixture.config, bindings: [...fixture.config.bindings, { subject: 'issuer-alice', uid: 'root' }] })).toThrow();
    expect(() => seedAuthConfig({ ...fixture.config, jwks: { keys: [{ ...fixture.config.jwks.keys[0], d: 'private' }] } })).toThrow();
    await expect(createAuthenticator({ ...fixture.config, jwks: { keys: [{ kty: 'RSA', kid: 'bad', n: 'AA', e: 'AQAB' }] } })).rejects.toThrow();
    const authenticate = await createAuthenticator({ ...fixture.config, bindings: [] });
    expect(await authenticate('Bearer ' + fixture.token())).toBeNull();
  });
  it('keeps personal requests bound to the verified hand, with bounded pagination', () => {
    expect(seedRequest('GET', '/v1/me', undefined)).toMatchObject({ status: 401 });
    expect(seedRequest('GET', '/v1/me/secret-links', undefined)).toMatchObject({ status: 401 });
    expect(seedRequest('GET', '/v1/me', 'verified', true)).toEqual({ kind: 'me' });
    expect(seedRequest('GET', '/v1/me/secret-links?limit=1&after=a', 'verified', true)).toMatchObject({ kind: 'secretLinks', limit: 1, after: 'a' });
    for (const query of ['uid=bob', 'from=bob', 'to=secret', 'limit=101', 'limit=1&limit=2']) {
      expect(seedRequest('GET', '/v1/me/secret-links?' + query, 'verified', true)).toMatchObject({ status: 400 });
    }
  });
});

describe('explicit independent enrollment', () => {
  it('requires a durable resolver before opening enrollment', async () => {
    const fixture = authFixture();
    await expect(createAuthenticator({ ...fixture.config, enrollment: 'open' })).rejects.toThrow('identity_resolver_required');
    await expect(createAuthenticator({ ...fixture.config, enrollment: 'guess-by-email' })).rejects.toThrow('invalid_auth_config');
  });
  it('passes only verified issuer/subject and explicit configuration to the resolver', async () => {
    const fixture = authFixture(); const calls: unknown[][] = [];
    const auth = await createAuthenticator({ ...fixture.config, enrollment: 'open' }, async (...args) => {
      calls.push(args); return 'new-local-account';
    });
    expect(await auth('Bearer ' + fixture.token({ sub: 'new-subject', uid: 'admin', email: 'same@example.test' }))).toBe('new-local-account');
    expect(calls).toEqual([[fixture.config.issuer, 'new-subject', null, true]]);
    expect(await auth('Bearer ' + authFixture().token())).toBeNull();
    expect(await auth('Bearer ' + fixture.token({ sub: 'bad subject' }))).toBeNull();
    expect(calls).toHaveLength(1);
  });
});
