import { UserManager, WebStorageStateStore } from 'oidc-client-ts';
import type { SeedBrowserConfig } from '../../domain/seedBrowser';
import type { IdentityClient } from './session';

export function createSeedIdentity(config: SeedBrowserConfig): IdentityClient {
  if (window.location.origin !== config.appOrigin) throw new Error('unexpected_app_origin');
  const manager = new UserManager({
    authority: config.issuer, client_id: 'lightseed-web',
    redirect_uri: config.appOrigin + '/auth/callback', post_logout_redirect_uri: config.appOrigin + '/',
    response_type: 'code', scope: 'openid lightseed:api', loadUserInfo: false, disablePKCE: false,
    automaticSilentRenew: true, revokeTokensOnSignout: true,
    // THE SESSION SURVIVES A RELOAD (ring 2026-11-02): the tokens rest in THIS TAB's own session
    // storage — never shared with another tab, gone when the tab closes, the browser OIDC client's
    // standard seat — so a reload re-reads the hand it had instead of forgetting it. An expired
    // access token is renewed silently from the refresh token; a dead refresh token signs out.
    userStore: new WebStorageStateStore({ store: window.sessionStorage, prefix: 'seed.oidc.user.' }),
    stateStore: new WebStorageStateStore({ store: window.sessionStorage, prefix: 'seed.oidc.' }),
    monitorSession: false, staleStateAgeInSeconds: 600,
  });
  return {
    current: () => manager.getUser(),
    callback: url => manager.signinRedirectCallback(url),
    login: () => manager.signinRedirect({ nonce: crypto.randomUUID() }),
    logout: async () => { manager.stopSilentRenew(); await manager.signoutRedirect(); },
    clear: () => manager.removeUser(),
    changes(callback) {
      const cleared = () => callback(null);
      const removers = [manager.events.addUserLoaded(callback), manager.events.addUserUnloaded(cleared),
        manager.events.addAccessTokenExpired(cleared), manager.events.addSilentRenewError(cleared),
        manager.events.addUserSignedOut(cleared)];
      return () => removers.forEach(remove => remove());
    },
  };
}
