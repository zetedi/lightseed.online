import { describe, it, expect } from 'vitest';
import { SSO_DOOR, SSO_SIGN_IN_PARAM, asksSignIn, ssoParentOrigins, withoutSignInAsk } from '../src/domain/ssoDoor';

// The SSO door's law: who may stand as a parent, and the names both halves speak.
// The mother half (theohouse.org src/sso.ts) hand-copies the message names, so the
// protocol test here is the one hand that notices a drift.

describe('the parents a face offers its door to', () => {
  it('a face offers exactly its apex and the www of that apex', () => {
    expect(ssoParentOrigins('seed.theohouse.org')).toEqual([
      'https://theohouse.org',
      'https://www.theohouse.org',
    ]);
  });

  it('a deeper face offers its immediate parent, not the far apex', () => {
    expect(ssoParentOrigins('deep.a.example.org')).toEqual([
      'https://a.example.org',
      'https://www.a.example.org',
    ]);
  });

  it('never a sibling subdomain: the offered parents exclude blog.theohouse.org', () => {
    expect(ssoParentOrigins('seed.theohouse.org')).not.toContain('https://blog.theohouse.org');
  });

  it('an apex host has no mother: the door stays closed on the node itself', () => {
    expect(ssoParentOrigins('lightseed.online')).toEqual([]);
    expect(ssoParentOrigins('theohouse.org')).toEqual([]);
  });

  it('a single label has no mother either (localhost, bare names)', () => {
    expect(ssoParentOrigins('localhost')).toEqual([]);
  });

  it('an empty label opens nothing (no "https://.." parents from ".." tricks)', () => {
    expect(ssoParentOrigins('seed..org')).toEqual([]);
    expect(ssoParentOrigins('.theohouse.org')).toEqual([]);
    expect(ssoParentOrigins('')).toEqual([]);
  });

  it('offers only https origins', () => {
    for (const origin of ssoParentOrigins('seed.theohouse.org')) {
      expect(origin.startsWith('https://')).toBe(true);
    }
  });
});

describe('the protocol names are pinned: the mother half copies these verbatim', () => {
  it('speaks the five fixed names', () => {
    expect(SSO_DOOR).toEqual({
      hello: 'lifeseed-sso-hello',
      state: 'lifeseed-sso-state',
      mint: 'lifeseed-sso-mint',
      token: 'lifeseed-sso-token',
      signout: 'lifeseed-sso-signout',
    });
  });
});

describe('the sign-in ask: a mother site links to the seed with ?signin', () => {
  it('the parameter name is pinned: the mother markup copies it verbatim', () => {
    expect(SSO_SIGN_IN_PARAM).toBe('signin');
  });

  it('hears the ask bare, valued, or among other params', () => {
    expect(asksSignIn('?signin')).toBe(true);
    expect(asksSignIn('?signin=1')).toBe(true);
    expect(asksSignIn('?tree=abc&signin')).toBe(true);
  });

  it('hears nothing in a plain address or a look-alike', () => {
    expect(asksSignIn('')).toBe(false);
    expect(asksSignIn('?tree=abc')).toBe(false);
    expect(asksSignIn('?signing=1')).toBe(false);
  });

  it('consumes the ask and keeps the rest of the address', () => {
    expect(withoutSignInAsk('?signin')).toBe('');
    expect(withoutSignInAsk('?tree=abc&signin')).toBe('?tree=abc');
    expect(withoutSignInAsk('?signin=1&invite=xyz')).toBe('?invite=xyz');
  });

  it('leaves an address without the ask as it was', () => {
    expect(withoutSignInAsk('')).toBe('');
    expect(withoutSignInAsk('?tree=abc')).toBe('?tree=abc');
  });
});
