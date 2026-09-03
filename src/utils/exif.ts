// THE EXIF PORT — read a photo's tags in the browser (exif-js, loaded lazily so it stays out of
// the main bundle until a photo is actually inspected) and hand them to the pure law in
// domain/exif, which turns them into a place and a moment. Two things this port guards:
//   · the ORIGINAL file must be read — the crop step re-encodes through a canvas and no EXIF
//     survives it (the ImagePicker passes the original beside the cropped file for this);
//   · exif-js only ever calls back for a JPEG it could parse; anything else (HEIC, PNG, a
//     truncated file) would leave the promise hanging forever, so a timeout resolves null.
import { photoProvenance, type PhotoProvenance, type WallClock } from '../domain/exif';

const EXIF_TIMEOUT_MS = 8000;

// DateTimeOriginal names no zone: anchor it in the reader's own zone (the planter usually stands
// where the photo was taken), honestly approximate; the GPS stamp, when present, is exact.
const browserClock: WallClock = (y, month1, d, h, mi, s, ms) => new Date(y, month1 - 1, d, h, mi, s, ms).getTime();

export const readPhotoProvenance = async (file: File): Promise<PhotoProvenance | null> => {
  if (!file || file.size === 0) return null;
  const EXIF = (await import('exif-js')).default;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: PhotoProvenance | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(v);
    };
    const timer = window.setTimeout(() => finish(null), EXIF_TIMEOUT_MS);
    try {
      const started = EXIF.getData(file as any, function (this: any) {
        const tag = (name: string) => EXIF.getTag(this, name);
        finish(photoProvenance({
          gpsLatitude: tag('GPSLatitude'),
          gpsLatitudeRef: tag('GPSLatitudeRef'),
          gpsLongitude: tag('GPSLongitude'),
          gpsLongitudeRef: tag('GPSLongitudeRef'),
          gpsAltitude: tag('GPSAltitude'),
          gpsAltitudeRef: tag('GPSAltitudeRef'),
          gpsDateStamp: tag('GPSDateStamp'),
          gpsTimeStamp: tag('GPSTimeStamp'),
          dateTimeOriginal: tag('DateTimeOriginal'),
          subsecTimeOriginal: tag('SubsecTimeOriginal'),
        }, browserClock));
      });
      if (started === false) finish(null);
    } catch (e) {
      console.error('EXIF Error:', e);
      finish(null);
    }
  });
};
