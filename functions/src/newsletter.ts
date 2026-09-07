// THE LETTER OF A PLACE, server side — the pure half. Functions is its own TS project and
// cannot import src/domain, so this module MIRRORS src/domain/newsletter.ts; the root test
// suite (tests/newsletter.test.ts) imports both and holds them equal.
export const normalizePlaceDomain = (domain: string): string =>
    domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

export const normalizeSubscriberEmail = (email: string): string => email.trim().toLowerCase();

export interface SubscriptionLike { email?: unknown; active?: unknown; domain?: unknown }

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

export const newsletterSendRefusal = (f: { isKeeper: boolean; isStaff: boolean; isNodePlace: boolean; audience: number }): string | null => {
    if (!f.isKeeper && !(f.isStaff && f.isNodePlace)) return 'newsletter_not_keeper';
    if (f.audience === 0) return 'newsletter_no_subscribers';
    return null;
};
