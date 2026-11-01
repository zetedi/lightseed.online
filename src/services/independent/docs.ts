// THE DOCUMENT DOOR, browser side (ring 2026-11-02). The Firebase backend reads and writes
// documents through the SDK and firestore.rules judges each at the database; the independent
// backend asks the node's API the same questions — GET /v1/docs/<collection>, POST
// /v1/docs/command — and seed.doc_write / the row policies judge with the same law (seed/schema
// 050–052). These helpers are the only way an independent module touches a document: a doc by
// its door (docGet), a page or the whole of a bounded list (docList / docAll), a write as a claim
// (docCommand), and love. Stamps the shell made become ISO strings on the way out (plainify) and
// ISO moments become Stamps on the way in (withStamps), so a component never sees the wire.
import { plainify } from '../../domain/export';
import { docSentinel, type SEED_DOC_COLLECTIONS } from '../../domain/seedDocs.mjs';
import { apiRead, readPage, session, withStamps } from './core';
import { seedPublicWrite } from './public';

export type DocCollection = keyof typeof SEED_DOC_COLLECTIONS;
export type DocCursor = string | [string, string];
export interface DocListAsk {
    parent?: string;
    where?: Record<string, string | number | boolean>;
    has?: Record<string, string>;
    within?: Record<string, string[]>;
    newest?: boolean;
    after?: DocCursor | null;
    limit?: number;
}

const DOCS = '/v1/docs/';
const paramsOf = (ask: DocListAsk): Record<string, string> => {
    const params: Record<string, string> = {};
    if (ask.parent) params.parent = ask.parent;
    for (const [k, v] of Object.entries(ask.where ?? {})) params['f.' + k] = String(v);
    for (const [k, v] of Object.entries(ask.has ?? {})) params['has.' + k] = v;
    for (const [k, v] of Object.entries(ask.within ?? {})) params['in.' + k] = v.join(',');
    if (ask.newest) params.order = 'newest';
    if (ask.after) params.after = typeof ask.after === 'string' ? ask.after : JSON.stringify(ask.after);
    return params;
};

// One document, or null when it is missing or not this hand's to see (the door's one silence).
export const docGet = async <T>(collection: DocCollection, id: string, parent?: string): Promise<(T & { id: string }) | null> => {
    const search = new URLSearchParams({ id, ...(parent ? { parent } : {}) });
    const body = await apiRead(`${DOCS}${collection}?${search}`, { missing: true }) as { doc?: unknown } | null;
    return body?.doc ? withStamps<T & { id: string }>(body.doc) : null;
};
// One page: items with their stamps and the node's own bookmark for the next.
export const docList = async <T>(collection: DocCollection, ask: DocListAsk = {}): Promise<{ items: (T & { id: string })[]; next: DocCursor | null }> => {
    const result = await readPage<T & { id: string }>(`${DOCS}${collection}`, 'items', paramsOf(ask), ask.limit ?? 50);
    const raw = result.next as unknown;
    const next: DocCursor | null = typeof raw === 'string' ? raw : Array.isArray(raw) && raw.length === 2 ? [String(raw[0]), String(raw[1])] : null;
    return { items: result.items, next };
};
// Every item of a bounded list, with an honest ceiling (never an infinite walk).
export const docAll = async <T>(collection: DocCollection, ask: DocListAsk = {}, maxPages = 20): Promise<(T & { id: string })[]> => {
    const items: (T & { id: string })[] = [];
    let after: DocCursor | null = ask.after ?? null;
    for (let page = 0; page < maxPages; page++) {
        const result = await docList<T>(collection, { ...ask, after, limit: 100 });
        items.push(...result.items);
        after = result.next;
        if (!after) break;
    }
    return items;
};

export type DocWrite =
    | { action: 'create'; collection: DocCollection; parent?: string; id?: string; data: Record<string, unknown> }
    | { action: 'set'; collection: DocCollection; parent?: string; id: string; data: Record<string, unknown>; merge?: boolean; expect?: Record<string, unknown> }
    | { action: 'update'; collection: DocCollection; parent?: string; id: string; patch: Record<string, unknown>; expect?: Record<string, unknown> }
    | { action: 'delete'; collection: DocCollection; parent?: string; id: string; expect?: Record<string, unknown> };

// The write, as the signed-in hand (the API binds the uid); a few doors stand open to anyone —
// an invitation request, a letter subscription — and those go without a token when no one is in.
export const docCommand = async <T = Record<string, unknown>>(write: DocWrite): Promise<{ id: string; doc: (T & { id: string }) | null }> => {
    const command = plainify(write) as Record<string, unknown>;
    const body = (session.snapshot().status === 'authenticated'
        ? await session.docCommand(command)
        : await seedPublicWrite('/v1/docs/command', command, fetch)) as { id: string; doc: Record<string, unknown> | null };
    return { id: body.id, doc: body.doc ? withStamps<T & { id: string }>(body.doc) : null };
};
// The sentinels a write may carry: the node's clock, a removal, a set's union/difference, a count.
export const serverTime = docSentinel.serverTime as () => unknown;
export const deleteField = docSentinel.deleteField as () => unknown;
export const arrayUnion = docSentinel.arrayUnion as (...values: unknown[]) => unknown;
export const arrayRemove = docSentinel.arrayRemove as (...values: unknown[]) => unknown;
export const increment = docSentinel.increment as (by: number) => unknown;

// LOVE is one atomic gesture (seed.love_toggle): the own slot and the public tally move together.
export const loveToggle = async (kind: 'lifetrees' | 'visions' | 'pulses' | 'communities' | 'lightHouses', id: string): Promise<{ loved: boolean; loveCount: number }> =>
    await session.docCommand({ action: 'love', kind, id }) as { loved: boolean; loveCount: number };
// Whether this hand's own mark lies on a being (the loves slot is readable by its holder alone).
export const isLoved = async (kind: 'lifetrees' | 'visions' | 'pulses' | 'communities' | 'lightHouses', id: string, uid: string): Promise<boolean> => {
    const collection = ({ lifetrees: 'lifetree_loves', visions: 'vision_loves', pulses: 'pulse_loves', communities: 'community_loves', lightHouses: 'light_house_loves' } as const)[kind];
    return !!(await docGet(collection, uid, id).catch(() => null));
};
