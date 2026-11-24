import type { DomainKey } from './words';
import { normalizeWebLink } from './webLink';

// FEATURED VIDEOS (rings 2026-11-20 and -24). A community may name a short list of videos beside
// its home quotes; where one stands, the quote carousel gives a second carousel half the row. A
// keeper pastes each link as a person knows it (a watch page, a share link, a short); the face
// needs a player address.
//
// The law: what is stored is never handed to a frame. A link is read into a KNOWN house and a
// video id of that house's own shape, and the player address is built here from those two
// alone — so no stored text can choose the frame's origin, its path or its parameters. A link
// to any other house is not a featured video, however much it looks like a film.
//
// Plain contract — guaranteed: featuredVideoOf answers a player address on
// www.youtube-nocookie.com or player.vimeo.com, or null; featuredVideosOf answers at most
// FEATURED_VIDEOS_MAX of them, in the keeper's order, each video once, and an empty list for
// anything that is not a list; featuredVideoLinks is what a hand may store and what the editor
// reads back (text rows only, trimmed, none empty, the same cap); featuredVideoProblem answers
// a DOMAIN key a person can fix (empty is not a fault). Enforced by tests/featuredVideo.test.ts.
// NOT guaranteed: that a video exists, is public, or allows embedding — that is the provider's
// answer, given only in the frame.

// A carousel a visitor can walk, not a channel: twelve, like the faces of a node.
export const FEATURED_VIDEOS_MAX = 12;

export type VideoHouse = 'youtube' | 'vimeo';

export interface FeaturedVideo {
  house: VideoHouse;
  id: string;
  // The address the frame loads — built here, never copied from the stored link.
  embedUrl: string;
  // The page a person can open in its own house.
  watchUrl: string;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com']);
// /embed/ID, /shorts/ID, /live/ID, /v/ID
const YOUTUBE_PATH = /^\/(?:embed|shorts|live|v)\/([^/]+)\/?$/;
// vimeo.com/ID, vimeo.com/ID/HASH (an unlisted video's key), /video/ID, /channels/x/ID, /groups/x/videos/ID
const VIMEO_PATH = /^\/(?:video\/|channels\/[\w-]+\/|groups\/[\w-]+\/videos\/)?(\d{1,12})(?:\/([0-9a-f]{6,20}))?\/?$/;
const VIMEO_HASH = /^[0-9a-f]{6,20}$/;

const youtube = (id: string | null | undefined): FeaturedVideo | null =>
  id && YOUTUBE_ID.test(id)
    ? { house: 'youtube', id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`, watchUrl: `https://www.youtube.com/watch?v=${id}` }
    : null;

const vimeo = (id: string, hash: string | null | undefined): FeaturedVideo => {
  const key = hash && VIMEO_HASH.test(hash) ? hash : '';
  return {
    house: 'vimeo', id,
    embedUrl: `https://player.vimeo.com/video/${id}?dnt=1${key ? `&h=${key}` : ''}`,
    watchUrl: `https://vimeo.com/${id}${key ? `/${key}` : ''}`,
  };
};

export const featuredVideoOf = (raw: string | null | undefined): FeaturedVideo | null => {
  const link = normalizeWebLink(raw);
  if (!link) return null;
  let url: URL;
  try { url = new URL(link); } catch { return null; }
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') return youtube(url.pathname.slice(1).replace(/\/$/, ''));
  if (YOUTUBE_HOSTS.has(host)) {
    if (url.pathname === '/watch') return youtube(url.searchParams.get('v'));
    return youtube(YOUTUBE_PATH.exec(url.pathname)?.[1]);
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = VIMEO_PATH.exec(url.pathname);
    return m ? vimeo(m[1], m[2] || url.searchParams.get('h')) : null;
  }
  return null;
};

// What a person can fix, in their own tongue. Empty is not a fault: the video is optional.
export const featuredVideoProblem = (raw: string | null | undefined): DomainKey | null =>
  !String(raw ?? '').trim() || featuredVideoOf(raw) ? null : 'video_not_known';

// The list a face may show: every link the law can read, in the keeper's order, each video
// once, never more than the cap. What it cannot read is passed over, not shown broken.
export const featuredVideosOf = (raw: unknown): FeaturedVideo[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: FeaturedVideo[] = [];
  for (const link of raw) {
    if (out.length >= FEATURED_VIDEOS_MAX) break;
    const video = typeof link === 'string' ? featuredVideoOf(link) : null;
    if (!video || seen.has(`${video.house}:${video.id}`)) continue;
    seen.add(`${video.house}:${video.id}`);
    out.push(video);
  }
  return out;
};

// What a hand stores from the rows it edits — and how the editor reads what is stored, since
// neither store checks the field: each link as pasted, trimmed; an empty row is not a link;
// what is not text is not a row, and what is not a list has no rows; never more rows than the
// cap. A link the law cannot read is KEPT — the editor names it beside its row, and deleting a
// keeper's typing unasked would hide the fault.
export const featuredVideoLinks = (rows: unknown): string[] =>
  !Array.isArray(rows) ? [] : rows
    .filter((r): r is string => typeof r === 'string')
    .map(r => r.trim())
    .filter(Boolean)
    .slice(0, FEATURED_VIDEOS_MAX);
