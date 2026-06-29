// The header's surface colours, derived from the community theme — extracted so the footer and
// the onboarding card can match the navigation exactly (same formula as components/Navigation.tsx).
export interface SurfaceColors {
  background: string;
  text: string;
  border: string;
  muted: string;
  isDark: boolean;
}

const isDarkHex = (hex: string | undefined, fallback: boolean): boolean => {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return fallback;
  const value = hex.slice(1);
  const channels = [0, 2, 4].map((start) => {
    const channel = parseInt(value.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance < 0.38;
};

export function headerSurface(theme: any, isDark: boolean): SurfaceColors {
  const background = theme?.surface || theme?.background || (isDark ? '#020617' : '#ffffff');
  const dark = isDarkHex(background, isDark);
  return {
    background,
    text: dark ? '#f8fafc' : (theme?.text || '#0f172a'),
    border: theme?.primary || (isDark ? '#1e293b' : '#e2e8f0'),
    muted: dark ? '#bbf7d0' : (theme?.neutral || '#64748b'),
    isDark: dark,
  };
}
