import { useEffect, useState } from 'react';
import { ChainTree } from '../sections/ChainTree';
import { getPulsesByCommunity } from '../../services/firebase';
import type { Community, Pulse } from '../../types';

// A COMMUNITY IS A BEING, so it has a digital tree too: its own chain of pulses (events,
// decisions, offerings) drawn by the being-generic ChainTree, with the community itself as the
// root. No care crown (a community is not watered); it grows as its members act within it.

// The vision may be stored as rich text (<p>, &nbsp;); the root card speaks it as plain words.
const plainWords = (html?: string | null): string | null => {
    const text = (html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
    return text || null;
};

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
                // A faceless community roots in Mahameru, the first willow every chain remembers.
                imageUrl: community.logoUrl || community.heroImageUrl || '/mahameru.svg',
                name: community.name,
                body: plainWords(community.vision),
                plantedLabel: community.createdAt?.toDate ? community.createdAt.toDate().toLocaleDateString() : undefined,
            }}
        />
    );
};
