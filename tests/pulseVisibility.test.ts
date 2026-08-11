import { describe, it, expect } from 'vitest';
import { canView, queryableLevels, mergeAuthored, pulseScope, eventFeedScope, eventsOnView } from '../src/domain/pulseVisibility';

// THE AUTHOR'S OWN. canView has always said an author sees their own pulse at every visibility;
// queryableLevels has always spoken about STANDING, not authorship. Between those two truths an
// author's own node-visible event fell out of every feed — invisible to the one who made it, most
// completely on a reflecting hub, which asks for 'public' and nothing else. These tests hold both
// halves: the gap that made the bug, and the merge that closes it.

const ev = (over: Record<string, unknown> = {}) => ({
  id: 'e1', authorId: 'zoltan', visibility: 'node' as const, ...over,
});

describe('the gap that hid an author from their own event', () => {
  it('canView lets the author see their own node-visible event', () => {
    expect(canView(ev(), { uid: 'zoltan' })).toBe(true);
  });

  it('but the levels a reflecting feed may request never mention authorship', () => {
    // A reflecting hub asks as the world asks: public only. The author's own node event is not
    // in the answer, and no visibility level the author could be granted would put it there.
    expect(queryableLevels({})).toEqual(['public']);
    expect(queryableLevels({ uid: 'zoltan' })).toEqual(['public', 'node']);
    expect(queryableLevels({})).not.toContain('node');
  });

  it('a standalone event is node-scoped: rooted in no community and no tree', () => {
    expect(pulseScope(ev())).toBe('node');
  });
});

describe('mergeAuthored: folding the author\'s own back in', () => {
  const at = (p: { ms: number }) => p.ms;

  it('adds what the feed could not ask for, newest first', () => {
    const feed = [{ id: 'a', ms: 300 }, { id: 'b', ms: 100 }];
    const own = [{ id: 'mine', ms: 200 }];
    expect(mergeAuthored(feed, own, at).map(p => p.id)).toEqual(['a', 'mine', 'b']);
  });

  it('never duplicates one the feed already carried', () => {
    const feed = [{ id: 'a', ms: 300 }, { id: 'mine', ms: 200 }];
    const own = [{ id: 'mine', ms: 200 }];
    const merged = mergeAuthored(feed, own, at);
    expect(merged).toHaveLength(2);
    expect(merged.filter(p => p.id === 'mine')).toHaveLength(1);
  });

  it('leaves the caller\'s arrays untouched — a feed page is not ours to reorder', () => {
    const feed = [{ id: 'a', ms: 100 }, { id: 'b', ms: 300 }];
    const own = [{ id: 'mine', ms: 200 }];
    mergeAuthored(feed, own, at);
    expect(feed.map(p => p.id)).toEqual(['a', 'b']);
    expect(own.map(p => p.id)).toEqual(['mine']);
  });

  it('holds when either side is empty, and when nothing is dated', () => {
    expect(mergeAuthored([], [{ id: 'mine', ms: 1 }], at).map(p => p.id)).toEqual(['mine']);
    expect(mergeAuthored([{ id: 'a', ms: 1 }], [], at).map(p => p.id)).toEqual(['a']);
    expect(mergeAuthored([], [], at)).toEqual([]);
    // An unsaved createdAt reads as 0 (serverTimestamp lands a breath later) — it sorts last
    // rather than throwing the whole list away.
    const undated = mergeAuthored([{ id: 'a', ms: 5 }], [{ id: 'mine', ms: 0 }], at);
    expect(undated.map(p => p.id)).toEqual(['a', 'mine']);
  });
});

describe('eventFeedScope — the one sentence both event surfaces speak', () => {
  // Ring 2026-08-11: the home hero box leaked a lightseed event onto Per Auset because the
  // banner carried a hand-copy of the feed's derivation and only the feed learned strictScope.
  const zoltan = { uid: 'zoltan', isStaff: false };

  it('reflecting: public-only plus the viewer\'s own', () => {
    const { levels, ownerUid } = eventFeedScope(zoltan, { reflectsPublic: true, strictScope: false });
    expect(levels).toEqual(['public']);
    expect(ownerUid).toBe('zoltan');
  });
  it('scoped strict: the place and nothing else — no owner merge', () => {
    const { levels, ownerUid } = eventFeedScope(zoltan, { reflectsPublic: false, strictScope: true });
    expect(levels).toEqual(['public', 'node']);
    expect(ownerUid).toBeUndefined();
  });
  it('scoped lenient: the place plus the viewer\'s own (creator never lost)', () => {
    const { levels, ownerUid } = eventFeedScope(zoltan, { reflectsPublic: false, strictScope: false });
    expect(levels).toEqual(['public', 'node']);
    expect(ownerUid).toBe('zoltan');
    expect(eventFeedScope(zoltan, {}).ownerUid).toBe('zoltan'); // absent flags = scoped lenient
  });
  it('a signed-out visitor: public only, no one to merge', () => {
    const { levels, ownerUid } = eventFeedScope({}, { reflectsPublic: false });
    expect(levels).toEqual(['public']);
    expect(ownerUid).toBeUndefined();
  });
});

describe('eventsOnView — the shared viewer cut (visitors see the node; past days rest)', () => {
  const NOON = new Date(2026, 7, 11, 12, 0).getTime();
  const iso = (d: Date) => d.toISOString();
  const nodeEv = { id: 'n', authorId: 'a', visibility: 'public' as const, eventDate: iso(new Date(2026, 7, 20)) };
  const communityEv = { id: 'c', authorId: 'a', visibility: 'public' as const, communityId: 'com1', eventDate: iso(new Date(2026, 7, 20)) };
  const pastEv = { id: 'p', authorId: 'a', visibility: 'public' as const, eventDate: iso(new Date(2026, 7, 8)) };
  const undatedEv = { id: 'u', authorId: 'a', visibility: 'public' as const };

  it('signed-out visitors see only node-scoped events', () => {
    const seen = eventsOnView([nodeEv, communityEv], { signedIn: false, showPast: true, nowMs: NOON });
    expect(seen.map(e => e.id)).toEqual(['n']);
  });
  it('past days rest hidden by default; the toggle wakes them; undated never ages out', () => {
    expect(eventsOnView([nodeEv, pastEv, undatedEv], { signedIn: true, showPast: false, nowMs: NOON }).map(e => e.id)).toEqual(['n', 'u']);
    expect(eventsOnView([nodeEv, pastEv, undatedEv], { signedIn: true, showPast: true, nowMs: NOON }).map(e => e.id)).toEqual(['n', 'p', 'u']);
  });
});
