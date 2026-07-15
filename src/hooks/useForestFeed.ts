import { useEffect, useRef, useState } from 'react';
import type { Alignment, Lightseed } from '../types';
import {
  fetchAllLifetrees, fetchLifetrees, fetchPulses, fetchEventPulses, fetchReachPulses, fetchVisions,
  getPendingAlignments, isHubDomain,
} from '../services/firebase';
import { queryableLevels } from '../domain/pulseVisibility';
import { reflectsInstancePublic } from '../domain/communityDoor';

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
  // The active node's commons setting: when it reflects the instance's public, the feed is
  // unscoped (shows every domain's public); otherwise it scopes to this node. Undefined =
  // fall back to the hub-domain default (zero migration). See domain/communityDoor.
  hostReflectsPublic?: boolean;
  // The active node's CANONICAL domain (impersonated || host community). Scoping keys on this,
  // not the raw hostname — so impersonation and hub-alias hosts (lifeseed.online) scope by the
  // node actually being viewed, matching how trees/pulses are tagged (plantLifetree).
  hostDomain?: string;
}) {
  const { tab, viewMode, lightseed, isSuperAdmin, isAdmin, setAlignments, hostReflectsPublic, hostDomain } = params;

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
    // The node being viewed: its canonical domain (so impersonation and hub aliases scope by the
    // right node), falling back to the raw hostname. Dev superadmin sees the whole network.
    const activeDomain = (isDevHost && isSuperAdmin) ? undefined : (hostDomain || window.location.hostname);
    // Commons mode: if this node reflects the instance's public, pass no domain (every feed
    // treats an absent domain as unscoped → the whole instance); otherwise scope to this node.
    // Unset flag falls back to the hub default, so the hub keeps reflecting and others stay scoped.
    const currentDomain = reflectsInstancePublic(hostReflectsPublic, isHubDomain(activeDomain))
      ? undefined
      : activeDomain;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadContent is recreated each render; its inputs (tab, lastDoc, hasMore, loadingMore) are already deps, adding it would re-attach every render
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadContent is recreated each render; its inputs (tab, lastDoc, hasMore, loadingMore) are already deps, adding it would rebuild the observer every render
  }, [tab, viewMode, hasMore, loadingMore, lastDoc]);

  return { data, setData, loadContent, loadingMore, forestSentinelRef };
}
