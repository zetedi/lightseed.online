// src/lib/loadConfig.ts
import type { LightseedConfig } from '@/types/ConfigTypes';
import { ConfigSchema } from '@/types/ConfigTypes';

// Runtime fetch of /config.json. Mount/replace this file per deploy.
export async function loadConfig(): Promise<LightseedConfig> {
  // Allow override via ?config=filename.json for dev/demo
  const url = new URL(window.location.href);
  const configName = url.searchParams.get('config') || 'config.json';
  const res = await fetch(`/${configName}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${configName}`);
  const json = await res.json();

  // Env overrides (from Vite): VITE_APP_TITLE, VITE_APP_TYPE, etc.
  const overrides: Partial<LightseedConfig> = {};
  const env = import.meta.env;
  const t = env?.VITE_APP_TYPE as string | undefined;
  const title = env?.VITE_APP_TITLE as string | undefined;
  if (t || title) {
    overrides.appConfig = {
      ...(json.appConfig || {}),
      ...(t ? { type: t } : {}),
      ...(title ? { title } : {}),
    };
  }

  const parsed = ConfigSchema.parse({ ...json, ...overrides });
  return parsed;
}