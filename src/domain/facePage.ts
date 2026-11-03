// THE FACE OF THE NODE (ring 2026-11-03): what the node says to whoever stands at it without
// signing in — a crawler unfurling a shared door, a search engine asking for the living sitemap,
// a mother site asking for its face's happenings. The origin serves these from four Cloud
// Functions (functions/src/preview.ts); the pure half of each lives here, shared by the
// independent node's API (seed/api/face.mjs). Nothing here reads a database: the server resolves
// the being, this law decides what a stranger may be told and shapes the words.
//
// Plain contract — guaranteed: publicCardOf answers null for every being the origin's card would
// not name (a tree that is not public — a bed's absent visibility is NOT public, as domain/bed
// says; a Light House without an explicit 'public'; a vision or pulse wearing any cloak but
// public or the legacy absence; an addressed reach whatever it wears) and the card's fields for
// the rest; shellCardOf swaps exactly the head meta the origin swaps, every value escaped once at
// the boundary, user content never expanded as a replacement pattern; canonicalHostOf answers only
// a host the node serves, else the node's own, so a forged Host header never enters a URL;
// faceSourceOf names the node's own media by path and a foreign picture by https address alone
// (never http, data or blob); isPublicAddress refuses every loopback, private, link-local,
// multicast and reserved range, so a face fetch never reaches the node's own network;
// sitemapXmlOf lists newest first, capped, escaped. Enforced by tests/facePage.test.ts and, end to
// end, tests/seed/face.postgres-test.ts. Not guaranteed: that a crawler honours any of it (their
// rules are theirs); a DNS answer that changes between the address check and the fetch.
import { lidFromPath } from './beingLink';
import { facePreviewUrlOf, sharePlaceNameOf, shareTitleOf } from './facePreview';

