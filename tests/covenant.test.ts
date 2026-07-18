import { describe, it, expect, beforeAll } from 'vitest';
import {
  COVENANT_DOMAIN, covenantIdentity, isQuorumMet, covenantSealed,
  signatureBindsToIdentity, alignmentCovenantId,
  covenantSignaturePayload, countVerifiedCovenantSignatures, verifiedCovenantSigners, signatureFromDoc,
  type Covenant, type CovenantParty, type RecordedSignature,
} from '../src/domain/covenant';
import { canonicalize } from '../src/domain/chain/canonical';
import { signingPreimage } from '../src/domain/signing';
import { keypairFromSeed, signPayload, verifyPayload, subtleEd25519Available } from '../src/services/signingCrypto';

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
  it('is a versioned, dedicated tag — v2, the SIGNER-BOUND generation', () => {
    expect(COVENANT_DOMAIN).toBe('lifeseed.covenant.v2');
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

describe('signatureFromDoc — PATH AUTHORITY: the doc id is the only signer', () => {
  it('the doc id WINS over a malicious body `uid` — a record can never claim another signer', () => {
    const rec = signatureFromDoc('mallory', { uid: 'victim', sig: 's', pubkey: 'p' });
    expect(rec.uid).toBe('mallory');
  });
  it('a record without a body uid simply gains its path uid', () => {
    expect(signatureFromDoc('alice', { sig: 's', pubkey: 'p' }).uid).toBe('alice');
  });
});

describe('covenantSignaturePayload — signatures are SIGNER-BOUND (non-transferable)', () => {
  it('binds the covenant identity to the signer uid — different signer, different bytes', () => {
    const identity = covenantIdentity(base, [{ uid: 'alice' }, { uid: 'bob' }]);
    expect(covenantSignaturePayload(identity, 'alice')).toEqual({ covenant: identity, signer: 'alice' });
    expect(canonicalize(covenantSignaturePayload(identity, 'alice')))
      .not.toBe(canonicalize(covenantSignaturePayload(identity, 'bob')));
  });
});

describe('countVerifiedCovenantSignatures — the quorum cannot be inflated (adversarial)', () => {
  let available = false;
  beforeAll(async () => { available = await subtleEd25519Available(); });

  const seedOf = (n: number) => Uint8Array.from({ length: 32 }, (_, j) => (n * 31 + j + 1) & 0xff);
  const parties: CovenantParty[] = [{ uid: 'alice' }, { uid: 'bob' }, { uid: 'mallory' }];
  const identity = covenantIdentity(base, parties); // quorum 3
  const partyUids = new Set(parties.map(p => p.uid));

  it('a VALID signature copied into another slot NEVER counts — even when the attacker republishes the victim\'s pubkey as their own', async () => {
    if (!available) return; // Ed25519 subtle unavailable in this runtime — skip the crypto leg
    const kpAlice = await keypairFromSeed(seedOf(1));
    // Alice signs her own slot (v2: bound to HER uid). The signature is world-readable.
    const sigAlice = await signPayload(kpAlice.privateKey, covenantSignaturePayload(identity, 'alice'), COVENANT_DOMAIN);
    // Mallory (a keyless party) copies it into their own slot AND publishes Alice's pubkey as their
    // published identity key (they may — persons/{mallory} is their own doc). Pre-fix this counted
    // as a second signature; post-fix the signer-binding kills it: the copied signature verifies
    // only against a payload bound to 'alice', never one bound to 'mallory'.
    const records: RecordedSignature[] = [
      { uid: 'alice', sig: sigAlice, pubkey: kpAlice.publicKeyB64 },
      { uid: 'mallory', sig: sigAlice, pubkey: kpAlice.publicKeyB64 },
    ];
    const published = new Map([['alice', kpAlice.publicKeyB64], ['mallory', kpAlice.publicKeyB64]]);
    expect(await countVerifiedCovenantSignatures(identity, records, partyUids, published, verifyPayload)).toBe(1);
  });

  it('a record whose body-uid claimed another signer is neutralized by path authority before counting', async () => {
    if (!available) return;
    const kpAlice = await keypairFromSeed(seedOf(1));
    const sigAlice = await signPayload(kpAlice.privateKey, covenantSignaturePayload(identity, 'alice'), COVENANT_DOMAIN);
    // The attack write: mallory's slot with body { uid: 'alice', ... }. The reader maps through
    // signatureFromDoc, so the record reaches the counter as uid 'mallory' — and does not verify there.
    const attack = signatureFromDoc('mallory', { uid: 'alice', sig: sigAlice, pubkey: kpAlice.publicKeyB64 });
    expect(attack.uid).toBe('mallory');
    const published = new Map([['alice', kpAlice.publicKeyB64], ['mallory', kpAlice.publicKeyB64]]);
    expect(await countVerifiedCovenantSignatures(
      identity,
      [{ uid: 'alice', sig: sigAlice, pubkey: kpAlice.publicKeyB64 }, attack],
      partyUids, published, verifyPayload,
    )).toBe(1);
  });

  it('two records for ONE uid count once (dedupe), and honest distinct signers count fully', async () => {
    if (!available) return;
    const kpAlice = await keypairFromSeed(seedOf(1));
    const kpBob = await keypairFromSeed(seedOf(2));
    const sigAlice = await signPayload(kpAlice.privateKey, covenantSignaturePayload(identity, 'alice'), COVENANT_DOMAIN);
    const sigBob = await signPayload(kpBob.privateKey, covenantSignaturePayload(identity, 'bob'), COVENANT_DOMAIN);
    const published = new Map([['alice', kpAlice.publicKeyB64], ['bob', kpBob.publicKeyB64]]);
    // Duplicated alice records collapse to one; alice + bob = two.
    expect(await countVerifiedCovenantSignatures(
      identity,
      [
        { uid: 'alice', sig: sigAlice, pubkey: kpAlice.publicKeyB64 },
        { uid: 'alice', sig: sigAlice, pubkey: kpAlice.publicKeyB64 },
        { uid: 'bob', sig: sigBob, pubkey: kpBob.publicKeyB64 },
      ],
      partyUids, published, verifyPayload,
    )).toBe(2);
  });

  it('a non-party signature and an unpublished-key signature still never count', async () => {
    if (!available) return;
    const kpEve = await keypairFromSeed(seedOf(3));
    const sigEve = await signPayload(kpEve.privateKey, covenantSignaturePayload(identity, 'eve'), COVENANT_DOMAIN);
    // eve is not a party; and alice-with-no-published-key fails the identity binding.
    const kpAlice = await keypairFromSeed(seedOf(1));
    const sigAlice = await signPayload(kpAlice.privateKey, covenantSignaturePayload(identity, 'alice'), COVENANT_DOMAIN);
    const published = new Map([['eve', kpEve.publicKeyB64]]); // alice published nothing
    expect(await countVerifiedCovenantSignatures(
      identity,
      [
        { uid: 'eve', sig: sigEve, pubkey: kpEve.publicKeyB64 },
        { uid: 'alice', sig: sigAlice, pubkey: kpAlice.publicKeyB64 },
      ],
      partyUids, published, verifyPayload,
    )).toBe(0);
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

describe('key continuity — the lineage fallback (verify-at-signing-time, step 1)', () => {
  let available = false;
  beforeAll(async () => { available = await subtleEd25519Available(); });

  const seedOf = (n: number) => Uint8Array.from({ length: 32 }, (_, j) => (n * 31 + j + 1) & 0xff);
  const parties: CovenantParty[] = [{ uid: 'alice' }, { uid: 'bob' }];
  const identity = covenantIdentity(base, parties);
  const partyUids = new Set(parties.map(p => p.uid));

  it('a signature made with a since-ROTATED key still counts when the key is in the signer\'s lineage', async () => {
    if (!available) return; // Ed25519 subtle unavailable in this runtime — skip the crypto leg
    const kpOld = await keypairFromSeed(seedOf(1));
    const kpNew = await keypairFromSeed(seedOf(2));
    // Alice sealed with her old key; she has since restored on a new device / started fresh, so her
    // PUBLISHED key is now the new one. The old key lives forever in her append-only lineage.
    const sigOld = await signPayload(kpOld.privateKey, covenantSignaturePayload(identity, 'alice'), COVENANT_DOMAIN);
    const records: RecordedSignature[] = [{ uid: 'alice', sig: sigOld, pubkey: kpOld.publicKeyB64 }];
    const published = new Map([['alice', kpNew.publicKeyB64]]);
    const lineage = async (uid: string, pk: string) => uid === 'alice' && pk === kpOld.publicKeyB64;
    // WITHOUT the lineage the rotation unbinds history (the pre-continuity behavior)…
    expect(await countVerifiedCovenantSignatures(identity, records, partyUids, published, verifyPayload)).toBe(0);
    // …WITH it, history survives the rotation.
    expect(await countVerifiedCovenantSignatures(identity, records, partyUids, published, verifyPayload, lineage)).toBe(1);
  });

  it('a THROWAWAY key still never counts — not the published key, not in the lineage', async () => {
    if (!available) return;
    const kpThrowaway = await keypairFromSeed(seedOf(3));
    const kpPublished = await keypairFromSeed(seedOf(4));
    const sig = await signPayload(kpThrowaway.privateKey, covenantSignaturePayload(identity, 'alice'), COVENANT_DOMAIN);
    const records: RecordedSignature[] = [{ uid: 'alice', sig, pubkey: kpThrowaway.publicKeyB64 }];
    const published = new Map([['alice', kpPublished.publicKeyB64]]);
    const lineage = async () => false; // never published to the lineage
    expect(await countVerifiedCovenantSignatures(identity, records, partyUids, published, verifyPayload, lineage)).toBe(0);
  });

  it('the lineage can never rescue a signature that fails the CRYPTO', async () => {
    if (!available) return;
    const kpOld = await keypairFromSeed(seedOf(1));
    const records: RecordedSignature[] = [{ uid: 'alice', sig: 'bm90LWEtc2lnbmF0dXJl', pubkey: kpOld.publicKeyB64 }];
    const published = new Map([['alice', '']]);
    const lineage = async () => true; // even a maximally generous lineage
    expect(await countVerifiedCovenantSignatures(identity, records, partyUids, published, verifyPayload, lineage)).toBe(0);
  });
});

describe('verifiedCovenantSigners — the seal block records only VERIFIED hands', () => {
  let available = false;
  beforeAll(async () => { available = await subtleEd25519Available(); });

  const seedOf = (n: number) => Uint8Array.from({ length: 32 }, (_, j) => (n * 31 + j + 1) & 0xff);
  const parties: CovenantParty[] = [{ uid: 'alice' }, { uid: 'bob' }];
  const identity = covenantIdentity(base, parties);
  const partyUids = new Set(parties.map(p => p.uid));

  it('an INVALID signature doc in a party\'s slot never places their name in the seal', async () => {
    if (!available) return;
    const kpAlice = await keypairFromSeed(seedOf(1));
    const kpBob = await keypairFromSeed(seedOf(2));
    const sigAlice = await signPayload(kpAlice.privateKey, covenantSignaturePayload(identity, 'alice'), COVENANT_DOMAIN);
    // Bob's slot holds garbage (a broken write, or a forgery attempt) under his real published key:
    // it fails the crypto, so bob must appear NOWHERE — not in the count, not in the signer list.
    const records: RecordedSignature[] = [
      { uid: 'alice', sig: sigAlice, pubkey: kpAlice.publicKeyB64 },
      { uid: 'bob', sig: 'bm90LWEtc2lnbmF0dXJl', pubkey: kpBob.publicKeyB64 },
    ];
    const published = new Map([['alice', kpAlice.publicKeyB64], ['bob', kpBob.publicKeyB64]]);
    const signers = await verifiedCovenantSigners(identity, records, partyUids, published, verifyPayload);
    expect([...signers]).toEqual(['alice']);
    // And the count is exactly the set's size — one rule, two readings.
    expect(await countVerifiedCovenantSignatures(identity, records, partyUids, published, verifyPayload)).toBe(1);
  });
});
