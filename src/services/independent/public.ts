// Public reads omit credentials and never follow a redirect to another origin.
export async function seedPublicRead(path: string, fetcher: typeof fetch = fetch, options?: { missing?: boolean }): Promise<unknown> {
  if (!/^\/v1\/[a-z0-9/-]+(?:\?[^#]*)?$/.test(path) || path.includes('..')) throw new Error('invalid_api_path');
  const response = await fetcher(path, { credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (options?.missing && response.status === 404) return null;
  if (!response.ok) throw new Error('api_unavailable');
  return response.json();
}

// A write any hand may make without a token (the rules decide): the same guards as a public read.
export async function seedPublicWrite(path: string, body: object, fetcher: typeof fetch = fetch): Promise<unknown> {
  if (!/^\/v1\/[a-z0-9/-]+$/.test(path) || path.includes('..')) throw new Error('invalid_api_path');
  const response = await fetcher(path, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
    credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (response.status === 401) throw new Error('authentication_required');
  if (response.status === 403) throw new Error('forbidden');
  if (!response.ok) throw new Error((await response.json().catch(() => ({})) as { error?: string }).error || 'api_unavailable');
  return response.json();
}
