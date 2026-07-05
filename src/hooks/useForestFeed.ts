import { useEffect, useRef, useState } from 'react';
import type { Alignment, Lightseed } from '../types';
import {
  fetchAllLifetrees, fetchLifetrees, fetchPulses, fetchEventPulses, fetchReachPulses, fetchVisions,
  getPendingAlignments,
} from '../services/firebase';
import { queryableLevels } from '../domain/pulseVisibility';

// The paginated forest / pulse / vision / event / reach feed and its infinite scroll. Owns `data`
// plus the cursor / loading / hasMore machinery; loadContent(reset) (re)loads the current tab,
// deduping by id when appending. The map view loads the whole forest at once (no pagination); the
// Observatory branch loads pending alignments (hence setAlignments). Extracted from App verbatim.
export function useForestFeed(params: {
  tab: string;
  viewMode: 'grid' | 'map';
  lightseed: Lightseed | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  setAlignments: (a: Alignment[]) => void;
}) {
  const { tab, viewMode, lightseed, isSuperAdmin, isAdmin, setAlignments } = params;

  const [data, setData] = useState<any[]>([]);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const forestSentinelRef = useRef<HTMLDivElement>(null);

  const loadContent = async (reset = false) => {
    if (reset) {
      setData([]);
      setLastDoc(null);
      setHasMore(true);
      // Note: synergies are intentionally NOT cleared here — they're tab-independent and
      // cached, so they remain visible in the Observatory after analysing in Visions.
    }

    if (!reset && !hasMore) return;

    setLoadingMore(true);
    const currentLastDoc = reset ? undefined : lastDoc;
    const isDevHost = /localhost|127\.0\.0\.1|^192\.168\.|\.local$/.test(window.location.hostname);
    // On dev hosts a superadmin sees the whole network (no domain scoping).
    const currentDomain = (isDevHost && isSuperAdmin) ? 'lightseed.online' : window.location.hostname;
    // Broad feeds carry no scope, so this resolves to public (+ node when signed in; all
    // but private for staff) — keeping the query to docs the rules will allow.
    const feedLevels = queryableLevels({ uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin });
    // Tree visibility levels this viewer may query (null = staff, no filter).
    const treeLevels: string[] | null = (isSuperAdmin || isAdmin) ? null : (lightseed ? ['public', 'node'] : ['public']);

    try {
      if (tab === 'forest') {
        if (viewMode === 'map') {
          // The map shows the whole forest at once (no pagination) so every tree appears.
          const all = await fetchAllLifetrees(currentDomain, lightseed?.uid, treeLevels);
          setData(all);
          setLastDoc(null);
          setHasMore(false);
        } else {
          const res = await fetchLifetrees(currentLastDoc, currentDomain, lightseed?.uid, treeLevels);
          setData(prev => {
            const newItems = res.items;
            if (reset) return newItems;
            // Deduplicate items based on ID to prevent visual duplicates
            const existingIds = new Set(prev.map(p => p.id));
            return [...prev, ...newItems.filter(i => !existingIds.has(i.id))];
          });
          setLastDoc(res.lastDoc);
          setHasMore(!!res.lastDoc);
        }
      }
      else if (tab === 'pulses') {
        const res = await fetchPulses(currentLastDoc, currentDomain, feedLevels);
        setData(prev => {
          const newItems = res.items;
          if (reset) return newItems;
          const existingIds = new Set(prev.map(p => p.id));
          return [...prev, ...newItems.filter(i => !existingIds.has(i.id))];
        });
        setLastDoc(res.lastDoc);
        setHasMore(!!res.lastDoc);
      }
      else if (tab === 'events') {
        const res = await fetchEventPulses(currentLastDoc, currentDomain, feedLevels);
        setData(prev => {
          const newItems = res.items;
          if (reset) return newItems;
          const existingIds = new Set(prev.map(p => p.id));
          return [...prev, ...newItems.filter(i => !existingIds.has(i.id))];
        });
        setLastDoc(res.lastDoc);
        setHasMore(!!res.lastDoc);
      }
      else if (tab === 'inspiration') {
        const res = await fetchReachPulses(currentLastDoc, currentDomain, feedLevels);
        setData(prev => {
          const newItems = res.items;
          if (reset) return newItems;
          const existingIds = new Set(prev.map(p => p.id));
          return [...prev, ...newItems.filter(i => !existingIds.has(i.id))];
        });
        setLastDoc(res.lastDoc);
        setHasMore(!!res.lastDoc);
      }
      else if (tab === 'visions') {
        const res = await fetchVisions(currentLastDoc, currentDomain);
        setData(prev => {
          const newItems = res.items;
          if (reset) return newItems;
          const existingIds = new Set(prev.map(p => p.id));
          return [...prev, ...newItems.filter(i => !existingIds.has(i.id))];
        });
        setLastDoc(res.lastDoc);
        setHasMore(!!res.lastDoc);
      }
      else if (tab === 'observatory' && lightseed) {
        const res = await getPendingAlignments(lightseed.uid);
        setAlignments(res);
      }
    } catch (e) {
      console.error("Load Content Error:", e);
    }
    setLoadingMore(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
        if (!loadingMore && hasMore && tab !== 'dashboard' && tab !== 'observatory' && tab !== 'inspiration' && tab !== 'profile' && tab !== 'about' && tab !== 'forest') {
          loadContent(false);
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingMore, hasMore, tab, lastDoc]);

  // IntersectionObserver sentinel for forest list view
  useEffect(() => {
    if (tab !== 'forest' || viewMode !== 'grid') return;
    const sentinel = forestSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadContent(false);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [tab, viewMode, hasMore, loadingMore, lastDoc]);

  return { data, setData, loadContent, loadingMore, forestSentinelRef };
}
