import { useEffect, useState } from 'react';
import { getIntelligence } from '@backend/intelligence';
import { listenToUserProfile } from '@backend';

// THE INTELLIGENCE A BEING SPEAKS WITH — its chosen one (by id), the name that one goes by, and
// how much of today's text allowance is spent. Read live from the being's profile.
export const useActiveIntelligence = (lightseed: { uid: string } | null | undefined) => {
    const [usage, setUsage] = useState(0);
    const [preferredIntelligenceId, setPreferredIntelligenceId] = useState<string | undefined>(undefined);
    // The name the chosen intelligence goes by, remembered WITH the id it was read for: a name
    // belongs to its intelligence, so once the choice changes or is cleared the old name is no
    // longer said, and the fallback speaks until the new one has answered.
    const [named, setNamed] = useState<{ id: string; name: string } | null>(null);

    useEffect(() => {
        if (lightseed) {
            const unsub = listenToUserProfile(lightseed.uid, (data) => {
                setUsage(data?.dailyAiText || 0);
                setPreferredIntelligenceId(data?.preferredIntelligenceId || undefined);
            });
            return () => unsub();
        }
    }, [lightseed]);

    // Resolve the active intelligence's display name (falls back to Osiris).
    useEffect(() => {
        if (!preferredIntelligenceId) return;
        let cancelled = false;
        getIntelligence(preferredIntelligenceId)
            .then(i => { if (!cancelled) setNamed({ id: preferredIntelligenceId, name: i && i.enabled !== false && i.name ? i.name : 'Osiris' }); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [preferredIntelligenceId]);
    const aiName = preferredIntelligenceId && named?.id === preferredIntelligenceId ? named.name : 'Osiris';

    return { usage, preferredIntelligenceId, aiName };
};
