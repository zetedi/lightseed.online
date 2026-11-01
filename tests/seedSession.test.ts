import { describe, expect, it, vi } from 'vitest';
import { seedBrowserConfig, seedSessionIdentity } from '../src/domain/seedBrowser';
import { createSeedSession, type IdentityClient, type LoginToken } from '../src/services/independent/session';

const user = { access_token: 'test-access-token', expired: false };
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
function setup(fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ uid: 'local-alice' }))) {
  let change: (user: LoginToken | null) => void = () => {};
  const identity: IdentityClient = {
    current: vi.fn().mockResolvedValue(user), callback: vi.fn().mockResolvedValue(user),
    login: vi.fn().mockResolvedValue(undefined), logout: vi.fn().mockResolvedValue(undefined), clear: vi.fn().mockResolvedValue(undefined),
    changes: cb => { change = cb; return () => {}; },
  };
  const session = createSeedSession(identity, fetcher);
  return { session, identity, fetcher, change: (u: LoginToken | null) => change(u) };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('independent media uploads', () => {
  it('sends binary images only to the fixed local endpoint with session authorization', async () => {
    const { session, fetcher } = setup(); await session.start();
    const bytes = new Blob(['image bytes'], { type: 'image/png' });
    fetcher.mockResolvedValueOnce(Response.json({ path: 'users/local-alice/photo.png' }));
    await session.uploadMedia('users/local-alice/photo.png', bytes);
    expect(fetcher).toHaveBeenLastCalledWith('/v1/media/upload', expect.objectContaining({
      method: 'POST', body: bytes, credentials: 'omit', redirect: 'error', cache: 'no-store',
      headers: { Authorization: 'Bearer test-access-token', 'Content-Type': 'image/png', 'X-Lightseed-Media-Path': 'users/local-alice/photo.png' },
    }));
    const count = fetcher.mock.calls.length;
    for (const path of ['https://evil.test/photo.png', 'users/../photo.png', 'thumbs/users/photo.png']) {
      await expect(session.uploadMedia(path, bytes)).rejects.toThrow('invalid_media');
    }
    await expect(session.uploadMedia('users/alice/photo.png', new Blob(['<svg/>'], { type: 'image/svg+xml' }))).rejects.toThrow('invalid_media');
    await expect(session.uploadMedia('users/alice/photo.png', new Blob([], { type: 'image/png' }))).rejects.toThrow('invalid_media');
    expect(fetcher).toHaveBeenCalledTimes(count);
    await session.logout();
    await expect(session.uploadMedia('users/alice/photo.png', bytes)).rejects.toThrow('authentication_required');
  });
  it('discards upload responses after account changes and clears rejected sessions', async () => {
    const { session, fetcher } = setup(); await session.start();
    const bytes = new Blob(['image'], { type: 'image/png' });
    const answer = deferred<Response>(); fetcher.mockReturnValueOnce(answer.promise);
    const upload = session.uploadMedia('users/alice/photo.png', bytes);
    await session.logout(); answer.resolve(Response.json({ path: 'users/alice/photo.png' }));
    await expect(upload).rejects.toThrow('session_changed');
    const next = setup(); await next.session.start();
    next.fetcher.mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(next.session.uploadMedia('users/alice/photo.png', bytes)).rejects.toThrow('authentication_required');
    expect(next.session.snapshot()).toEqual({ status: 'anonymous' });
  });
});

describe('independent browser session', () => {
  it('uses only the API-confirmed identity and keeps tokens out of snapshots', async () => {
    const { session, fetcher } = setup();
    await session.start();
    expect(session.snapshot()).toEqual({ status: 'authenticated', uid: 'local-alice' });
    expect(fetcher).toHaveBeenCalledWith('/v1/me', expect.objectContaining({
      headers: { Authorization: 'Bearer test-access-token' }, credentials: 'omit', redirect: 'error', cache: 'no-store',
    }));
  });
  it('redeems a callback once across concurrent initialization', async () => {
    const { session, identity } = setup();
    await Promise.all([session.start('https://app.example/auth/callback?code=one'), session.start('https://app.example/auth/callback?code=one')]);
    expect(identity.callback).toHaveBeenCalledTimes(1);
    expect(identity.current).not.toHaveBeenCalled();
  });
  it('does not send an expired token, and rejects malformed or unbound local identity', async () => {
    const first = setup(); vi.mocked(first.identity.current).mockResolvedValue({ ...user, expired: true });
    await first.session.start(); expect(first.session.snapshot()).toEqual({ status: 'anonymous' }); expect(first.fetcher).not.toHaveBeenCalled();
    for (const response of [Response.json({ uid: '' }), Response.json({ sub: 'alice' }), new Response('', { status: 401 })]) {
      const { session } = setup(vi.fn<typeof fetch>().mockResolvedValue(response));
      await session.start(); expect(session.snapshot()).toEqual({ status: 'error' });
    }
  });
  it('discards a slow identity answer after sign-out and ignores late provider renewal', async () => {
    const answer = deferred<Response>(); const { session, change } = setup(vi.fn<typeof fetch>().mockReturnValue(answer.promise));
    const pending = session.start(); await settle();
    await session.logout(); change(user); answer.resolve(Response.json({ uid: 'alice' })); await pending;
    expect(session.snapshot()).toEqual({ status: 'anonymous' });
    await expect(session.read('/v1/me/secret-links')).rejects.toThrow('authentication_required');
  });
  it('ignores an old token renewal while redirecting to a new login', async () => {
    const { session, change } = setup(); await session.start(); await session.login();
    change({ access_token: 'old-account-renewal' }); await settle();
    expect(session.snapshot()).toEqual({ status: 'loading' });
    await expect(session.read('/v1/me/secret-links')).rejects.toThrow('authentication_required');
  });
  it('does not let an old account overwrite a new account', async () => {
    const answer = deferred<Response>(); const f = vi.fn<typeof fetch>().mockReturnValueOnce(answer.promise).mockResolvedValueOnce(Response.json({ uid: 'bob' }));
    const { session, change } = setup(f); const pending = session.start(); await settle();
    change({ access_token: 'bob-token' }); await settle(); answer.resolve(Response.json({ uid: 'alice' })); await pending;
    expect(session.snapshot()).toEqual({ status: 'authenticated', uid: 'bob' });
  });
  it('refuses external token destinations, clears rejected sessions and ignores late private responses', async () => {
    const { session, fetcher } = setup(); await session.start();
    for (const path of ['https://evil.test/v1/me', '//evil.test/v1/me', '/v1/../other', '/other']) await expect(session.read(path)).rejects.toThrow('invalid_api_path');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const answer = deferred<Response>(); fetcher.mockReturnValueOnce(answer.promise);
    const reading = session.read('/v1/me/secret-links'); await session.logout(); answer.resolve(Response.json({ links: ['private'] }));
    await expect(reading).rejects.toThrow('session_changed');
    const second = setup(); await second.session.start(); second.fetcher.mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(second.session.read('/v1/me/secret-links')).rejects.toThrow('authentication_required');
    expect(second.session.snapshot()).toEqual({ status: 'anonymous' });
  });
  it('writes only the display name through the authenticated profile endpoint', async () => {
    const { session, fetcher } = setup(); await session.start();
    fetcher.mockResolvedValueOnce(Response.json({ profile: { uid: 'local-alice', displayName: 'Willow' } }));
    await session.saveProfile('Willow');
    expect(fetcher).toHaveBeenLastCalledWith('/v1/me/profile', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ displayName: 'Willow' }),
      headers: { Authorization: 'Bearer test-access-token', 'Content-Type': 'application/json' }, redirect: 'error',
    }));
  });
  it('saves appearance picture references with the current session and no caller identity field', async () => {
    const {session,fetcher}=setup();await session.start();
    fetcher.mockResolvedValueOnce(Response.json({profile:{siteLogoUrl:'/v1/media?path=users/alice/logo.png'}}));
    await session.profilePicture('siteLogoUrl','users/alice/logo.png');
    expect(fetcher).toHaveBeenLastCalledWith('/v1/me/profile',expect.objectContaining({
      method:'POST',body:JSON.stringify({action:'set_picture',slot:'siteLogoUrl',path:'users/alice/logo.png'}),
      headers:{Authorization:'Bearer test-access-token','Content-Type':'application/json'},
    }));
    const count=fetcher.mock.calls.length;
    await expect(session.profilePicture('siteHeroUrl','https://external.test/image.png')).rejects.toThrow('invalid_profile');
    expect(fetcher).toHaveBeenCalledTimes(count);
  });
  it('expires locally on renewal failure and clears tokens if remote sign-out fails', async () => {
    const { session, identity, change } = setup(); await session.start(); change(null); await settle();
    expect(session.snapshot()).toEqual({ status: 'anonymous' });
    vi.mocked(identity.logout).mockRejectedValue(new Error('offline')); await session.logout();
    expect(identity.clear).toHaveBeenCalledOnce(); expect(session.snapshot()).toEqual({ status: 'error' });
  });
  it('fails closed for callback validation errors', async () => {
    const { session, identity, fetcher } = setup(); vi.mocked(identity.callback).mockRejectedValue(new Error('state_mismatch'));
    await session.start('https://app.example/auth/callback?state=wrong');
    expect(session.snapshot()).toEqual({ status: 'error' }); expect(fetcher).not.toHaveBeenCalled();
  });
});
describe('independent browser configuration', () => {
  it('requires exact HTTPS origins and a fixed issuer', () => {
    expect(seedBrowserConfig({ appOrigin: 'https://app.example', issuer: 'https://identity.example/realms/lightseed' })).toMatchObject({ appOrigin: 'https://app.example' });
    for (const appOrigin of ['http://app.example', 'https://app.example/', 'https://user@app.example', 'https://app.example/path']) expect(() => seedBrowserConfig({ appOrigin, issuer: 'https://identity.example/realms/lightseed' })).toThrow();
    for (const issuer of ['http://identity.example', 'https://identity.example/realm?x=1', 'https://identity.example/realm#x', 'https://a@identity.example/realm']) expect(() => seedBrowserConfig({ appOrigin: 'https://app.example', issuer })).toThrow();
    expect(seedSessionIdentity({ uid: 'a\nb' })).toBeNull();
  });
});

