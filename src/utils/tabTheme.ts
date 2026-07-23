// One source of truth for a tab's colour — used by BOTH the nav's active pill and the list-page
// header band, so the menu item and the list header read as one surface (same pigment, no drift).
// A node theme (community white-label) overrides the fallback the same way Navigation always did:
// visions/about → accent, pulses/events/inspiration → secondary, everything else → primary.

export interface TabTheme { primary?: string; secondary?: string; accent?: string }

// Hex equivalents of the nav's Tailwind fallback classes (bg-teal-600 etc.).
const FALLBACK: Record<string, string> = {
  dashboard: '#4f46e5',    // indigo-600
  visions: '#f59e0b',      // amber-500
  forest: '#059669',       // emerald-600
  pulses: '#ea580c',       // orange-600 — deliberately distinct from events
  events: '#0d9488',       // teal-600
  observatory: '#e11d48',  // rose-600
  inspiration: '#4f46e5',  // indigo-600
  about: '#9333ea',        // purple-600
  communities: '#0d9488',  // teal-600
  collab: '#7c3aed',       // violet-600
  beds: '#6366f1',         // indigo-500 — the bed's moonlit motif
  offerings: '#d97706',    // amber-600 — offered for light
};

// A light tint of a tab's colour — the list BOX wears this (the band keeps full saturation), so
// the surface stays one hue without shouting. `strength` = how far toward white (0..1).
export const tabTint = (hex: string, strength = 0.88): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * strength);
  const [r, g, b] = [mix(n >> 16 & 255), mix(n >> 8 & 255), mix(n & 255)];
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

// The lightseed glow — the same warm ring the Tend button carries. Worn by the create CTAs in the
// list header bands so the "grow something" action is always the lit one.
export const CTA_GLOW = 'ring-2 ring-yellow-300/60 shadow-[0_0_18px_rgba(250,204,21,0.45)] hover:shadow-[0_0_28px_rgba(250,204,21,0.7)]';

export const tabTone = (tab: string, theme?: TabTheme | null): string => {
  const themed =
    tab === 'visions' || tab === 'about' ? theme?.accent
    // Pulses is intentionally NOT theme-mapped: events takes theme.secondary, and mapping both
    // there made the two tabs indistinguishable. Pulses keeps its own orange.
    : tab === 'events' || tab === 'inspiration' ? theme?.secondary
    // Pulses keeps its own orange; beds keep their moonlit indigo — neither inherits the node's
    // primary, so the beds header + active pill stay indigo whatever theme the node wears.
    : tab === 'pulses' || tab === 'beds' ? undefined
    : theme?.primary;
  return themed || FALLBACK[tab] || '#334155';
};
