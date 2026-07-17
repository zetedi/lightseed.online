import { describe, it, expect, beforeAll } from 'vitest';
import { createPublicKey, verify as edVerify, sign as edSign, createPrivateKey } from 'node:crypto';
import { keypairFromSeed, signPayload, verifyPayload, subtleEd25519Available } from '../src/services/signingCrypto';
import { signingPreimage, seedToPhrase, phraseToSeed } from '../src/domain/signing';

// The load-bearing proof: an app-produced Ed25519 signature (crypto.subtle) CROSS-VERIFIES with
// node:crypto — the exact scheme the offline initiation ledger uses (scripts/verify-initiations.mjs).
// So app-signed and git-signed artifacts share ONE algorithm and ONE public-key shape (base64 SPKI).
// If crypto.subtle Ed25519 is unavailable in this Node, the subtle-dependent cases are skipped and the
// node:crypto side + the pure codec still run.

const DOMAIN = 'covenant.mint.v1';
const PAYLOAD = { decision: 'plant', treeId: 'aspen', at: 1783382400000, nested: { b: 2, a: 1 } };

// The bytes both sides must agree on (mirrors what signPayload signs internally).
const preimageBytes = () => Buffer.from(signingPreimage(DOMAIN, PAYLOAD), 'utf8');

// A fixed seed so the derived public key is reproducible run to run.
const SEED = Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 11) & 0xff);

// The same fixed PKCS8/SPKI wrappers signingCrypto uses — to build a node KeyObject from a bare seed.
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const nodePrivFromSeed = (seed: Uint8Array) =>
  createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, Buffer.from(seed)]), format: 'der', type: 'pkcs8' });

let available = false;
beforeAll(async () => { available = await subtleEd25519Available(); });

describe('signingCrypto (Ed25519, one algorithm)', () => {
  it.runIf(true)('an app (subtle) signature verifies under node:crypto with the same SPKI pubkey', async () => {
    if (!available) { expect(available).toBe(false); return; } // documented skip: no subtle Ed25519 here
    const kp = await keypairFromSeed(SEED);
    const sigB64 = await signPayload(kp.privateKey, PAYLOAD, DOMAIN);

    const nodePub = createPublicKey({ key: Buffer.from(kp.publicKeyB64, 'base64'), format: 'der', type: 'spki' });
    const ok = edVerify(null, preimageBytes(), nodePub, Buffer.from(sigB64, 'base64'));
    expect(ok).toBe(true);
  });

  it('a node:crypto signature verifies under the app (subtle) verifyPayload', async () => {
    if (!available) { expect(available).toBe(false); return; }
    const kp = await keypairFromSeed(SEED);
    const nodeSig = edSign(null, preimageBytes(), nodePrivFromSeed(SEED)).toString('base64');
    expect(await verifyPayload(kp.publicKeyB64, nodeSig, PAYLOAD, DOMAIN)).toBe(true);
  });

  it('the derived SPKI public key is byte-identical to node:crypto\'s', async () => {
    if (!available) { expect(available).toBe(false); return; }
    const kp = await keypairFromSeed(SEED);
    const nodeSpki = createPublicKey(nodePrivFromSeed(SEED)).export({ format: 'der', type: 'spki' }).toString('base64');
    expect(kp.publicKeyB64).toBe(nodeSpki);
  });

  it('verifyPayload rejects a tampered payload and a tampered signature', async () => {
    if (!available) { expect(available).toBe(false); return; }
    const kp = await keypairFromSeed(SEED);
    const sigB64 = await signPayload(kp.privateKey, PAYLOAD, DOMAIN);
    expect(await verifyPayload(kp.publicKeyB64, sigB64, { ...PAYLOAD, treeId: 'other' }, DOMAIN)).toBe(false);
    expect(await verifyPayload(kp.publicKeyB64, sigB64, PAYLOAD, 'other.domain')).toBe(false);
    const bad = Buffer.from(sigB64, 'base64'); bad[0] ^= 0xff;
    expect(await verifyPayload(kp.publicKeyB64, bad.toString('base64'), PAYLOAD, DOMAIN)).toBe(false);
  });

  it('restore-from-phrase reproduces the SAME public key', async () => {
    if (!available) { expect(available).toBe(false); return; }
    const original = await keypairFromSeed(SEED);
    const restoredSeed = phraseToSeed(seedToPhrase(SEED));
    const restored = await keypairFromSeed(restoredSeed);
    expect(restored.publicKeyB64).toBe(original.publicKeyB64);

    // And a signature from the restored key still verifies under the original's published pubkey.
    const sig = await signPayload(restored.privateKey, PAYLOAD, DOMAIN);
    expect(await verifyPayload(original.publicKeyB64, sig, PAYLOAD, DOMAIN)).toBe(true);
  });

  it('the stored private key is non-extractable (cannot be exfiltrated)', async () => {
    if (!available) { expect(available).toBe(false); return; }
    const kp = await keypairFromSeed(SEED);
    expect(kp.privateKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('pkcs8', kp.privateKey)).rejects.toBeTruthy();
  });
});
