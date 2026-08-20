import { describe, it, expect } from 'vitest';
import { SECTION_DOORS, sectionFromPath, sectionPath } from '../src/domain/sectionDoor';

// The section doors (ring 2026-08-19): the hybrid adoption shape's smallest part — a
// mother site links straight into rooms of its seed subdomain with plain URLs.

describe('section doors — plain URLs open the rooms', () => {
  it('every named room opens, with or without a trailing slash', () => {
    for (const [segment, tab] of Object.entries(SECTION_DOORS)) {
      expect(sectionFromPath(`/${segment}`)).toBe(tab);
      expect(sectionFromPath(`/${segment}/`)).toBe(tab);
    }
  });

  it('the doors are a registry, not a pattern — unknown and reserved paths stay closed', () => {
    expect(sectionFromPath('/')).toBeNull();
    expect(sectionFromPath('/eventside')).toBeNull();          // whole segments only
    expect(sectionFromPath('/events/next')).toBeNull();        // one segment only
    expect(sectionFromPath('/b/019f6381-48fd-7fcc-9382-e99d923f38f4')).toBeNull(); // the being door
    expect(sectionFromPath('/i/abc123')).toBeNull();           // the invitation door
    expect(sectionFromPath('/model')).toBeNull();              // the hidden diagram
    expect(sectionFromPath('/u/x')).toBeNull();                // the unsubscribe rewrite
    expect(sectionFromPath('/Events')).toBeNull();             // doors are lowercase
  });

  it('sectionPath is the exact inverse for door-bearing tabs, null for private rooms', () => {
    for (const [segment, tab] of Object.entries(SECTION_DOORS)) {
      expect(sectionPath(tab)).toBe(`/${segment}`);
      expect(sectionFromPath(sectionPath(tab)!)).toBe(tab);
    }
    expect(sectionPath('dashboard')).toBeNull();
    expect(sectionPath('profile')).toBeNull();
    expect(sectionPath('newsletter')).toBeNull();
    // Registry hygiene: a door must never be minted for a prototype-chain name.
    expect(sectionPath('toString')).toBeNull();
    expect(sectionFromPath('/tostring')).toBeNull();
    expect(sectionFromPath('/constructor')).toBeNull(); // inherited AND truthy — the sharp one
  });
});
