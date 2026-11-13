#!/usr/bin/env node
// Real code+PKCE flow against a disposable issuer; never uses installation accounts.
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, delimiter } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { seedIdentityRealm } from '../src/domain/seedIdentity.mjs';
import { createAuthenticator } from '../seed/api/auth.mjs';
import { createApi } from '../seed/api/server.mjs';
import { OidcClient, InMemoryWebStorage, WebStorageStateStore } from 'oidc-client-ts';

const directory = await mkdtemp(join(tmpdir(), 'lightseed-identity-'));
const project = 'lightseed-identity-check-' + randomBytes(6).toString('hex');
const realmFile = join(directory, 'lightseed-realm.json');
const override = join(directory, 'override.yml');
const password = randomBytes(24).toString('base64url');
const env = { ...process.env, COMPOSE_PROJECT_NAME: project, COMPOSE_PROFILES: '',
  COMPOSE_FILE: [resolve('seed/identity/compose.yml'), override].join(delimiter),
  SEED_IDENTITY_DB_PASSWORD: randomBytes(32).toString('base64url'),
  SEED_IDENTITY_ADMIN: 'test-admin', SEED_IDENTITY_ADMIN_PASSWORD: randomBytes(32).toString('base64url'),
  SEED_IDENTITY_ORIGIN: 'https://identity.example.test', SEED_IDENTITY_REALM_FILE: realmFile };
