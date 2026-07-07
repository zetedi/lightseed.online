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
};

export const tabTone = (tab: string, theme?: TabTheme | null): string => {
  const themed =
    tab === 'visions' || tab === 'about' ? theme?.accent
    // Pulses is intentionally NOT theme-mapped: events takes theme.secondary, and mapping both
    // there made the two tabs indistinguishable. Pulses keeps its own orange.
    : tab === 'events' || tab === 'inspiration' ? theme?.secondary
    : tab === 'pulses' ? undefined
    : theme?.primary;
  return themed || FALLBACK[tab] || '#334155';
};
