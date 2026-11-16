// THE EXIF PORT — read a photo's tags in the browser and hand them to the pure law in domain/exif,
// which turns them into a place and a moment. Since 2026-11-16 the bytes are read by our own small
// reader (domain/exifRead): exif-js threw in strict mode on every photo carrying a text tag, never
// called back, and this port's timeout answered "no place" for all of them. Two things stay true:
//   · the ORIGINAL file must be read — the crop step re-encodes through a canvas and no EXIF
//     survives it (the ImagePicker passes the original beside the cropped file for this);
//   · only the head of the file is read (EXIF sits in the first segments of a JPEG), so a large
//     photo costs nothing; anything that is not a JPEG with EXIF (HEIC, PNG, a truncated file)
//     answers null at once.
import { photoProvenance, type PhotoProvenance, type WallClock } from '../domain/exif';
import { exifTagsOf } from '../domain/exifRead';

const EXIF_HEAD_BYTES = 256 * 1024; // an APP1 segment is at most 64 KiB and stands before the picture's data

// DateTimeOriginal names no zone: anchor it in the reader's own zone (the planter usually stands
// where the photo was taken), honestly approximate; the GPS stamp, when present, is exact.
const browserClock: WallClock = (y, month1, d, h, mi, s, ms) => new Date(y, month1 - 1, d, h, mi, s, ms).getTime();

export const readPhotoProvenance = async (file: File): Promise<PhotoProvenance | null> => {
  if (!file || file.size === 0) return null;
  try {
    const tags = exifTagsOf(await file.slice(0, EXIF_HEAD_BYTES).arrayBuffer());
    return tags ? photoProvenance(tags, browserClock) : null;
  } catch (e) {
    console.error('EXIF Error:', e);
    return null;
  }
};
