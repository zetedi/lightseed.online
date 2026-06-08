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
    background: '#ffffff',
    mode: 'light',
    surface: '#ffffff',
    text: '#0f172a',
  },
  domain: 'lightseed.online',
  model: 'gemini-3.5-flash',
  githubActionsEnabled: false,
};
