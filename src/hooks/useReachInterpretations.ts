import { useCallback, useState } from 'react';
import { translatePulse, type TranslationResponse } from '@backend/gemini';
import { fetchGrowthPulses } from '@backend';
import { useLanguage } from '../contexts/LanguageContext';
import type { Lifetree } from '../types';

// WHAT A MESSAGE MEANS — the reading a being may ask for beneath an incoming tree's words
// (domain/translation), kept per line of the open thread.
export const useReachInterpretations = (
    selectedTree: Lifetree | null,
    activeTree: Lifetree | null | undefined,
    preferredIntelligenceId: string | undefined,
) => {
    const { t } = useLanguage();
    // Per-message AI interpretations — the "shadow text" beneath an incoming tree's words.
    const [interpretations, setInterpretations] = useState<Record<number, TranslationResponse | 'loading' | { error: string }>>({});
    // A new thread starts with no readings.
    const clearInterpretations = useCallback(() => setInterpretations({}), []);

    // Reveal what an incoming tree's message means — interpreted through the reader's
    // chosen intelligence against both trees' visions, shown as greyed shadow text.
    const revealInterpretation = async (index: number, text: string) => {
        if (!selectedTree || !activeTree) return;
        const current = interpretations[index];
        if (current === 'loading' || (current && !('error' in current))) return; // already loading or done
        setInterpretations(prev => ({ ...prev, [index]: 'loading' }));
        try {
            // Depth = context depth (domain/translation): the visions, plus the sender tree's
            // public growth (its mints). The subgraph (depth 4) can widen this later.
            let context = [selectedTree.shortTitle, selectedTree.body, activeTree.body]
                .filter(Boolean).join(' — ');
            try {
                const mints = (await fetchGrowthPulses(selectedTree.id))
                    .slice(0, 5).map(p => p.title).filter(Boolean).join(' · ');
                if (mints) context += ` — Recent public growth of ${selectedTree.name}: ${mints}`;
            } catch { /* optional context — the reading works without it */ }
            const result = await translatePulse({
                senderTreeName: selectedTree.name,
                receiverTreeName: activeTree.name,
                message: text,
                depth: 3, // message + visions + public mints (what we actually gathered)
                context,
            }, preferredIntelligenceId);
            setInterpretations(prev => ({ ...prev, [index]: result }));
        } catch (e: any) {
            setInterpretations(prev => ({ ...prev, [index]: { error: e?.message || t('err_interpreter') } }));
        }
    };

    return { interpretations, revealInterpretation, clearInterpretations };
};
