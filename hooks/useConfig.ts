
import { useMemo } from 'react';
import { defaultConfig } from '../config/default';
import { Organisation } from '../types';

export const useConfig = (hostOrganisation: Organisation | null) => {
  const config = useMemo(() => {
    if (!hostOrganisation) return defaultConfig;

    return {
      ...defaultConfig,
      name: hostOrganisation.name || defaultConfig.name,
      logoUrl: hostOrganisation.logoUrl,
      theme: {
        ...defaultConfig.theme,
        ...(hostOrganisation.theme || {})
      }
    };
  }, [hostOrganisation]);

  return config;
};
