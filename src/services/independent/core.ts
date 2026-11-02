// THE INDEPENDENT NODE'S CORE — the mirror of ../firebase/core.ts (ring 2026-11-01). No SDK
// wakes here: the node's own HTTP API answers, the self-hosted OpenID Connect issuer signs the
// hand in, and the session (./session) binds the local UID through /v1/me. Every other
// independent module reaches the API through `session` and `apiRead` below, never a URL of its
// own making. SEED_BROWSER_CONFIG is defined by the independent build (vite.config.ts, mode
// 'independent') from the installation's HTTPS origins; a Firebase build never imports this file.
import { charter } from '../../config/charter';
import type { Stamp } from '../../domain/time';
import type { Lightseed } from '../../types';
import { seedBrowserConfig } from '../../domain/seedBrowser';
import { createSeedIdentity } from './oidc';
import { createSeedSession } from './session';
import { seedPublicRead } from './public';

declare const SEED_BROWSER_CONFIG: unknown;

// Robustly read a millisecond timestamp from a Stamp, a JS Date, an ISO string, or nothing.
export const toMillis = (value: unknown): number => {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') { const ms = Date.parse(value); return Number.isFinite(ms) ? ms : 0; }
    const stamp = value as { toMillis?: () => number } | null | undefined;
    return typeof stamp?.toMillis === 'function' ? stamp.toMillis() : 0;
};

// STORED MOMENTS the shell makes itself: a plain Stamp (domain/time) — the API speaks ISO
// strings, and the independent services turn them into Stamps at the boundary with these.
export const stampOfMs = (ms: number): Stamp => ({ toMillis: () => ms, toDate: () => new Date(ms) });
export const stampNow = (): Stamp => stampOfMs(Date.now());

export const SYSTEM_EMAIL_FROM = charter.mail.from;

export const getEnv = (key: string) => {
    const w = window as unknown as { process?: { env?: Record<string, string> } };
    const meta = import.meta as unknown as { env?: Record<string, string> };
    return w.process?.env?.[key] || meta.env?.[key] || "";
};

// THE SESSION, one per page: the standard browser OIDC client (code + PKCE, tokens in memory)
// behind the session controller that binds the API's own idea of who this is.
const config = seedBrowserConfig(SEED_BROWSER_CONFIG);
export const session = createSeedSession(createSeedIdentity(config));
// The sign-in callback is consumed exactly once, and the authorization code leaves the address.
const callback = window.location.pathname === '/auth/callback' ? window.location.href : undefined;
if (callback) window.history.replaceState(null, '', '/');
void session.start(callback);

// A read that carries the session's token when there is one and goes public otherwise — the
// API decides what each hand may see. `missing` asks for null instead of an error on 404.
export const apiRead = (path: string, options?: { missing?: boolean }): Promise<unknown> =>
    session.snapshot().status === 'authenticated' ? session.read(path, options) : seedPublicRead(path, fetch, options);

// ISO MOMENTS BECOME STAMPS at the boundary: the API speaks ISO-8601 strings; the shell reads
// `createdAt.toMillis()` as it always has. Every key that names a moment (…At, at) and holds an
// ISO string is turned into a Stamp, at any depth; nothing else is touched.
const ISO_MOMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const namesAMoment = (key: string): boolean => key === 'at' || /At$/.test(key);
export const withStamps = <T>(value: unknown): T => {
    const walk = (v: unknown, key?: string): unknown => {
        if (Array.isArray(v)) return v.map(x => walk(x));
        if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x, k)]));
        if (typeof v === 'string' && key && namesAMoment(key) && ISO_MOMENT.test(v)) return stampOfMs(Date.parse(v));
        return v;
    };
    return walk(value) as T;
};

// One being by its door (`{ tree }`, `{ community }` …): the document with its stamps, or null.
export const readDoc = async <T>(path: string, key: string): Promise<T | null> => {
    const body = await apiRead(path, { missing: true }) as Record<string, unknown> | null;
    const found = body?.[key];
    return found ? withStamps<T>(found) : null;
};

