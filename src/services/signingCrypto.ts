import { signingPreimage } from '../domain/signing';

// The WebCrypto half of the signing crystal: Ed25519 primitives ONLY — no IndexedDB, no Firebase,
// no app state. Kept separate from services/keys.ts (the device keystore) so this layer can be
// exercised in a plain Node test and reused wherever a keypair or a verification is needed.
//
// One algorithm across the whole project: a public key here is base64 of its SPKI/DER encoding —
// byte-for-byte the same shape the offline initiation ledger uses (scripts/*.mjs, node:crypto), so an
// app-signed artifact and a git-signed one share one public-key format and cross-verify.

// RFC 8410 fixed DER wrappers for Ed25519. A private key is a 32-byte SEED wrapped in a constant
// PKCS8 prefix; a public key is 32 bytes wrapped in a constant SPKI prefix. Because the prefixes are
// constant we can build/parse them by hand and thus derive a keypair from a bare seed (the recovery
// path) without ever needing the counterpart key material handed to us.
const PKCS8_ED25519_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);
const SPKI_ED25519_PREFIX = new Uint8Array([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);

const ALG = 'Ed25519';

export interface SigningKeypair {
  // The private key is imported NON-EXTRACTABLE by keypairFromSeed — script/XSS cannot export it.
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  // base64(SPKI/DER) — what gets published to persons/{uid}.publicKeyPem; matches the initiation format.
  publicKeyB64: string;
}

// crypto.subtle Ed25519 is not universal yet (older Safari/Node). Callers gate on this.
export async function subtleEd25519Available(): Promise<boolean> {
  try {
    const c = globalThis.crypto?.subtle;
    if (!c) return false;
    await c.generateKey({ name: ALG }, false, ['sign', 'verify']);
    return true;
  } catch { return false; }
}

const toB64 = (bytes: ArrayBuffer | Uint8Array): string => {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};

const fromB64 = (b64: string): Uint8Array => {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

const fromB64Url = (b64url: string): Uint8Array => {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
  return fromB64(b64);
};

const concat = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0); out.set(b, a.length);
  return out;
};

// 32 fresh random bytes — the seed the recovery phrase encodes. crypto.subtle.generateKey is used by
// ensureSigningKey (per the key-custody decision); this is here for callers that want a raw seed.
export function generateSeed(): Uint8Array {
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  return seed;
}

// A 32-byte seed → a usable keypair. The private key is imported TWICE: once extractable so we can
// export its JWK and read the derived public key `x` (WebCrypto gives us no other way to get the
// public half from a private key), then once NON-EXTRACTABLE for storage/use. The public key is
// reconstructed as SPKI from those 32 public bytes, so publicKeyB64 is deterministic in the seed —
// restoring from a phrase reproduces the SAME public key (proven in the tests).
export async function keypairFromSeed(seed: Uint8Array): Promise<SigningKeypair> {
  if (seed.length !== 32) throw new Error('seed must be 32 bytes');
  const subtle = crypto.subtle;
  const pkcs8 = concat(PKCS8_ED25519_PREFIX, seed);

  const probe = await subtle.importKey('pkcs8', pkcs8, { name: ALG }, true, ['sign']);
  const jwk = await subtle.exportKey('jwk', probe);
  if (!jwk.x) throw new Error('could not derive public key from seed');
  const pubBytes = fromB64Url(jwk.x);
  const spki = concat(SPKI_ED25519_PREFIX, pubBytes);

  const privateKey = await subtle.importKey('pkcs8', pkcs8, { name: ALG }, false, ['sign']);
  const publicKey = await subtle.importKey('spki', spki, { name: ALG }, true, ['verify']);
  return { privateKey, publicKey, publicKeyB64: toB64(spki) };
}

// Sign a payload under a domain tag. The signature covers exactly signingPreimage(...) — the same
// canonical, versioned, domain-separated bytes the pure layer defines. Returns base64.
export async function signPayload(privateKey: CryptoKey, payload: unknown, domainTag: string): Promise<string> {
  const bytes = new TextEncoder().encode(signingPreimage(domainTag, payload));
  const sig = await crypto.subtle.sign(ALG, privateKey, bytes);
  return toB64(sig);
}

// Verify a signature using ONLY the public key (base64 SPKI/DER) — anyone can verify, since persons
// are world-readable. Returns false (never throws) on a bad key, bad signature, or mismatch.
export async function verifyPayload(
  publicKeyB64Spki: string,
  signatureB64: string,
  payload: unknown,
  domainTag: string,
): Promise<boolean> {
  try {
    const pub = await crypto.subtle.importKey('spki', fromB64(publicKeyB64Spki), { name: ALG }, true, ['verify']);
    const bytes = new TextEncoder().encode(signingPreimage(domainTag, payload));
    return await crypto.subtle.verify(ALG, pub, fromB64(signatureB64), bytes);
  } catch {
    return false;
  }
}
