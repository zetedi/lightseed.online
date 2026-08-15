import React from 'react';
import type { Community, Lightseed, Pulse } from '../../types';
import type { SectionKind } from '../../domain/appearance';
import { HearthHero } from './HearthHero';

// THE SECTION REGISTRY (ring 2026-08-16) — the one mapping from a stored section KIND to
// the reviewed component that renders it. Components live here in the repo and pass the
// gate; the database composes them by name. tests/appearance.test.ts holds this registry
// against domain/appearance.SECTION_KINDS in both directions — a kind without a component
// (or a component without a law) fails the mirror.
export interface SectionComponentProps {
  community: Community;
  props: Record<string, unknown>;
  lightseed: Lightseed | null;
  onViewEvent?: (event: Pulse) => void;
}

export const SECTION_COMPONENTS: Record<SectionKind, React.FC<SectionComponentProps>> = {
  hearth_hero: HearthHero,
};
