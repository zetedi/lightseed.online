// UUIDv7 (RFC 9562): a time-ordered, globally-unique identifier whose first 48 bits are the
// creation time in Unix milliseconds. We use it as the LID — the Lightseed ID, an object's
// portable "true name". It sorts by birth, is unique without any coordinator, and is
// independent of the storage backend, so meaningful objects keep their identity across nodes
// and across years. (LID = Lightseed ID — NOT a lifetree id.)
//
// We mint it as a FIELD beside Firestore's random auto-id (never as the document id), so the
// time-ordering of v7 can't reintroduce the write-hotspotting that random ids exist to avoid.

export { uuidv7 } from '../domain/uuidv7.mjs';

// Read an object's birth-time back out of its lid — the millisecond timestamp baked into a
// UUIDv7. Returns epoch milliseconds, or null if the id isn't a parseable UUIDv7.
export function timeOf(lid?: string | null): number | null {
  if (!lid) return null;
  const hex = lid.replace(/-/g, '');
  if (hex.length < 12) return null;
  const ms = parseInt(hex.slice(0, 12), 16);
  return Number.isNaN(ms) ? null : ms;
}
