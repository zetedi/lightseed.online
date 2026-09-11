import type { DomainKey } from './words';

// A DOOR TO SOMEWHERE ELSE (ring 2026-09-11). Beings carry links outward: a vision's page, a
// tree's site, an offering's detail, an organisation's home. Three things went wrong wherever
// this was left to each screen:
//
//   1. a link typed as `example.com` was handed to the browser as written — a RELATIVE path, so
//      the door opened onto our own shell and the visitor never left (the visions bug);
//   2. a field that stores a BARE host was rendered as `https://${domain}`, so a value someone
//      pasted with its scheme became `https://https://example.com`;
//   3. every door opened in a new tab, including doors that lead back into this same shell.
//
// The law: a stored link is ALWAYS absolute and always http(s) — nothing else is a web door, and
// `javascript:` is not a door at all. Where it points decides the tab: another host is a new tab
// (with the opener sealed), this host is the same tab, because leaving your own house through a
// new window is not travel.
//
// Plain contract — guaranteed: normalizeWebLink answers an absolute https(s) URL or null;
// webLinkProblem answers a DOMAIN key for what a person can fix; hostOf reads the host of a
// stored link (bare or absolute); linkTarget answers href/target/rel for rendering, never a
// relative href. Enforced by tests/webLink.test.ts. NOT guaranteed: that the door leads anywhere
// — reachability is the world's business, not a regex's.

// A hostname with at least one dot, no spaces, no credentials, ending in a letter run.
const HOST_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/;

const stripWrapping = (raw: string | null | undefined): string =>
  String(raw ?? '').trim().replace(/^<|>$/g, '').trim();

// The scheme someone actually typed, lowercased ('' when they typed none).
const schemeOf = (s: string): string => (/^([a-z][a-z0-9+.-]*):/i.exec(s)?.[1] || '').toLowerCase();

// What a person typed, made into a link the browser can follow — or null when it is not a web
// door. A bare host gains https:// (the assumption every browser makes and no field should ask
// a person to type); `//host/path` is protocol-relative and gains it too.
export const normalizeWebLink = (raw: string | null | undefined): string | null => {
  const text = stripWrapping(raw);
  if (!text || /\s/.test(text)) return null;
  const scheme = schemeOf(text);
  if (scheme && scheme !== 'http' && scheme !== 'https') return null;   // never a javascript:/data: door
  const withScheme = scheme ? text : `https://${text.replace(/^\/\//, '')}`;
  let url: URL;
  try { url = new URL(withScheme); } catch { return null; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;                        // no credentials in a door
  const host = url.hostname.toLowerCase();
  if (!HOST_RE.test(host) && host !== 'localhost') return null;
  url.hostname = host;
  return url.toString();
};

// What a person can fix, in their own tongue. Null means the link stands (empty is not a fault:
// a link is optional everywhere it appears — the caller decides whether absence is allowed).
export const webLinkProblem = (raw: string | null | undefined): DomainKey | null => {
  const text = stripWrapping(raw);
  if (!text) return null;
  const scheme = schemeOf(text);
  if (scheme && scheme !== 'http' && scheme !== 'https') return 'link_not_web';
  return normalizeWebLink(text) ? null : 'link_not_valid';
};

// The host a stored value points at — it may be bare ('example.com') or absolute.
export const hostOf = (raw: string | null | undefined): string | null => {
  const link = normalizeWebLink(raw);
  if (!link) return null;
  try { return new URL(link).hostname.toLowerCase(); } catch { return null; }
};

// A BARE host, for the fields that store one (a tree's domain, a community's address): the same
// validation, with the scheme and path stripped back off.
export const normalizeHostname = (raw: string | null | undefined): string | null => hostOf(raw);

// www is a coat, not a name: two hosts that differ only by it are the same place.
const bareHost = (host: string): string => host.replace(/^www\./, '');

export const isSameHost = (raw: string | null | undefined, currentHost: string | null | undefined): boolean => {
  const host = hostOf(raw);
  const here = String(currentHost ?? '').toLowerCase().trim();
  return !!host && !!here && bareHost(host) === bareHost(here);
};

export interface LinkTarget {
  href: string;
  target?: '_blank';
  rel?: string;
}

// How to render a door: absolute always; a door to elsewhere opens a new tab with the opener
// sealed; a door back into this same shell opens where the reader already stands.
export const linkTarget = (raw: string | null | undefined, currentHost: string | null | undefined): LinkTarget | null => {
  const href = normalizeWebLink(raw);
  if (!href) return null;
  return isSameHost(href, currentHost) ? { href } : { href, target: '_blank', rel: 'noopener noreferrer' };
};

// The name to SHOW for a link: the host and path, without the scheme's noise.
export const linkLabel = (raw: string | null | undefined): string => {
  const href = normalizeWebLink(raw);
  if (!href) return stripWrapping(raw);
  return href.replace(/^https?:\/\//, '').replace(/\/$/, '');
};