// One page of a bounded list, with the API's own bookmark for the next.
export const readPage = async <T>(path: string, key: string, params: Record<string, string> = {}, limit = 50): Promise<{ items: T[]; next: string | null }> => {
    const search = new URLSearchParams({ ...params, limit: String(limit) });
    const body = await apiRead(`${path}?${search}`) as Record<string, unknown>;
    return { items: withStamps<T[]>(body[key] ?? []), next: typeof body.next === 'string' ? body.next : null };
};

// Every item of a bounded list (the node's caps keep these small: ≤144 communities, a being's
// own trees); `maxPages` is the honest ceiling, never an infinite walk.
export const readAll = async <T>(path: string, key: string, params: Record<string, string> = {}, maxPages = 20): Promise<T[]> => {
    const items: T[] = [];
    let after: string | null = null;
    for (let page = 0; page < maxPages; page++) {
        const result: { items: T[]; next: string | null } = await readPage<T>(path, key, { ...params, ...(after ? { after } : {}) }, 100);
        items.push(...result.items);
        after = result.next;
        if (!after) break;
    }
    return items;
};

// HOW THIS NODE SIGNS A HAND IN. The shell's sign-in door asks before it draws: here the
// self-hosted issuer alone, through a redirect; no passwords, no provider pop-ups.
export const authCapabilities = (): { emailPassword: boolean; google: boolean; issuer: boolean } =>
    ({ emailPassword: false, google: false, issuer: true });
export const signInWithIssuer = (): Promise<void> => session.login();

// The signed-in hand as the shell knows it. The local profile names it; the issuer's claims
// never do (the API chose the UID through its explicit bindings, not an email match).
let current: Lightseed | null = null;
let knownUid: string | null = null;
let profileCreatedAtMs: number | null = null;
const describe = async (uid: string, claimed?: string): Promise<Lightseed> => {
    // The local profile names the hand; before one exists, the issuer's claimed name stands in so
    // the shell can write the first profile (ensurePersonEntity), as a provider name once did.
    let displayName: string | null = claimed ?? null;
    let email: string | null = null;
    try {
        const body = await session.read('/v1/me/profile') as { profile?: { displayName?: unknown; createdAt?: unknown } | null; email?: unknown };
        if (typeof body.profile?.displayName === 'string') displayName = body.profile.displayName;
        profileCreatedAtMs = body.profile?.createdAt ? toMillis(body.profile.createdAt) || null : null;
        // The address the issuer verified and the node remembered (migration 056): the shell's own eyes only.
        if (typeof body.email === 'string') email = body.email;
    } catch { /* a profile not yet written names no one; the shell asks for a name */ }
    return { uid, email, displayName, photoURL: null };
};

export const onAuthChange = (callback: (user: Lightseed | null) => void): (() => void) => {
    let generation = 0;
    const speak = async () => {
        const snapshot = session.snapshot();
        if (snapshot.status === 'loading') return;
        const mine = ++generation;
        if (snapshot.status !== 'authenticated') { current = null; knownUid = null; profileCreatedAtMs = null; callback(null); return; }
        if (knownUid !== snapshot.uid || !current) {
            const described = await describe(snapshot.uid, snapshot.name);
            if (mine !== generation) return;
            current = described; knownUid = snapshot.uid;
        }
        callback(current);
    };
    const unsubscribe = session.subscribe(() => { void speak(); });
    void speak();
    return () => { ++generation; unsubscribe(); };
};

// When this account began — the profile's own birth on this node, else unknown.
export const accountCreatedAtMs = (): number | null => profileCreatedAtMs;

// The signed-in hand's uid as the session knows it (null while no one is in), and the same as a demand.
export const currentUid = (): string | null => { const s = session.snapshot(); return s.status === 'authenticated' ? s.uid : null; };
export const requireUid = (): string => { const uid = currentUid(); if (!uid) throw new Error('authentication_required'); return uid; };
