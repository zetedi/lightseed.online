// UUIDv7 (RFC 9562): a time-ordered, globally-unique identifier whose first 48 bits are the
// creation time in Unix milliseconds. We use it as the LID — the Lightseed ID, an object's
// portable "true name". It sorts by birth, is unique without any coordinator, and is
// independent of the storage backend, so meaningful objects keep their identity across nodes
// and across years. (LID = Lightseed ID — NOT a lifetree id.)
//
// We mint it as a FIELD beside Firestore's random auto-id (never as the document id), so the
// time-ordering of v7 can't reintroduce the write-hotspotting that random ids exist to avoid.

export function uuidv7(at: number = Date.now()): string {
  const bytes = new Uint8Array(16);

  // 48-bit big-endian millisecond timestamp in the first six bytes (the object's birth).
  let ts = Math.max(0, Math.floor(at));
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }

  // 74 bits of randomness fill the remaining ten bytes.
  crypto.getRandomValues(bytes.subarray(6));

  // Version 7 (high nibble of byte 6) and the RFC 4122 variant (top two bits of byte 8).
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Read an object's birth-time back out of its lid — the millisecond timestamp baked into a
// UUIDv7. Returns epoch milliseconds, or null if the id isn't a parseable UUIDv7.
export function timeOf(lid?: string | null): number | null {
  if (!lid) return null;
  const hex = lid.replace(/-/g, '');
  if (hex.length < 12) return null;
  const ms = parseInt(hex.slice(0, 12), 16);
  return Number.isNaN(ms) ? null : ms;
}
