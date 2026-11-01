import { generateKeyPairSync, sign } from 'node:crypto';

// Disposable issuer: only tests mint tokens. Production API holds public keys only.
export function authFixture() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const config = { version: 1, issuer: 'https://identity.example.test', audience: 'lightseed-test-api',
    jwks: { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'test-key' }] },
    bindings: [{ subject: 'issuer-alice', uid: 'alice' }, { subject: 'issuer-bob', uid: 'bob' }] };
  const token = (claims = {}, header = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const body = encode({ alg: 'RS256', typ: 'at+jwt', kid: 'test-key', ...header }) + '.' + encode({
      iss: config.issuer, aud: config.audience, sub: 'issuer-alice', iat: now, exp: now + 600,
      scope: 'lightseed:api', ...claims,
    });
    return body + '.' + sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url');
  };
  return { config, token };
}
