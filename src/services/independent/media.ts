// THE INDEPENDENT NODE'S HAND for media — the mirror of ../firebase/media.ts (ring 2026-11-01).
// A picture passes the shared darkroom first (utils/photoEncode: fitted to the primary's edge and
// re-encoded, the label following the bytes — so a phone's HEIC leaves the browser as WebP or JPEG,
// as on the origin) and then goes to the node's own store (migration 019), which strips metadata,
// bounds decoding and makes the WebP variants itself. The stored name follows the bytes
// (a/b/1.webp or a/b/1.jpg), never a wish — the store refuses a path without the bytes' own
// extension. The answer is the picture's door on this node (/v1/media?path=…), which every
// <Picture> renders as any URL.
import type * as F from '../firebase/media';
import { session } from './core';
import { withImageExtension } from '../../domain/imageBytes';
import { pictureReleaseOf } from '../../domain/pictureRelease';
import { seedMediaReferencePath } from '../../domain/seedMedia.mjs';
import { encodePhoto, fileToWebpBase64 } from '../../utils/photoEncode';
export { fileToWebpBase64 };

export const uploadImage: typeof F.uploadImage = async (file, path, onProgress) => {
    const { blob, kind } = await encodePhoto(file);
    onProgress?.(0);
    const result = await session.uploadMedia(withImageExtension(path, kind), blob) as { url: string };
    onProgress?.(100);
    return result.url;
};
export const uploadBase64Image: typeof F.uploadBase64Image = async (dataUrl, path) => uploadImage(await (await fetch(dataUrl)).blob(), path);

// RELEASING A PICTURE (ring 2026-11-03): after a seat's picture is replaced or removed and the
// holder's document has been written, the old picture leaves the node with its variants — through
// the API (POST /v1/media/release, migration 060), which proves the hand and that nothing shows it
// any more, and frees the bytes only when no other picture shares them. Fire-and-forget, as on the
// origin: a refusal (still in use, not a releasable seat, not ours) is logged, never surfaced — the
// document is already right.
export const releasePicture: typeof F.releasePicture = (url) => {
    const path = url ? seedMediaReferencePath(url) : null;
    if (!url || !path || !pictureReleaseOf(path)) return;
    session.releaseMedia(url).catch((e: unknown) => console.warn('releasePicture:', e instanceof Error ? e.message : e));
};
