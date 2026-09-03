import { describe, it, expect } from 'vitest';
import {
  gpsToDecimal, gpsAltitudeM, exifMomentMs, photoProvenance, plantedProvenance, UTC_CLOCK, type WallClock,
} from '../src/domain/exif';
import { GENESIS_MOMENT_MS, GENESIS_PLACE } from '../src/domain/genesis';

// exif-js hands back Number objects wearing numerator/denominator; mimic that exactly.
const rational = (numerator: number, denominator = 1) => Object.assign(new Number(numerator / denominator), { numerator, denominator });
const dms = (d: number, m: number, s: number) => [rational(d), rational(m), rational(s * 100, 100)];

describe('gpsToDecimal — degrees, minutes, seconds into a signed decimal', () => {
  it('reads N/E as positive and S/W as negative', () => {
    expect(gpsToDecimal(dms(50, 50, 18.726), 'N', 90)).toBeCloseTo(50.838535, 5);
    expect(gpsToDecimal(dms(4, 22, 49.44), 'E', 180)).toBeCloseTo(4.3804, 5);
    expect(gpsToDecimal(dms(33, 52, 4.8), 'S', 90)).toBeCloseTo(-33.868, 4);
    expect(gpsToDecimal(dms(151, 12, 27.6), 'w', 180)).toBeCloseTo(-151.2077, 4);
  });

  it('accepts plain numbers and fractional minutes with zero seconds (the phone convention)', () => {
    expect(gpsToDecimal([50, 50.3121, 0], 'N', 90)).toBeCloseTo(50.838535, 5);
  });

  it('refuses an incomplete triple, an unknown hemisphere, a zero denominator, or a place off the Earth', () => {
    expect(gpsToDecimal(undefined, 'N', 90)).toBeNull();
    expect(gpsToDecimal([rational(50), rational(50)], 'N', 90)).toBeNull();
    expect(gpsToDecimal(dms(50, 50, 18), undefined, 90)).toBeNull();
    expect(gpsToDecimal(dms(50, 50, 18), 'X', 90)).toBeNull();
    expect(gpsToDecimal([rational(50, 0), rational(0), rational(0)], 'N', 90)).toBeNull();
    expect(gpsToDecimal(dms(91, 0, 0), 'N', 90)).toBeNull();
    expect(gpsToDecimal(dms(181, 0, 0), 'E', 180)).toBeNull();
  });
});

describe('gpsAltitudeM — metres, signed by the sea-level flag', () => {
  it('reads above and below sea level', () => {
    expect(gpsAltitudeM(rational(859, 10), rational(0))).toBeCloseTo(85.9, 5);
    expect(gpsAltitudeM(rational(859, 10), 0)).toBeCloseTo(85.9, 5);
    expect(gpsAltitudeM(rational(42), 1)).toBe(-42);
    expect(gpsAltitudeM(rational(42), '1')).toBe(-42);
    expect(gpsAltitudeM(rational(42), undefined)).toBe(42);
  });
  it('is null without an altitude', () => {
    expect(gpsAltitudeM(undefined, 0)).toBeNull();
  });
});

