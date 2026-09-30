import { describe, it, expect, beforeAll } from 'vitest';
import { keypairFromSeed, signPayload, subtleEd25519Available } from '../src/services/signingCrypto';
import {
  DECISION_DOMAIN, DECISION_EPOCH_DOMAIN, decisionIdentity, decisionSignaturePayload, decisionEpochSignaturePayload,
  verifiedDecisionSigners,
} from '../src/domain/decision';
import { sha256 } from '../src/domain/chain/hash';
const keyFingerprint = (pubkeyB64: string) => sha256(pubkeyB64);
import {
  DECISION_DOMAIN as SERVER_DOMAIN, DECISION_EPOCH_DOMAIN as SERVER_EPOCH_DOMAIN,
  decisionIdentity as serverIdentity, decisionSignaturePayload as serverPayload, decisionEpochSignaturePayload as serverEpochPayload,
  verifiedDecisionSigners as serverVerifiedSigners, fingerprintOf, type SignerFacts, type RecordedDecisionSignature,
} from '../functions/src/decisionSeal';
import { keyStandingAt as serverKeyStandingAt, keyStandingCounts as serverKeyStandingCounts } from '../functions/src/keyEpoch';
import { keyStandingAt, keyStandingCounts, type KeyEpoch, type KeyEvent } from '../src/domain/keyEpoch';

// THE SEAL RE-VERIFIED ON SERVER GROUND: before the commons moves, the server counts a decision's
// signatures exactly as the shell does. This suite signs with REAL Ed25519 keys and asks both
// counting rules the same questions — and walks the key-epoch mirror on the shell's own fixtures.

const decision = { lid: '018f-dec', communityId: 'com-grove', nature: 'purchase' as const, title: 'A bed for the newcomer', body: 'From the glow, 108.', votesRequired: 2 };

describe('the domain tags and identity are one law', () => {
  it('server and shell agree on every constant and shape', () => {
    expect(SERVER_DOMAIN).toBe(DECISION_DOMAIN);
    expect(SERVER_EPOCH_DOMAIN).toBe(DECISION_EPOCH_DOMAIN);
    expect(serverIdentity(decision)).toEqual(decisionIdentity(decision));
    const id = decisionIdentity(decision);
    expect(serverPayload(id, 'ana')).toEqual(decisionSignaturePayload(id, 'ana'));
    expect(serverEpochPayload(id, 'ana', 'fp', 'ep')).toEqual(decisionEpochSignaturePayload(id, 'ana', 'fp', 'ep'));
  });
});

describe('the key-epoch mirror', () => {
  const OLD = 'a'.repeat(64), NEXT = 'b'.repeat(64);
  const epochs: KeyEpoch[] = [{ epochId: 'epoch-old', fingerprint: OLD, anchoredAtMs: 100 }, { epochId: 'rotate-1', fingerprint: NEXT, anchoredAtMs: 500 }];
  const rotation: KeyEvent = { eventId: 'rotate-1', type: 'rotate', epochId: 'rotate-1', keyFingerprint: NEXT, previousFingerprint: OLD, recordedAtMs: 500 };
  const freeze: KeyEvent = { eventId: 'freeze-1', type: 'freeze', epochId: 'epoch-old', keyFingerprint: OLD, recordedAtMs: 500 };
  const recover: KeyEvent = { eventId: 'recover-1', type: 'recover', epochId: 'recover-1', keyFingerprint: NEXT, previousFingerprint: OLD, recordedAtMs: 700, suspectedSinceMs: 300 };
  it('judges every standing identically', () => {
    const uses = [
      { epochId: 'epoch-old', keyFingerprint: OLD, recordedAtMs: 50 }, { epochId: 'epoch-old', keyFingerprint: OLD, recordedAtMs: 200 },
      { epochId: 'epoch-old', keyFingerprint: OLD, recordedAtMs: 499 }, { epochId: 'epoch-old', keyFingerprint: OLD, recordedAtMs: 500 },
      { epochId: 'epoch-old', keyFingerprint: OLD, recordedAtMs: 350 }, { epochId: 'nope', keyFingerprint: OLD, recordedAtMs: 200 },
      { epochId: 'epoch-old', keyFingerprint: NEXT, recordedAtMs: 200 }, { keyFingerprint: OLD, recordedAtMs: 200 },
    ];
    for (const use of uses) for (const [ev, cur] of [[[], OLD], [[rotation], NEXT], [[freeze], OLD], [[freeze, recover], NEXT]] as const) {
      const mine = keyStandingAt(use, epochs, ev, cur);
      expect(serverKeyStandingAt(use, epochs, ev, cur)).toBe(mine);
      expect(serverKeyStandingCounts(mine)).toBe(keyStandingCounts(mine));
    }
  });
});

