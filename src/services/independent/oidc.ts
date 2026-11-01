import { InMemoryWebStorage, UserManager, WebStorageStateStore } from 'oidc-client-ts';
import type { SeedBrowserConfig } from '../../domain/seedBrowser';
import type { IdentityClient } from './session';

export function createSeedIdentity(config: SeedBrowserConfig): IdentityClient {
  if (window.location.origin !== config.appOrigin) throw new Error('unexpected_app_origin');
  const manager = new UserManager({
    authority: config.issuer, client_id: 'lightseed-web',
    redirect_uri: config.appOrigin + '/auth/callback', post_logout_redirect_uri: config.appOrigin + '/',
    response_type: 'code', scope: 'openid lightseed:api', loadUserInfo: false, disablePKCE: false,
    automaticSilentRenew: true, revokeTokensOnSignout: true,
    // Access/refresh tokens stay in this tab's memory; only pending PKCE/state crosses a redirect.
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
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
