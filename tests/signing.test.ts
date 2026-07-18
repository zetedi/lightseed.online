import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { SIGNING_VERSION, signingPreimage, seedToPhrase, phraseToSeed, parsePhrase, keyCustody, restoreConflictsWithPublished } from '../src/domain/signing';
import { BIP39_WORDLIST } from '../src/domain/bip39Wordlist';

// The pure signing crystal: the preimage (deterministic + domain-separated) and the recovery-phrase
// codec — now a STANDARD BIP39 mnemonic, asserted against the official Trezor/BIP39 test vectors.

describe('signingPreimage', () => {
  it('is versioned and domain-separated', () => {
    const p = signingPreimage('covenant.align', { a: 1 });
    const lines = p.split('\n');
    expect(lines[0]).toBe(SIGNING_VERSION);
    expect(lines[1]).toBe('covenant.align');
  });

  it('is deterministic and independent of object key order', () => {
    const a = signingPreimage('tag', { x: 1, y: 2, nested: { b: 2, a: 1 } });
    const b = signingPreimage('tag', { nested: { a: 1, b: 2 }, y: 2, x: 1 });
    expect(a).toBe(b);
  });

  it('separates domains — same payload, different tag, different bytes', () => {
    const payload = { decision: 'plant', treeId: 't1' };
    expect(signingPreimage('council.decision', payload)).not.toBe(signingPreimage('covenant.mint', payload));
  });

  it('distinguishes types the way canonicalize does (1 ≠ "1" ≠ true)', () => {
    const n = signingPreimage('t', { v: 1 });
    const s = signingPreimage('t', { v: '1' });
    const b = signingPreimage('t', { v: true });
    expect(new Set([n, s, b]).size).toBe(3);
  });
});

describe('BIP39 wordlist', () => {
  it('is exactly the 2048-word official English list', () => {
    expect(BIP39_WORDLIST).toHaveLength(2048);
    expect(BIP39_WORDLIST[0]).toBe('abandon');
    expect(BIP39_WORDLIST[2047]).toBe('zoo');
    // All lowercase a–z, unique.
    expect(new Set(BIP39_WORDLIST).size).toBe(2048);
    for (const w of BIP39_WORDLIST) expect(w).toMatch(/^[a-z]+$/);
  });

  it('is byte-exact-canonical: SHA-256 of the newline-joined file matches the known digest', () => {
    // The canonical bitcoin/bips bip-0039/english.txt is newline-separated with a trailing newline.
    const file = BIP39_WORDLIST.join('\n') + '\n';
    const digest = createHash('sha256').update(file, 'utf8').digest('hex');
    expect(digest).toBe('2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda');
  });
});

