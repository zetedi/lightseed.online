// THE RELEASE OF A PICTURE, server side — the pure half. MIRRORS src/domain/pictureRelease.ts;
// tests/pictureRelease.test.ts imports both and holds them equal. index.ts owns the plumbing.
import { IMAGE_VARIANT_SIZES, imageVariantKeyOf, isDerivedImagePath } from "./imageVariant";

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
