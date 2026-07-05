import React, { useState } from 'react';
import { Pulse, Lifetree } from '../../types';
import { Icons } from './Icons';
import { translatePulse } from '../../services/gemini';
import { spendAiTokens, db } from '../../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';

// The AI "Translation Depth" + "Network Memory" column that reveals a pulse's deeper intent (spending
// a tree's AI tokens) and shows its validation standing. Extracted from PulseDetail so the event
// profile (and any future pulse-like view) can offer the same reflection without duplicating it.
export const PulseInsightPanel = ({ pulse, activeTree }: { pulse: Pulse; activeTree?: Lifetree | null }) => {
    const [depth, setDepth] = useState<number>(3);
    const [isTranslating, setIsTranslating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTranslate = async () => {
        if (!activeTree) {
            setError("You must have an active Lifetree to translate.");
            return;
        }

        setIsTranslating(true);
        setError(null);

        try {
            // 1. Spend AI Tokens (1 token per depth level)
            const tokenCost = depth;
            await spendAiTokens(activeTree.id, tokenCost);

            // 2. Call Translation Service
            const response = await translatePulse({
                senderTreeName: pulse.authorName,
                receiverTreeName: activeTree.name,
                message: pulse.content || pulse.body,
                depth,
            });

            // 3. Update the Pulse doc with the interpretation
            const interpretationData = {
                depth,
                interpretation: response.interpretation,
                confidence: response.confidence,
                alternatives: response.alternatives,
                growthSuggestion: response.growthSuggestion
            };

            await updateDoc(doc(db, 'pulses', pulse.id), {
                aiInterpretation: interpretationData
            });

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
                            <div className="bg-white/10 p-4 rounded-xl border border-white/20">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs uppercase tracking-widest text-indigo-300 font-bold">Interpretation (Depth {pulse.aiInterpretation.depth})</span>
                                    <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-1 rounded font-mono">
                                        {pulse.aiInterpretation.confidence}% Match
                                    </span>
                                </div>
                                <p className="text-sm font-medium leading-relaxed">
                                    {pulse.aiInterpretation.interpretation}
                                </p>
                            </div>

                            {pulse.aiInterpretation.alternatives && pulse.aiInterpretation.alternatives.length > 0 && (
                                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-2">Alternative Angles</span>
                                    <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside pl-4">
                                        {pulse.aiInterpretation.alternatives.map((alt, i) => (
                                            <li key={i}>{alt}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {pulse.aiInterpretation.growthSuggestion && (
                                <div className="bg-emerald-900/40 p-4 rounded-xl border border-emerald-500/30">
                                    <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold block mb-2 flex items-center gap-1">
                                        <Icons.Leaf /> Growth Suggestion
                                    </span>
                                    <p className="text-xs text-emerald-100">
                                        {pulse.aiInterpretation.growthSuggestion}
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <p className="text-sm text-indigo-200 font-light">
                                Use AI tokens (Attention-Energy) to translate this pulse and reveal deeper underlying intent, emotion, or systemic context.
                            </p>

                            <div className="space-y-3">
                                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
                                    <span>Depth Level</span>
                                    <span>{depth} / 7</span>
                                </div>
                                <input
                                    type="range"
                                    min="1" max="7"
                                    value={depth}
                                    onChange={(e) => setDepth(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                                <div className="text-[10px] text-slate-400 flex justify-between">
                                    <span>1: Summary</span>
                                    <span>7: Initiation</span>
                                </div>
                            </div>

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

                            {error && <div className="text-xs text-red-400 bg-red-900/30 border border-red-500/50 p-3 rounded-lg">{error}</div>}

                            <button
                                disabled={isTranslating || !activeTree || (activeTree.aiTokenBalance || 0) < depth}
                                onClick={handleTranslate}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-indigo-900/50 transition-all active:scale-95 flex justify-center items-center gap-2"
                            >
                                {isTranslating ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <Icons.Wizard />}
                                {isTranslating ? "Translating..." : "Translate Pulse"}
                            </button>

                            {!activeTree && <p className="text-[10px] text-center text-rose-400">You need an active Lifetree to perform translations.</p>}
                            {activeTree && (activeTree.aiTokenBalance || 0) < depth && <p className="text-[10px] text-center text-amber-400">Not enough AI tokens. Validate observations to earn more.</p>}
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
                        Only validated understanding becomes memory. When you validate this pulse, you contribute to community coherence and earn AI tokens.
                    </p>
                </div>
            </div>
        </div>
    );
};