describe('recovery-phrase codec — standard BIP39', () => {
  const seedFrom = (fn: (i: number) => number) => Uint8Array.from({ length: 32 }, (_, i) => fn(i) & 0xff);

  // ── Official Trezor/BIP39 256-bit test vectors — BOTH directions. ──────────────────────────────
  const ZERO_MNEMONIC = Array(23).fill('abandon').concat('art');           // entropy = 32×0x00
  const FF_MNEMONIC = Array(23).fill('zoo').concat('vote');                // entropy = 32×0xff

  it('encodes the 32×0x00 vector to 23×abandon + art', () => {
    expect(seedToPhrase(new Uint8Array(32).fill(0x00))).toEqual(ZERO_MNEMONIC);
  });
  it('decodes 23×abandon + art back to 32×0x00', () => {
    expect(Array.from(phraseToSeed(ZERO_MNEMONIC))).toEqual(Array(32).fill(0x00));
  });
  it('encodes the 32×0xff vector to 23×zoo + vote', () => {
    expect(seedToPhrase(new Uint8Array(32).fill(0xff))).toEqual(FF_MNEMONIC);
  });
  it('decodes 23×zoo + vote back to 32×0xff', () => {
    expect(Array.from(phraseToSeed(FF_MNEMONIC))).toEqual(Array(32).fill(0xff));
  });

  it('cross-checks the pure sync SHA-256 checksum against node:crypto for both vectors', () => {
    // The 24th word carries the 8-bit checksum = first byte of SHA-256(entropy). If our pure sync
    // sha256 disagreed with a reference SHA-256, these mnemonics could not both be produced and parsed.
    for (const fill of [0x00, 0xff]) {
      const seed = new Uint8Array(32).fill(fill);
      const check = createHash('sha256').update(Buffer.from(seed)).digest()[0];
      // Reconstruct the expected 24th index: last 3 entropy bits + 8 checksum bits.
      const lastEntropyBits = fill & 0b111;                 // top 3 bits of a repeated byte
      const idx = (lastEntropyBits << 8) | check;
      expect(seedToPhrase(seed)[23]).toBe(BIP39_WORDLIST[idx]);
    }
  });

  it('round-trips exactly for many random seeds (seedToPhrase → phraseToSeed === seed)', () => {
    for (let t = 0; t < 200; t++) {
      const seed = seedFrom(i => (i * 31 + t * 17 + 7) ^ (t << 2));
      const phrase = seedToPhrase(seed);
      expect(phrase).toHaveLength(24);
      for (const w of phrase) expect(BIP39_WORDLIST).toContain(w);
      expect(Array.from(phraseToSeed(phrase))).toEqual(Array.from(seed));
    }
  });

  it('rejects a mistyped word via the SHA-256 checksum (single-word swap)', () => {
    const seed = seedFrom(i => i * 13 + 5);
    const phrase = seedToPhrase(seed);
    let caught = 0;
    // Swap each word for a DIFFERENT valid BIP39 word; the checksum rejects nearly all single edits.
    for (let pos = 0; pos < phrase.length; pos++) {
      const other = seedToPhrase(seedFrom(i => i * 13 + 6))[pos];
      if (other === phrase[pos]) continue;
      const tampered = phrase.slice(); tampered[pos] = other;
      try { phraseToSeed(tampered); } catch { caught++; }
    }
    // 8-bit checksum: at least the large majority of single-word swaps are caught.
    expect(caught).toBeGreaterThan(phrase.length - 3);
  });

  it('rejects an unknown (off-list) word', () => {
    const phrase = seedToPhrase(seedFrom(i => i));
    const tampered = phrase.slice(); tampered[0] = 'zzzz';
    expect(() => phraseToSeed(tampered)).toThrow(/unknown word/);
  });

  it('rejects a wrong word count', () => {
    expect(() => phraseToSeed(['abandon', 'ability'])).toThrow();
  });

  it('rejects a non-32-byte seed', () => {
    expect(() => seedToPhrase(new Uint8Array(16))).toThrow();
  });

  it('parsePhrase normalises whitespace and case', () => {
    expect(parsePhrase('  Abandon\n abilITY\tzoo ')).toEqual(['abandon', 'ability', 'zoo']);
  });
});

describe('keyCustody — where a device stands against the published identity', () => {
  const LOCAL = 'base64-spki-device-key';
  const OTHER = 'base64-spki-newer-key';

  it('fresh — no device key, nothing published: minting is safe', () => {
    expect(keyCustody(null, '')).toBe('fresh');
  });
  it('needs_restore — no device key but an identity IS published: never silently mint', () => {
    expect(keyCustody(null, OTHER)).toBe('needs_restore');
  });
  it('publish_needed — a device key with nothing published: self-heal by publishing', () => {
    expect(keyCustody(LOCAL, '')).toBe('publish_needed');
  });
  it('ready — device and published agree', () => {
    expect(keyCustody(LOCAL, LOCAL)).toBe('ready');
  });
  it('stale_device — the device holds an OLDER key than the published identity: never self-heal over it', () => {
    expect(keyCustody(LOCAL, OTHER)).toBe('stale_device');
  });
});

describe('restoreConflictsWithPublished — a restore may only land the key it claims to restore', () => {
  const PUBLISHED = 'base64-spki-published-key';

  it('a phrase deriving the PUBLISHED key restores freely', () => {
    expect(restoreConflictsWithPublished(PUBLISHED, PUBLISHED)).toBe(false);
  });
  it('with NO published key, any valid phrase may install (first publication)', () => {
    expect(restoreConflictsWithPublished('any-derived-key', '')).toBe(false);
  });
  it('a valid phrase deriving a DIFFERENT key conflicts — the silent-replace bypass is closed', () => {
    expect(restoreConflictsWithPublished('another-derived-key', PUBLISHED)).toBe(true);
  });
});
