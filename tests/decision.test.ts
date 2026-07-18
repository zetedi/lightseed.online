import { describe, it, expect, beforeAll } from 'vitest';
import {
  DECISION_DOMAIN, decisionIdentity, decisionEnacted, decisionAuthoritative,
  decisionSignaturePayload, countVerifiedDecisionSignatures, verifiedDecisionSigners, decisionDeletable,
  type Decision, type RecordedDecisionSignature, type Position,
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
  it('is a versioned, dedicated tag — v2, the SIGNER-BOUND generation', () => {
    expect(DECISION_DOMAIN).toBe('lifeseed.decision.v2');
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

describe('decisionSignaturePayload — signatures are SIGNER-BOUND (non-transferable)', () => {
  it('binds the decision identity to the signer uid — different signer, different bytes', () => {
    const identity = decisionIdentity(base);
    expect(decisionSignaturePayload(identity, 'alice')).toEqual({ decision: identity, signer: 'alice' });
    expect(canonicalize(decisionSignaturePayload(identity, 'alice')))
      .not.toBe(canonicalize(decisionSignaturePayload(identity, 'bob')));
  });
});

describe('end-to-end — a real Ed25519 signature over the signer-bound identity seals the vote', () => {
  let available = false;
  beforeAll(async () => { available = await subtleEd25519Available(); });

  // A fixed seed so the derived key is reproducible run to run.
  const seed = Uint8Array.from({ length: 32 }, (_, i) => (i * 5 + 3) & 0xff);
  const seedOf = (n: number) => Uint8Array.from({ length: 32 }, (_, j) => (n * 31 + j) & 0xff);

  it.runIf(true)('signs the bound identity, verifies it, and refuses a tampered proposal', async () => {
    if (!available) return; // Ed25519 subtle unavailable in this runtime — skip the crypto leg
    const identity = decisionIdentity(base);
    const kp = await keypairFromSeed(seed);
    const payload = decisionSignaturePayload(identity, 'alice');
    const sig = await signPayload(kp.privateKey, payload, DECISION_DOMAIN);

    // The signature verifies against the frozen identity bound to ITS OWN signer, under the decision domain.
    expect(await verifyPayload(kp.publicKeyB64, sig, payload, DECISION_DOMAIN)).toBe(true);
    // A tampered proposal (title changed under the signer) no longer verifies.
    expect(await verifyPayload(kp.publicKeyB64, sig,
      decisionSignaturePayload(decisionIdentity({ ...base, title: 'forged' }), 'alice'), DECISION_DOMAIN)).toBe(false);
    // The same bytes signed under the COVENANT domain do not count as a decision signature.
    expect(await verifyPayload(kp.publicKeyB64, sig, payload, COVENANT_DOMAIN)).toBe(false);
    // SIGNER-BINDING: alice's signature can never verify in bob's slot — even with the right key.
    expect(await verifyPayload(kp.publicKeyB64, sig, decisionSignaturePayload(identity, 'bob'), DECISION_DOMAIN)).toBe(false);
  });

  it.runIf(true)('a "passed" charter with six of seven verified signatures is not authoritative', async () => {
    if (!available) return;
    const identity = decisionIdentity(base);
    // Six distinct members sign honestly (each bound to their own uid) — counted by the REAL rule.
    const records: RecordedDecisionSignature[] = [];
    const published = new Map<string, string>();
    for (let i = 0; i < 6; i++) {
      const uid = `member-${i}`;
      const kp = await keypairFromSeed(seedOf(i));
      const sig = await signPayload(kp.privateKey, decisionSignaturePayload(identity, uid), DECISION_DOMAIN);
      records.push({ uid, sig, pubkey: kp.publicKeyB64 });
      published.set(uid, kp.publicKeyB64);
    }
    const verifiedCount = await countVerifiedDecisionSignatures(identity, records, 'threshold', published, verifyPayload);
    expect(verifiedCount).toBe(6);
    // The proposer flipped the doc to 'passed', but only six of seven signatures verify — the seal fails.
    expect(decisionEnacted(verifiedCount, base.votesRequired)).toBe(false);
    expect(decisionAuthoritative('passed', verifiedCount, base.votesRequired, 'threshold')).toBe(false);
  });

  it.runIf(true)('one real hand cannot fill the quorum: a copied signature never counts in another slot, and duplicates count once', async () => {
    if (!available) return;
    const identity = decisionIdentity(base);
    const kpAlice = await keypairFromSeed(seedOf(1));
    const sigAlice = await signPayload(kpAlice.privateKey, decisionSignaturePayload(identity, 'alice'), DECISION_DOMAIN);
    // Six keyless members copy alice's world-readable signature into their own slots — and even
    // publish alice's pubkey as their own published key. Pre-fix this inflated a 7-quorum from one
    // hand; post-fix the signer-binding refuses every copied slot.
    const records: RecordedDecisionSignature[] = [{ uid: 'alice', sig: sigAlice, pubkey: kpAlice.publicKeyB64 }];
    const published = new Map<string, string>([['alice', kpAlice.publicKeyB64]]);
    for (let i = 0; i < 6; i++) {
      const uid = `copyist-${i}`;
      records.push({ uid, sig: sigAlice, pubkey: kpAlice.publicKeyB64 });
      published.set(uid, kpAlice.publicKeyB64);
    }
    // And a duplicate record claiming alice AGAIN (dedupe leg).
    records.push({ uid: 'alice', sig: sigAlice, pubkey: kpAlice.publicKeyB64 });
    const verifiedCount = await countVerifiedDecisionSignatures(identity, records, 'threshold', published, verifyPayload);
    expect(verifiedCount).toBe(1);
    expect(decisionEnacted(verifiedCount, base.votesRequired)).toBe(false);
  });

  it.runIf(true)('consensus mode counts only uniting signatures — and still one per hand', async () => {
    if (!available) return;
    const identity = decisionIdentity(base);
    const kpAlice = await keypairFromSeed(seedOf(1));
    const sigAlice = await signPayload(kpAlice.privateKey, decisionSignaturePayload(identity, 'alice'), DECISION_DOMAIN);
    const published = new Map<string, string>([['alice', kpAlice.publicKeyB64]]);
    const unite: RecordedDecisionSignature = { uid: 'alice', sig: sigAlice, pubkey: kpAlice.publicKeyB64, position: 'unite' };
    const aside: RecordedDecisionSignature = { uid: 'alice', sig: sigAlice, pubkey: kpAlice.publicKeyB64, position: 'stand_aside' };
    expect(await countVerifiedDecisionSignatures(identity, [aside], 'consensus', published, verifyPayload)).toBe(0);
    expect(await countVerifiedDecisionSignatures(identity, [unite, unite], 'consensus', published, verifyPayload)).toBe(1);
  });
});

describe('key continuity — the lineage fallback (verify-at-signing-time, step 1)', () => {
  let available = false;
  beforeAll(async () => { available = await subtleEd25519Available(); });
  const seedOf = (n: number) => Uint8Array.from({ length: 32 }, (_, j) => (n * 31 + j) & 0xff);

  it('a signature made with a since-ROTATED key still counts when the key is in the signer\'s lineage', async () => {
    if (!available) return; // Ed25519 subtle unavailable in this runtime — skip the crypto leg
    const identity = decisionIdentity(base);
    const kpOld = await keypairFromSeed(seedOf(1));
    const kpNew = await keypairFromSeed(seedOf(2));
    const sigOld = await signPayload(kpOld.privateKey, decisionSignaturePayload(identity, 'alice'), DECISION_DOMAIN);
    const records: RecordedDecisionSignature[] = [{ uid: 'alice', sig: sigOld, pubkey: kpOld.publicKeyB64 }];
    const published = new Map([['alice', kpNew.publicKeyB64]]); // alice rotated after signing
    const lineage = async (uid: string, pk: string) => uid === 'alice' && pk === kpOld.publicKeyB64;
    // WITHOUT the lineage the rotation unbinds history (the pre-continuity behavior)…
    expect(await countVerifiedDecisionSignatures(identity, records, 'threshold', published, verifyPayload)).toBe(0);
    // …WITH it, history survives the rotation — and the consensus position gate still applies.
    expect(await countVerifiedDecisionSignatures(identity, records, 'threshold', published, verifyPayload, lineage)).toBe(1);
    expect(await countVerifiedDecisionSignatures(identity, records, 'consensus', published, verifyPayload, lineage)).toBe(0);
  });

  it('a THROWAWAY key still never counts — not the published key, not in the lineage', async () => {
    if (!available) return;
    const identity = decisionIdentity(base);
    const kpThrowaway = await keypairFromSeed(seedOf(3));
    const kpPublished = await keypairFromSeed(seedOf(4));
    const sig = await signPayload(kpThrowaway.privateKey, decisionSignaturePayload(identity, 'alice'), DECISION_DOMAIN);
    const records: RecordedDecisionSignature[] = [{ uid: 'alice', sig, pubkey: kpThrowaway.publicKeyB64 }];
    const published = new Map([['alice', kpPublished.publicKeyB64]]);
    expect(await countVerifiedDecisionSignatures(identity, records, 'threshold', published, verifyPayload, async () => false)).toBe(0);
  });
});

describe('verifiedDecisionSigners — the enactment block records only VERIFIED hands, never votes[]', () => {
  let available = false;
  beforeAll(async () => { available = await subtleEd25519Available(); });
  const seedOf = (n: number) => Uint8Array.from({ length: 32 }, (_, j) => (n * 31 + j) & 0xff);

  it('an INVALID signature doc never places a member\'s name among the signers', async () => {
    if (!available) return;
    const identity = decisionIdentity(base);
    const kpAlice = await keypairFromSeed(seedOf(1));
    const kpBob = await keypairFromSeed(seedOf(2));
    const sigAlice = await signPayload(kpAlice.privateKey, decisionSignaturePayload(identity, 'alice'), DECISION_DOMAIN);
    // Bob's slot holds garbage under his real published key: it fails the crypto, so bob must
    // appear NOWHERE — not in the count, not in the enactment block's signer list.
    const records: RecordedDecisionSignature[] = [
      { uid: 'alice', sig: sigAlice, pubkey: kpAlice.publicKeyB64 },
      { uid: 'bob', sig: 'bm90LWEtc2lnbmF0dXJl', pubkey: kpBob.publicKeyB64 },
    ];
    const published = new Map([['alice', kpAlice.publicKeyB64], ['bob', kpBob.publicKeyB64]]);
    const signers = await verifiedDecisionSigners(identity, records, 'threshold', published, verifyPayload);
    expect([...signers]).toEqual(['alice']);
    expect(await countVerifiedDecisionSignatures(identity, records, 'threshold', published, verifyPayload)).toBe(1);
  });
});

describe('decisionDeletable — draft vanishes, minted withdraws', () => {
  const draft = { status: 'open' as const, proposedBy: 'alice', votes: ['alice'] };
  const aPosition = [{ by: 'bob', stance: 'stand_aside', at: 1 }] as unknown as Position[];

  it('an unsigned draft carrying only the proposer\'s own voice may vanish', () => {
    expect(decisionDeletable(draft, 0)).toBe(true);
  });
  it('a PASSED decision may only be withdrawn — the mint is never erased', () => {
    expect(decisionDeletable({ ...draft, status: 'passed' }, 0)).toBe(false);
  });
  it('a single signature protects the record — signed withdraws', () => {
    expect(decisionDeletable(draft, 1)).toBe(false);
  });
  it('another being\'s vote protects the record', () => {
    expect(decisionDeletable({ ...draft, votes: ['alice', 'bob'] }, 0)).toBe(false);
  });
  it('a recorded position protects the record', () => {
    expect(decisionDeletable({ ...draft, positions: aPosition }, 0)).toBe(false);
  });
  it('a withdrawn, unsigned, unshared draft may still vanish — retraction does not freeze it', () => {
    expect(decisionDeletable({ ...draft, status: 'withdrawn' }, 0)).toBe(true);
  });
  it('absent votes read as no other voice (a legacy shape)', () => {
    expect(decisionDeletable({ status: 'open', proposedBy: 'alice' }, 0)).toBe(true);
  });
});
