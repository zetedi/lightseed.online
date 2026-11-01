// Identity establishes a login, never a keeper/staff seat or a portable LID.
export function seedIdentityRealm(appOrigin, enrollment = 'closed') {
  if (!['open', 'closed'].includes(enrollment)) throw new Error('invalid_enrollment');
  const url = new URL(appOrigin);
  if (url.protocol !== 'https:' || url.origin !== appOrigin || url.username || url.password) throw new Error('invalid_app_origin');
  return {
    realm: 'lightseed', enabled: true, sslRequired: 'external',
    registrationAllowed: enrollment === 'open', resetPasswordAllowed: true, verifyEmail: true,
    loginWithEmailAllowed: true, duplicateEmailsAllowed: false,
    bruteForceProtected: true, passwordPolicy: 'length(12)',
    accessTokenLifespan: 300, ssoSessionIdleTimeout: 1800, ssoSessionMaxLifespan: 36000,
    revokeRefreshToken: true, refreshTokenMaxReuse: 0,
    clients: [{ clientId: 'lightseed-web', protocol: 'openid-connect', enabled: true,
      publicClient: true, standardFlowEnabled: true, implicitFlowEnabled: false,
      directAccessGrantsEnabled: false, serviceAccountsEnabled: false,
      redirectUris: [appOrigin + '/auth/callback'], webOrigins: [appOrigin],
      attributes: { 'pkce.code.challenge.method': 'S256', 'post.logout.redirect.uris': appOrigin + '/' },
      defaultClientScopes: ['lightseed:api', 'lightseed:name'], optionalClientScopes: [],
    }],
    clientScopes: [{ name: 'lightseed:api', protocol: 'openid-connect',
      attributes: { 'include.in.token.scope': 'true', 'display.on.consent.screen': 'true' },
      protocolMappers: [{ name: 'lightseed-api-audience', protocol: 'openid-connect',
        protocolMapper: 'oidc-audience-mapper', config: {
          'included.custom.audience': 'lightseed-api', 'access.token.claim': 'true', 'id.token.claim': 'false',
        } }, { name: 'lightseed-subject', protocol: 'openid-connect',
        protocolMapper: 'oidc-sub-mapper', config: { 'access.token.claim': 'true' },
      }],
    }, {
      // THE CLAIMED NAME (ring 2026-11-01): the person's own name and username ride in the ID
      // token alone, so a first sign-in can write its first profile (the shell's
      // ensurePersonEntity) — a courtesy, never identity: the API binds the subject, not the name.
      name: 'lightseed:name', protocol: 'openid-connect',
      attributes: { 'include.in.token.scope': 'false', 'display.on.consent.screen': 'false' },
      protocolMappers: [{ name: 'lightseed-full-name', protocol: 'openid-connect',
        protocolMapper: 'oidc-full-name-mapper', config: { 'id.token.claim': 'true', 'access.token.claim': 'false', 'userinfo.token.claim': 'true' },
      }, { name: 'lightseed-username', protocol: 'openid-connect',
        protocolMapper: 'oidc-usermodel-attribute-mapper', config: {
          'user.attribute': 'username', 'claim.name': 'preferred_username', 'jsonType.label': 'String',
          'id.token.claim': 'true', 'access.token.claim': 'false', 'userinfo.token.claim': 'true',
        } }],
    }],
  };
}
