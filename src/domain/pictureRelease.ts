import { IMAGE_VARIANT_SIZES, imageVariantKeyOf, isDerivedImagePath, storageObjectOf } from './imageVariant';

// THE RELEASE OF A PICTURE (ring 2026-09-08). Until now nothing ever deleted a picture: a
// replaced logo, a removed hero, a dropped gallery image left the file, its two variants and
// its original copy in the bucket for good. This law names WHICH pictures may be released
// and by WHOM — only the APPEARANCE seats, whose pictures bind to nothing but the document
// that shows them: a community's logo, hero, gallery and landing pages; a person's site logo
// and hero. Everything a CHAIN binds — a pulse's picture, an event's, a tree's portrait, a
// watering photo — is never released: the chain remembers, and its referent must stand.
//
// Plain contract — guaranteed: pictureReleaseOf answers null for every path outside the
// releasable seats (derived prefixes included) and, for a releasable one, its HOLDER (the
// document that may still show it) and every OBJECT to delete (the primary, its variants, its
// original copy); docReferencesPicture is true when any string in the holder's document
// still names the path (raw or URL-encoded). Not guaranteed: who may act for the holder —
// the server proves that (owner, keeper link, staff). Enforced by tests/pictureRelease.test.ts.

export type PictureHolder = { kind: 'community'; id: string } | { kind: 'user'; uid: string };
export interface PictureRelease { holder: PictureHolder; objects: string[] }

const SEGMENT = '[A-Za-z0-9_.~-]+';
const COMMUNITY_SEAT = new RegExp(`^communities/(${SEGMENT})/(?:logo_[^/]+|hero_[^/]+|[0-9]+(?:\\.[A-Za-z0-9]+)?|pages/[^/]+)$`);
const USER_SEAT = new RegExp(`^users/(${SEGMENT})/site-theme/[^/]+$`);

export const pictureReleaseOf = (path: string): PictureRelease | null => {
  if (!path || isDerivedImagePath(path)) return null;
  let holder: PictureHolder | null = null;
  const c = COMMUNITY_SEAT.exec(path);
  if (c) holder = { kind: 'community', id: c[1] };
  const u = USER_SEAT.exec(path);
  if (u) holder = { kind: 'user', uid: u[1] };
  if (!holder) return null;
  const objects = [path, ...IMAGE_VARIANT_SIZES.map((s) => imageVariantKeyOf(path, s)), `originals/${path}`];
  return { holder, objects };
};

// The release a download URL asks for — the URL's own path, or null for anything not ours.
export const pictureReleaseOfUrl = (url: string): PictureRelease | null => {
  const obj = storageObjectOf(url);
  return obj ? pictureReleaseOf(obj.path) : null;
};

// Does the holder's document still show this picture? Every string, at any depth.
export const docReferencesPicture = (doc: unknown, path: string): boolean => {
  const needles = [path, encodeURIComponent(path)];
  const walk = (v: unknown): boolean => {
    if (typeof v === 'string') return needles.some((n) => v.includes(n));
    if (Array.isArray(v)) return v.some(walk);
    if (v && typeof v === 'object') return Object.values(v as Record<string, unknown>).some(walk);
    return false;
  };
  return walk(doc);
};
