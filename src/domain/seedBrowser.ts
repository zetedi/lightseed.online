export type SeedBrowserConfig = { appOrigin: string; issuer: string };
export function seedBrowserConfig(value: unknown): SeedBrowserConfig {
  if (!value || typeof value !== 'object') throw new Error('invalid_browser_config');
  const v = value as Record<string, unknown>;
  if (typeof v.appOrigin !== 'string' || typeof v.issuer !== 'string') throw new Error('invalid_browser_config');
  const app = new URL(v.appOrigin), issuer = new URL(v.issuer);
  if (app.protocol !== 'https:' || app.origin !== v.appOrigin
    || issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.search || issuer.hash
    || issuer.href !== v.issuer || issuer.pathname.endsWith('/')) throw new Error('invalid_browser_config');
  return { appOrigin: v.appOrigin, issuer: v.issuer };
}
export function seedSessionIdentity(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const uid = (value as Record<string, unknown>).uid;
  return typeof uid === 'string' && uid.length > 0 && uid.length <= 128 && !/[\u0000-\u0020\u007f]/.test(uid) ? uid : null;
}