describe('counting real signatures on server ground', () => {
  let available = false;
  beforeAll(async () => { available = await subtleEd25519Available(); });
  const seedOf = (i: number) => Uint8Array.from({ length: 32 }, (_, k) => (k * 7 + i * 13) % 256);

  it('a v3 quorum counts; a copied slot, a stranger, a frozen key and a wrong epoch do not', async () => {
    if (!available) return;
    const identity = decisionIdentity(decision);
    const signers = new Map<string, SignerFacts>();
    const sigs: RecordedDecisionSignature[] = [];
    const published = new Map<string, string>();
    const keys: Record<string, Awaited<ReturnType<typeof keypairFromSeed>>> = {};
    for (const [i, uid] of ['ana', 'bo', 'cy'].entries()) {
      const kp = await keypairFromSeed(seedOf(i + 1));
      keys[uid] = kp;
      const fp = await keyFingerprint(kp.publicKeyB64);
      expect(fingerprintOf(kp.publicKeyB64)).toBe(fp); // the fingerprint is one hash on both sides
      const epochId = `anchor-${uid}`;
      const sig = await signPayload(kp.privateKey, decisionEpochSignaturePayload(identity, uid, fp, epochId), DECISION_EPOCH_DOMAIN);
      sigs.push({ uid, sig, pubkey: kp.publicKeyB64, version: 3, keyFingerprint: fp, epochId, recordedAtMs: 1_000 });
      published.set(uid, kp.publicKeyB64);
      signers.set(uid, {
        publicKeyPem: kp.publicKeyB64, currentFingerprint: fp, lineage: new Map([[fp, kp.publicKeyB64]]),
        epochs: [{ epochId, fingerprint: fp, anchoredAtMs: 100 }], events: [{ eventId: epochId, type: 'anchor', epochId, keyFingerprint: fp, recordedAtMs: 100 }],
        member: uid !== 'cy', // cy is no member of the circle
      });
    }
    const counted = serverVerifiedSigners(identity, 'threshold', sigs, signers);
    expect([...counted].sort()).toEqual(['ana', 'bo']);

    // The shell counts the same two (its lineage check is injected; here: the same facts).
    const lineage = async (uid: string, pubkey: string) => signers.get(uid)!.lineage.get(await keyFingerprint(pubkey)) === pubkey;
    const verify = async (pubkey: string, sig: string, payload: unknown, domain: string) => {
      const { verifyPayload } = await import('../src/services/signingCrypto');
      return verifyPayload(pubkey, sig, payload, domain);
    };
    const mine = await verifiedDecisionSigners(identity, sigs.filter(s => s.uid !== 'cy') as never, 'threshold', published, verify, lineage);
    expect([...mine].sort()).toEqual(['ana', 'bo']);

    // A copied signature in another member's slot never verifies (signer-bound bytes).
    const copied = { ...sigs[0], uid: 'bo' };
    expect(serverVerifiedSigners(identity, 'threshold', [copied], signers).size).toBe(0);
    // A frozen key: a freeze recorded before the signature's receipt revokes it at signing.
    const frozen = new Map(signers);
    const ana = signers.get('ana')!;
    frozen.set('ana', { ...ana, events: [...ana.events, { eventId: 'freeze', type: 'freeze', epochId: 'anchor-ana', keyFingerprint: ana.currentFingerprint, recordedAtMs: 900 }] });
    expect(serverVerifiedSigners(identity, 'threshold', sigs, frozen).has('ana')).toBe(false);
    // An epoch the lineage never anchored.
    const wrongEpoch = { ...sigs[1], epochId: 'never' };
    expect(serverVerifiedSigners(identity, 'threshold', [wrongEpoch], signers).size).toBe(0);
    // A tampered identity (the amount changed after signing) verifies nothing.
    expect(serverVerifiedSigners({ ...identity, body: 'From the glow, 1080.' }, 'threshold', sigs, signers).size).toBe(0);
    // Consensus counts only uniting signatures.
    const united = sigs.map(s => ({ ...s, position: s.uid === 'ana' ? 'unite' : 'stand_aside' }));
    expect([...serverVerifiedSigners(identity, 'consensus', united, signers)]).toEqual(['ana']);
  });

  it('a v2 signature binds to the current published key', async () => {
    if (!available) return;
    const identity = decisionIdentity(decision);
    const kp = await keypairFromSeed(seedOf(9));
    const sig = await signPayload(kp.privateKey, decisionSignaturePayload(identity, 'dee'), DECISION_DOMAIN);
    const facts: SignerFacts = { publicKeyPem: kp.publicKeyB64, currentFingerprint: fingerprintOf(kp.publicKeyB64), lineage: new Map(), epochs: [], events: [], member: true };
    const s: RecordedDecisionSignature = { uid: 'dee', sig, pubkey: kp.publicKeyB64, recordedAtMs: null };
    expect(serverVerifiedSigners(identity, 'threshold', [s], new Map([['dee', facts]])).has('dee')).toBe(true);
    // A key never published — not current, not in the lineage — is a stranger's word.
    expect(serverVerifiedSigners(identity, 'threshold', [s], new Map([['dee', { ...facts, publicKeyPem: 'other' }]])).size).toBe(0);
  });
});
