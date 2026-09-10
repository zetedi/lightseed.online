import { describe, it, expect } from 'vitest';
import { subscriptionIdOf, audienceOf, newsletterSendRefusal, normalizePlaceDomain, isSubscriberEmail, subscribedToPlace} from '../src/domain/newsletter';
import { DOMAIN_KEYS } from '../src/domain/words';
import { audienceOf as sAudienceOf, newsletterSendRefusal as sNewsletterSendRefusal, normalizePlaceDomain as sNormalizePlaceDomain } from '../functions/src/newsletter';

// The letter of a place (ring 2026-09-08): a subscription belongs to the place it was made at.
describe('subscriptionIdOf — one document per place and address', () => {
  it('is deterministic and normalised', () => {
    expect(subscriptionIdOf('theohouse.org', 'Ana@Example.org ')).toBe(subscriptionIdOf('https://www.theohouse.org/', 'ana@example.org'));
    expect(subscriptionIdOf('theohouse.org', 'ana@example.org')).not.toBe(subscriptionIdOf('lightseed.online', 'ana@example.org'));
  });
  it('encodes both halves so neither can forge the separator', () => {
    expect(subscriptionIdOf('a__b.org', 'x@y.z')).toBe('a__b.org__x%40y.z');
    expect(normalizePlaceDomain('https://WWW.Seed.Enlightenednations.org/path')).toBe('seed.enlightenednations.org');
    expect(isSubscriberEmail(' ana@example.org ')).toBe(true);
    expect(isSubscriberEmail('not an address')).toBe(false);
  });
});

describe('audienceOf — the active subscribers stamped with the place, once each', () => {
  const subs = [
    { email: 'a@x.org', active: true, domain: 'theohouse.org' },
    { email: 'A@x.org', active: true, domain: 'theohouse.org' },       // the same address, twice
    { email: 'b@x.org', active: false, domain: 'theohouse.org' },      // rested
    { email: 'c@x.org', active: true, domain: 'lightseed.online' },    // another place
    { email: 'd@x.org', active: true },                                // the unstamped legacy row
    { active: true, domain: 'theohouse.org' },                         // no address
  ];
  it('keeps the place\'s own, drops the rest', () => {
    expect(audienceOf(subs, 'theohouse.org').map(s => s.email)).toEqual(['a@x.org']);
    expect(audienceOf(subs, 'lightseed.online').map(s => s.email)).toEqual(['c@x.org']);
    expect(audienceOf(subs, 'perauset.web.app')).toEqual([]);
  });
});

describe('the functions mirror stays true', () => {
  it('audience, refusal and the place\'s spelling agree', () => {
    const subs = [{ email: 'a@x.org', active: true, domain: 'theohouse.org' }, { email: 'b@x.org', active: true, domain: 'lightseed.online' }, { email: 'c@x.org', active: false, domain: 'theohouse.org' }];
    expect(sAudienceOf(subs, 'theohouse.org')).toEqual(audienceOf(subs, 'theohouse.org'));
    for (const f of [{ isKeeper: true, isStaff: false, isNodePlace: false, audience: 1 }, { isKeeper: false, isStaff: true, isNodePlace: false, audience: 1 }, { isKeeper: false, isStaff: true, isNodePlace: true, audience: 0 }]) {
      expect(sNewsletterSendRefusal(f)).toBe(newsletterSendRefusal(f));
    }
    expect(sNormalizePlaceDomain('https://WWW.X.org/')).toBe(normalizePlaceDomain('https://WWW.X.org/'));
  });
});

describe('newsletterSendRefusal — keepers send their place\'s letter; staff the node\'s', () => {
  it('a keeper may; staff may for the node only; a stranger may not; an empty list refuses', () => {
    expect(newsletterSendRefusal({ isKeeper: true, isStaff: false, isNodePlace: false, audience: 3 })).toBeNull();
    expect(newsletterSendRefusal({ isKeeper: false, isStaff: true, isNodePlace: true, audience: 3 })).toBeNull();
    expect(newsletterSendRefusal({ isKeeper: false, isStaff: true, isNodePlace: false, audience: 3 })).toBe('newsletter_not_keeper');
    expect(newsletterSendRefusal({ isKeeper: false, isStaff: false, isNodePlace: true, audience: 3 })).toBe('newsletter_not_keeper');
    expect(newsletterSendRefusal({ isKeeper: true, isStaff: false, isNodePlace: false, audience: 0 })).toBe('newsletter_no_subscribers');
    for (const k of ['newsletter_not_keeper', 'newsletter_no_subscribers'] as const) expect(DOMAIN_KEYS).toContain(k);
  });
});

// ALREADY ON THE LIST (ring 2026-09-11): the footer must not ask for what a being already has.
describe('subscribedToPlace — the map speaks, the old boolean only for the node', () => {
  it('the map wins wherever it speaks', () => {
    expect(subscribedToPlace({ newsletterPlaces: { 'a.org': true } }, 'a.org', 'node.org')).toBe(true);
    expect(subscribedToPlace({ newsletterPlaces: { 'a.org': false }, newsletterSubscribed: true }, 'a.org', 'a.org')).toBe(false);
  });
  it('the legacy boolean answers for the node\'s own letter, and nowhere else', () => {
    expect(subscribedToPlace({ newsletterSubscribed: true }, 'node.org', 'node.org')).toBe(true);
    expect(subscribedToPlace({ newsletterSubscribed: true }, 'a.org', 'node.org')).toBe(false);
  });
  it('no records, no place, no claim', () => {
    expect(subscribedToPlace(null, 'a.org', 'node.org')).toBe(false);
    expect(subscribedToPlace({ newsletterPlaces: { 'a.org': true } }, '', 'node.org')).toBe(false);
    expect(subscribedToPlace({}, 'a.org', 'node.org')).toBe(false);
  });
  it('reads a place the way every other door does (case and www folded)', () => {
    expect(subscribedToPlace({ newsletterPlaces: { 'a.org': true } }, 'WWW.A.ORG', 'node.org')).toBe(true);
  });
});
