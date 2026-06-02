import { AppConfig } from './types';

export const defaultConfig: AppConfig = {
  name: '.seed',
  logo: {
    backgroundFill: 'white',
    strokeColor: '#334155',
    seedFill: 'white',
  },
  theme: {
    primary: '#059669', // emerald-600
    secondary: '#0284c7', // sky-600
    accent: '#f59e0b', // amber-500
    neutral: '#334155', // slate-700
    background: '#B2713A', // Current background color
  },
  domain: 'lightseed.online',
  model: 'gemini-3.5-flash',
  githubActionsEnabled: false,
};
