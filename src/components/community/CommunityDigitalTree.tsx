import { useEffect, useState } from 'react';
import { ChainTree } from '../sections/ChainTree';
import { getPulsesByCommunity } from '../../services/firebase';
import type { Community, Pulse } from '../../types';

// A COMMUNITY IS A BEING, so it has a digital tree too: its own chain of pulses (events,
// decisions, offerings) drawn by the being-generic ChainTree, with the community itself as the
// root. No tend crown (a community is not watered); it grows as its members act within it.
export const CommunityDigitalTree = ({ community, onViewPulse }: {
    community: Community;
    onViewPulse?: (pulse: Pulse) => void;
}) => {
    const [blocks, setBlocks] = useState<Pulse[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let alive = true;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- flips the loading flag before the async chain fetch; re-runs only when the community changes
        setLoading(true);
        getPulsesByCommunity(community.id)
            .then(ps => { if (alive) { setBlocks(ps); setLoading(false); } })
            .catch(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [community.id]);

    return (
        <ChainTree
            blocks={blocks}
            loading={loading}
            onViewPulse={(p) => onViewPulse?.(p)}
            emptyText="No blocks on this community's chain yet — its events, decisions and offerings will grow it."
            root={{
                imageUrl: community.logoUrl || community.heroImageUrl || null,
                name: community.name,
                body: community.vision || null,
                plantedLabel: community.createdAt?.toDate ? community.createdAt.toDate().toLocaleDateString() : undefined,
            }}
        />
    );
};
