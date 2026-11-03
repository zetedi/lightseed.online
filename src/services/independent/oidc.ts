import { UserManager, WebStorageStateStore, type UserManagerSettings } from 'oidc-client-ts';
import type { SeedBrowserConfig } from '../../domain/seedBrowser';
import { ISSUER_CLIENT_ID, issuerSigninArgs, issuerRegistrationEndpoint, issuerResetUrl, type IssuerDoor } from '../../domain/issuerDoors';
import type { IdentityClient } from './session';

export function createSeedIdentity(config: SeedBrowserConfig): IdentityClient {
  if (window.location.origin !== config.appOrigin) throw new Error('unexpected_app_origin');
  const settings: UserManagerSettings = {
    authority: config.issuer, client_id: ISSUER_CLIENT_ID,
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
  };
  const manager = new UserManager(settings);
  // THE ISSUER'S DOORS (ring 2026-11-03): every door is the same signed request (domain/issuerDoors
  // shapes the hint, the provider and the action); registration is the realm's endpoint beside the
  // authorization one, reached by a second manager that shares this one's state store, so the one
  // callback completes either door; the forgotten password is the realm's own page.
  const open = (door?: IssuerDoor) => ({ nonce: crypto.randomUUID(), ...issuerSigninArgs(door) });
  return {
    current: () => manager.getUser(),
    callback: url => manager.signinRedirectCallback(url),
    login: door => manager.signinRedirect(open(door)),
    async register(door) {
      const metadata = await manager.metadataService.getMetadata();
      const registrar = new UserManager({ ...settings, metadata: { ...metadata, authorization_endpoint: issuerRegistrationEndpoint(config.issuer) } });
      await registrar.signinRedirect(open(door));
    },
    async reset() { window.location.assign(issuerResetUrl(config.issuer, ISSUER_CLIENT_ID)); },
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
