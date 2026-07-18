import { canonicalize } from './chain/canonical';
import { BIP39_WORDLIST } from './bip39Wordlist';

// The signing crystal (pure part) — everything here is deterministic string/bytes work, with NO
// WebCrypto and NO storage. Two things live here:
//
//   1. The SIGNING PREIMAGE — the exact bytes an Ed25519 signature covers. It mirrors blockPreimage
//      in chain/verify.ts: a versioned, domain-separated string built on the SAME canonicalize()
//      that seals the chain, so an app signature and a chain hash agree on how a value becomes bytes.
//      Domain separation (the `domainTag`) means a signature minted for one purpose can never be
//      replayed as a signature for another — the tag is inside what was signed.
//
//   2. The RECOVERY-PHRASE CODEC — a reversible, checksummed encoding of the 32-byte Ed25519 seed to
//      a human-writable word list and back. The being writes the phrase down once at key creation;
//      it is the ONLY way to restore the private key on another device (the key itself never leaves
//      the device it was made on — see services/keys.ts). The checksum catches a mistyped word before
//      it silently derives the wrong (empty) identity.

// Versioned + domain-separated, exactly like BLOCK_HASH_VERSION. Bumping this is a conscious break.
export const SIGNING_VERSION = 'lifeseed.sign.v1';

// The bytes a signature covers: [version, domainTag, canonical(payload)] joined by newlines.
// canonicalize() is the shared preimage builder (chain + signing) — same value, same bytes, forever.
export function signingPreimage(domainTag: string, payload: unknown): string {
  return [SIGNING_VERSION, domainTag, canonicalize(payload)].join('\n');
}

// ── Recovery-phrase codec — STANDARD BIP39 ─────────────────────────────────────────────────────────
//
// The recovery phrase is a full, spec-compliant BIP39 mnemonic (Zoltán's decision): transcription-
// robust AND interoperable with any BIP39 tool. The 32-byte seed IS the 256-bit BIP39 entropy.
//
//   entropy (256 bits) ‖ checksum (first 8 bits of SHA-256(entropy)) = 264 bits
//   → 24 groups of 11 bits → 24 indices into the OFFICIAL 2048-word English wordlist.
//
// phraseToSeed reverses it and THROWS on a wrong word count, an unknown word, or a checksum that does
// not match SHA-256(entropy) — so a mistyped word is caught before it derives the wrong identity.
//
// The BIP39 checksum is SHA-256. To keep this codec SYNCHRONOUS (services/keys.ts and SigningKeyModal
// call it inline — no await), we use a small PURE synchronous SHA-256 over bytes (sha256Bytes below),
// NOT the async crypto.subtle digest used elsewhere in the chain layer.

const SEED_BYTES = 32;           // 256-bit entropy
const PHRASE_WORDS = 24;         // (256 + 8) / 11 = 24
const BITS_PER_WORD = 11;        // 2^11 = 2048 words
const CHECKSUM_BITS = (SEED_BYTES * 8) / 32; // BIP39: ENT/32 = 8 bits for 256-bit entropy
const WORDLIST_SIZE = 1 << BITS_PER_WORD;

// word → index, once. The official wordlist is a bijection index↔word; -1 marks a word not on it.
const WORD_INDEX: ReadonlyMap<string, number> = new Map(BIP39_WORDLIST.map((w, i) => [w, i]));

// A pure, synchronous SHA-256 (FIPS 180-4) over bytes → 32-byte digest. Self-contained so the codec
// stays sync; only used for the 8-bit BIP39 checksum here (not a hot path).
function sha256Bytes(data: Uint8Array): Uint8Array {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const bitLen = data.length * 8;
  const withOne = data.length + 1;
  const total = withOne + ((56 - (withOne % 64) + 64) % 64) + 8; // pad to 64-byte multiple
  const msg = new Uint8Array(total);
  msg.set(data);
  msg[data.length] = 0x80;
  // 64-bit big-endian length; bitLen < 2^32 here, so the low 32 bits suffice.
  msg[total - 4] = (bitLen >>> 24) & 0xff;
  msg[total - 3] = (bitLen >>> 16) & 0xff;
  msg[total - 2] = (bitLen >>> 8) & 0xff;
  msg[total - 1] = bitLen & 0xff;

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = (msg[off + i * 4] << 24) | (msg[off + i * 4 + 1] << 16) | (msg[off + i * 4 + 2] << 8) | msg[off + i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    out[i * 4] = (h[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (h[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (h[i] >>> 8) & 0xff;
    out[i * 4 + 3] = h[i] & 0xff;
  }
  return out;
}

// The BIP39 checksum: the first CHECKSUM_BITS bits of SHA-256(entropy), as an integer.
function checksumBits(seed: Uint8Array): number {
  const digest = sha256Bytes(seed);
  // CHECKSUM_BITS is 8 for 256-bit entropy → the whole first byte.
  return digest[0] >>> (8 - CHECKSUM_BITS);
}

// 32-byte seed (256-bit BIP39 entropy) → 24-word BIP39 mnemonic.
export function seedToPhrase(seed: Uint8Array): string[] {
  if (seed.length !== SEED_BYTES) throw new Error(`seed must be ${SEED_BYTES} bytes`);
  const bits: number[] = [];
  for (const byte of seed) for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  const check = checksumBits(seed);
  for (let i = CHECKSUM_BITS - 1; i >= 0; i--) bits.push((check >> i) & 1);
  const words: string[] = [];
  for (let g = 0; g < PHRASE_WORDS; g++) {
    let idx = 0;
    for (let b = 0; b < BITS_PER_WORD; b++) idx = (idx << 1) | bits[g * BITS_PER_WORD + b];
    words.push(BIP39_WORDLIST[idx]);
  }
  return words;
}

// 24-word BIP39 mnemonic → 32-byte seed. Throws on wrong length, an unknown word, or a failed SHA-256
// checksum (a mistyped word).
export function phraseToSeed(words: string[]): Uint8Array {
  if (words.length !== PHRASE_WORDS) throw new Error(`phrase must be ${PHRASE_WORDS} words`);
  const bits: number[] = [];
  for (const raw of words) {
    const idx = WORD_INDEX.get(raw.trim().toLowerCase());
    if (idx === undefined || idx >= WORDLIST_SIZE) throw new Error(`unknown word in recovery phrase: "${raw}"`);
    for (let b = BITS_PER_WORD - 1; b >= 0; b--) bits.push((idx >> b) & 1);
  }
  const seed = new Uint8Array(SEED_BYTES);
  for (let i = 0; i < SEED_BYTES; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
    seed[i] = byte;
  }
  let check = 0;
  for (let b = 0; b < CHECKSUM_BITS; b++) check = (check << 1) | bits[SEED_BYTES * 8 + b];
  if (check !== checksumBits(seed)) throw new Error('recovery phrase checksum failed — a word looks mistyped');
  return seed;
}

// Normalise free-typed input (any whitespace/case) into a candidate word list for phraseToSeed.
export function parsePhrase(input: string): string[] {
  return input.trim().toLowerCase().split(/\s+/).filter(Boolean);
}
