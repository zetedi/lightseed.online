import type { LightseedConfig } from '@/types/ConfigTypes';
import { ConfigSchema } from '@/types/ConfigTypes';

export async function loadConfig(): Promise<LightseedConfig> {
  const url = new URL(window.location.href);
  const configName = url.searchParams.get('config') || 'config.json';
  const res = await fetch(`/${configName}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${configName}`);
  const json = await res.json();
  const overrides: Partial<LightseedConfig> = {};
  const env = import.meta.env as ImportMetaEnv;
  const t = env.VITE_APP_TYPE as string | undefined;
  const title = env.VITE_APP_TITLE as string | undefined;
  if (t || title) {
    overrides.appConfig = {
      ...(json.appConfig || {}),
      ...(t ? { type: t } : {}),
      ...(title ? { title } : {}),
    };
  }
  const parsed = ConfigSchema.parse({ ...json, ...overrides });
  const root = document.documentElement;
  root.style.setProperty('--accent-color', parsed.theme.accent);
  root.style.setProperty('--lifeseed-logo', `url("${parsed.theme.logo || '/lifeseed.svg'}")`);
  return parsed;
}