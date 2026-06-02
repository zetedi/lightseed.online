
import { useMemo } from 'react';
import { defaultConfig } from '../config/default';
import { Organisation } from '../types';

const isHubDomain = (domain: string) => {
    const d = domain.toLowerCase().replace(/^www\./, '');
    return d === 'lightseed.online' || d === 'localhost' || d === '127.0.0.1' || d.startsWith('192.168.') || d.endsWith('.local');
};

export const useConfig = (hostOrganisation: Organisation | null) => {
  const config = useMemo(() => {
    const domain = window.location.hostname;
    
    // Default "lively" palette for lifeseed.online if no org config is present
    const livelyPalette = {
      primary: '#10b981',
      secondary: '#3b82f6',
      accent: '#facc15',
      neutral: '#475569',
      background: '#D97706'
    };

    const isLively = domain === 'lifeseed.online' || domain === 'www.lifeseed.online';

    const baseConfig = isLively
      ? { ...defaultConfig, name: 'lifeseed', theme: { ...defaultConfig.theme, ...livelyPalette } }
      : defaultConfig;

    if (!hostOrganisation) return baseConfig;

    return {
      ...baseConfig,
      name: hostOrganisation.name || baseConfig.name,
      logoUrl: hostOrganisation.logoUrl,
      theme: {
        ...baseConfig.theme,
        ...(hostOrganisation.theme || {})
      }
    };
  }, [hostOrganisation]);

  return config;
};
