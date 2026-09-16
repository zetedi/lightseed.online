// pictures.ts — split from index.ts (ring 2026-09-16); every function keeps its name, trigger and options.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getStorage } from "firebase-admin/storage";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { IMAGE_VARIANT_SIZES, IMAGE_VARIANT_QUALITY, imageVariantKeyOf, isDerivedImagePath, storageObjectOf } from "./imageVariant";
import { pictureReleaseOf, docReferencesPicture } from "./pictureRelease";
import sharp from "sharp";
import { FACE_BUCKET, db, isStaffUid } from "./core";

// --- IMAGE VARIANTS ------------------------------------------------------------------------
// Every primary picture written to the bucket gets its small faces made here, once, at
// upload: thumbs/<path>@480.webp and @1200.webp (domain/imageVariant, mirrored in
// ./imageVariant). Fitted inside, never enlarged, upright by EXIF, alpha kept; immutable at
// the CDN, because a primary's path never changes (uploads are named by their moment, and
// the recode of stored primaries keeps path and token — ring 2026-09-06). A derived object
// never derives again (isDerivedImagePath), and a picture the decoder cannot read leaves no
// variant — the renderer's fallback to the primary stands.
const RASTER_IMAGE_RE = /^image\/(jpeg|jpg|png|webp|gif|heic|heif|avif|tiff)$/i;

export const deriveImageVariants = onObjectFinalized({ bucket: FACE_BUCKET, memory: "1GiB", timeoutSeconds: 120 }, async (event) => {
    const name = event.data.name || "";
    if (!name || isDerivedImagePath(name) || !RASTER_IMAGE_RE.test(event.data.contentType || "")) return;
    const bucket = getStorage().bucket(event.data.bucket);
    try {
        const [source] = await bucket.file(name).download();
        const upright = sharp(source, { failOn: "none", limitInputPixels: 80_000_000 }).rotate();
        for (const size of IMAGE_VARIANT_SIZES) {
            const out = await upright.clone()
                .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
                .webp({ quality: IMAGE_VARIANT_QUALITY })
                .toBuffer();
            await bucket.file(imageVariantKeyOf(name, size)).save(out, {
                contentType: "image/webp",
                resumable: false,
                metadata: { cacheControl: "public, max-age=31536000, immutable", metadata: { source: name } },
            });
        }
    } catch (e) {
        console.error(`deriveImageVariants failed for ${name}:`, e);
    }
});

// --- RELEASING A PICTURE (ring 2026-09-08) --------------------------------------------------
// A replaced logo, a removed hero, a dropped gallery image: the picture leaves the bucket with
// its variants and its original copy — but only from the APPEARANCE seats the law names
// (./pictureRelease, mirrored from domain), only by a hand that holds the seat (the community's
// owner or keeper, the person themself, staff), and only once the holder's document no longer
// shows it. A chain-bound picture is never released; a still-shown one is refused.
export const releasePicture = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    const uid = request.auth.uid;
    const url = String(request.data?.url || "");
    const obj = storageObjectOf(url);
    if (!obj || obj.bucket !== FACE_BUCKET) throw new HttpsError("invalid-argument", "picture_not_ours");
    const release = pictureReleaseOf(obj.path);
    if (!release) throw new HttpsError("failed-precondition", "picture_not_releasable");

    let holderDoc: Record<string, unknown> | null = null;
    if (release.holder.kind === "community") {
        const snap = await db.collection("communities").doc(release.holder.id).get();
        holderDoc = snap.exists ? (snap.data() as Record<string, unknown>) : null;
        const keeperLink = await db.collection("links").doc(`${uid}__keeper__${release.holder.id}`).get();
        const may = (holderDoc?.ownerId === uid) || keeperLink.exists || (await isStaffUid(uid));
        if (!may) throw new HttpsError("permission-denied", "picture_not_yours");
    } else {
        if (release.holder.uid !== uid && !(await isStaffUid(uid))) throw new HttpsError("permission-denied", "picture_not_yours");
        const snap = await db.collection("users").doc(release.holder.uid).get();
        holderDoc = snap.exists ? (snap.data() as Record<string, unknown>) : null;
    }
    if (holderDoc && docReferencesPicture(holderDoc, obj.path)) throw new HttpsError("failed-precondition", "picture_in_use");

    const bucket = getStorage().bucket(FACE_BUCKET);
    let released = 0;
    for (const name of release.objects) {
        try { await bucket.file(name).delete(); released++; } catch (e: unknown) { const err = e as { code?: number; message?: string } | null; if (err?.code !== 404) console.warn(`releasePicture: ${name}:`, err?.message || e); }
    }
    return { released };
});
