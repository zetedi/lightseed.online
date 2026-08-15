import type { DomainKey } from './words';

// LANDING SECTIONS — components in the repo, compositions in the database (ring 2026-08-16).
// A community's landing is assembled from REGISTERED section kinds: the React code lives in
// src/components/landing/ and passes the gate like all code; the database stores only WHICH
// sections, in what order, with what props. No executable code ever travels through
// Firestore — the node's skin can hold data to laws, never arbitrary code to any law.
//
// Plain contract — guaranteed: parseLandingSections admits only known kinds with lawful
// props (unknown kinds and junk props are dropped, never rendered); the renderer executes
// only registry components that shipped through review. Not guaranteed: prop CONTENT is the
// keeper's voice (their words, their image URLs) — sanitized at render where rich, but not
// judged for taste. Enforced by: this law + tests/appearance.test.ts + the registry mapping
// in src/components/landing/registry.tsx (a kind added here without a component there fails
// the mirror test, and vice versa).

export const SECTION_KINDS = ['hearth_hero'] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export interface LandingSection {
  kind: SectionKind;
  props: Record<string, unknown>;
}

// A landing stays a page, not a scroll of everything.
export const MAX_LANDING_SECTIONS = 12;

const isHttpUrl = (v: unknown): boolean =>
  typeof v === 'string' && /^https:\/\/\S+$/i.test(v);

// Why this section cannot stand, or null when it may — per kind, mirroring what its
// component actually reads. Caps keep a landing a page and a prop a prop.
export const sectionProblem = (s: { kind?: unknown; props?: unknown }): DomainKey | null => {
  if (!SECTION_KINDS.includes(s.kind as SectionKind)) return 'appearance_unknown_kind';
  const p = (s.props ?? {}) as Record<string, unknown>;
  if (typeof p !== 'object' || Array.isArray(p)) return 'appearance_bad_props';
  switch (s.kind as SectionKind) {
    case 'hearth_hero': {
      if (p.imageUrl !== undefined && !isHttpUrl(p.imageUrl)) return 'appearance_bad_props';
      if (p.headline !== undefined && (typeof p.headline !== 'string' || p.headline.length > 140)) return 'appearance_bad_props';
      if (p.showEvents !== undefined && typeof p.showEvents !== 'boolean') return 'appearance_bad_props';
      if (p.maxEvents !== undefined && (!Number.isInteger(p.maxEvents) || (p.maxEvents as number) < 1 || (p.maxEvents as number) > 6)) return 'appearance_bad_props';
      return null;
    }
  }
};

// The tolerant read from a stored doc: only lawful sections pass, order kept, count capped.
// Junk never reaches the renderer — the field the registry trusts stays clean by law.
export const parseLandingSections = (raw: unknown): LandingSection[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is LandingSection => !!s && typeof s === 'object' && sectionProblem(s as LandingSection) === null)
    .slice(0, MAX_LANDING_SECTIONS);
};
