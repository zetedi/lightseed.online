// Installation trust, never request data. Email, token UID and role claims confer no authority.
export function seedAuthConfig(value) {
  const text = (v, max = 512) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u0020\u007f]/.test(v);
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!object(value) || value.version !== 1 || !text(value.issuer) || !text(value.audience)
    || !Array.isArray(value.bindings) || value.bindings.length > 10000
    || !object(value.jwks) || !Array.isArray(value.jwks.keys)
    || value.jwks.keys.length < 1 || value.jwks.keys.length > 20) throw new Error('invalid_auth_config');
  const enrollment = value.enrollment ?? 'closed';
  if (!['open', 'closed'].includes(enrollment)) throw new Error('invalid_auth_config');
  const disabledSubjects = value.disabledSubjects ?? [];
  if (!Array.isArray(disabledSubjects) || disabledSubjects.length > 10000 || disabledSubjects.some(s => !text(s))
    || new Set(disabledSubjects).size !== disabledSubjects.length) throw new Error('invalid_auth_config');
  const tokenProfile = value.tokenProfile ?? 'rfc9068';
  if (!['rfc9068', 'keycloak'].includes(tokenProfile)
    || (tokenProfile === 'keycloak' && !text(value.clientId, 128))) throw new Error('invalid_auth_config');
  const issuer = new URL(value.issuer);
  if (issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.search || issuer.hash) throw new Error('invalid_auth_config');
  const kids = new Set();
  const keys = value.jwks.keys.map(key => {
    if (!object(key) || key.kty !== 'RSA' || !text(key.kid, 128) || kids.has(key.kid)
      || !text(key.n, 2048) || !/^[A-Za-z0-9_-]+$/.test(key.n)
      || !text(key.e, 16) || !/^[A-Za-z0-9_-]+$/.test(key.e)
      || Object.keys(key).some(k => !['kty', 'kid', 'n', 'e', 'use', 'alg', 'key_ops'].includes(k))
      || (key.alg !== undefined && key.alg !== 'RS256') || (key.use !== undefined && key.use !== 'sig')
      || (key.key_ops !== undefined && (!Array.isArray(key.key_ops) || key.key_ops.length !== 1 || key.key_ops[0] !== 'verify'))) throw new Error('invalid_auth_config');
    kids.add(key.kid);
    return { kty: 'RSA', kid: key.kid, n: key.n, e: key.e, alg: 'RS256', use: 'sig' };
  });
  const subjects = new Set();
  const bindings = value.bindings.map(binding => {
    if (!object(binding) || !text(binding.subject) || !text(binding.uid, 128) || subjects.has(binding.subject)) throw new Error('invalid_auth_config');
    subjects.add(binding.subject);
    return { subject: binding.subject, uid: binding.uid };
  });
  return { disabledSubjects, enrollment, tokenProfile, clientId: value.clientId, issuer: value.issuer, audience: value.audience, jwks: { keys }, bindings };
}
