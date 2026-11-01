import { IMAGE_MIME, imageKindOfMime, type ImageKind } from '../domain/imageBytes';
import { IMAGE_PRIMARY_MAX_EDGE, IMAGE_PRIMARY_QUALITY } from '../domain/imageVariant';

// THE BROWSER'S OWN DARKROOM (lifted from services/firebase/media on 2026-11-01 so both backends
// share one encoder). Resize (cap the longest edge) and re-encode — WebP where the browser can
// encode it, JPEG where it cannot (Safari and iOS answer a WebP request with PNG bytes, silently;
// those uploads then wore `image/webp` over a 3-4 MB PNG and no share-card crawler could decode
// the face — ring 2026-09-05). The blob's REAL kind rides with it, so the upload labels what it
// holds. The edge and quality are the primary's one truth (domain/imageVariant).
export const encodePhoto = (file: Blob, quality = IMAGE_PRIMARY_QUALITY / 100, maxDim = IMAGE_PRIMARY_MAX_EDGE): Promise<{ blob: Blob; kind: ImageKind }> =>
    new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            const longest = Math.max(w, h);
            if (longest > maxDim) {
                const scale = maxDim / longest;
                w = Math.round(w * scale);
                h = Math.round(h * scale);
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            const settle = (blob: Blob | null, wanted: ImageKind) => {
                if (!blob) { reject(new Error('Image conversion failed')); return; }
                // The kind the canvas actually produced — a browser that cannot encode the
                // asked-for type answers with another (PNG), and the label must follow the bytes.
                const kind = imageKindOfMime(blob.type) || wanted;
                resolve({ blob, kind });
            };
            canvas.toBlob(blob => {
                if (blob && imageKindOfMime(blob.type) === 'webp') { settle(blob, 'webp'); return; }
                // No WebP encoder here: JPEG is encodable everywhere and small enough.
                canvas.toBlob(jpeg => settle(jpeg, 'jpeg'), 'image/jpeg', quality);
            }, 'image/webp', quality);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
        img.src = url;
    });

// A photo as base64 for an intelligence to look at (the watering witness): small, re-encoded.
export const fileToWebpBase64 = async (file: File, maxDim = 1024): Promise<{ data: string; mimeType: string }> => {
    const { blob, kind } = await encodePhoto(file, 0.8, maxDim);
    const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error('Could not read image.'));
        r.readAsDataURL(blob);
    });
    const comma = dataUrl.indexOf(',');
    return { data: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl, mimeType: IMAGE_MIME[kind] };
};
