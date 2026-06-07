
import { useEffect, useMemo } from 'react';
import { Community } from '../types';
import baseConfig from '../lifeseed.config.json';
import { defaultConfig } from '../config/default';

export const isHubDomain = (domain?: string) => {
    if (!domain) return true;
    const d = domain.toLowerCase().replace(/^www\./, '');
    return d === 'lightseed.online' || d === 'lifeseed.online' || d === 'localhost' || d === '127.0.0.1' || d.startsWith('192.168.') || d.endsWith('.local');
};

export const useConfig = (hostCommunity: Community | null) => {
  return useMemo(() => {
    if (!hostCommunity) return defaultConfig;

    return {
      ...defaultConfig,
      name: hostCommunity.name || defaultConfig.name,
      logoUrl: hostCommunity.logoUrl,
      theme: {
        ...defaultConfig.theme,
        ...(hostCommunity.theme || {})
      }
    };
  }, [hostCommunity]);
};
