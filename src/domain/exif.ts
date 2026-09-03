// PHOTO PROVENANCE — principle 10 ("real coordinates, real EXIF moments"): the pure arithmetic
// that turns a photo's EXIF tags into a place and a moment. Reading the bytes needs a browser
// and exif-js (utils/exif.ts, the port); everything AFTER the tags lives here, deterministic and
// tested. A tree planted from a geotagged photo is placed where the photo was taken, and its
// `planted*` provenance (domain/lifetree) carries that moment — the same fields the Moment of
// GENESIS was read from (ring 2026-07-14, "The Moment is the one").

// exif-js hands rationals back as Number objects carrying numerator/denominator; a plain
// number is accepted too, so a caller may pre-resolve.
export interface ExifRational { numerator: number; denominator: number }
export type ExifNumber = number | ExifRational | { valueOf(): number };

export interface PhotoProvenance {
  latitude: number;
  longitude: number;
  altitudeM?: number;  // metres above sea level (negative below); absent when the photo carries none
  takenAtMs?: number;  // the exposure moment; absent when no usable date tag
}

// The raw tags a reader may gather. Every field is optional: a photo carries what it carries.
export interface ExifTags {
  gpsLatitude?: ExifNumber[];   // [degrees, minutes, seconds]
  gpsLatitudeRef?: string;      // 'N' | 'S'
  gpsLongitude?: ExifNumber[];
  gpsLongitudeRef?: string;     // 'E' | 'W'
  gpsAltitude?: ExifNumber;
  gpsAltitudeRef?: ExifNumber | string; // 0 = above sea level, 1 = below
  gpsDateStamp?: string;        // 'YYYY:MM:DD' (UTC)
  gpsTimeStamp?: ExifNumber[];  // [h, m, s] (UTC)
  dateTimeOriginal?: string;    // 'YYYY:MM:DD HH:MM:SS' — the camera's wall clock, no zone
  subsecTimeOriginal?: string;  // fractional seconds as digits ('123' = .123)
}

// A wall clock → milliseconds port. EXIF's DateTimeOriginal names no zone (exif-js reads no
// OffsetTimeOriginal), so the caller chooses how to anchor it — the browser's own zone in the
// app (the planter usually stands where the photo was taken). The default is UTC, so the law
// stays deterministic under test.
export type WallClock = (y: number, month1: number, d: number, h: number, mi: number, s: number, ms: number) => number;
export const UTC_CLOCK: WallClock = (y, month1, d, h, mi, s, ms) => Date.UTC(y, month1 - 1, d, h, mi, s, ms);

