export interface ThemeConfig {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
  background: string;
  mode?: 'light' | 'dark';
  surface?: string;
  text?: string;
}

export interface AppConfig {
  name: string;
  logoUrl?: string;
  logo: {
    backgroundFill?: string;
    strokeColor?: string;
    seedFill?: string;
  };
  theme: ThemeConfig;
  domain: string;
  model: string;
  githubActionsEnabled: boolean;
  // Invite-only growth: new accounts require a valid invitation. Flip to false to open signup.
  inviteOnly: boolean;
}
