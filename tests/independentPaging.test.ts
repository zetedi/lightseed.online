import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gatherPages, pageCursorParam, readPageCursor } from '../src/domain/pageCursor';

describe('the bookmark of a page (domain/pageCursor)', () => {
    it('carries both shapes a door makes, and nothing else', () => {
        expect(readPageCursor('abc')).toBe('abc');
        expect(readPageCursor(['2026-11-19T10:00:00.123456Z', 't7'])).toEqual(['2026-11-19T10:00:00.123456Z', 't7']);
        for (const none of [null, undefined, '', 7, {}, [], ['a'], ['a', 'b', 'c'], ['a', 7], ['', 'b']]) expect(readPageCursor(none)).toBeNull();
    });
    it('travels back as the door reads it: a string as itself, a pair as its JSON', () => {
        expect(pageCursorParam('abc')).toBe('abc');
        expect(JSON.parse(pageCursorParam(['m', 'i']))).toEqual(['m', 'i']);
    });
    it('walks to the end, or stops at the ceiling and says so', async () => {
        const pages = (count: number) => async (after: string | [string, string] | null) => {
            const at = after === null ? 0 : Number(after);
            return { items: [at], next: at + 1 < count ? String(at + 1) : null };
        };
        expect(await gatherPages(pages(3), 20)).toEqual({ items: [0, 1, 2], complete: true });
        expect(await gatherPages(pages(3), 3)).toEqual({ items: [0, 1, 2], complete: true });
        expect(await gatherPages(pages(4), 3)).toEqual({ items: [0, 1, 2], complete: false });
        expect(await gatherPages(pages(9), 2, '5')).toEqual({ items: [5, 6], complete: false });
    });
});

// THE SERVICE LAYER ITSELF, over a stand-in node. The real core and the real document helpers
// run; only the sign-in machinery (which needs a browser) and the network are replaced. The
// stand-in answers exactly as seed.doc_list does: newest-first lists bookmark with the pair
// [moment, id] (tests/seed/documents.postgres-test.ts holds the door to that), id-ordered lists
// with the last id.
vi.mock('../src/services/independent/oidc', () => ({ createSeedIdentity: () => ({}) }));
vi.mock('../src/services/independent/session', () => ({
    createSeedSession: () => ({ snapshot: () => ({ status: 'anonymous' }), start: async () => {} }),
}));

describe('paging through the independent service layer', () => {
    const asked: string[] = [];
    const node = (total: number) => async (input: unknown) => {
        const url = new URL(String(input), 'https://node.example');
        asked.push(url.pathname + url.search);
        const limit = Number(url.searchParams.get('limit'));
        const newest = url.searchParams.get('order') === 'newest';
        const after = url.searchParams.get('after');
        const all = Array.from({ length: total }, (_, i) => ({ id: `d${String(i).padStart(5, '0')}`, moment: `2026-01-01T00:00:00.${String(i).padStart(6, '0')}Z` }));
        let rows = newest ? [...all].reverse() : all;
        if (after !== null) {
            const id = newest ? (JSON.parse(after) as [string, string])[1] : after;
            rows = rows.slice(rows.findIndex(r => r.id === id) + 1);
        }
        const page = rows.slice(0, limit), last = page.at(-1);
        const next = rows.length > limit && last ? (newest ? [last.moment, last.id] : last.id) : null;
        return new Response(JSON.stringify({ items: page.map(r => ({ id: r.id })), next }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const load = async (total: number) => {
        vi.stubGlobal('fetch', vi.fn(node(total)));
        return import('../src/services/independent/docs');
    };
    beforeEach(() => {
        asked.length = 0;
        vi.stubGlobal('SEED_BROWSER_CONFIG', { appOrigin: 'https://node.example', issuer: 'https://id.node.example/realms/lightseed', origins: ['https://node.example'] });
        vi.stubGlobal('window', { location: { pathname: '/', href: 'https://node.example/' }, history: { replaceState: () => {} } });
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    it('a newest-first feed reaches its second page and its end', async () => {
        const { docList } = await load(30);
        const first = await docList('lifetrees', { newest: true, limit: 12 });
        expect(first.items.map(d => d.id)).toHaveLength(12);
        expect(first.next).toEqual([expect.any(String), 'd00018']);
        const second = await docList('lifetrees', { newest: true, limit: 12, after: first.next });
        expect(second.items[0].id).toBe('d00017');
        expect(second.next).toEqual([expect.any(String), 'd00006']);
        const third = await docList('lifetrees', { newest: true, limit: 12, after: second.next });
        expect(third.items.map(d => d.id)).toHaveLength(6);
        expect(third.next).toBeNull();
        expect(new Set([...first.items, ...second.items, ...third.items].map(d => d.id)).size).toBe(30);
    });
    it('an id-ordered list pages by its string bookmark', async () => {
        const { docList } = await load(5);
        const first = await docList('lifetrees', { limit: 3 });
        expect(first.next).toBe('d00002');
        expect((await docList('lifetrees', { limit: 3, after: first.next })).items.map(d => d.id)).toEqual(['d00003', 'd00004']);
    });
    it('reads a whole list of either order, and says when the ceiling cut it', async () => {
        const { docAll, docWhole } = await load(250);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect((await docAll('pulses', { newest: true })).length).toBe(250);
        expect(await docWhole('pulses', {}, 3).then(w => [w.items.length, w.complete])).toEqual([250, true]);
        expect(warn).not.toHaveBeenCalled();
        expect(await docWhole('pulses', {}, 2).then(w => [w.items.length, w.complete])).toEqual([200, false]);
        expect((await docAll('pulses', {}, 2)).length).toBe(200);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain('/v1/docs/pulses');
    });
});
