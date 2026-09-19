import { describe, it, expect } from 'vitest';
import { COIN_CODE_MAX, COIN_NAME_MAX, coinOf, coinProblem, coinTitle, normalizeCoin } from '../src/domain/coin';
import { formatLight, RAY_UNITS } from '../src/domain/light';

const perAuset = { domain: 'seed.perauset.org', logoUrl: 'https://x/logo.webp', coin: { name: 'Blue Lotus Universal Exchange', code: 'BLUE' } };

describe('the coin — a community names the face of its light, never its physics', () => {
  it('the shell speaks Light when a community names none', () => {
    expect(coinOf(null)).toEqual({ name: 'Light', code: 'light', color: '#f59e0b', place: null, logoUrl: null, own: false });
    expect(coinOf({ domain: 'lightseed.online', coin: null })).toMatchObject({ name: 'Light', own: false });
  });
  it('a named coin wears the community\'s place and logo', () => {
    expect(coinOf(perAuset)).toEqual({ name: 'Blue Lotus Universal Exchange', code: 'BLUE', color: '#f59e0b', place: 'seed.perauset.org', logoUrl: 'https://x/logo.webp', own: true });
    expect(coinOf({ ...perAuset, coin: { ...perAuset.coin, color: '#3F6CAB' } }).color).toBe('#3f6cab');
    expect(coinOf({ ...perAuset, coin: { ...perAuset.coin, color: 'blue' } }).color).toBe('#f59e0b');
    expect(coinTitle(coinOf(perAuset))).toBe('BLUE · seed.perauset.org');
    expect(coinTitle(coinOf(null))).toBe('Light');
  });
  it('a half-named coin completes itself; an empty one is none', () => {
    expect(normalizeCoin({ name: 'Blue Lotus' })).toEqual({ name: 'Blue Lotus', code: 'BlueLotu' });
    expect(normalizeCoin({ code: 'BLUE' })).toEqual({ name: 'BLUE', code: 'BLUE' });
    expect(normalizeCoin({ name: '  ', code: '' })).toBe(null);
  });
  it('refuses a long name or a code that is not letters and digits', () => {
    expect(coinProblem({ name: 'x'.repeat(COIN_NAME_MAX + 1) })).toBe('coin_name_long');
    expect(coinProblem({ code: 'B L' })).toBe('coin_code_bad');
    expect(coinProblem({ code: 'x'.repeat(COIN_CODE_MAX + 1) })).toBe('coin_code_bad');
    expect(coinProblem({ name: 'Blue Lotus', code: 'BLUE' })).toBe(null);
    expect(normalizeCoin({ code: 'B L' })).toBe(null);
  });
  it('the physics stays: rays are rays whatever the coin; the unit word is the coin\'s code', () => {
    expect(formatLight(RAY_UNITS)).toBe('1 ray');
    expect(formatLight(RAY_UNITS, coinOf(perAuset))).toBe('1 ray');
    expect(formatLight(50)).toBe('50 light');
    expect(formatLight(50, coinOf(perAuset))).toBe('50 BLUE');
    expect(formatLight(0, coinOf(perAuset))).toBe('0 BLUE');
  });
});
