import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { storage, functions } from './core';
import { pictureReleaseOfUrl } from '../../domain/pictureRelease';
import { beginNetwork, endNetwork, setUploadProgress } from '../network';
import { IMAGE_MIME, withImageExtension } from '../../domain/imageBytes';
// The darkroom is shared with the independent backend (utils/photoEncode, ring 2026-11-01).
import { encodePhoto, fileToWebpBase64 } from '../../utils/photoEncode';
export { fileToWebpBase64 };

// app live transfer status: the resumable task reports 0..100 to the network store, and the
// global NetworkStatus badge shows "Uploading: N%" under the loader wherever the user is.
export const uploadImage = async (file: Blob, path: string, onProgress?: (pct: number) => void): Promise<string> => {
    const { blob, kind } = await encodePhoto(file);
    // The stored name and label follow the bytes (a/b/1.webp or a/b/1.jpg), never a wish.
    const storageRef = ref(storage, withImageExtension(path, kind));
    beginNetwork();
    setUploadProgress(0);
    try {
        await new Promise<void>((resolve, reject) => {
            const task = uploadBytesResumable(storageRef, blob, { contentType: IMAGE_MIME[kind] });
            task.on('state_changed',
                snap => {
                    const pct = snap.totalBytes > 0 ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
                    setUploadProgress(pct);
                    onProgress?.(pct);
                },
                reject,
                () => resolve());
        });
        return await getDownloadURL(storageRef);
    } finally {
        setUploadProgress(null);
        endNetwork();
    }
};

// An AI-made picture arrives as a data URL. It takes the same road as a picked photo — fitted
// and encoded like every primary — instead of landing raw (a 1280² PNG weighs 2–3 MB; ring
// 2026-09-06 found the AI road the one upload path the encoder never saw).
export const uploadBase64Image = async (dataUrl: string, path: string): Promise<string> => {
    const blob = await (await fetch(dataUrl)).blob();
    return uploadImage(blob, path);
};

// Re-encode a picked image as a small WebP and return its base64 payload (no data: prefix) —
// the compact form vision models want for analysis. Reuses the same resize/encode as uploads.
// A photo as base64 for the AI's eye (the watering witness) — WebP or JPEG, and the mimeType
// names what the bytes really are.


// RELEASING A PICTURE (ring 2026-09-08): after a seat's picture is replaced or removed and the
// holder's document has been written, the old picture leaves the bucket with its variants and
// its original — through the server (functions/releasePicture), which proves the hand and
// that nothing shows it any more. Fire-and-forget: a refusal (still in use, not a releasable
// seat, not ours) is logged, never surfaced — the document is already right.
export const releasePicture = (url: string | null | undefined): void => {
    if (!url || !pictureReleaseOfUrl(url)) return;
    const fn = httpsCallable(functions, 'releasePicture');
    fn({ url }).catch((e) => console.warn('releasePicture:', e?.message || e));
};
