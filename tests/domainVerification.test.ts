import { describe, expect, it } from 'vitest';
import {
  DOMAIN_CHALLENGE_TTL_MS,
  challengeIsLive,
  challengeRecordName,
  challengeRecordValue,
  isDomainVerified,
  txtProvesChallenge,
} from '../src/domain/domainVerification';

const NOW = 1783382400000;

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
});