describe('independent community writes from the browser', () => {
  it('sends supported graph commands without allowing role or provenance grants',async()=>{
    const {session,fetcher}=setup();await session.start();
    fetcher.mockResolvedValueOnce(Response.json({linked:true}));
    const command={action:'link',from:'alice',rel:'guardian',to:'tree'};
    await session.linkCommand(command);
    expect(fetcher).toHaveBeenLastCalledWith('/v1/links/command',expect.objectContaining({method:'POST',body:JSON.stringify(command)}));
    const count=fetcher.mock.calls.length;
    await expect(session.linkCommand({...command,rel:'keeper'})).rejects.toThrow('invalid_command');
    expect(fetcher).toHaveBeenCalledTimes(count);
  });
  it('uses session authorization and rejects caller-supplied authority before sending', async () => {
    const { session, fetcher } = setup(); await session.start();
    fetcher.mockResolvedValueOnce(Response.json({ joined: true }));
    await session.communityCommand({ action: 'join', id: 'garden' });
    expect(fetcher).toHaveBeenLastCalledWith('/v1/communities/command', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ action: 'join', id: 'garden' }),
      headers: { Authorization: 'Bearer test-access-token', 'Content-Type': 'application/json' },
    }));
    const count = fetcher.mock.calls.length;
    await expect(session.communityCommand({ action: 'join', id: 'garden', member: 'other' })).rejects.toThrow('invalid_command');
    expect(fetcher).toHaveBeenCalledTimes(count);
    await session.logout();
    await expect(session.communityCommand({ action: 'join', id: 'garden' })).rejects.toThrow('authentication_required');
  });
});