const num = (v: ExifNumber | undefined | null): number | null => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'object' && 'numerator' in v && 'denominator' in v) {
    const { numerator, denominator } = v as ExifRational;
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
    return numerator / denominator;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Degrees/minutes/seconds (any of them fractional) and a hemisphere → a signed decimal degree.
// Null when the triple is incomplete or the result leaves the Earth.
export const gpsToDecimal = (dms: ExifNumber[] | undefined, ref: string | undefined, limit: number): number | null => {
  if (!dms || dms.length < 3 || !ref) return null;
  const [d, m, s] = [num(dms[0]), num(dms[1]), num(dms[2])];
  if (d === null || m === null || s === null) return null;
  let decimal = d + m / 60 + s / 3600;
  const hemisphere = ref.trim().toUpperCase();
  if (hemisphere === 'S' || hemisphere === 'W') decimal = -decimal;
  else if (hemisphere !== 'N' && hemisphere !== 'E') return null;
  return Math.abs(decimal) <= limit ? decimal : null;
};

// Altitude in metres; the ref flag 1 means below sea level.
export const gpsAltitudeM = (alt: ExifNumber | undefined, ref: ExifNumber | string | undefined): number | null => {
  const m = num(alt);
  if (m === null) return null;
  const below = ref !== undefined && String(num(ref as ExifNumber) ?? ref) === '1';
  return below ? -m : m;
};

const DATE_RE = /^(\d{4}):(\d{2}):(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/;

// A calendar date that exists. Cameras without a clock write 0000:00:00 — "no date", not year 0.
const calendarDate = (text: string | undefined): { y: number; mo: number; d: number; h?: number; mi?: number; s?: number } | null => {
  const m = text ? DATE_RE.exec(text.trim()) : null;
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  if (y < 1 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (m[4] === undefined) return { y, mo, d };
  const [h, mi, s] = [+m[4], +m[5], +m[6]];
  if (h > 23 || mi > 59 || s > 60) return null;
  return { y, mo, d, h, mi, s };
};

// The exposure moment. The GPS date + time stamp is UTC and exact, so it wins; otherwise
// DateTimeOriginal is read on the given wall clock. Null when neither parses.
export const exifMomentMs = (tags: Pick<ExifTags, 'gpsDateStamp' | 'gpsTimeStamp' | 'dateTimeOriginal' | 'subsecTimeOriginal'>, clock: WallClock = UTC_CLOCK): number | null => {
  const gpsDate = calendarDate(tags.gpsDateStamp);
  if (gpsDate && tags.gpsTimeStamp && tags.gpsTimeStamp.length >= 3) {
    const [h, mi, s] = [num(tags.gpsTimeStamp[0]), num(tags.gpsTimeStamp[1]), num(tags.gpsTimeStamp[2])];
    if (h !== null && mi !== null && s !== null) {
      const whole = Math.floor(s);
      const ms = Date.UTC(gpsDate.y, gpsDate.mo - 1, gpsDate.d, h, mi, whole, Math.round((s - whole) * 1000));
      if (Number.isFinite(ms)) return ms;
    }
  }
  const original = calendarDate(tags.dateTimeOriginal);
  if (!original || original.h === undefined) return null;
  const sub = (tags.subsecTimeOriginal || '').trim();
  const fraction = /^\d+$/.test(sub) ? Math.round(Number(`0.${sub}`) * 1000) : 0;
  const ms = clock(original.y, original.mo, original.d, original.h, original.mi!, original.s!, fraction);
  return Number.isFinite(ms) ? ms : null;
};

// The whole reading: a place is required (no place, no provenance — a moment alone places
// nothing); altitude and moment ride along when present. A 0,0 fix is a camera saying
// "no fix" in the only way it can, not a tree at Null Island.
export const photoProvenance = (tags: ExifTags, clock: WallClock = UTC_CLOCK): PhotoProvenance | null => {
  const latitude = gpsToDecimal(tags.gpsLatitude, tags.gpsLatitudeRef, 90);
  const longitude = gpsToDecimal(tags.gpsLongitude, tags.gpsLongitudeRef, 180);
  if (latitude === null || longitude === null) return null;
  if (latitude === 0 && longitude === 0) return null;
  const out: PhotoProvenance = { latitude, longitude };
  const altitudeM = gpsAltitudeM(tags.gpsAltitude, tags.gpsAltitudeRef);
  if (altitudeM !== null) out.altitudeM = altitudeM;
  const takenAtMs = exifMomentMs(tags, clock);
  if (takenAtMs !== null) out.takenAtMs = takenAtMs;
  return out;
};

// The provenance fields a lifetree carries (domain/lifetree `planted*`), minus the stamp type:
// the moment stays milliseconds here; the service seals it into the backend's Stamp.
export const plantedProvenance = (p: PhotoProvenance): {
  plantedLatitude: number; plantedLongitude: number; plantedAltitudeM?: number; plantedAtMs?: number;
} => ({
  plantedLatitude: p.latitude,
  plantedLongitude: p.longitude,
  ...(p.altitudeM !== undefined ? { plantedAltitudeM: p.altitudeM } : {}),
  ...(p.takenAtMs !== undefined ? { plantedAtMs: p.takenAtMs } : {}),
});
