import type { DomainKey } from './words';

// THE LETTER OF A PLACE (ring 2026-09-08). Until now the node had one letter and one list: a
// signup on any face joined "the lightseed newsletter", and only staff could send — to
// everyone. Now every place (a community that hosts a domain) has its own letter: a
// subscription is stamped with the place it was made at, a keeper of the place sends to that
// place's subscribers and no one else's, and the node's own letter is the node community's,
// sent by its staff. A member link is a relationship, not consent to mail: the audience is
// those who SUBSCRIBED at the place, at the footer or in their profile — never the member list.
//
// Plain contract — guaranteed: subscriptionIdOf is deterministic in (place, email) so one
// address subscribes once per place and unsubscribing finds the same document; audienceOf
// returns exactly the active subscriptions stamped with the place; newsletterSendRefusal
// names why a hand may not send, or null. Not guaranteed: who is a keeper — the server proves
// that from the community and its links (functions/sendNewsletterEmails) and hands the fact in.

export const normalizePlaceDomain = (domain: string): string =>
  domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

export const normalizeSubscriberEmail = (email: string): string => email.trim().toLowerCase();

export const isSubscriberEmail = (email: string): boolean => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizeSubscriberEmail(email));

// One document per (place, address): <place>__<address>, each URI-encoded so neither can forge a separator.
export const subscriptionIdOf = (place: string, email: string): string =>
  `${encodeURIComponent(normalizePlaceDomain(place))}__${encodeURIComponent(normalizeSubscriberEmail(email))}`;

export interface SubscriptionLike { email?: unknown; active?: unknown; domain?: unknown }

// The audience of a place's letter: active subscriptions stamped with that place, one per address.
export const audienceOf = <T extends SubscriptionLike>(subscriptions: readonly T[], place: string): T[] => {
  const home = normalizePlaceDomain(place);
  const seen = new Set<string>();
  return subscriptions.filter((s) => {
    if (s.active !== true || typeof s.email !== 'string' || typeof s.domain !== 'string') return false;
    if (normalizePlaceDomain(s.domain) !== home) return false;
    const key = normalizeSubscriberEmail(s.email);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Who may send a place's letter: its keepers (the founding ownerId or a keeper link — the
// server's fact), and the node's staff for the node's own place only.
export const newsletterSendRefusal = (f: { isKeeper: boolean; isStaff: boolean; isNodePlace: boolean; audience: number }): DomainKey | null => {
  if (!f.isKeeper && !(f.isStaff && f.isNodePlace)) return 'newsletter_not_keeper';
  if (f.audience === 0) return 'newsletter_no_subscribers';
  return null;
};
