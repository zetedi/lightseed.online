// THE SSO DOOR (ring 2026-09-02) — the hybrid shape's second invisible door. A mother
// site (theohouse.org) and its seed face (seed.theohouse.org) are the SAME SITE to a
// browser but different ORIGINS to Firebase Auth: signing in at the seed tells the apex
// nothing. The door closes that gap: the mother page iframes /sso.html (built from
// src/sso.ts), which stands — unpartitioned, because same-site — inside the seed's own
// session, answers who is home, and can ask the mintSsoToken callable for a custom
// token so the mother page signs in as the same person. One sign-in, two hearths.
//
// This module is the door's LAW, pure and tested: which parents may speak to it, and
// the message names both sides pin. The mother half lives in the mother site's own
// repo and hand-copies the names — they are PROTOCOL, not identity, and never change
// meaning (the embed.js lesson: lifeseed-refresh outlived the rename).
//
// Plain contract — guaranteed now: ssoParentOrigins answers ONLY the face's own apex
// and its www, derived from the door's hostname (a derivation, not a registry — no
// list to forget when the thirteenth face arrives), and answers nothing for an apex
// or single-label host, so the door cannot open on lightseed.online itself. HTTPS
// only. Not guaranteed: sibling subdomains (blog.theohouse.org is a stranger), any
// multi-label registrable-domain awareness (a face at seed.example.co.uk would offer
// example.co.uk AND www — correct — but a face at deep.a.example.org offers
// a.example.org, its immediate parent, which is the shape faces actually take).

// The message names of the door's protocol. Both halves pin these; the mother half
// copies the values verbatim (see theohouse.org src/sso.ts).
export const SSO_DOOR = {
  /** parent → door: name yourself; the door adopts an allowed greeter as ITS parent. */
  hello: 'lifeseed-sso-hello',
  /** door → parent: { type, user: { uid, name } | null } — on hello and every change. */
  state: 'lifeseed-sso-state',
  /** parent → door: ask the seed to mint a custom token for the signed-in person. */
  mint: 'lifeseed-sso-mint',
  /** door → parent: { type, token: string | null } — null when the mint could not answer. */
  token: 'lifeseed-sso-token',
  /** parent → door: sign the seed out (the seed is the source of truth; state follows). */
  signout: 'lifeseed-sso-signout',
} as const;

// The origins allowed to stand as this door's parent: the face's own mother site —
// its apex and the www of that apex — derived from the hostname serving the door.
// A host without a subdomain (the node's own apex, localhost) has no mother: [].
export const ssoParentOrigins = (hostname: string): string[] => {
  const labels = hostname.split('.');
  if (labels.length < 3 || labels.some((l) => !l)) return [];
  const apex = labels.slice(1).join('.');
  return [`https://${apex}`, `https://www.${apex}`];
};

// THE SIGN-IN ASK. Identity lives in one place — the seed — so a mother site's own "sign
// in" door (theohouse.org's header) is nothing but a link here with this parameter: the
// seed opens its sign-in dialog for a visitor it does not know, and consumes the ask from
// the address so a copied URL is a door, not a demand. Like the message names, the
// parameter is protocol: the mother site's markup hand-copies `?signin`, never renamed.
export const SSO_SIGN_IN_PARAM = 'signin';

// Whether a query string carries the ask ('?signin', '?signin=1', '?tree=x&signin').
export const asksSignIn = (search: string): boolean =>
  new URLSearchParams(search).has(SSO_SIGN_IN_PARAM);

// The same query string with the ask consumed: '' when nothing else remains, so the
// address can be rewritten without a dangling '?'.
export const withoutSignInAsk = (search: string): string => {
  const params = new URLSearchParams(search);
  params.delete(SSO_SIGN_IN_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
};