const run = args => new Promise((accept, reject) => {
  const child = spawn('docker', ['compose', ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
  child.on('error', reject);
  child.on('close', code => code === 0 ? accept(stdout) : reject(new Error('Identity container command failed: ' + stderr.slice(-1500))));
});
let started = false;
let server;
try {
  const realm = seedIdentityRealm('https://app.example.test');
  // Synthetic account only; production realm generator never creates users/passwords.
  realm.users = [{ id: '00000000-0000-4000-8000-000000000001', username: 'alice', enabled: true,
    email: 'alice@example.test', emailVerified: true, firstName: 'Alice', lastName: 'Test',
    credentials: [{ type: 'password', value: password, temporary: false }] }];
  await writeFile(realmFile, JSON.stringify(realm), { mode: 0o644 }); // private parent, container-readable
  await writeFile(override, "services:\n  identity:\n    ports: !override\n      - '127.0.0.1::8080'\n", { mode: 0o600 });
  console.log('Starting an isolated identity server and its own database.');
  started = true;
  await run(['up', '-d']);
  const origin = 'http://' + (await run(['port', 'identity', '8080'])).trim();
  const issuer = env.SEED_IDENTITY_ORIGIN + '/realms/lightseed';
  const internal = url => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, env.SEED_IDENTITY_ORIGIN);
    return origin + parsed.pathname + parsed.search;
  };
  const headers = { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'identity.example.test', 'x-forwarded-port': '443' };
  const request = (url, options = {}) => fetch(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { ...headers, ...options.headers } });
  let discovery;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const r = await request(origin + '/realms/lightseed/.well-known/openid-configuration');
      if (r.ok) { discovery = await r.json(); break; }
    } catch { /* startup in progress */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(discovery, 'Issuer did not become ready');
  assert.equal(discovery.issuer, issuer);
  // Establish the binding through the operator API, never from an unverified token.
  const adminResponse = await request(origin + '/realms/master/protocol/openid-connect/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password',
      username: env.SEED_IDENTITY_ADMIN, password: env.SEED_IDENTITY_ADMIN_PASSWORD }),
  });
  assert.equal(adminResponse.status, 200);
  const adminToken = (await adminResponse.json()).access_token;
  const accountsResponse = await request(origin + '/admin/realms/lightseed/users?username=alice&exact=true', {
    headers: { authorization: 'Bearer ' + adminToken },
  });
  assert.equal(accountsResponse.status, 200);
  const accounts = await accountsResponse.json();
  assert.equal(accounts.length, 1);
  const accountId = accounts[0].id;
  console.log('Checking the enrollment at scale: a census of persons becomes logins and bindings.');
  // THE ENROLLMENT AT SCALE (ring 2026-11-14): alice already has an account (bound by address, never made twice),
  // bob has none (made: enabled, unverified, a password to set), the departed get no login; the trust file
  // after the ceremony is written beside the given one and a second run finds nothing to do.
  const census = join(directory, 'census'); await mkdir(census, { mode: 0o700 });
  const lid = n => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
  await writeFile(join(census, 'identities.json'), JSON.stringify([
    { sourceUid: 'alice', targetUid: 'alice', personLid: lid(1) }, { sourceUid: 'bob', targetUid: 'bob', personLid: lid(2) },
    { sourceUid: 'gone', targetUid: 'gone', departed: true }]), { mode: 0o600 });
  await writeFile(join(census, 'bundle.json'), JSON.stringify({ head: {}, docs: [
    { path: 'users/alice', data: { uid: 'alice', email: 'Alice@example.test', displayName: 'Alice Test' } },
    { path: 'users/bob', data: { uid: 'bob', email: 'bob@example.test', displayName: 'Bob the Builder' } }] }), { mode: 0o600 });
  const trustBefore = join(census, 'auth.json');
  await writeFile(trustBefore, JSON.stringify({ version: 1, issuer, audience: 'lightseed-api', tokenProfile: 'keycloak', clientId: 'lightseed-web', jwks: { keys: [] }, bindings: [] }), { mode: 0o600 });
  const enroll = (trust, out, ...extra) => new Promise((accept, reject) => {
    const child = spawn(process.execPath, [resolve('scripts/enroll-seed-identities.mjs'), join(census, 'identities.json'), '--people', join(census, 'bundle.json'), '--trust', trust, '--admin', origin, '--out', out, ...extra], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
    child.on('error', reject);
    child.on('close', code => accept({ code, stdout, stderr }));
  });
  const trustAfter = join(census, 'auth.enrolled.json');
  const planned = await enroll(trustBefore, trustAfter);
  assert.equal(planned.code, 0, 'The enrollment plan must be clear: ' + planned.stderr.slice(-500));
  assert.match(planned.stdout, /1 accounts to make, 1 standing accounts to bind, 0 already bound, 1 departed/);
  await assert.rejects(() => readFile(trustAfter), 'A plan writes nothing');
  const applied = await enroll(trustBefore, trustAfter, '--apply');
  assert.equal(applied.code, 0, 'The enrollment must apply: ' + applied.stderr.slice(-500));
  assert.match(applied.stdout, /Applied: 1 accounts made, 1 standing accounts bound/);
  const enrolled = JSON.parse(await readFile(trustAfter, 'utf8'));
  assert.equal(enrolled.issuer, issuer);
  assert.equal(enrolled.bindings.length, 2);
  assert.deepEqual(enrolled.bindings.find(b => b.uid === 'alice'), { subject: accountId, uid: 'alice' });
  const bobBinding = enrolled.bindings.find(b => b.uid === 'bob'); assert.ok(bobBinding?.subject);
  const bobResponse = await request(origin + '/admin/realms/lightseed/users/' + bobBinding.subject, { headers: { authorization: 'Bearer ' + adminToken } });
  assert.equal(bobResponse.status, 200);
  const bob = await bobResponse.json();
  assert.equal(bob.email, 'bob@example.test'); assert.equal(bob.enabled, true); assert.equal(bob.emailVerified, false);
  assert.deepEqual([...bob.requiredActions].sort(), ['UPDATE_PASSWORD', 'VERIFY_EMAIL']);
  assert.equal(bob.attributes?.lightseedUid, undefined); // the issuer carries no uid: the trust file is the binding
  assert.equal(bob.firstName, 'Bob the'); assert.equal(bob.lastName, 'Builder');
  const again = await enroll(trustAfter, join(census, 'auth.again.json'), '--apply');
  assert.equal(again.code, 0); assert.match(again.stdout, /0 accounts to make, 0 standing accounts to bind, 2 already bound/); assert.match(again.stdout, /nothing to do/);
  await assert.rejects(() => readFile(join(census, 'auth.again.json')), 'Nothing to do writes nothing');
  // The authenticator the API builds from the file after the ceremony binds alice's account to her uid.
  console.log('Checking authorization-code sign-in with S256 PKCE.');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(24).toString('base64url');
  const params = new URLSearchParams({ client_id: 'lightseed-web', response_type: 'code',
    redirect_uri: 'https://app.example.test/auth/callback', scope: 'openid lightseed:api',
    state, nonce: randomBytes(24).toString('base64url'), code_challenge: challenge, code_challenge_method: 'S256' });
  const noPkce = new URLSearchParams(params); noPkce.delete('code_challenge'); noPkce.delete('code_challenge_method');
  const refused = await request(internal(discovery.authorization_endpoint) + '?' + noPkce);
  assert.ok(refused.status >= 400 || new URL(refused.headers.get('location')).searchParams.has('error'), 'PKCE must be required');
  const authorize = async (requestParams = params, fullCallback = false) => {
    const login = await request(internal(discovery.authorization_endpoint) + '?' + requestParams);
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    const html = await login.text();
    const action = html.match(/<form[^>]*id="kc-form-login"[^>]*action="([^"]+)"/);
    assert.ok(action, 'Missing login form');
    const signedIn = await request(internal(action[1].replaceAll('&amp;', '&')), {
      method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: 'alice', password, credentialId: '' }),
    });
    assert.equal(signedIn.status, 302, 'Login did not complete');
    const callback = new URL(signedIn.headers.get('location'));
    assert.equal(callback.origin + callback.pathname, 'https://app.example.test/auth/callback');
    assert.equal(callback.searchParams.get('state'), requestParams.get('state'));
    const code = callback.searchParams.get('code'); assert.ok(code);
    return fullCallback ? callback.href : code;
  };
  const code = await authorize();
  const exchange = async (codeVerifier, authCode = code) => request(internal(discovery.token_endpoint), {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: 'lightseed-web', grant_type: 'authorization_code',
      code: authCode, redirect_uri: 'https://app.example.test/auth/callback', code_verifier: codeVerifier }),
  });
  const response = await exchange(verifier);
  assert.equal(response.status, 200);
  const tokens = await response.json();
  assert.ok(tokens.access_token && tokens.id_token && tokens.refresh_token);
  const jwks = await (await request(internal(discovery.jwks_uri))).json();
  const keys = jwks.keys.filter(k => k.use === 'sig' && k.alg === 'RS256').map(({ kty, kid, n, e }) => ({ kty, kid, n, e }));
  const authenticate = await createAuthenticator({ version: 1, issuer, audience: 'lightseed-api',
    tokenProfile: 'keycloak', clientId: 'lightseed-web', jwks: { keys },
    bindings: [{ subject: accountId, uid: 'local-alice' }] });
  const claims = JSON.parse(Buffer.from(tokens.access_token.split('.')[1], 'base64url'));
  assert.equal(typeof claims.sub, 'string', 'Access token must include subject');
  assert.equal(claims.sub, accountId, 'Subject must match operator-confirmed account');
  assert.equal(await authenticate('Bearer ' + tokens.access_token), 'local-alice');
  assert.equal(await authenticate('Bearer ' + tokens.id_token), null);
  // The actual HTTP identity route uses the same verifier; PostgreSQL RLS has its own integration suite.
  server = createApi({}, authenticate);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const api = 'http://127.0.0.1:' + server.address().port;
  const me = await fetch(api + '/v1/me', { headers: { authorization: 'Bearer ' + tokens.access_token } });
  assert.deepEqual(await me.json(), { uid: 'local-alice' });
  console.log('Checking the browser OIDC client callback against the real issuer.');
  const oidc = new OidcClient({ authority: issuer, client_id: 'lightseed-web',
    redirect_uri: 'https://app.example.test/auth/callback', response_type: 'code',
    scope: 'openid lightseed:api', loadUserInfo: false, metadata: discovery,
    stateStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
  });
  const signin = await oidc.createSigninRequest({ nonce: randomBytes(32).toString('base64url') });
  const oidcParams = new URL(signin.url).searchParams;
  assert.equal(oidcParams.get('code_challenge_method'), 'S256');
  const oidcCallback = await authorize(oidcParams, true);
  const wrongState = new URL(oidcCallback); wrongState.searchParams.set('state', 'untrusted');
  await assert.rejects(() => oidc.processSigninResponse(wrongState.href));
  const nativeFetch = globalThis.fetch;
  try {
    // Test-only transport bridge: public HTTPS issuer maps to the isolated loopback
    // container. Production browser requests use HTTPS directly, with no override.
    globalThis.fetch = (url, options = {}) => nativeFetch(internal(String(url)), {
      ...options, headers: { ...Object.fromEntries(new Headers(options.headers)), ...headers },
    });
    const browserTokens = await oidc.processSigninResponse(oidcCallback);
    assert.equal(await authenticate('Bearer ' + browserTokens.access_token), 'local-alice');
    await assert.rejects(() => oidc.processSigninResponse(oidcCallback));
  } finally { globalThis.fetch = nativeFetch; }
  console.log('Checking refresh, logout and issuer persistence.');
  const form = body => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const refreshed = await request(internal(discovery.token_endpoint), form({ client_id: 'lightseed-web', grant_type: 'refresh_token', refresh_token: tokens.refresh_token }));
  assert.equal(refreshed.status, 200, 'Refresh must succeed before logout or code replay');
  const next = await refreshed.json();
  const logout = await request(internal(discovery.end_session_endpoint), form({ client_id: 'lightseed-web', refresh_token: next.refresh_token }));
  assert.equal(logout.status, 204);
  const afterLogout = await request(internal(discovery.token_endpoint), form({ client_id: 'lightseed-web', grant_type: 'refresh_token', refresh_token: next.refresh_token }));
  assert.equal(afterLogout.status, 400);
  assert.equal((await exchange(verifier)).status, 400, 'Authorization code replay must fail');
  const wrongCode = await authorize();
  assert.equal((await exchange(randomBytes(32).toString('base64url'), wrongCode)).status, 400, 'Wrong PKCE verifier must fail');

  await run(['restart', 'identity']);
  // Restart may assign a new ephemeral port. Confirm the persisted signing keys survive.
  const restartedOrigin = 'http://' + (await run(['port', 'identity', '8080'])).trim();
  let recovered = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const r = await request(restartedOrigin + '/realms/lightseed/protocol/openid-connect/certs');
      if (r.ok) { const restored = await r.json(); assert.ok(restored.keys.some(k => k.kid === keys[0].kid)); recovered = true; break; }
    } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(recovered, 'Issuer did not recover');
  console.log('Identity proof passed: discovery, code+PKCE login, code replay refusal, verified API identity, browser-client callback/state checks, ID-token refusal, refresh, logout and persistent keys.');
} catch (error) {
  // Never print token responses, cookies, authorization codes or synthetic passwords.
  console.error(error instanceof Error ? error.message : 'Identity proof failed');
  process.exitCode = 1;
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  let cleaned = !started;
  if (started) {
    try { await run(['down', '--volumes', '--remove-orphans']); cleaned = true; }
    catch { console.error(`Cleanup failed: inspect ${project}; private files remain at ${directory}`); process.exitCode = 1; }
  }
  if (cleaned) await rm(directory, { recursive: true, force: true });
}
