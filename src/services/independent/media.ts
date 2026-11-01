// THE INDEPENDENT NODE'S HAND for media — the mirror of ../firebase/media.ts (ring 2026-11-01).
// Pictures go to the node's own store (migration 019): the API strips metadata, bounds decoding
// and makes the WebP variants itself, so the browser sends the bytes it has. The answer is the
// picture's door on this node (/v1/media?path=…), which every <Picture> renders as any URL.
import type * as F from '../firebase/media';
import { session } from './core';

export const uploadImage: typeof F.uploadImage = async (file, path, onProgress) => {
    onProgress?.(0);
    const result = await session.uploadMedia(path, file) as { url: string };
    onProgress?.(100);
    return result.url;
};
export const uploadBase64Image: typeof F.uploadBase64Image = async (dataUrl, path) => uploadImage(await (await fetch(dataUrl)).blob(), path);
export { fileToWebpBase64 } from '../../utils/photoEncode';
// Release is the node's garbage collection, not yet grown; a picture no longer referenced
// simply stays until it is. Fire-and-forget in both backends, so this hand says so and returns.
export const releasePicture: typeof F.releasePicture = (url) => { if (url) console.warn('releasePicture: not yet grown on this node', url); };
