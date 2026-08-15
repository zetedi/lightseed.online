import { describe, it, expect, vi } from 'vitest';
import { SECTION_KINDS, sectionProblem, parseLandingSections, MAX_LANDING_SECTIONS } from '../src/domain/appearance';

// The registry's components import the browser-coupled Firebase services; the mirror test
// needs only their EXISTENCE, so the service seam is mocked before the registry loads.
vi.mock('../src/services/firebase', () => ({ fetchEventPulses: async () => ({ items: [], lastDoc: null }) }));
const { SECTION_COMPONENTS } = await import('../src/components/landing/registry');

// Landing sections (ring 2026-08-16): components in the repo, compositions in the database.
// The mirror test is the heart: a kind without a component (or component without a law)
// must fail HERE, not in a visitor's browser.

describe('the registry mirrors the law, both directions', () => {
  it('every kind has a reviewed component; every component has a lawful kind', () => {
    for (const kind of SECTION_KINDS) {
      expect(SECTION_COMPONENTS[kind], `kind '${kind}' has no component in the registry`).toBeTruthy();
    }
    for (const kind of Object.keys(SECTION_COMPONENTS)) {
      expect(SECTION_KINDS.includes(kind as (typeof SECTION_KINDS)[number]), `component '${kind}' has no law in SECTION_KINDS`).toBe(true);
    }
  });
});

describe('sectionProblem — junk never reaches the renderer', () => {
  it('a lawful hearth passes, empty props included', () => {
    expect(sectionProblem({ kind: 'hearth_hero', props: {} })).toBeNull();
    expect(sectionProblem({ kind: 'hearth_hero', props: { imageUrl: 'https://x.example/f.webp', headline: 'The Heart Fire', showEvents: true, maxEvents: 4 } })).toBeNull();
  });
  it('unknown kinds are refused by name', () => {
    expect(sectionProblem({ kind: 'raw_html', props: {} })).toBe('appearance_unknown_kind');
    expect(sectionProblem({ kind: undefined, props: {} })).toBe('appearance_unknown_kind');
  });
  it('unlawful props are refused: http-only images, capped headline, bounded events', () => {
    expect(sectionProblem({ kind: 'hearth_hero', props: { imageUrl: 'javascript:alert(1)' } })).toBe('appearance_bad_props');
    expect(sectionProblem({ kind: 'hearth_hero', props: { imageUrl: 'http://insecure.example/x.png' } })).toBe('appearance_bad_props');
    expect(sectionProblem({ kind: 'hearth_hero', props: { headline: 'x'.repeat(141) } })).toBe('appearance_bad_props');
    expect(sectionProblem({ kind: 'hearth_hero', props: { maxEvents: 0 } })).toBe('appearance_bad_props');
    expect(sectionProblem({ kind: 'hearth_hero', props: { maxEvents: 7 } })).toBe('appearance_bad_props');
  });
});

describe('parseLandingSections — the tolerant read', () => {
  it('keeps order, drops junk, caps the count, survives non-arrays', () => {
    const good = { kind: 'hearth_hero', props: {} };
    const parsed = parseLandingSections([good, { kind: 'evil' }, null, { kind: 'hearth_hero', props: { maxEvents: 99 } }, good]);
    expect(parsed).toHaveLength(2);
    expect(parseLandingSections(undefined)).toEqual([]);
    expect(parseLandingSections('<script>')).toEqual([]);
    expect(parseLandingSections(Array(20).fill(good)).length).toBe(MAX_LANDING_SECTIONS);
  });
});
