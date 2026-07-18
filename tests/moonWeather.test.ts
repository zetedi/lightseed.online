import { describe, it, expect } from 'vitest';
import { moonPhase, SYNODIC_MONTH_DAYS } from '../src/domain/moon';
import { isForecastable, isPhysicalLocation, weatherFace, FORECAST_HORIZON_DAYS } from '../src/domain/weather';

const EPOCH_NEW_MOON = 947182440000; // 2000-01-06 18:14 UTC — the algorithm's anchor
const DAY = 86400000;

describe('moonPhase', () => {
  it('the anchor is a new moon', () => {
    expect(moonPhase(new Date(EPOCH_NEW_MOON)).name).toBe('New Moon');
  });
  it('half a synodic month later the moon is full', () => {
    expect(moonPhase(new Date(EPOCH_NEW_MOON + (SYNODIC_MONTH_DAYS / 2) * DAY)).name).toBe('Full Moon');
    expect(moonPhase(new Date(EPOCH_NEW_MOON + (SYNODIC_MONTH_DAYS / 2) * DAY)).emoji).toBe('🌕');
  });
  it('quarters land on quarters, and dates before the anchor still resolve', () => {
    expect(moonPhase(new Date(EPOCH_NEW_MOON + (SYNODIC_MONTH_DAYS / 4) * DAY)).name).toBe('First Quarter');
    expect(moonPhase(new Date(EPOCH_NEW_MOON - (SYNODIC_MONTH_DAYS / 4) * DAY)).name).toBe('Last Quarter');
  });
  it('a full cycle returns to new', () => {
    expect(moonPhase(new Date(EPOCH_NEW_MOON + SYNODIC_MONTH_DAYS * DAY)).name).toBe('New Moon');
  });
});

describe('weatherFace', () => {
  it('maps the WMO vocabulary to faces', () => {
    expect(weatherFace(0)).toEqual({ emoji: '☀️', label: 'Clear' });
    expect(weatherFace(63).label).toBe('Rain');
    expect(weatherFace(95).emoji).toBe('⛈️');
    expect(weatherFace(999).label).toBe('Weather'); // unknown codes stay calm
  });
});

describe('isPhysicalLocation — the internet has no weather', () => {
  it('accepts places under the sky', () => {
    expect(isPhysicalLocation('Budapest, Per Auset garden')).toBe(true);
    expect(isPhysicalLocation('The Olive Grove, Crete')).toBe(true);
  });
  it('rejects online rooms, links, and emptiness', () => {
    expect(isPhysicalLocation('Online')).toBe(false);
    expect(isPhysicalLocation('Zoom call')).toBe(false);
    expect(isPhysicalLocation('https://meet.example.org/xyz')).toBe(false);
    expect(isPhysicalLocation('meet.google.com/abc')).toBe(false);
    expect(isPhysicalLocation('')).toBe(false);
    expect(isPhysicalLocation(undefined)).toBe(false);
  });
});

describe('isForecastable', () => {
  const now = Date.parse('2026-07-13T12:00:00Z');
  it('within the 16-day horizon: forecast; past or far: current sky', () => {
    expect(isForecastable('2026-07-20T18:00:00Z', now)).toBe(true);
    expect(isForecastable(new Date(now + (FORECAST_HORIZON_DAYS + 2) * DAY).toISOString(), now)).toBe(false);
    expect(isForecastable('2026-07-01T18:00:00Z', now)).toBe(false);
    expect(isForecastable(undefined, now)).toBe(false);
    expect(isForecastable('not-a-date', now)).toBe(false);
  });
});
