import { useEffect, useMemo, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { firestoreStore } from '../adapters/firestore';
import { getAllSanctuaries, getSanctuariesByDomain } from '../services/firebase/trees';
import { canViewSanctuary, type Sanctuary } from '../domain/sanctuary';
import { useRefreshSignal } from './useRefreshSignal';

// The sanctuaries THIS viewer may see, scoped like the trees: a community domain shows its
// own, the hub (domain null) shows them all. One source for the map markers AND the forest
// grid cards: fetch what the rules allow (public-only when signed out), then gate per-doc
// with canViewSanctuary using the viewer's member links.

export const useVisibleSanctuaries = (domain: string | null, refreshKey = 0): Sanctuary[] => {
    const { lightseed, isAdmin, isSuperAdmin } = useSession();
    const viewerUid = lightseed?.uid;
    const signal = useRefreshSignal(['sanctuaries']);

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

    const [all, setAll] = useState<Sanctuary[]>([]);
    useEffect(() => {
        let alive = true;
        const opts = { publicOnly: !viewerUid };
        (domain ? getSanctuariesByDomain(domain, opts) : getAllSanctuaries(opts))
            .then(list => { if (alive) setAll(list); })
            .catch(() => {});
        return () => { alive = false; };
    }, [domain, refreshKey, viewerUid, signal]);

    return useMemo(
        () => all.filter(s => canViewSanctuary(s, { uid: viewerUid, isStaff: isAdmin || isSuperAdmin, memberCommunityIds })),
        [all, viewerUid, isAdmin, isSuperAdmin, memberCommunityIds],
    );
};
