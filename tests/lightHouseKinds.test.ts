import { describe, it, expect } from 'vitest';
import { LIGHT_HOUSE_KINDS, isLightHouseKind, lightHouseKindKey, lightHouseKindDescKey } from '../src/domain/lightHouse';
import { translations } from '../src/utils/translations';

// The kinds a Light House may be consecrated as (ring 2026-08-21) — a registry with its
// words in every tongue, extensible by adding to BOTH (the DOMAIN_KEYS manifest holds the
// mirror true at compile time; this test holds the spoken words present at run time).

describe('light house kinds — the registry and its words', () => {
  it('the three founding kinds stand, in order', () => {
    expect([...LIGHT_HOUSE_KINDS]).toEqual(['temple', 'ashram', 'sanctuary']);
  });

  it('isLightHouseKind narrows honestly — unknown kinds stay plain strings', () => {
    for (const k of LIGHT_HOUSE_KINDS) expect(isLightHouseKind(k)).toBe(true);
    expect(isLightHouseKind('cathedral')).toBe(false); // a kind not yet minted
    expect(isLightHouseKind('')).toBe(false);
    expect(isLightHouseKind(undefined)).toBe(false);
    expect(isLightHouseKind('Temple')).toBe(false); // kinds are lowercase tokens
  });

  it('every kind speaks a label and a description in the completed tongues', () => {
    for (const lang of ['en', 'ar', 'zh'] as const) {
      const dict = translations[lang] as Record<string, string>;
      for (const k of LIGHT_HOUSE_KINDS) {
        expect(dict[lightHouseKindKey(k)], `${lang}: ${k} label`).toBeTruthy();
        expect(dict[lightHouseKindDescKey(k)], `${lang}: ${k} description`).toBeTruthy();
      }
      expect(dict['lh_kind_label'], `${lang}: the picker label`).toBeTruthy();
      expect(dict['lh_kind_all'], `${lang}: the all-pill`).toBeTruthy();
    }
  });
});