describe('exifMomentMs — the exposure moment', () => {
  it('prefers the GPS date + time stamp, which is UTC and exact', () => {
    const ms = exifMomentMs({
      gpsDateStamp: '2019:08:18',
      gpsTimeStamp: [rational(17), rational(27), rational(23)],
      dateTimeOriginal: '2019:08:18 19:27:23',
    });
    expect(ms).toBe(GENESIS_MOMENT_MS);
  });

  it('reads DateTimeOriginal on the given wall clock — the Moment, anchored at +02:00', () => {
    const brussels: WallClock = (y, mo, d, h, mi, s, ms) => Date.UTC(y, mo - 1, d, h, mi, s, ms) - 2 * 3600 * 1000;
    expect(exifMomentMs({ dateTimeOriginal: '2019:08:18 19:27:23' }, brussels)).toBe(GENESIS_MOMENT_MS);
    // The default clock is UTC, so the law is deterministic under test.
    expect(exifMomentMs({ dateTimeOriginal: '2019:08:18 17:27:23' })).toBe(GENESIS_MOMENT_MS);
    expect(exifMomentMs({ dateTimeOriginal: '2019:08:18 17:27:23' }, UTC_CLOCK)).toBe(GENESIS_MOMENT_MS);
  });

  it('carries the sub-second fraction', () => {
    expect(exifMomentMs({ dateTimeOriginal: '2019:08:18 17:27:23', subsecTimeOriginal: '250' })).toBe(GENESIS_MOMENT_MS + 250);
    expect(exifMomentMs({ dateTimeOriginal: '2019:08:18 17:27:23', subsecTimeOriginal: 'abc' })).toBe(GENESIS_MOMENT_MS);
  });

  it('is null when no date parses (a date without a time places no moment)', () => {
    expect(exifMomentMs({})).toBeNull();
    expect(exifMomentMs({ dateTimeOriginal: '0000:00:00 00:00:00' })).toBeNull();
    expect(exifMomentMs({ dateTimeOriginal: '2019:08:18' })).toBeNull();
    expect(exifMomentMs({ dateTimeOriginal: 'yesterday' })).toBeNull();
    expect(exifMomentMs({ gpsDateStamp: '2019:08:18' })).toBeNull(); // a GPS date without its time
  });
});

describe('photoProvenance — the whole reading', () => {
  it('places the birth photo of Mahameru where and when it was taken', () => {
    const p = photoProvenance({
      gpsLatitude: dms(50, 50, 18.726), gpsLatitudeRef: 'N',
      gpsLongitude: dms(4, 22, 49.44), gpsLongitudeRef: 'E',
      gpsAltitude: rational(859, 10), gpsAltitudeRef: rational(0),
      gpsDateStamp: '2019:08:18', gpsTimeStamp: [rational(17), rational(27), rational(23)],
    });
    expect(p).not.toBeNull();
    expect(p!.latitude).toBeCloseTo(GENESIS_PLACE.latitude, 5);
    expect(p!.longitude).toBeCloseTo(GENESIS_PLACE.longitude, 5);
    expect(p!.altitudeM).toBeCloseTo(GENESIS_PLACE.altitudeM, 5);
    expect(p!.takenAtMs).toBe(GENESIS_MOMENT_MS);
  });

  it('needs a place — a moment alone, a missing hemisphere, or a 0,0 "no fix" yields nothing', () => {
    expect(photoProvenance({ dateTimeOriginal: '2019:08:18 17:27:23' })).toBeNull();
    expect(photoProvenance({ gpsLatitude: dms(50, 50, 18), gpsLatitudeRef: 'N', gpsLongitude: dms(4, 22, 49) })).toBeNull();
    expect(photoProvenance({ gpsLatitude: dms(0, 0, 0), gpsLatitudeRef: 'N', gpsLongitude: dms(0, 0, 0), gpsLongitudeRef: 'E' })).toBeNull();
  });

  it('a place without altitude or moment stands alone, no undefined fields', () => {
    const p = photoProvenance({ gpsLatitude: dms(50, 50, 18), gpsLatitudeRef: 'N', gpsLongitude: dms(4, 22, 49), gpsLongitudeRef: 'E' });
    expect(p).toEqual({ latitude: expect.any(Number), longitude: expect.any(Number) });
  });
});

describe('plantedProvenance — the fields a tree carries', () => {
  it('maps the reading onto planted* and leaves absent parts absent', () => {
    expect(plantedProvenance({ latitude: 1, longitude: 2 })).toEqual({ plantedLatitude: 1, plantedLongitude: 2 });
    expect(plantedProvenance({ latitude: 1, longitude: 2, altitudeM: 3, takenAtMs: 4 }))
      .toEqual({ plantedLatitude: 1, plantedLongitude: 2, plantedAltitudeM: 3, plantedAtMs: 4 });
  });
});