export type FaceBeingKind = 'tree' | 'house' | 'vision' | 'pulse';
export interface PublicBeingCard {
  name: string;
  body: string;
  image?: string;
  // The ground the being stands on (its `domain` stamp) — names the PLACE on the card.
  domain?: string;
  // Present only for a public Light House — becomes a JSON-LD Place block.
  place?: { latitude?: number; longitude?: number };
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const doc = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

// The canonical lid a door names — either shape /b/ accepts — or null.
export const lidOfDoor = (door: string): string | null => lidFromPath(`/b/${door}`);

// Absent visibility is the legacy-public form; only a STRING 'public' is public otherwise. A
// visibility that exists but is not a string is malformed and falls on the sealed side.
const publicOrLegacy = (visibility: unknown): boolean => visibility == null || visibility === 'public';
const addressed = (pulse: Record<string, unknown>): boolean =>
  pulse.type === 'reach' && (pulse.recipientUid != null || pulse.participantUids != null);

// THE GATE — the origin's findPublicBeingByLid, per kind.
export const isPublicBeing = (kind: FaceBeingKind, being: unknown): boolean => {
  if (!being || typeof being !== 'object' || Array.isArray(being)) return false;
  const b = doc(being);
  switch (kind) {
    case 'tree': return b.visibility === 'public' || (b.visibility == null && b.treeType !== 'BED');
    case 'house': return b.visibility === 'public';
    case 'vision': return publicOrLegacy(b.visibility);
    case 'pulse': return publicOrLegacy(b.visibility) && !addressed(b);
  }
};

// The card a public being shows; null for anything the gate refuses.
export const publicCardOf = (kind: FaceBeingKind, being: unknown): PublicBeingCard | null => {
  if (!isPublicBeing(kind, being)) return null;
  const b = doc(being);
  const image = (v: unknown): string | undefined => (text(v) ? text(v) : undefined);
  switch (kind) {
    case 'tree': return { name: text(b.name), body: text(b.body), image: image(b.latestGrowthUrl) ?? image(b.imageUrl), domain: text(b.domain) };
    case 'house': return {
      name: text(b.name), body: text(b.body), image: image(b.imageUrl), domain: text(b.domain),
      place: { latitude: typeof b.latitude === 'number' ? b.latitude : undefined, longitude: typeof b.longitude === 'number' ? b.longitude : undefined },
    };
    case 'vision': return { name: text(b.title), body: text(b.body), image: image(b.imageUrl), domain: text(b.domain) };
    case 'pulse': {
      const many = Array.isArray(b.imageUrls) ? b.imageUrls.find((u) => typeof u === 'string' && u) : undefined;
      return { name: text(b.title), body: text(b.body) || text(b.content), image: image(many) ?? image(b.imageUrl), domain: text(b.domain) };
    }
  }
};

// The host the visitor actually asked for, admitted only when the node serves it (its own
// domain, a face door, the charter's domains); anything else — a forged header, a raw address —
// collapses to the node's own. A port rides along (the local walk's edge is not on 443).
export const canonicalHostOf = (raw: unknown, hosts: readonly string[], fallback: string): string => {
  const first = text(raw).split(',')[0].trim().toLowerCase().replace(/^www\./, '');
  const m = /^([a-z0-9][a-z0-9.-]*)(:\d{1,5})?$/.exec(first);
  if (!m) return fallback;
  return hosts.some((h) => h.toLowerCase() === m[1]) ? first : fallback;
};

// Attribute-safe escape for user content entering raw HTML — all five.
export const escapeHtmlFull = (s: string): string => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const collapseWhitespace = (s: string): string => s.replace(/\s+/g, ' ').trim();
const truncate160 = (s: string): string => (s.length <= 160 ? s : `${s.slice(0, 159).trimEnd()}…`);
export const cardDescriptionOf = (body: string, name: string, placeName: string): string =>
  truncate160(collapseWhitespace(body)) || `${name} — a living being on ${placeName}.`;

// Where a being's picture is: the node's own media by path, or a foreign picture by https address.
export type FaceSource = { kind: 'local'; path: string } | { kind: 'remote'; url: string };
const MEDIA_PATH_RE = /^[A-Za-z0-9_.~/-]{3,1024}$/;
const soundMediaPath = (path: string | null): path is string =>
  !!path && MEDIA_PATH_RE.test(path) && path.split('/').every((p) => p && p !== '.' && p !== '..');
export const faceSourceOf = (image: unknown, ownHosts: readonly string[] = []): FaceSource | null => {
  const s = text(image);
  if (!s) return null;
  let url: URL;
  try { url = new URL(s, 'https://node.invalid'); } catch { return null; }
  if (url.pathname === '/v1/media') {
    const own = url.host === 'node.invalid' || ownHosts.some((h) => h.toLowerCase() === url.host.toLowerCase());
    if (!own) return url.protocol === 'https:' ? { kind: 'remote', url: s } : null;
    const path = url.searchParams.get('path');
    return soundMediaPath(path) ? { kind: 'local', path } : null;
  }
  if (url.host === 'node.invalid') return null; // a relative address that is not the media door
  return url.protocol === 'https:' && !url.username && !url.password ? { kind: 'remote', url: s } : null;
};

// Is this address one a stranger's picture may live at? Loopback, private, link-local, carrier,
// multicast, reserved, documentation and the unspecified address are the node's own neighbourhood.
export const isPublicAddress = (ip: string): boolean => {
  const v4 = (s: string): number[] | null => {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
    if (!m) return null;
    const parts = m.slice(1).map(Number);
    return parts.every((n) => n <= 255) ? parts : null;
  };
  const publicV4 = ([a, b]: number[]): boolean =>
    !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)));
  const four = v4(ip);
  if (four) return publicV4(four);
  const lower = ip.toLowerCase().replace(/%.*$/, '');
  if (!/^[0-9a-f:.]+$/.test(lower) || !lower.includes(':')) return false;
  const mapped = /^(?:0*:)*:?ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(lower);
  if (mapped) { const inner = v4(mapped[1]); return !!inner && publicV4(inner); }
  // Expand to the first hextet.
  const head = lower.startsWith('::') ? 0 : parseInt(lower.split(':')[0] || '0', 16);
  if (lower === '::' || lower === '::1' || lower.startsWith('::')) return false; // unspecified, loopback, v4-compatible
  if ((head & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((head & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((head & 0xff00) === 0xff00) return false; // ff00::/8 multicast
  if (head === 0x2002 || head === 0x0064) return false; // 6to4 and NAT64 carry an embedded v4 — not judged, refused
  if (head === 0x2001 && lower.split(':')[1] === 'db8') return false; // documentation
  return true;
};

export interface ShareCard { title: string; siteName?: string; description: string; image: string; url: string; card?: 'summary' }

// The card for one public being at one host: the title names its place, the description is its
// own words, the picture is its face preview — a small JPEG the node makes — else the node's og.png.
export const shareCardOf = (p: { host: string; door: string; being: PublicBeingCard; place: { name?: string | null; domain?: string | null } | null | undefined; nodeName: string; ownHosts?: readonly string[] }): { card: ShareCard; placeLd?: object } => {
  const placeName = sharePlaceNameOf(p.place, p.nodeName);
  const description = cardDescriptionOf(p.being.body, p.being.name, placeName);
  const own = p.being.image && faceSourceOf(p.being.image, p.ownHosts ?? [p.host]) ? p.being.image : null;
  const image = own ? facePreviewUrlOf(p.host, p.door, own) : `https://${p.host}/og.png`;
  const url = `https://${p.host}/b/${p.door}`;
  const placeLd = p.being.place ? {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: p.being.name,
    description,
    url,
    ...(p.being.place.latitude != null && p.being.place.longitude != null ? {
      geo: { '@type': 'GeoCoordinates', latitude: p.being.place.latitude, longitude: p.being.place.longitude },
    } : {}),
  } : undefined;
  return { card: { title: shareTitleOf(p.being.name, p.place, p.nodeName), siteName: placeName, description, image, url, card: 'summary' }, placeLd };
};

// Replace the text between two captured delimiters with an already-escaped value. A replacer
// FUNCTION, never a replacement string: user content may contain `$&` and friends.
const setBetween = (html: string, re: RegExp, value: string): string =>
  html.replace(re, (_m, pre: string, post: string) => `${pre}${value}${post}`);

// Swap the built shell's head meta for one being. All values arrive RAW and are escaped here, once.
export const shellCardOf = (shell: string, raw: ShareCard, placeLd?: object): string => {
  const title = escapeHtmlFull(raw.title);
  const siteName = raw.siteName ? escapeHtmlFull(raw.siteName) : null;
  const description = escapeHtmlFull(raw.description);
  const image = escapeHtmlFull(raw.image);
  const url = escapeHtmlFull(raw.url);
  let out = shell;
  out = setBetween(out, /(<title>)[\s\S]*?(<\/title>)/, title);
  out = setBetween(out, /(<meta name="description" content=")[^"]*(")/, description);
  out = setBetween(out, /(<link rel="canonical" href=")[^"]*(")/, url);
  for (const [prop, value] of [
    ['og:title', title], ['og:description', description],
    ['og:url', url], ['og:image', image], ['og:image:alt', title],
    ...(siteName ? ([['og:site_name', siteName]] as const) : []),
  ] as const) {
    out = setBetween(out, new RegExp(`(<meta property="${prop}" content=")[^"]*(")`), value);
  }
  for (const [name, value] of [
    ['twitter:title', title], ['twitter:description', description], ['twitter:image', image],
    ...(raw.card ? ([['twitter:card', raw.card]] as const) : []),
  ] as const) {
    out = setBetween(out, new RegExp(`(<meta name="${name}" content=")[^"]*(")`), value);
  }
  // The static og:image dimensions/type describe og.png; for a being's own image they would lie.
  if (!raw.image.endsWith('/og.png')) {
    out = out.replace(/\n?\s*<meta property="og:image:(?:type|width|height)" content="[^"]*" \/>/g, '');
  }
  if (placeLd) {
    // <-escape so user content can never break out via </script>; a function for the `$&` reason above.
    const json = JSON.stringify(placeLd).replace(/</g, '\\u003c');
    out = out.replace('</head>', () => `<script type="application/ld+json">${json}</script>\n</head>`);
  }
  return out;
};

// The living sitemap: home and every public being as /b/<lid>, newest first, capped.
export const SITEMAP_MAX_BEINGS = 500;
const xmlEscape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const sitemapXmlOf = (host: string, beings: ReadonlyArray<{ lid: string; ms: number }>): string => {
  const home = `  <url>\n    <loc>https://${host}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`;
  const entries = [...beings].sort((a, b) => b.ms - a.ms).slice(0, SITEMAP_MAX_BEINGS).map((b) => {
    const lastmod = b.ms ? `\n    <lastmod>${new Date(b.ms).toISOString().slice(0, 10)}</lastmod>` : '';
    return `  <url>\n    <loc>https://${host}/b/${xmlEscape(b.lid)}</loc>${lastmod}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[home, ...entries].join('\n')}\n</urlset>\n`;
};
