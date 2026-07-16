// The being link — a being's offline/online bridge. The URL carries the LID (the true
// name, portable across nodes and storage backends), never a Firestore doc id: paper
// outlives databases. `/b/<lid>` is resolved by the shell (findBeingByLid) into whichever
// profile the lid names — tree, lightHouse, vision, pulse, event.

export const beingPath = (lid: string): string => `/b/${lid}`;

export const beingUrl = (lid: string, origin: string): string =>
  `${origin.replace(/\/+$/, '')}${beingPath(lid)}`;

// A minted QR remembers the exact URL it was printed with. When the being's home domain
// changes, the mint goes stale — refreshing re-mints with the current origin.
export const isQrStale = (savedHref: string | undefined, lid: string, origin: string): boolean =>
  !!savedHref && savedHref !== beingUrl(lid, origin);

// The lid a /b/ path names, or null. Tolerates a trailing slash.
export const lidFromPath = (pathname: string): string | null => {
  const m = pathname.match(/^\/b\/([0-9a-fA-F-]{8,})\/?$/);
  return m ? m[1] : null;
};
