// THE EXIF READER (2026-11-16) — the bytes of a JPEG → the tags domain/exif needs, pure and tested.
// It replaces exif-js: that library assigns an undeclared loop variable in its string reader, which
// throws in strict mode — and every module of the built app is strict — so it never called back for
// ANY photo carrying a text tag (every camera writes its make and model); the port's timeout then
// answered "no place" eight seconds later, for every photo. This reader takes only what the law
// reads: the GPS directory (place, altitude, UTC date and time) and the exposure moment.
//
// What is guaranteed: a JPEG whose first APP1 segment is EXIF, in either byte order, is read; every
// offset is checked against the segment, so a truncated or hostile file yields null (or the tags
// that could be read), never a throw and never a hang. What is not: HEIC, PNG and WebP are not read
// (null) — a phone's picker usually hands the browser a JPEG. Rationals are handed on as
// numerator/denominator, so a zero denominator is refused by the law, not divided here.
import type { ExifTags, ExifRational } from './exif';

const TYPE_BYTES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
const MAX_ENTRIES = 512;

interface Entry { type: number; count: number; at: number }

export const exifTagsOf = (input: ArrayBuffer | Uint8Array): ExifTags | null => {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size = view.byteLength;
  if (size < 4 || view.getUint16(0) !== 0xFFD8) return null;

  // The first APP1 segment that says "Exif": the TIFF block inside it.
  let tiff = -1, end = 0;
  for (let at = 2; at + 4 <= size;) {
    if (view.getUint8(at) !== 0xFF) return null;
    const marker = view.getUint8(at + 1);
    if (marker === 0xFF) { at++; continue; }          // fill bytes before a marker
    if (marker === 0xDA || marker === 0xD9) return null; // the picture's own data: no EXIF before it
    const length = view.getUint16(at + 2);
    if (length < 2) return null;
    if (marker === 0xE1 && at + 10 <= size && view.getUint32(at + 4) === 0x45786966 && view.getUint16(at + 8) === 0) {
      tiff = at + 10; end = Math.min(size, at + 2 + length); break;
    }
    at += 2 + length;
  }
  if (tiff < 0 || tiff + 8 > end) return null;

  const order = view.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4D4D) return null;
  const little = order === 0x4949;
  const u16 = (at: number) => view.getUint16(at, little);
  const u32 = (at: number) => view.getUint32(at, little);
  if (u16(tiff + 2) !== 42) return null;

  // One directory: tag → where its value lies. Anything that leaves the segment is left out.
  const directory = (offset: number): Map<number, Entry> => {
    const entries = new Map<number, Entry>();
    const start = tiff + offset;
    if (offset < 8 || start + 2 > end) return entries;
    const count = Math.min(u16(start), MAX_ENTRIES);
    for (let i = 0; i < count; i++) {
      const at = start + 2 + i * 12;
      if (at + 12 > end) break;
      const type = u16(at + 2), n = u32(at + 4);
      const width = TYPE_BYTES[type];
      if (!width || n === 0 || n > 0xFFFF) continue;
      const total = width * n;
      const valueAt = total <= 4 ? at + 8 : tiff + u32(at + 8);
      if (valueAt < tiff || valueAt + total > end) continue;
      entries.set(u16(at), { type, count: n, at: valueAt });
    }
    return entries;
  };
  const pointer = (dir: Map<number, Entry>, tag: number): number | null => {
    const e = dir.get(tag);
    return e && e.type === 4 && e.count === 1 ? u32(e.at) : null;
  };
  const text = (e: Entry | undefined): string | undefined => {
    if (!e || e.type !== 2) return undefined;
    let out = '';
    for (let i = 0; i < e.count; i++) { const c = view.getUint8(e.at + i); if (c === 0) break; out += String.fromCharCode(c); }
    return out || undefined;
  };
  const rationals = (e: Entry | undefined, n: number): ExifRational[] | undefined => {
    if (!e || e.type !== 5 || e.count < n) return undefined;
    return Array.from({ length: n }, (_, i) => ({ numerator: u32(e.at + i * 8), denominator: u32(e.at + i * 8 + 4) }));
  };

  const tags: ExifTags = {};
  try {
    const ifd0 = directory(u32(tiff + 4));
    const gpsAt = pointer(ifd0, 0x8825);
    if (gpsAt !== null) {
      const gps = directory(gpsAt);
      tags.gpsLatitudeRef = text(gps.get(1));
      tags.gpsLatitude = rationals(gps.get(2), 3);
      tags.gpsLongitudeRef = text(gps.get(3));
      tags.gpsLongitude = rationals(gps.get(4), 3);
      const altitudeRef = gps.get(5);
      if (altitudeRef && altitudeRef.type === 1) tags.gpsAltitudeRef = view.getUint8(altitudeRef.at);
      tags.gpsAltitude = rationals(gps.get(6), 1)?.[0];
      tags.gpsTimeStamp = rationals(gps.get(7), 3);
      tags.gpsDateStamp = text(gps.get(29));
    }
    const exifAt = pointer(ifd0, 0x8769);
    if (exifAt !== null) {
      const exif = directory(exifAt);
      tags.dateTimeOriginal = text(exif.get(0x9003));
      tags.subsecTimeOriginal = text(exif.get(0x9291));
    }
  } catch { /* a value that left the buffer: what was read stands */ }
  for (const key of Object.keys(tags) as Array<keyof ExifTags>) if (tags[key] === undefined) delete tags[key];
  return Object.keys(tags).length ? tags : null;
};
