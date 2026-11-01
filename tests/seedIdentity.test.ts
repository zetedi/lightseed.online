import { describe, expect, it } from 'vitest';
import { seedIdentityRealm } from '../src/domain/seedIdentity.mjs';
import { createAuthenticator } from '../seed/api/auth.mjs';
import { authFixture } from './seed/auth-fixture.mjs';

describe('seed identity provider', () => {
  it('requires exact HTTPS callbacks and code flow with S256; grants no application powers', () => {
    const realm = seedIdentityRealm('https://app.example');
    const client = realm.clients[0];
    expect(client.redirectUris).toEqual(['https://app.example/auth/callback']);
    expect(client.webOrigins).toEqual(['https://app.example']);
    expect(client.attributes['pkce.code.challenge.method']).toBe('S256');
    expect(client).toMatchObject({ publicClient: true, standardFlowEnabled: true,
      implicitFlowEnabled: false, directAccessGrantsEnabled: false, serviceAccountsEnabled: false });
    expect(realm).toMatchObject({ registrationAllowed: false, verifyEmail: true, bruteForceProtected: true, accessTokenLifespan: 300 });
    expect(realm).not.toHaveProperty('users');
    expect(realm).not.toHaveProperty('roles');
    expect(realm.clientScopes[0].protocolMappers[0].config['id.token.claim']).toBe('false');
    expect(realm.clientScopes[0].protocolMappers[1]).toMatchObject({ protocolMapper: 'oidc-sub-mapper', config: { 'access.token.claim': 'true' } });
  });
  it('opens registration only by explicit installation choice', () => {
    expect(seedIdentityRealm('https://app.example', 'open').registrationAllowed).toBe(true);
    expect(() => seedIdentityRealm('https://app.example', 'guess')).toThrow('invalid_enrollment');
  });
  it.each(['http://app.example', 'https://app.example/', 'https://app.example/path', 'https://app.example?x=a', 'https://a@app.example'])('refuses ambiguous origin %s', origin => {
    expect(() => seedIdentityRealm(origin)).toThrow();
  });
  it('requires explicit Keycloak profile, access-token purpose and authorized client', async () => {
    const { config, token } = authFixture();
    const authenticate = await createAuthenticator({ ...config, tokenProfile: 'keycloak', clientId: 'lightseed-web' });
    const access = { typ: 'Bearer', azp: 'lightseed-web' };
    expect(await authenticate('Bearer ' + token(access, { typ: 'JWT' }))).toBe('alice');
    for (const claims of [{ typ: 'ID', azp: 'lightseed-web' }, { typ: 'Bearer', azp: 'other' }, {}]) {
      expect(await authenticate('Bearer ' + token(claims, { typ: 'JWT' }))).toBeNull();
    }
    const strict = await createAuthenticator(config);
    expect(await strict('Bearer ' + token(access, { typ: 'JWT' }))).toBeNull();
    await expect(createAuthenticator({ ...config, tokenProfile: 'keycloak' })).rejects.toThrow();
    await expect(createAuthenticator({ ...config, tokenProfile: 'unknown' })).rejects.toThrow();
  });
});

describe('the claimed name (ring 2026-11-01)', () => {
  it('rides in the ID token alone, as a default scope of the web client, and never in the API token', () => {
    const realm = seedIdentityRealm('https://app.example');
    const scope = realm.clientScopes.find(s => s.name === 'lightseed:name')!;
    expect(realm.clients[0].defaultClientScopes).toContain('lightseed:name');
    expect(scope.attributes['include.in.token.scope']).toBe('false');
    for (const mapper of scope.protocolMappers) {
      expect(mapper.config['id.token.claim']).toBe('true');
      expect(mapper.config['access.token.claim']).toBe('false');
    }
    expect(scope.protocolMappers.map(m => m.protocolMapper)).toEqual(['oidc-full-name-mapper', 'oidc-usermodel-attribute-mapper']);
    expect((scope.protocolMappers[1].config as Record<string, string>)['claim.name']).toBe('preferred_username');
  });
});
