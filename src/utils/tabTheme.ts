// One source of truth for a destination's colour, used by the desktop active pill, the mobile
// menu tile, the list-page header band, the full-width sub-tab strips and the list-box tint,
// so a destination reads as one pigment everywhere it appears.
//
// THE SPECTRUM (prototype, 2026-07-25): the seven primary destinations already stand in
// root-to-crown order, so each wears its chakra's colour as a deep MINERAL tone, not a signal
// colour: garnet, sienna, ochre, malachite, lapis, indigo, amethyst. All tones hold >= 5:1
// contrast with white text. Alerts, danger reds, notification dots and the golden CTA glow
// stay semantically separate; the forest's doorway is garnet while the forest itself stays green.
//
// Destination colours are STABLE ACROSS NODES (learned orientation: the menu is the body's
// spine wherever you stand). A node's theme keeps identity everywhere else: nav surface,
// backgrounds, heroes, landings, CTAs. To revert to theme-tinted menus, re-add the theme
// branches in tabTone below; the callers all still pass the theme through.

export interface TabTheme { primary?: string; secondary?: string; accent?: string }

// Root to crown, in the order the menu already stands. Balanced (2026-07-25, second pass)
// between the first deep-mineral cut and Zoltán's classic chakra reference strip: neighbours
// now separate by LIGHTNESS as well as hue (the first cut's equal-depth sienna/ochre and
// lapis/indigo pairs read too close). Solar gold is the one bright tone; it takes DARK text.
export const SPECTRUM: Record<string, string> = {
  forest: '#b3152f',      // root · crimson garnet: ground, embodiment
  visions: '#c94b0c',     // sacral · vivid sienna: creativity, imagination
  events: '#e39c10',      // solar · true gold (dark foreground): action, confidence
  offerings: '#298442',   // heart · leaf green: generosity, relationship
  collab: '#1d5cc7',      // throat · azure lapis: voice, listening, translation
  communities: '#463585', // third eye · deep violet-indigo: collective perception, shared wisdom
  about: '#71269e',       // crown · plum amethyst: lineage, unity, the whole
};

// Sub-destinations stay inside the parent's hue family: a deeper step of the same mineral.
export const SPECTRUM_DEEP: Record<string, string> = {
  alignments: '#7c2d12',    // visions' deep rust (resonance heat)
  beds: '#14532d',          // offerings' night green (rest inside the heart)
  intelligences: '#1d5cc7', // collab's own azure (the first sub-tab keeps the parent tone)
  organisations: '#1e3a8a', // collab's deep navy
};

// Off-spectrum surfaces (not among the seven destinations). Pulses belong to every being's
// story, so they take no chakra of their own; whispers (reaches) live in the throat family.
const FALLBACK: Record<string, string> = {
  dashboard: '#4f46e5',    // indigo-600 (legacy, no band of its own)
  pulses: '#ea580c',       // orange-600, the profile's My Pulses accents
  inspiration: '#0369a1',  // sky-700: the whisper side of the voice
  observatory: '#e11d48',  // rose-600 (retired destination, kept for old references)
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

// The theme parameter is accepted (every caller passes it) but the seven destinations no longer
// bend to it: the spectrum is stable orientation. Off-spectrum keys keep their fixed tones too.
export const tabTone = (tab: string, _theme?: TabTheme | null): string =>
  SPECTRUM[tab] || SPECTRUM_DEEP[tab] || FALLBACK[tab] || '#334155';

// The foreground that stands on a destination's tone. Every tone carries white except the solar
// gold, which is bright by nature (the reference chakra yellow) and takes deep amber-brown text
// instead: 6.4:1, versus 2.3:1 had white stayed. One bright band, one dark voice on it.
export const tabFg = (tab: string): string => (tab === 'events' ? '#451a03' : '#ffffff');
