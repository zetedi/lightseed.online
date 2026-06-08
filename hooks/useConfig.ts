
import { useMemo } from 'react';
import { Community } from '../types';
import { defaultConfig } from '../config/default';
import { normalizeTheme, oldEmeraldEarthTheme } from '../utils/theme';

export const isHubDomain = (domain?: string) => {
    if (!domain) return true;
    const d = domain.toLowerCase().replace(/^www\./, '');
    return d === 'lightseed.online' || d === 'lifeseed.online' || d === 'localhost' || d === '127.0.0.1' || d.startsWith('192.168.') || d.endsWith('.local');
};

const isPreviousLifeseedDefaultTheme = (theme: Community['theme']) =>
  theme?.primary === '#10b981' &&
  theme?.secondary === '#2563eb' &&
  theme?.accent === '#f59e0b' &&
  theme?.background === '#ffffff' &&
  (theme?.surface === undefined || theme.surface === '#ffffff') &&
  (theme?.text === undefined || theme.text === '#0f172a') &&
  (theme?.mode === undefined || theme.mode === 'light');

export const useConfig = (hostCommunity: Community | null) => {
  return useMemo(() => {
    const hostDomain = (hostCommunity?.domain || (typeof window !== 'undefined' ? window.location.hostname : defaultConfig.domain))
      .toLowerCase()
      .replace(/^www\./, '');
    const domainDefaultTheme = normalizeTheme(hostDomain === 'lifeseed.online' ? oldEmeraldEarthTheme : defaultConfig.theme);

    if (!hostCommunity) {
      return {
        ...defaultConfig,
        name: hostDomain === 'lifeseed.online' ? 'lifeseed' : defaultConfig.name,
        domain: hostDomain || defaultConfig.domain,
        theme: domainDefaultTheme,
      };
    }

    return {
      ...defaultConfig,
      name: hostCommunity.name || defaultConfig.name,
      logoUrl: hostCommunity.logoUrl,
      domain: hostCommunity.domain || defaultConfig.domain,
      theme: normalizeTheme(
        hostDomain === 'lifeseed.online' && isPreviousLifeseedDefaultTheme(hostCommunity.theme)
          ? undefined
          : hostCommunity.theme,
        domainDefaultTheme
      )
    };
  }, [hostCommunity]);
};
