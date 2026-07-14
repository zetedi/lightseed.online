import { describe, it, expect } from 'vitest';
import { GENESIS_MOMENT_ISO, GENESIS_MOMENT_MS, GENESIS_PLACE, GENESIS_MEANING } from '../src/domain/genesis';

// The Moment — golden and immovable. If any of these fail, someone touched the origin.

describe('the genesis moment', () => {
  it('ISO and milliseconds agree — 2019-08-18 19:27:23 +02:00', () => {
    expect(Date.parse(GENESIS_MOMENT_ISO)).toBe(GENESIS_MOMENT_MS);
    expect(new Date(GENESIS_MOMENT_MS).toISOString()).toBe('2019-08-18T17:27:23.000Z');
  });
  it('the place is the pond by Place Jourdain, Brussels', () => {
    expect(GENESIS_PLACE.latitude).toBeCloseTo(50.838535, 6);
    expect(GENESIS_PLACE.longitude).toBeCloseTo(4.3804, 4);
    expect(GENESIS_PLACE.altitudeM).toBeCloseTo(85.9, 1);
    expect(GENESIS_PLACE.name).toBe('The Source');
  });
  it('the meaning is named — simply', () => {
    expect(GENESIS_MEANING).toBe('The end of the search.');
  });
});
