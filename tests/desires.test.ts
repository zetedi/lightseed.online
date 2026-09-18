import { describe, it, expect } from 'vitest';
import { DESIRE_KEYS, desiresOf, tongueToWear } from '../src/domain/desires';
import { LANGUAGES, isLanguage } from '../src/domain/tongues';
import { LANGUAGES as SHELL_LANGUAGES, isLanguage as shellIsLanguage } from '../src/utils/translations';

describe('desires — what a being wishes wherever it stands', () => {
  it('reads only known desires with lawful values', () => {
    expect(desiresOf({ tongue: 'ar' })).toEqual({ tongue: 'ar' });
    expect(desiresOf({ tongue: 'klingon' })).toEqual({});
    expect(desiresOf({ tongue: 'ar', mood: 'joy' })).toEqual({ tongue: 'ar' });
    expect(desiresOf(null)).toEqual({});
    expect(desiresOf('ar')).toEqual({});
    expect([...DESIRE_KEYS]).toEqual(['tongue']);
  });
  it('the desire wins over what the browser remembered; no desire, the memory stands', () => {
    expect(tongueToWear('zh', 'en')).toBe('zh');
    expect(tongueToWear(undefined, 'hu')).toBe('hu');
    expect(tongueToWear(null, 'hu')).toBe('hu');
  });
  it('the tongues live in the domain and the shell speaks the same list', () => {
    expect([...SHELL_LANGUAGES]).toEqual([...LANGUAGES]);
    expect(shellIsLanguage).toBe(isLanguage);
    for (const l of LANGUAGES) expect(isLanguage(l)).toBe(true);
    expect(isLanguage('xx')).toBe(false);
  });
});
