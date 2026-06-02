export interface ThemeConfig {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
  background: string;
}

export interface AppConfig {
  name: string;
  logo: {
    backgroundFill?: string;
    strokeColor?: string;
    seedFill?: string;
  };
  theme: ThemeConfig;
  domain: string;
  model: string;
  githubActionsEnabled: boolean;
}
