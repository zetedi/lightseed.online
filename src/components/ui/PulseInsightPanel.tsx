import { useState } from 'react';
import { Pulse, Lifetree } from '../../types';
import { Icons } from './Icons';
import { translatePulse } from '../../services/gemini';
import { getActiveIntelligenceId, getIntelligence, DEFAULT_INTELLIGENCE_ID } from '../../services/intelligence';
import { spendAiTokens, db } from '../../services/firebase';
import { isTokenisationEnabled } from '../../domain/tokenisation';
import { doc, updateDoc } from 'firebase/firestore';

// The AI "Translation Depth" + "Network Memory" column that reveals a pulse's deeper intent (spending
// a tree's AI tokens) and shows its validation standing. Extracted from PulseDetail so the event
// profile (and any future pulse-like view) can offer the same reflection without duplicating it.
export const PulseInsightPanel = ({ pulse, activeTree }: { pulse: Pulse; activeTree?: Lifetree | null }) => {
    const [depth, setDepth] = useState<number>(3);
    const [isTranslating, setIsTranslating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // The AI-token economy is a per-node toggle (About → Vision). While off, translation is free
    // and the token cost/balance UI is hidden.
    const tokensOn = isTokenisationEnabled();

    const handleTranslate = async () => {
        if (!activeTree) {
            setError("You must have an active Lifetree to translate.");
            return;
        }

        setIsTranslating(true);
        setError(null);

        try {
            // 1. Spend AI Tokens (1 token per depth level) — only when the node runs the token economy.
            if (tokensOn) {
                await spendAiTokens(activeTree.id, depth);
            }

            // 2. Call the Translation engine through the reader's chosen intelligence — resolved
            // HERE so the provenance we persist below names the lens that actually read.
            const intelligenceId = getActiveIntelligenceId() ?? DEFAULT_INTELLIGENCE_ID;
            const intelligence = await getIntelligence(intelligenceId).catch(() => null);
            const response = await translatePulse({
                senderTreeName: pulse.authorName,
                receiverTreeName: activeTree.name,
                message: pulse.content || pulse.body,
                depth,
            }, intelligenceId);

            // 3. Update the Pulse doc with the reading — the five distinctions (NVC) plus
            // provenance (who read, through which intelligence — the Carry honesty law).
            // Firestore rejects undefined values, so only the layers the model filled are saved.
            const interpretationData = Object.fromEntries(Object.entries({
                depth,
                happened: response.happened,
                feeling: response.feeling,
                inference: response.inference,
                need: response.need,
                asks: response.asks,
                alternatives: response.alternatives,
                readByTreeId: activeTree.id,
                readByTreeName: activeTree.name,
                intelligenceId,
                intelligenceName: intelligence?.name || 'Osiris',
                readAt: Date.now(),
            }).filter(([, v]) => v !== undefined)) as unknown as NonNullable<Pulse['aiInterpretation']>;

            await updateDoc(doc(db, 'pulses', pulse.id), {
                aiInterpretation: interpretationData
            });

            // eslint-disable-next-line react-hooks/immutability -- intentional optimistic mutation of the parent-owned pulse object so all views of it show the saved interpretation without a refetch
            pulse.aiInterpretation = interpretationData; // optimistic update
        } catch (e: any) {
            console.error(e);
            setError(e.message);
        } finally {
            setIsTranslating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-lg font-bold text-sky-400 uppercase tracking-wider mb-6 flex items-center">
                        <Icons.Wizard />
                        <span className="ml-2">Translation Depth System</span>
                    </h2>

                    {pulse.aiInterpretation ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            {/* The five distinctions (NVC) — legacy single-blob readings fall into
                                the first layer so old pulses keep rendering. */}
                            <div className="bg-white/10 p-4 rounded-xl border border-white/20 space-y-2">
                                <span className="text-xs uppercase tracking-widest text-indigo-300 font-bold">Reading (Depth {pulse.aiInterpretation.depth})</span>
                                {/* Provenance — a persisted reading names its lens (the Carry honesty law). */}
                                {(pulse.aiInterpretation.readByTreeName || pulse.aiInterpretation.intelligenceName) && (
                                    <p className="text-[10px] text-indigo-200/70">
                                        read by {pulse.aiInterpretation.readByTreeName || 'a tree'} · through {pulse.aiInterpretation.intelligenceName || 'an intelligence'}
                                        {pulse.aiInterpretation.readAt ? ` · ${new Date(pulse.aiInterpretation.readAt).toLocaleDateString()}` : ''}
                                    </p>
                                )}
                                {([
                                    ['happened', pulse.aiInterpretation.happened ?? pulse.aiInterpretation.interpretation],
                                    ['feels', pulse.aiInterpretation.feeling],
                                    ['may assume · unconfirmed', pulse.aiInterpretation.inference],
                                    ['needs', pulse.aiInterpretation.need],
                                    ['asks', pulse.aiInterpretation.asks ?? pulse.aiInterpretation.growthSuggestion],
                                ] as [string, string | undefined][]).filter(([, v]) => v && v.trim()).map(([label, v]) => (
                                    <p key={label} className="text-sm font-medium leading-relaxed">
                                        <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300/80">{label}</span> {v}
                                    </p>
                                ))}
                            </div>

                            {pulse.aiInterpretation.alternatives && pulse.aiInterpretation.alternatives.length > 0 && (
                                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-2">Also possible</span>
                                    <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside pl-4">
                                        {pulse.aiInterpretation.alternatives.map((alt, i) => (
                                            <li key={i}>{alt}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <p className="text-sm text-indigo-200 font-light">
                                {tokensOn
                                    ? 'Use AI tokens (Attention-Energy) to translate this pulse and reveal deeper underlying intent, emotion, or systemic context.'
                                    : 'Translate this pulse to reveal its deeper underlying intent, emotion, or systemic context.'}
                            </p>

                            {/* Depth = how much of the being's living context the reading draws on
                                (never how speculative it may get) — see domain/translation. */}
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
                                    <span>Context Depth</span>
                                    <span>{depth} / 4</span>
                                </div>
                                <input
                                    type="range"
                                    min="1" max="4"
                                    value={depth}
                                    onChange={(e) => setDepth(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                                <div className="text-[10px] text-slate-400 flex justify-between">
                                    <span>1: Message alone</span>
                                    <span>4: The subgraph</span>
                                </div>
                            </div>

                            {tokensOn && (
                                <div className="bg-black/20 p-4 rounded-xl border border-white/10 flex items-center justify-between">
                                    <div>
                                        <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Energy Cost</div>
                                        <div className="text-lg font-mono font-bold text-amber-400">{depth} AI Tokens</div>
                                    </div>
                                    {activeTree && (
                                        <div className="text-right">
                                            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Your Balance</div>
                                            <div className="text-lg font-mono font-bold text-white">{activeTree.aiTokenBalance || 0}</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {error && <div className="text-xs text-red-400 bg-red-900/30 border border-red-500/50 p-3 rounded-lg">{error}</div>}

                            <button
                                disabled={isTranslating || !activeTree || (tokensOn && (activeTree.aiTokenBalance || 0) < depth)}
                                onClick={handleTranslate}
                                className="mx-auto bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-10 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-900/50 transition-all active:scale-95 flex justify-center items-center gap-2"
                            >
                                {isTranslating ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <Icons.Wizard />}
                                {isTranslating ? "Translating..." : "Translate Pulse"}
                            </button>

                            {!activeTree && <p className="text-[10px] text-center text-rose-400">You need an active Lifetree to perform translations.</p>}
                            {tokensOn && activeTree && (activeTree.aiTokenBalance || 0) < depth && <p className="text-[10px] text-center text-amber-400">Not enough AI tokens. Validate observations to earn more.</p>}
                        </div>
                    )}
                </div>
            </div>

            {/* Immutable chain Ledger info - Repurposed for Memory / Validation */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                    <Icons.ShieldCheck />
                    <span className="ml-2">Network Memory</span>
                </h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <span className="text-sm text-slate-600">Validation Score</span>
                        <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{pulse.validationScore || pulse.loveCount || 0}</span>
                    </div>
                    <p className="text-xs text-slate-500 italic">
                        {tokensOn
                            ? 'Only validated understanding becomes memory. When you validate this pulse, you contribute to community coherence and earn AI tokens.'
                            : 'Only validated understanding becomes memory. When you validate this pulse, you contribute to community coherence.'}
                    </p>
                </div>
            </div>
        </div>
    );
};
