import { describe, it, expect } from 'vitest';
import { exifTagsOf } from '../src/domain/exifRead';
import { photoProvenance } from '../src/domain/exif';

// THE EXIF READER (2026-11-16): a JPEG's bytes → the tags the law reads. The fixture is built here,
// byte by byte, in both byte orders — the same shape a camera writes (IFD0 → Exif IFD, GPS IFD).
type Value = { tag: number; type: 1 | 2 | 4 | 5; ascii?: string; byte?: number; long?: number; rationals?: Array<[number, number]> };

const tiffOf = (little: boolean, gps: Value[], exif: Value[]): Uint8Array => {
  const out: number[] = [];
  const u16 = (v: number) => (little ? [v & 255, v >> 8] : [v >> 8, v & 255]);
  const u32 = (v: number) => (little ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255] : [(v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255]);
  const dataOf = (v: Value): number[] => v.type === 2 ? [...[...v.ascii!].map(c => c.charCodeAt(0)), 0]
    : v.type === 1 ? [v.byte!] : v.type === 4 ? u32(v.long!) : v.rationals!.flatMap(([n, d]) => [...u32(n), ...u32(d)]);
  const countOf = (v: Value) => v.type === 2 ? v.ascii!.length + 1 : v.type === 5 ? v.rationals!.length : 1;
  // Layout: header(8) IFD0 | Exif IFD | GPS IFD | the values that do not fit in four bytes.
  const sizeOf = (entries: Value[]) => 2 + entries.length * 12 + 4;
  const ifd0At = 8, exifAt = ifd0At + sizeOf([{} as Value, {} as Value]), gpsAt = exifAt + sizeOf(exif);
  let heapAt = gpsAt + sizeOf(gps);
  const heap: number[] = [];
  const directory = (entries: Value[]) => {
    const bytes = [...u16(entries.length)];
    for (const v of entries) {
      const data = dataOf(v);
      bytes.push(...u16(v.tag), ...u16(v.type), ...u32(countOf(v)));
      if (data.length <= 4) bytes.push(...data, ...Array(4 - data.length).fill(0));
      else { bytes.push(...u32(heapAt)); heap.push(...data); heapAt += data.length; }
    }
    return [...bytes, ...u32(0)];
  };
  out.push(...(little ? [0x49, 0x49] : [0x4D, 0x4D]), ...u16(42), ...u32(ifd0At));
  out.push(...directory([{ tag: 0x8769, type: 4, long: exifAt }, { tag: 0x8825, type: 4, long: gpsAt }]));
  out.push(...directory(exif), ...directory(gps), ...heap);
  return Uint8Array.from(out);
};
const jpegOf = (tiff: Uint8Array, before: number[] = []): Uint8Array => {
  const length = 2 + 6 + tiff.length;
  return Uint8Array.from([0xFF, 0xD8, ...before, 0xFF, 0xE1, length >> 8, length & 255, 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff, 0xFF, 0xDA, 0, 2, 0xFF, 0xD9]);
};
const JFIF = [0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
// Budapest, 47°29'52.62"N 19°2'24.96"E, 112.5 m, 2026-11-16 09:30:15 UTC.
const GPS: Value[] = [
  { tag: 1, type: 2, ascii: 'N' }, { tag: 2, type: 5, rationals: [[47, 1], [29, 1], [5262, 100]] },
  { tag: 3, type: 2, ascii: 'E' }, { tag: 4, type: 5, rationals: [[19, 1], [2, 1], [2496, 100]] },
  { tag: 5, type: 1, byte: 0 }, { tag: 6, type: 5, rationals: [[1125, 10]] },
  { tag: 7, type: 5, rationals: [[9, 1], [30, 1], [15, 1]] }, { tag: 29, type: 2, ascii: '2026:11:16' },
];
const EXIF: Value[] = [{ tag: 0x9003, type: 2, ascii: '2026:11:16 10:30:15' }, { tag: 0x9291, type: 2, ascii: '250' }];

describe('exifTagsOf — a photo\'s bytes become the tags the law reads', () => {
  for (const little of [true, false]) {
    it(`reads the place and the moment (${little ? 'little' : 'big'}-endian)`, () => {
      const tags = exifTagsOf(jpegOf(tiffOf(little, GPS, EXIF), JFIF));
      expect(tags?.gpsLatitudeRef).toBe('N');
      expect(tags?.gpsLongitudeRef).toBe('E');
      expect(tags?.gpsLatitude).toEqual([{ numerator: 47, denominator: 1 }, { numerator: 29, denominator: 1 }, { numerator: 5262, denominator: 100 }]);
      expect(tags?.gpsDateStamp).toBe('2026:11:16');
      expect(tags?.dateTimeOriginal).toBe('2026:11:16 10:30:15');
      expect(tags?.subsecTimeOriginal).toBe('250');
      const place = photoProvenance(tags!);
      expect(place?.latitude).toBeCloseTo(47 + 29 / 60 + 52.62 / 3600, 9);
      expect(place?.longitude).toBeCloseTo(19 + 2 / 60 + 24.96 / 3600, 9);
      expect(place?.altitudeM).toBe(112.5);
      expect(place?.takenAtMs).toBe(Date.UTC(2026, 10, 16, 9, 30, 15)); // the GPS stamp is UTC and wins
    });
  }
  it('accepts a buffer as well as a view into a larger one', () => {
    const jpeg = jpegOf(tiffOf(true, GPS, EXIF));
    const padded = new Uint8Array(jpeg.length + 7); padded.set(jpeg, 7);
    expect(exifTagsOf(jpeg.buffer.slice(0) as ArrayBuffer)?.gpsLatitudeRef).toBe('N');
    expect(exifTagsOf(padded.subarray(7))?.gpsLatitudeRef).toBe('N');
  });
  it('a photo with a moment and no place has tags, and no provenance', () => {
    const tags = exifTagsOf(jpegOf(tiffOf(true, [], EXIF)));
    expect(tags).toEqual({ dateTimeOriginal: '2026:11:16 10:30:15', subsecTimeOriginal: '250' });
    expect(photoProvenance(tags!)).toBeNull();
  });
  it('a zero denominator is handed on and refused by the law, never divided here', () => {
    const broken = GPS.map(v => (v.tag === 2 ? { ...v, rationals: [[47, 1], [29, 0], [0, 1]] as Array<[number, number]> } : v));
    const tags = exifTagsOf(jpegOf(tiffOf(true, broken, [])));
    expect(tags?.gpsLatitude?.[1]).toEqual({ numerator: 29, denominator: 0 });
    expect(photoProvenance(tags!)).toBeNull();
  });
  it('what is not a JPEG with EXIF answers null', () => {
    expect(exifTagsOf(new Uint8Array(0))).toBeNull();
    expect(exifTagsOf(Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))).toBeNull(); // PNG
    expect(exifTagsOf(Uint8Array.from([0xFF, 0xD8, 0xFF, 0xD9]))).toBeNull();                          // an empty JPEG
    expect(exifTagsOf(Uint8Array.from([0xFF, 0xD8, ...JFIF, 0xFF, 0xDA, 0, 2, 0xFF, 0xD9]))).toBeNull(); // JFIF only
  });
  it('a truncated or lying file never throws and never loops', () => {
    const whole = jpegOf(tiffOf(true, GPS, EXIF), JFIF);
    for (let cut = 0; cut < whole.length; cut++) expect(() => exifTagsOf(whole.subarray(0, cut))).not.toThrow();
    const lying = Uint8Array.from(whole);
    for (let i = 30; i < lying.length; i += 3) { const copy = Uint8Array.from(lying); copy[i] = 0xFF; expect(() => exifTagsOf(copy)).not.toThrow(); }
    const zeroLength = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xE2, 0, 0, 0xFF, 0xE1, 0, 8]);
    expect(exifTagsOf(zeroLength)).toBeNull();
  });
});
