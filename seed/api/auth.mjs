import { createLocalJWKSet, importJWK, jwtVerify } from 'jose';
import { seedAuthConfig } from '../../src/domain/seedAuth.mjs';

// Offline trust: tokens cannot choose a discovery URL or introduce signing keys.
// Config changes (including revocation and key rotation) require restarting the API.
/** @param {*} input @param {((issuer: string, subject: string, explicitUid: string | null, open: boolean) => Promise<string | null>) | undefined} [resolveIdentity] */
export async function createAuthenticator(input, resolveIdentity) {
  const config = seedAuthConfig(input);
  if (config.enrollment === 'open' && !resolveIdentity) throw new Error('identity_resolver_required');
  // Invalid keys fail startup, not the first user's request.
  for (const key of config.jwks.keys) {
    const imported = await importJWK(key, 'RS256');
    if (imported.algorithm.modulusLength < 2048) throw new Error('unsafe_auth_key');
  }
  const keys = createLocalJWKSet(config.jwks);
  const bindings = new Map(config.bindings.map(b => [b.subject, b.uid]));
  return async authorization => {
    if (typeof authorization !== 'string' || authorization.length > 7168 || !/^Bearer [A-Za-z0-9_.-]+$/i.test(authorization)) return null;
    let verifiedSubject;
    try {
      const { payload, protectedHeader } = await jwtVerify(authorization.slice(7), keys, {
        issuer: config.issuer, audience: config.audience, algorithms: ['RS256'], typ: config.tokenProfile === 'keycloak' ? 'JWT' : 'at+jwt',
        requiredClaims: ['sub', 'exp', 'iat', 'aud', 'iss'], maxTokenAge: 900, clockTolerance: 5,
      });
      if (config.tokenProfile === 'keycloak' && (payload.typ !== 'Bearer' || payload.azp !== config.clientId)) return null;
      if (!protectedHeader.kid || payload.aud !== config.audience || payload.exp <= payload.iat
        || payload.exp - payload.iat > 900 || typeof payload.scope !== 'string'
        || !payload.scope.split(' ').includes('lightseed:api')) return null;
      if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 512 || /[\u0000-\u0020\u007f]/.test(payload.sub)) return null;
      verifiedSubject = payload.sub;
    } catch { return null; }
    if (config.disabledSubjects.includes(verifiedSubject)) return null;
    const explicitUid = bindings.get(verifiedSubject) ?? null;
    if (!resolveIdentity) return explicitUid;
    try { return await resolveIdentity(config.issuer, verifiedSubject, explicitUid, config.enrollment === 'open'); }
    catch (error) { if (error.code === 'LS010') return null; throw error; }
  };
}
