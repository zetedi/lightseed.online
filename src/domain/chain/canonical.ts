// Canonical serialization — a deterministic, type-tagged encoding of a value to a string.
//
// Why: the live chain currently hashes `JSON.stringify(data) + previousHash + timestamp`
// (utils/crypto.ts). Plain JSON.stringify is key-order dependent, silently drops `undefined`,
// and has no stable encoding for Firestore Timestamps — so a verifier (or another runtime, or
// another language) cannot reproduce the same bytes, which means a hash can never be re-checked.
//
// `canonicalize` fixes that: the SAME logical value always produces the SAME string, regardless of
// object key insertion order, and every primitive type carries a tag so values of different types
// can never collide (e.g. the number 1, the string "1", and true all encode differently). This is
// the shared preimage builder for BOTH hashing and (later) signing of blocks.
//
// This module is PURE and additive — nothing in the live mint path imports it yet. It is the
// prerequisite that the future "lock the blocks in" switch will turn on. See src/domain/chain/verify.ts.

const isTimestampLike = (v: unknown): v is { toMillis: () => number } =>
  !!v && typeof v === 'object' && typeof (v as any).toMillis === 'function';

function encode(v: unknown): string {
  if (v === null) return 'z';            // null
  if (v === undefined) return 'u';       // explicit (JSON.stringify would drop it)
  const t = typeof v;
  if (t === 'string') return 's:' + JSON.stringify(v); // JSON-escapes quotes/newlines/unicode
  if (t === 'number') return 'd:' + (Number.isFinite(v) ? (v as number).toString() : 'NaN');
  if (t === 'boolean') return 'b:' + (v ? '1' : '0');
  if (t === 'bigint') return 'i:' + (v as bigint).toString();
  // Firestore Timestamp (toMillis) or a JS Date — encode as epoch millis under one tag.
  if (isTimestampLike(v)) return 't:' + v.toMillis();
  if (v instanceof Date) return 't:' + v.getTime();
  if (Array.isArray(v)) return '[' + v.map(encode).join(',') + ']';   // order is significant
  if (t === 'object') {
    const obj = v as Record<string, unknown>;
    // Sort keys so insertion order can't change the bytes; drop `undefined` values to match how
    // Firestore stores documents (it omits undefined), so stored-doc and preimage agree.
    const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + encode(obj[k])).join(',') + '}';
  }
  // functions / symbols must never appear in block content; encode defensively rather than throw.
  return 'x';
}

// Deterministic string encoding of any JSON-ish value (incl. Firestore Timestamps / Dates).
export function canonicalize(value: unknown): string {
  return encode(value);
}
