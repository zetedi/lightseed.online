
export const colors = {
  sky: "bg-slate-800", 
  earth: "bg-[#92400E]", 
  grass: "bg-[#65A30D]",
  snow: "bg-[#F8FAFC]",
  sun: "bg-[#F59E0B]", // Amber 500
};

export type ThemeMode = 'light' | 'dark';

export type CommunityThemePreset = {
  id: string;
  name: string;
  description: string;
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
  background: string;
  surface: string;
  text: string;
  mode: ThemeMode;
};

export const oldEmeraldEarthThemeValues = {
  primary: '#059669',
  secondary: '#0284c7',
  accent: '#f59e0b',
  neutral: '#334155',
  background: '#B2713A',
  surface: '#064E3B',
  text: '#0f172a',
  mode: 'light' as const,
};

export const oldEmeraldEarthTheme: CommunityThemePreset = {
  id: 'old-emerald-earth',
  name: 'Emerald Earth',
  description: 'The original emerald header with brown earth background.',
  ...oldEmeraldEarthThemeValues,
};

export const canopyTheme: CommunityThemePreset = {
  id: 'canopy',
  name: 'Canopy',
  description: 'Fresh green with white space.',
  primary: '#047857',
  secondary: '#0369a1',
  accent: '#d97706',
  neutral: '#334155',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  mode: 'light',
};

export const communityThemePresets: CommunityThemePreset[] = [
  oldEmeraldEarthTheme,
  canopyTheme,
  {
    id: 'river',
    name: 'River',
    description: 'Calm blue and emerald.',
    primary: '#0f766e',
    secondary: '#2563eb',
    accent: '#f59e0b',
    neutral: '#334155',
    background: '#eff6ff',
    surface: '#ffffff',
    text: '#0f172a',
    mode: 'light',
  },
  {
    id: 'meadow',
    name: 'Meadow',
    description: 'Warm daylight and amber.',
    primary: '#15803d',
    secondary: '#0891b2',
    accent: '#ca8a04',
    neutral: '#365314',
    background: '#f7fee7',
    surface: '#ffffff',
    text: '#1f2937',
    mode: 'light',
  },
  {
    id: 'bloom',
    name: 'Bloom',
    description: 'Soft rose with green anchors.',
    primary: '#0f766e',
    secondary: '#be185d',
    accent: '#ea580c',
    neutral: '#334155',
    background: '#fff7ed',
    surface: '#ffffff',
    text: '#1e293b',
    mode: 'light',
  },
  {
    id: 'night',
    name: 'Night Grove',
    description: 'Dark mode with bright accents.',
    primary: '#34d399',
    secondary: '#38bdf8',
    accent: '#fbbf24',
    neutral: '#cbd5e1',
    background: '#020617',
    surface: '#0f172a',
    text: '#e2e8f0',
    mode: 'dark',
  },
];

const clampHex = (value: string | undefined, fallback: string) =>
  /^#[0-9A-Fa-f]{6}$/.test(value || '') ? value! : fallback;

export const THEME_FIELDS = ['primary', 'secondary', 'accent', 'neutral', 'background', 'surface', 'text', 'mode'] as const;
export const themeEquals = (a: any, b: any) => THEME_FIELDS.every(k => a?.[k] === b?.[k]);

export const normalizeTheme = (theme: Partial<CommunityThemePreset> | undefined, fallback = canopyTheme) => ({
  primary: clampHex(theme?.primary, fallback.primary),
  secondary: clampHex(theme?.secondary, fallback.secondary),
  accent: clampHex(theme?.accent, fallback.accent),
  neutral: clampHex(theme?.neutral, fallback.neutral),
  background: clampHex(theme?.background, fallback.background),
  surface: clampHex(theme?.surface, fallback.surface),
  text: clampHex(theme?.text, fallback.text),
  mode: theme?.mode === 'dark' ? 'dark' as const : 'light' as const,
});
