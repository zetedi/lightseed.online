// Identity establishes a login, never a keeper/staff seat or a portable LID.
// `smtp` (optional): the issuer's own courier for verification and password-recovery mail —
// { host, port, from, user?, password?, ssl? } as the installation's secrets, never the API's.
export function seedIdentityRealm(appOrigin, enrollment = 'closed', smtp = null) {
  if (!['open', 'closed'].includes(enrollment)) throw new Error('invalid_enrollment');
  const url = new URL(appOrigin);
  if (url.protocol !== 'https:' || url.origin !== appOrigin || url.username || url.password) throw new Error('invalid_app_origin');
  const smtpServer = smtp === null ? {} : { smtpServer: seedIdentitySmtp(smtp) };
  return {
    ...smtpServer,
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
      defaultClientScopes: ['lightseed:api', 'lightseed:name', 'lightseed:email'], optionalClientScopes: [],
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
    }, {
      // THE ADDRESS A LOGIN CARRIES (ring 2026-11-03): the verified address rides in the ACCESS token
      // so the API may remember it on the account for the mail organ (seed.record_login_email) — a
      // courtesy for letters, never identity: the API still binds the subject alone.
      name: 'lightseed:email', protocol: 'openid-connect',
      attributes: { 'include.in.token.scope': 'false', 'display.on.consent.screen': 'false' },
      protocolMappers: [{ name: 'lightseed-email', protocol: 'openid-connect',
        protocolMapper: 'oidc-usermodel-attribute-mapper', config: {
          'user.attribute': 'email', 'claim.name': 'email', 'jsonType.label': 'String',
          'id.token.claim': 'false', 'access.token.claim': 'true', 'userinfo.token.claim': 'true',
        } }, { name: 'lightseed-email-verified', protocol: 'openid-connect',
        protocolMapper: 'oidc-usermodel-property-mapper', config: {
          'user.attribute': 'emailVerified', 'claim.name': 'email_verified', 'jsonType.label': 'boolean',
          'id.token.claim': 'false', 'access.token.claim': 'true', 'userinfo.token.claim': 'true',
        } }],
    }],
  };
}

// Keycloak's realm smtpServer block from the installation's settings; every value a string, as the realm import reads them.
export function seedIdentitySmtp(smtp) {
  const text = v => typeof v === 'string' && v.length > 0 && v.length <= 512 && !/[\u0000-\u0020\u007f]/.test(v);
  if (!smtp || typeof smtp !== 'object' || !text(smtp.host) || !Number.isInteger(smtp.port) || smtp.port < 1 || smtp.port > 65535
    || !text(smtp.from) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(smtp.from)
    || (smtp.user !== undefined && !text(smtp.user)) || (smtp.password !== undefined && (typeof smtp.password !== 'string' || !smtp.password))
    || (smtp.user === undefined) !== (smtp.password === undefined)) throw new Error('invalid_smtp');
  const ssl = smtp.ssl === true || smtp.port === 465;
  return { host: smtp.host, port: String(smtp.port), from: smtp.from, ssl: String(ssl), starttls: String(!ssl),
    ...(smtp.user ? { auth: 'true', user: smtp.user, password: smtp.password } : { auth: 'false' }) };
}
