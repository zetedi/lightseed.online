import { describe, it, expect, beforeAll } from 'vitest';
import {
  DECISION_DOMAIN, decisionIdentity, decisionEnacted, decisionAuthoritative,
  type Decision,
} from '../src/domain/decision';
import { COVENANT_DOMAIN } from '../src/domain/covenant';
import { canonicalize } from '../src/domain/chain/canonical';
import { signingPreimage } from '../src/domain/signing';
import { keypairFromSeed, signPayload, verifyPayload, subtleEd25519Available } from '../src/services/signingCrypto';

// The pure decision crystal (Covenant, phase 3): the canonical IDENTITY every member signs
// (deterministic, frozen), the signing domain tag, and the enactment/authority logic. No Firestore.
// A closing end-to-end block signs a real Ed25519 signature over the identity to prove the whole loop —
// and that a 'passed' flag with fewer verified signatures than the quorum is NOT authoritative.

const base: Pick<Decision, 'lid' | 'communityId' | 'nature' | 'title' | 'votesRequired'> & { body?: string } = {
  lid: '018f-dec-lid',
  communityId: 'com-grove',
  nature: 'charter',
  title: 'Adopt the grove charter',
  body: 'We tend the commons together, and mark the truth of every tending.',
  votesRequired: 7,
};

describe('DECISION_DOMAIN', () => {
  it('is a versioned, dedicated tag — never the raw signing version', () => {
    expect(DECISION_DOMAIN).toBe('lifeseed.decision.v1');
  });
  it('separates a decision signature from a covenant signature (neither can replay the other)', () => {
    const payload = { any: 'value' };
    expect(DECISION_DOMAIN).not.toBe(COVENANT_DOMAIN);
    expect(signingPreimage(DECISION_DOMAIN, payload)).not.toBe(signingPreimage(COVENANT_DOMAIN, payload));
  });
});

describe('decisionIdentity — the frozen essence a member signs', () => {
  it('carries exactly lid/communityId/nature/title/body/votesRequired', () => {
    expect(decisionIdentity(base)).toEqual({
      lid: base.lid, communityId: 'com-grove', nature: 'charter',
      title: base.title, body: base.body, votesRequired: 7,
    });
  });

  it('normalises an absent body to "" so the signed bytes are deterministic', () => {
    const { body: _dropped, ...noBody } = base;
    const withUndef = decisionIdentity(noBody);
    const withEmpty = decisionIdentity({ ...noBody, body: '' });
    expect(withUndef.body).toBe('');
    expect(canonicalize(withUndef)).toBe(canonicalize(withEmpty));
  });

  it('changes bytes when ANY frozen field changes — the signature would no longer verify', () => {
    const original = canonicalize(decisionIdentity(base));
    expect(canonicalize(decisionIdentity({ ...base, title: 'changed' }))).not.toBe(original);
    expect(canonicalize(decisionIdentity({ ...base, body: 'changed' }))).not.toBe(original);
    expect(canonicalize(decisionIdentity({ ...base, nature: 'intention' }))).not.toBe(original);
    expect(canonicalize(decisionIdentity({ ...base, votesRequired: 3 }))).not.toBe(original);
    expect(canonicalize(decisionIdentity({ ...base, communityId: 'other' }))).not.toBe(original);
    expect(canonicalize(decisionIdentity({ ...base, lid: 'other-lid' }))).not.toBe(original);
  });
});

describe('decisionEnacted — enactment is by VERIFIED signatures, never a raw count', () => {
  it('needs at least `votesRequired` verified signatures', () => {
    expect(decisionEnacted(6, 7)).toBe(false);
    expect(decisionEnacted(7, 7)).toBe(true);
    expect(decisionEnacted(8, 7)).toBe(true);
  });
  it('never enacts at a requirement of 0 or below (a decision that needs no voice is not one)', () => {
    expect(decisionEnacted(0, 0)).toBe(false);
    expect(decisionEnacted(5, 0)).toBe(false);
    expect(decisionEnacted(1, -1)).toBe(false);
  });
});

describe('decisionAuthoritative — the flag must be backed by the crypto', () => {
  it('a THRESHOLD "passed" with fewer verified signatures than the quorum is NOT authoritative', () => {
    expect(decisionAuthoritative('passed', 6, 7, 'threshold')).toBe(false);
    expect(decisionAuthoritative('passed', 7, 7, 'threshold')).toBe(true);
  });
  it('an open threshold decision is authoritative regardless of count (nothing is being claimed yet)', () => {
    expect(decisionAuthoritative('open', 0, 7, 'threshold')).toBe(true);
  });
  it('a CONSENSUS decision enacts by discernment, so its flag is not a signature-count claim', () => {
    expect(decisionAuthoritative('passed', 1, 7, 'consensus')).toBe(true);
  });
  it('defaults to threshold when mode is absent (legacy decisions)', () => {
    expect(decisionAuthoritative('passed', 6, 7)).toBe(false);
  });
});

describe('end-to-end — a real Ed25519 signature over the frozen identity seals the vote', () => {
  let available = false;
  beforeAll(async () => { available = await subtleEd25519Available(); });

  // A fixed seed so the derived key is reproducible run to run.
  const seed = Uint8Array.from({ length: 32 }, (_, i) => (i * 5 + 3) & 0xff);

  it.runIf(true)('signs the identity, verifies it, and refuses a tampered proposal', async () => {
    if (!available) return; // Ed25519 subtle unavailable in this runtime — skip the crypto leg
    const identity = decisionIdentity(base);
    const kp = await keypairFromSeed(seed);
    const sig = await signPayload(kp.privateKey, identity, DECISION_DOMAIN);

    // The signature verifies against the frozen identity under the decision domain.
    expect(await verifyPayload(kp.publicKeyB64, sig, identity, DECISION_DOMAIN)).toBe(true);
    // A tampered proposal (title changed under the signer) no longer verifies.
    expect(await verifyPayload(kp.publicKeyB64, sig, decisionIdentity({ ...base, title: 'forged' }), DECISION_DOMAIN)).toBe(false);
    // The same bytes signed under the COVENANT domain do not count as a decision signature.
    expect(await verifyPayload(kp.publicKeyB64, sig, identity, COVENANT_DOMAIN)).toBe(false);
  });

  it.runIf(true)('a "passed" charter with six of seven verified signatures is not authoritative', async () => {
    if (!available) return;
    const identity = decisionIdentity(base);
    // Six distinct members sign honestly.
    let verifiedCount = 0;
    for (let i = 0; i < 6; i++) {
      const kp = await keypairFromSeed(Uint8Array.from({ length: 32 }, (_, j) => (i * 31 + j) & 0xff));
      const sig = await signPayload(kp.privateKey, identity, DECISION_DOMAIN);
      if (await verifyPayload(kp.publicKeyB64, sig, identity, DECISION_DOMAIN)) verifiedCount++;
    }
    expect(verifiedCount).toBe(6);
    // The proposer flipped the doc to 'passed', but only six of seven signatures verify — the seal fails.
    expect(decisionEnacted(verifiedCount, base.votesRequired)).toBe(false);
    expect(decisionAuthoritative('passed', verifiedCount, base.votesRequired, 'threshold')).toBe(false);
  });
});
