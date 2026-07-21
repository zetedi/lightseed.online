// Base62 compact lids — the SPOKEN-SHORT form of a being's true name, for doors and paper:
// the canonical lid (UUIDv7, 36 chars with dashes) compresses to a fixed 22 characters, which
// makes /b/ URLs shorter and their QR codes coarser (fewer modules scan better at leaf-tag
// size). This is an ENCODING, never a second name: everything STORED stays canonical RFC form
// (portable, greppable, timeOf keeps reading the birth time); the codec is a pure bijection
// used only at the URL/QR boundary (domain/beingLink).
//
// The alphabet is in ASCII order (digits < upper < lower) and the output is zero-padded to a
// fixed length, so LEXICOGRAPHIC order of encodings equals numeric order of the underlying
// 128 bits — a UUIDv7's time-ordering survives the compression. Base62 is case-sensitive:
// right for links and QR payloads, wrong for anything a human must type by hand (that would
// be Crockford Base32, a different door).

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const LID62_LENGTH = 22; // ceil(128 / log2(62)) — every 128-bit value fits in 22 chars

const MAX_128 = 1n << 128n;

// Canonical lid → 22-char base62. Throws on anything that is not a 32-hex-digit uuid form.
export const toBase62 = (lid: string): string => {
  const hex = lid.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error('Not a canonical lid (a UUID has 32 hex digits).');
  let n = BigInt(`0x${hex}`);
  let out = '';
  while (n > 0n) {
    out = ALPHABET[Number(n % 62n)] + out;
    n /= 62n;
  }
  return out.padStart(LID62_LENGTH, '0');
};

// 22-char base62 → canonical lid (lowercase, dashed). Throws on wrong length, foreign
// characters, or a value beyond 128 bits (62^22 exceeds 2^128, so the top of the range
// encodes nothing).
export const fromBase62 = (s: string): string => {
  if (s.length !== LID62_LENGTH) throw new Error(`A compact lid has exactly ${LID62_LENGTH} characters.`);
  let n = 0n;
  for (const ch of s) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) throw new Error(`Not a base62 character: "${ch}".`);
    n = n * 62n + BigInt(v);
  }
  if (n >= MAX_128) throw new Error('Beyond 128 bits: no lid lives there.');
  const hex = n.toString(16).padStart(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// Is this string a decodable compact lid? (Shape and range; no exceptions.)
export const isBase62Lid = (s: string): boolean => {
  if (s.length !== LID62_LENGTH) return false;
  try { fromBase62(s); return true; } catch { return false; }
};
