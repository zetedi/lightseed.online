import { useEffect, useMemo, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { firestoreStore } from '../adapters/firestore';
import { getAllLightHouses, getLightHousesByDomain } from '../services/firebase/trees';
import { canViewLightHouse, type LightHouse } from '../domain/lightHouse';
import { useRefreshSignal } from './useRefreshSignal';

// The lightHouses THIS viewer may see, scoped like the trees: a community domain shows its
// own, the hub (domain null) shows them all. One source for the map markers AND the forest
// grid cards: fetch what the rules allow (public-only when signed out), then gate per-doc
// with canViewLightHouse using the viewer's member links.

export const useVisibleLightHouses = (domain: string | null, refreshKey = 0): LightHouse[] => {
    const { lightseed, isAdmin, isSuperAdmin } = useSession();
    const viewerUid = lightseed?.uid;
    const signal = useRefreshSignal(['lightHouses']);

    const [memberCommunityIds, setMemberCommunityIds] = useState<Set<string>>(new Set());
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset-on-signout before the async links fetch below
        if (!viewerUid) { setMemberCommunityIds(prev => prev.size === 0 ? prev : new Set()); return; }
        let alive = true;
        firestoreStore.linksFrom(viewerUid, 'member')
            .then(links => { if (alive) setMemberCommunityIds(new Set(links.map(l => l.to))); })
            .catch(() => {});
        return () => { alive = false; };
    }, [viewerUid]);

    const [all, setAll] = useState<LightHouse[]>([]);
    // Belonging is LIN edges (lightHouse __shelters__ community) — one query, grouped.
    const [homesOf, setHomesOf] = useState<Map<string, string[]>>(new Map());
    useEffect(() => {
        let alive = true;
        const opts = { publicOnly: !viewerUid };
        Promise.all([
            (domain ? getLightHousesByDomain(domain, opts) : getAllLightHouses(opts)),
            viewerUid ? firestoreStore.linksByRel('shelters').catch(() => []) : Promise.resolve([]),
        ])
            .then(([list, links]) => {
                if (!alive) return;
                const map = new Map<string, string[]>();
                for (const l of links) map.set(l.from, [...(map.get(l.from) || []), l.to]);
                setAll(list);
                setHomesOf(map);
            })
            .catch(() => {});
        return () => { alive = false; };
    }, [domain, refreshKey, viewerUid, signal]);

    return useMemo(
        () => all.filter(s => canViewLightHouse(
            s,
            { uid: viewerUid, isStaff: isAdmin || isSuperAdmin, memberCommunityIds },
            [...(s.communityId ? [s.communityId] : []), ...(homesOf.get(s.id) || [])],
        )),
        [all, homesOf, viewerUid, isAdmin, isSuperAdmin, memberCommunityIds],
    );
};
