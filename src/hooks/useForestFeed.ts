import { useEffect, useRef, useState } from 'react';
import type { Alignment, Lightseed, Pulse } from '../types';
import {
  fetchAllLifetrees, fetchLifetrees, fetchPulses, fetchEventPulses, fetchOfferingPulses, fetchReachPulses, fetchVisions,
  getPendingAlignments, treesStandingIn,
} from '../services/firebase';
import { queryableLevels, eventFeedScope, ownMergeUid } from '../domain/pulseVisibility';
import { dataDomainFor, reflectsInstancePublic } from '../domain/communityDoor';
import { excludeBedTrees } from '../domain/bed';

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
  // unscoped (shows every domain's public); otherwise it scopes to this place. Undefined =
  // scoped: opening reflection is always an explicit community decision.
  hostReflectsPublic?: boolean;
  // The active node's CANONICAL domain (impersonated || host community). Scoping keys on this,
  // not the raw hostname — so impersonation and alternate seed-shell hosts scope by the place
  // actually being viewed, matching how trees/pulses are tagged (plantLifetree).
  hostDomain?: string;
  // Strict scope: when scoped, hide even the viewer's own off-domain trees (a "this place only"
  // forest). Only meaningful while NOT reflecting. See domain/community.strictScope.
  hostStrictScope?: boolean;
  // The active community's id: a scoped forest also shows the trees STANDING here through
  // grows_in edges (ring 2026-08-24) — they entered through the door, so even strict shows them.
  hostCommunityId?: string;
}) {
  const { tab, viewMode, lightseed, isSuperAdmin, isAdmin, setAlignments, hostReflectsPublic, hostDomain, hostStrictScope, hostCommunityId } = params;

  const [data, setData] = useState<any[]>([]);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const forestSentinelRef = useRef<HTMLDivElement>(null);
  // Only the NEWEST load may land. A reset (tab change, re-scope, a sign-in resolving) that
  // fires while an older query is still in flight used to lose the race: whichever response
  // arrived last won, so a wider, stale set could replace the fresh narrower one — items
  // appearing, then vanishing. Every await below checks it is still the newest request.
  const seqRef = useRef(0);

  const loadContent = async (reset = false) => {
    const seq = ++seqRef.current;
    const stale = () => seq !== seqRef.current;
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
    // The place being viewed: its canonical community domain (so impersonation scopes by the
    // right community), falling back to the raw hostname. Dev superadmin sees the whole network.
    const activeDomain = (isDevHost && isSuperAdmin) ? undefined : (hostDomain || window.location.hostname);
    // Commons mode: if this node reflects the instance's public, pass no domain (every feed
    // treats an absent domain as unscoped → the whole instance); otherwise scope to this node.
    // No hostname has an inherited role: absent/false is scoped; true opens the canopy.
    const reflects = reflectsInstancePublic(hostReflectsPublic);
    const currentDomain = dataDomainFor(activeDomain, hostReflectsPublic);
    // The tree feeds merge the viewer's OWN trees so a creator is never lost on a custom
    // domain; a strict, scoped node suppresses the merge. ONE derivation (domain
    // ownMergeUid) — the hand-copy era ended with the Nūr-on-Per-Auset leak.
    const feedOwnerUid = ownMergeUid(lightseed?.uid, { reflectsPublic: hostReflectsPublic, strictScope: hostStrictScope });
    // A reflecting feed requests PUBLIC only. A scoped feed keeps the viewer's ordinary
    // readable levels; reflection must never carry another place's node-visible records.
    const feedLevels = reflects
      ? queryableLevels({})
      : queryableLevels({ uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin });
    // Tree visibility levels this viewer may query (null = staff, no filter).
    const treeLevels: string[] | null = reflects
      ? ['public']
      : ((isSuperAdmin || isAdmin) ? null : (lightseed ? ['public', 'node'] : ['public']));

    try {
      if (tab === 'forest') {
        // Trees standing here through the door (grows_in) join a SCOPED forest — map and
        // grid alike; the service absorbs per-doc refusals so unseen trees stay unseen.
        const standing = (currentDomain && hostCommunityId)
          ? await treesStandingIn(hostCommunityId).catch(() => [])
          : [];
        if (stale()) return;
        const unionStanding = (items: any[]) => {
          const seen = new Set(items.map((t: any) => t.id));
          return [...items, ...standing.filter(t => !seen.has(t.id))];
        };
        if (viewMode === 'map') {
          // The map shows the whole forest at once (no pagination) so every tree appears.
          // Beds are already excluded at the service layer — the guard here is the belt
          // to that braces (a bed must never reach the forest, whatever the source).
          const all = unionStanding(excludeBedTrees(await fetchAllLifetrees(currentDomain, feedOwnerUid, treeLevels)));
          if (stale()) return;
          setData(all);
          setLastDoc(null);
          setHasMore(false);
        } else {
          const res = await fetchLifetrees(currentLastDoc, currentDomain, feedOwnerUid, treeLevels);
          if (stale()) return;
          setData(prev => {
            const newItems = reset ? unionStanding(excludeBedTrees(res.items)) : excludeBedTrees(res.items);
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
        if (stale()) return;
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
        // The events tab and the home hero box derive their scope from ONE sentence
        // (domain/pulseVisibility eventFeedScope) — the banner leak taught us what two
        // hand-copies of the same law cost. ownerUid folds the viewer's OWN events in;
        // a strict scoped node suppresses it, like the trees.
        const { levels, ownerUid } = eventFeedScope(
          { uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin },
          { reflectsPublic: hostReflectsPublic, strictScope: hostStrictScope },
        );
        const res = await fetchEventPulses(currentLastDoc, currentDomain, levels, ownerUid);
        if (stale()) return;
        setData(prev => {
          const newItems = res.items;
          if (reset) return newItems;
          const existingIds = new Set(prev.map(p => p.id));
          return [...prev, ...newItems.filter(i => !existingIds.has(i.id))];
        });
        setLastDoc(res.lastDoc);
        setHasMore(!!res.lastDoc);
      }
      else if (tab === 'offerings') {
        const res = await fetchOfferingPulses(currentLastDoc, currentDomain, feedLevels);
        if (stale()) return;
        setData(prev => {
          // A paused offering leaves the shared feed but stays visible to its own author
          // (who sees it wearing the PAUSED chip and may rewake it from its profile).
          const newItems = res.items.filter(
            (p: Pulse) => p.offeringActive !== false || p.authorId === lightseed?.uid,
          );
          if (reset) return newItems;
          const existingIds = new Set(prev.map(p => p.id));
          return [...prev, ...newItems.filter(i => !existingIds.has(i.id))];
        });
        setLastDoc(res.lastDoc);
        setHasMore(!!res.lastDoc);
      }
      else if (tab === 'inspiration') {
        const res = await fetchReachPulses(currentLastDoc, currentDomain, feedLevels);
        if (stale()) return;
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
        const res = await fetchVisions(currentLastDoc, currentDomain, {
          uid: lightseed?.uid,
          isStaff: isSuperAdmin || isAdmin,
          publicOnly: reflects,
        });
        if (stale()) return;
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
        if (stale()) return;
        setAlignments(res);
      }
    } catch (e) {
      console.error("Load Content Error:", e);
    }
    if (!stale()) setLoadingMore(false);
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
