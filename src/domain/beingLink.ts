import { toBase62, fromBase62, isBase62Lid, LID62_LENGTH } from './lid62';

// The being link — a being's offline/online bridge. The URL carries the LID (the true
// name, portable across nodes and storage backends), never a Firestore doc id: paper
// outlives databases. `/b/<lid>` is resolved by the shell (findBeingByLid) into whichever
// profile the lid names — tree, lightHouse, vision, pulse, event.
//
// New doors are minted COMPACT (base62, 22 chars — domain/lid62): a shorter URL makes a
// coarser QR that scans better at leaf-tag size. The parser accepts BOTH forms forever, so
// every QR already printed with the canonical 36-char lid keeps opening its being; either
// way the caller receives the CANONICAL lid (storage never sees base62).

export const beingPath = (lid: string): string => `/b/${toBase62(lid)}`;

export const beingUrl = (lid: string, origin: string): string =>
  `${origin.replace(/\/+$/, '')}${beingPath(lid)}`;

// A minted QR remembers the exact URL it was printed with. When the being's home domain
// changes (or the mint predates the compact form), the mint goes stale — refreshing
// re-mints with the current origin and encoding.
export const isQrStale = (savedHref: string | undefined, lid: string, origin: string): boolean =>
  !!savedHref && savedHref !== beingUrl(lid, origin);

// The CANONICAL lid a /b/ path names, or null. Tolerates a trailing slash; reads the
// compact form and the canonical form alike.
export const lidFromPath = (pathname: string): string | null => {
  const m = pathname.match(/^\/b\/([0-9a-zA-Z-]{8,})\/?$/);
  if (!m) return null;
  const raw = m[1];
  // The compact door: exactly 22 base62 characters. (A canonical lid is 36 chars with
  // dashes, so the two shapes can never collide.)
  if (raw.length === LID62_LENGTH && isBase62Lid(raw)) return fromBase62(raw);
  // The canonical door, as printed on every QR minted before the compact form.
  return /^[0-9a-fA-F-]{8,}$/.test(raw) ? raw : null;
};
