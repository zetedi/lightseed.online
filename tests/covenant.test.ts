import { describe, it, expect } from 'vitest';
import {
  COVENANT_DOMAIN, covenantIdentity, isQuorumMet, covenantSealed,
  signatureBindsToIdentity, alignmentCovenantId,
  type Covenant, type CovenantParty,
} from '../src/domain/covenant';
import { canonicalize } from '../src/domain/chain/canonical';
import { signingPreimage } from '../src/domain/signing';

// The pure covenant crystal: the canonical IDENTITY every party signs (deterministic, party-order
// independent, role-normalised), the signing domain tag, and the quorum/seal logic. No crypto here.

const base: Pick<Covenant, 'lid' | 'kind' | 'title' | 'body' | 'quorum' | 'genesisHash'> = {
  lid: '018f-cov-lid',
  kind: 'covenant',
  title: 'We tend the grove together',
  body: 'Each of us waters when we can, and marks the truth of it.',
  quorum: 3,
  genesisHash: 'g0-abc',
};

describe('COVENANT_DOMAIN', () => {
  it('is a versioned, dedicated tag — never the raw signing version', () => {
    expect(COVENANT_DOMAIN).toBe('lifeseed.covenant.v1');
  });
  it('separates a covenant signature from any other purpose (a Council decision cannot replay it)', () => {
    const payload = { any: 'value' };
    expect(signingPreimage(COVENANT_DOMAIN, payload)).not.toBe(signingPreimage('lifeseed.council.v1', payload));
  });
});

describe('covenantIdentity — the frozen essence a party signs', () => {
  it('carries exactly lid/kind/title/body/quorum/genesisHash + normalised, sorted parties', () => {
    const parties: CovenantParty[] = [{ uid: 'carol', role: 'witness' }, { uid: 'alice', role: 'initiator' }];
    const id = covenantIdentity(base, parties);
    expect(id).toEqual({
      lid: base.lid, kind: 'covenant', title: base.title, body: base.body,
      quorum: 3, genesisHash: 'g0-abc',
      parties: [{ uid: 'alice', role: 'initiator' }, { uid: 'carol', role: 'witness' }],
    });
  });

  it('is INDEPENDENT of the order the parties were minted (sorted by uid → same bytes)', () => {
    const a = covenantIdentity(base, [{ uid: 'bob' }, { uid: 'alice' }, { uid: 'carol' }]);
    const b = covenantIdentity(base, [{ uid: 'carol' }, { uid: 'alice' }, { uid: 'bob' }]);
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it('normalises an absent role to "" so a party slot is deterministic', () => {
    const withUndef = covenantIdentity(base, [{ uid: 'alice' }]);
    const withEmpty = covenantIdentity(base, [{ uid: 'alice', role: '' }]);
    expect(canonicalize(withUndef)).toBe(canonicalize(withEmpty));
    expect(withUndef.parties[0]).toEqual({ uid: 'alice', role: '' });
  });

  it('changes bytes when ANY frozen field changes — the signature would no longer verify', () => {
    const parties: CovenantParty[] = [{ uid: 'alice' }, { uid: 'bob' }];
    const original = canonicalize(covenantIdentity(base, parties));
    expect(canonicalize(covenantIdentity({ ...base, title: 'changed' }, parties))).not.toBe(original);
    expect(canonicalize(covenantIdentity({ ...base, quorum: 2 }, parties))).not.toBe(original);
    expect(canonicalize(covenantIdentity({ ...base, genesisHash: 'other' }, parties))).not.toBe(original);
    // Adding or removing a party changes the identity too (the roster is signed).
    expect(canonicalize(covenantIdentity(base, [{ uid: 'alice' }, { uid: 'bob' }, { uid: 'carol' }]))).not.toBe(original);
    expect(canonicalize(covenantIdentity(base, [{ uid: 'alice' }]))).not.toBe(original);
    // A party's ROLE is part of the identity — changing it changes the bytes.
    expect(canonicalize(covenantIdentity(base, [{ uid: 'alice', role: 'x' }, { uid: 'bob' }]))).not.toBe(original);
  });

  it('does not mutate the caller\'s parties array', () => {
    const parties: CovenantParty[] = [{ uid: 'bob' }, { uid: 'alice' }];
    covenantIdentity(base, parties);
    expect(parties.map(p => p.uid)).toEqual(['bob', 'alice']);
  });
});

describe('signatureBindsToIdentity — the seal binds to the PUBLISHED identity key', () => {
  const PUBLISHED = 'base64-spki-alice-published-key';
  it('counts a signature only when its recorded pubkey EQUALS the published identity key', () => {
    expect(signatureBindsToIdentity(PUBLISHED, PUBLISHED)).toBe(true);
  });
  it('a throwaway key (recorded in the signer\'s own doc, != published) does NOT count — non-repudiation', () => {
    // The self-signer signs with a key they can later disown; it is not their published identity key.
    expect(signatureBindsToIdentity('base64-spki-throwaway-key', PUBLISHED)).toBe(false);
  });
  it('a party who has published NO key (empty) cannot contribute a counting signature', () => {
    expect(signatureBindsToIdentity('anything', '')).toBe(false);
    // Not even two empties count — an unset published key never seals.
    expect(signatureBindsToIdentity('', '')).toBe(false);
  });
});

describe('alignmentCovenantId — the deterministic twin id (race-free get-or-mint)', () => {
  it('is a pure, stable function of the alignmentId — two ensure calls converge on ONE id', () => {
    expect(alignmentCovenantId('align-123')).toBe(alignmentCovenantId('align-123'));
  });
  it('is distinct per alignment, and namespaced so it can never collide with an auto-id covenant', () => {
    expect(alignmentCovenantId('a')).not.toBe(alignmentCovenantId('b'));
    expect(alignmentCovenantId('align-123')).toBe('align_align-123');
  });
});

describe('isQuorumMet / covenantSealed', () => {
  it('needs at least `quorum` signatures', () => {
    expect(isQuorumMet(1, 2)).toBe(false);
    expect(isQuorumMet(2, 2)).toBe(true);
    expect(isQuorumMet(3, 2)).toBe(true);
  });
  it('never seals at quorum 0 or below (a covenant with no required signature is not one)', () => {
    expect(isQuorumMet(0, 0)).toBe(false);
    expect(isQuorumMet(5, 0)).toBe(false);
    expect(isQuorumMet(1, -1)).toBe(false);
  });
  it('covenantSealed reads the same rule on the VERIFIED count', () => {
    expect(covenantSealed(2, 3)).toBe(false);
    expect(covenantSealed(3, 3)).toBe(true);
  });
});
