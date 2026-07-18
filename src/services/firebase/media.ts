import { ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import { storage } from './core';

// Resize (cap the longest edge) and re-encode as WebP — keeps uploads small.
const toWebP = (file: File, quality = 0.82, maxDim = 1600): Promise<Blob> =>
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
            canvas.toBlob(
                blob => blob ? resolve(blob) : reject(new Error('WebP conversion failed')),
                'image/webp',
                quality
            );
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
        img.src = url;
    });

export const uploadImage = async (file: File, path: string): Promise<string> => {
    const webpPath = path.replace(/\.[^.]+$/, '') + '.webp';
    const blob = await toWebP(file);
    const storageRef = ref(storage, webpPath);
    await uploadBytes(storageRef, blob, { contentType: 'image/webp' });
    return await getDownloadURL(storageRef);
};

export const uploadBase64Image = async (base64String: string, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadString(storageRef, base64String, 'data_url');
    return await getDownloadURL(storageRef);
}

// Re-encode a picked image as a small WebP and return its base64 payload (no data: prefix) —
// the compact form vision models want for analysis. Reuses the same resize/encode as uploads.
export const fileToWebpBase64 = async (file: File, maxDim = 1024): Promise<{ data: string; mimeType: string }> => {
    const blob = await toWebP(file, 0.8, maxDim);
    const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error('Could not read image.'));
        r.readAsDataURL(blob);
    });
    const comma = dataUrl.indexOf(',');
    return { data: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl, mimeType: 'image/webp' };
};

