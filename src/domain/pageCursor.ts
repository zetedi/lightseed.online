// THE BOOKMARK OF A PAGE (2026-11-19). The node's doors answer a bounded list with a bookmark
// for the next page, and the bookmark has two shapes: a plain string (the last id, or a door's
// own sealed text) and, where a list is read newest-first, the pair [moment, id]. Both are the
// door's to make and the door's to read; the browser only carries them back. This file is the
// one place that knows the shapes, so no hand between the door and the feed can drop one.
export type PageCursor = string | [string, string];

// What a door's `next` says: a bookmark, or null when the list has ended. Anything else is no
// bookmark — never guessed into one.
export const readPageCursor = (raw: unknown): PageCursor | null => {
    if (typeof raw === 'string') return raw.length > 0 ? raw : null;
    if (Array.isArray(raw) && raw.length === 2 && raw.every(part => typeof part === 'string' && part.length > 0)) return [raw[0], raw[1]];
    return null;
};

// The bookmark as the `after` parameter: a string travels as itself, a pair as its JSON.
export const pageCursorParam = (cursor: PageCursor): string => typeof cursor === 'string' ? cursor : JSON.stringify(cursor);

export interface Gathered<T> {
    items: T[];
    // false when the walk stopped at its ceiling while the door still held a bookmark: the
    // list is a beginning, not the whole.
    complete: boolean;
}

// Walk a list page by page to its end, or to an honest ceiling. Never an infinite walk, and
// never a silent one: a list cut at the ceiling says so.
export const gatherPages = async <T>(
    fetchPage: (after: PageCursor | null) => Promise<{ items: T[]; next: PageCursor | null }>,
    maxPages: number, start: PageCursor | null = null,
): Promise<Gathered<T>> => {
    const items: T[] = [];
    let after = start;
    for (let page = 0; page < maxPages; page++) {
        const result = await fetchPage(after);
        items.push(...result.items);
        after = result.next;
        if (!after) return { items, complete: true };
    }
    return { items, complete: false };
};
