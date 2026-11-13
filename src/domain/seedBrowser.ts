// THE FACES (ring 2026-11-03): the shell may stand at the application origin or at any face host the
// charter names — `origins`, every one an https origin and a redirect URI of the realm's client; the
// application origin is always among them.
export type SeedBrowserConfig = { appOrigin: string; issuer: string; origins: string[] };
const httpsOrigin = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try { const url = new URL(value); return url.protocol === 'https:' && url.origin === value; } catch { return false; }
};
export function seedBrowserConfig(value: unknown): SeedBrowserConfig {
  if (!value || typeof value !== 'object') throw new Error('invalid_browser_config');
  const v = value as Record<string, unknown>;
  if (!httpsOrigin(v.appOrigin) || typeof v.issuer !== 'string') throw new Error('invalid_browser_config');
  const issuer = new URL(v.issuer);
  if (issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.search || issuer.hash
    || issuer.href !== v.issuer || issuer.pathname.endsWith('/')) throw new Error('invalid_browser_config');
  const listed = v.origins === undefined ? [] : v.origins;
  if (!Array.isArray(listed) || listed.length > 64 || !listed.every(httpsOrigin)) throw new Error('invalid_browser_config');
  const origins = [...new Set([v.appOrigin, ...listed])];
  return { appOrigin: v.appOrigin, issuer: v.issuer, origins };
}
export function seedSessionIdentity(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const uid = (value as Record<string, unknown>).uid;
  return typeof uid === 'string' && uid.length > 0 && uid.length <= 128 && !/[\u0000-\u0020\u007f]/.test(uid) ? uid : null;
}
