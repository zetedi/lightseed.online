// THE ISSUER'S DOORS (ring 2026-11-03): the five provider hands of the origin (a Google pop-up, an
// email-and-password sign-in and sign-up, a verification mail, a password reset) exist on the
// independent node as the REALM's own doors, reached by a redirect — the shell never carries a
// password, never sends a mail, never decides an identity: the issuer does, and the node's API
// then chooses the uid by its bindings. This law shapes the redirect: the hint the realm may
// prefill (an email or username), the identity provider it may jump to (Keycloak's `kc_idp_hint`),
// the required action a signed-in person asks for (`kc_action`: verify the email, update the
// password or the profile), the registration endpoint beside the authorization one, and the
// realm's own forgotten-password door. A value that is not a hint, a provider name or a known
// action is left out of the door, never sent.
export const ISSUER_CLIENT_ID = 'lightseed-web';
export const ISSUER_ACTIONS = ['VERIFY_EMAIL', 'UPDATE_PASSWORD', 'UPDATE_PROFILE'] as const;
export type IssuerAction = typeof ISSUER_ACTIONS[number];
export interface IssuerDoor {
  hint?: string;        // login_hint: an email or username the realm may prefill
  provider?: string;    // kc_idp_hint: an identity provider configured at the realm (e.g. 'google')
  action?: IssuerAction; // kc_action: a required action a signed-in person asks for
}
export interface IssuerSigninArgs { login_hint?: string; extraQueryParams: Record<string, string> }

const HINT_MAX = 254;
const hintOf = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const hint = value.trim();
  return hint.length > 0 && hint.length <= HINT_MAX && !/[\s\u0000-\u001f\u007f]/.test(hint) ? hint : null;
};
const providerOf = (value: unknown): string | null => (typeof value === 'string' && /^[a-z][a-z0-9-]{0,30}$/.test(value) ? value : null);
const actionOf = (value: unknown): IssuerAction | null => (ISSUER_ACTIONS as readonly string[]).includes(String(value)) ? value as IssuerAction : null;

export const issuerSigninArgs = (door: IssuerDoor = {}): IssuerSigninArgs => {
  const hint = hintOf(door.hint), provider = providerOf(door.provider), action = actionOf(door.action);
  return {
    ...(hint ? { login_hint: hint } : {}),
    extraQueryParams: { ...(provider ? { kc_idp_hint: provider } : {}), ...(action ? { kc_action: action } : {}) },
  };
};

const base = (issuer: string): string => issuer.replace(/\/+$/, '');
// Keycloak's registration endpoint stands beside the authorization endpoint and takes the same request.
export const issuerRegistrationEndpoint = (issuer: string): string => `${base(issuer)}/protocol/openid-connect/registrations`;
// The realm's forgotten-password door, reached without a session; the realm asks for the username itself.
export const issuerResetUrl = (issuer: string, clientId: string = ISSUER_CLIENT_ID): string =>
  `${base(issuer)}/login-actions/reset-credentials?client_id=${encodeURIComponent(clientId)}`;
