import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Community, Lightseed } from '../types';
import { isHubDomain, useConfig } from './useConfig';
import { normalizeTheme } from '../utils/theme';

export type ThemeModePreference = 'light' | 'dark' | null;

// The whole shell's theming, extracted from App verbatim: resolves the effective theme + dark mode
// from the node config, the (optional) impersonated community and the signed-in user's personal
// site theme; applies the CSS custom properties to <html>; persists the light/dark preference; and
// builds the sacred-geometry background. `config` is passed in (App also reads name/inviteOnly off
// it) so useConfig stays a single call in the shell.
export function useSiteTheme(params: {
  config: ReturnType<typeof useConfig>;
  impersonatedCommunity: Community | null;
  lightseed: Lightseed | null;
  personalSiteTheme: any;
  personalSiteLogoUrl: string;
}) {
  const { config, impersonatedCommunity, lightseed, personalSiteTheme, personalSiteLogoUrl } = params;

  const [themeModePreference, setThemeModePreference] = useState<ThemeModePreference>(() => {
    const savedMode = localStorage.getItem('lifeseed_theme_mode');
    if (savedMode === 'light' || savedMode === 'dark') return savedMode;

    const legacyNightMode = localStorage.getItem('lifeseed_night_mode');
    if (legacyNightMode === 'true') return 'dark';
    if (legacyNightMode === 'false') return 'light';

    return null;
  });
  // While viewing as a community, the community's own branding wins over the
  // signed-in user's personal site theme/logo.
  const configuredTheme = !impersonatedCommunity && lightseed && personalSiteTheme
    ? normalizeTheme(personalSiteTheme, config.theme)
    : config.theme;
  const configuredLogoUrl = !impersonatedCommunity && lightseed && personalSiteLogoUrl && isHubDomain(window.location.hostname)
    ? personalSiteLogoUrl
    : config.logoUrl;
  const effectiveThemeMode = themeModePreference || configuredTheme.mode || 'light';
  const effectiveTheme = effectiveThemeMode === 'dark' ? {
    ...configuredTheme,
    background: '#020617',
    surface: '#0f172a',
    text: '#e2e8f0',
    neutral: '#cbd5e1',
    mode: 'dark' as const,
  } : {
    ...configuredTheme,
    background: configuredTheme.mode === 'dark' ? '#ffffff' : configuredTheme.background,
    surface: configuredTheme.mode === 'dark' ? '#ffffff' : (configuredTheme.surface || '#ffffff'),
    text: configuredTheme.mode === 'dark' ? '#0f172a' : (configuredTheme.text || '#0f172a'),
    neutral: configuredTheme.mode === 'dark' ? '#334155' : configuredTheme.neutral,
    mode: 'light' as const,
  };
  const effectiveIsDark = effectiveTheme.mode === 'dark';

  useEffect(() => {
    // effectiveTheme is a fresh object literal every render (always truthy), so the effect keys
    // on its primitive fields; only the fields read here are used.
    const root = document.documentElement;
    root.style.setProperty('--color-primary', effectiveTheme.primary);
    root.style.setProperty('--color-secondary', effectiveTheme.secondary);
    root.style.setProperty('--color-accent', effectiveTheme.accent);
    root.style.setProperty('--color-background', effectiveTheme.background);
    root.style.setProperty('--color-surface', effectiveTheme.surface || '#ffffff');
    root.style.setProperty('--color-text', effectiveTheme.text || '#0f172a');
    root.dataset.mode = effectiveIsDark ? 'dark' : 'light';
  }, [effectiveTheme.primary, effectiveTheme.secondary, effectiveTheme.accent, effectiveTheme.background, effectiveTheme.surface, effectiveTheme.text, effectiveIsDark]);

  useEffect(() => {
    if (localStorage.getItem('lifeseed_theme_mode') === null && localStorage.getItem('lifeseed_night_mode') === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- re-syncs to the node's theme mode when it changes and the user has no saved preference
      setThemeModePreference(null);
    }
  }, [configuredTheme.mode]);

  const toggleNightMode = () => {
    setThemeModePreference(prev => {
      const currentMode = prev || configuredTheme.mode || 'light';
      const next = currentMode === 'dark' ? 'light' : 'dark';
      localStorage.setItem('lifeseed_theme_mode', next);
      localStorage.setItem('lifeseed_night_mode', String(next === 'dark'));
      return next;
    });
  };

  const bgHex = effectiveTheme.background;
  const bgEncoded = bgHex.replace('#', '%23');
  const patternStrokeEncoded = effectiveIsDark ? '%23fff' : '%23000';
  const patternStrokeOpacity = effectiveIsDark ? '.3' : '.14';
  const patternInnerOpacity = effectiveIsDark ? '.4' : '.18';
  
  const svgBackground = `data:image/svg+xml,%3Csvg width='332.5537705' height='320' xmlns='http://www.w3.org/2000/svg'%3E%3Cstyle%3E .outerCircle %7B fill: ${bgEncoded}; stroke: ${patternStrokeEncoded}; stroke-width: 7; stroke-opacity: ${patternStrokeOpacity}; %7D .circle %7B fill: none; stroke: ${patternStrokeEncoded}; stroke-width: .3; stroke-opacity: ${patternStrokeOpacity}; %7D .innerCircle %7B fill: ${bgEncoded}; stroke: ${patternStrokeEncoded}; stroke-width: 1.7; stroke-opacity: ${patternInnerOpacity}; %7D %3C/style%3E%3Crect width='100%25' height='100%25' fill='${bgEncoded}'/%3E%3Cdefs%3E%3CclipPath id='clean'%3E%3Crect width='332.5537705' height='320' /%3E%3C/clipPath%3E%3C/defs%3E%3Cg%3E%3Ccircle cx='-38.2768775' cy='-32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='96' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='160' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='224' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='288' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='352' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='0' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='64' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='128' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='192' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='256' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='320' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='-32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='96' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='160' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='224' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='288' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='352' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='0' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='64' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='128' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='192' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='256' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='320' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='-32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='96' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='160' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='224' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='288' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='352' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='0' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='64' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='128' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='192' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='256' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='320' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='-32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='96' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='160' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='224' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='288' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='352' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='0' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='64' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='128' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='192' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='256' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='320' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='96' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='160' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='64' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='128' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='192' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='96' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='160' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='288' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3C/g%3E%3C/svg%3E`;

  const backgroundStyle = {
    backgroundColor: bgHex,
    backgroundImage: `url("${svgBackground}")`,
    backgroundSize: '108px', 
    backgroundRepeat: 'repeat',
    backgroundPosition: 'center center',
    backgroundAttachment: 'fixed',
  };

  return { effectiveTheme, effectiveIsDark, configuredLogoUrl, toggleNightMode, backgroundStyle: backgroundStyle as CSSProperties };
}
