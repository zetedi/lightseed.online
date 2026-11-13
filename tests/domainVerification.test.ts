import { describe, expect, it } from 'vitest';
import {
  DOMAIN_CHALLENGE_TTL_MS,
  challengeHostLabel,
  challengeIsLive,
  challengeRecordName,
  challengeZone,
  challengeRecordValue,
  isDomainVerified,
  txtProvesChallenge,
  hostWearingOf,
  wearsHost,
} from '../src/domain/domainVerification';

const NOW = 1783382400000;

describe('the host label is relative to the ZONE the dashboard appends (ring 2026-09-07)', () => {
  it('an apex community keeps the bare label', () => {
    expect(challengeZone('theohouse.org')).toBe('theohouse.org');
    expect(challengeHostLabel('theohouse.org')).toBe('_lightseed-challenge');
    expect(challengeHostLabel('https://www.Theohouse.org/')).toBe('_lightseed-challenge');
  });
  it('a subdomain community carries its sub-labels — the bare label would land at the apex', () => {
    expect(challengeZone('seed.enlightenednations.org')).toBe('enlightenednations.org');
    expect(challengeHostLabel('seed.enlightenednations.org')).toBe('_lightseed-challenge.seed');
    expect(challengeHostLabel('a.b.example.com')).toBe('_lightseed-challenge.a.b');
    expect(challengeRecordName('seed.enlightenednations.org')).toBe('_lightseed-challenge.seed.enlightenednations.org');
  });
  it('knows the common two-part public suffixes', () => {
    expect(challengeZone('example.co.uk')).toBe('example.co.uk');
    expect(challengeHostLabel('example.co.uk')).toBe('_lightseed-challenge');
    expect(challengeHostLabel('seed.example.co.uk')).toBe('_lightseed-challenge.seed');
  });
});

describe('domain verification — proof of control, nothing more', () => {
  it('names the challenge in the underscored namespace on the normalized domain', () => {
    expect(challengeRecordName('example.org')).toBe('_lightseed-challenge.example.org');
    expect(challengeRecordName('https://WWW.Example.org/path')).toBe('_lightseed-challenge.example.org');
  });

  it('speaks the exact record value', () => {
    expect(challengeRecordValue('abc123')).toBe('lightseed-verification=v1:abc123');
  });

  it('accepts the record whole or chunked, and nothing else', () => {
    const token = 'f'.repeat(32);
    const value = challengeRecordValue(token);
    expect(txtProvesChallenge([[value]], token)).toBe(true);
    expect(txtProvesChallenge([[value.slice(0, 10), value.slice(10)]], token)).toBe(true);
    expect(txtProvesChallenge([['v=spf1 -all'], [value]], token)).toBe(true);
    expect(txtProvesChallenge([['v=spf1 -all']], token)).toBe(false);
    expect(txtProvesChallenge([[challengeRecordValue('other')]], token)).toBe(false);
    expect(txtProvesChallenge([], token)).toBe(false);
  });

  it('a challenge lives unused within its week, and not a moment longer', () => {
    expect(challengeIsLive({ usedAtMs: null, createdAtMs: NOW }, NOW)).toBe(true);
    expect(challengeIsLive({ usedAtMs: null, createdAtMs: NOW - DOMAIN_CHALLENGE_TTL_MS + 1 }, NOW)).toBe(true);
    expect(challengeIsLive({ usedAtMs: null, createdAtMs: NOW - DOMAIN_CHALLENGE_TTL_MS }, NOW)).toBe(false);
    expect(challengeIsLive({ usedAtMs: NOW - 5, createdAtMs: NOW - 10 }, NOW)).toBe(false);
  });

  it('the badge speaks only while the canonical domain still equals the proven one', () => {
    expect(isDomainVerified({ domain: 'example.org', domainVerification: { domain: 'example.org' } })).toBe(true);
    expect(isDomainVerified({ domain: 'https://WWW.example.org/x', domainVerification: { domain: 'example.org' } })).toBe(true);
    expect(isDomainVerified({ domain: 'moved.org', domainVerification: { domain: 'example.org' } })).toBe(false);
    expect(isDomainVerified({ domain: 'example.org', domainVerification: null })).toBe(false);
    expect(isDomainVerified({ domain: 'example.org' })).toBe(false);
  });

  it('a host is worn by a proven domain or a granted alias — a bare claim wears nothing', () => {
    const proven = { domain: 'example.org', domainVerification: { domain: 'example.org' } };
    const granted = { domain: 'elsewhere.org', domainAliases: ['Example.ORG', 'face.web.app'] };
    const claim = { domain: 'example.org' };
    expect(hostWearingOf(proven, 'example.org')).toBe('domain');
    expect(hostWearingOf(proven, 'https://www.example.org/')).toBe('domain');
    expect(hostWearingOf(granted, 'example.org')).toBe('alias');
    expect(hostWearingOf(granted, 'face.web.app')).toBe('alias');
    expect(hostWearingOf(claim, 'example.org')).toBeNull();
    expect(hostWearingOf({ domain: 'moved.org', domainVerification: { domain: 'example.org' } }, 'example.org')).toBeNull(); // the proof binds the domain it proved
    expect(hostWearingOf(proven, 'other.org')).toBeNull();
    expect(hostWearingOf(proven, '')).toBeNull();
    expect(wearsHost(proven, 'example.org')).toBe(true);
    expect(wearsHost(claim, 'example.org')).toBe(false);
  });
});
