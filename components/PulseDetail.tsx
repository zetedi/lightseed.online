import React, { useState } from 'react';
import { Pulse, Lifetree } from '../types';
import { Icons } from './ui/Icons';
import { translatePulse } from '../services/gemini';
import { spendAiTokens, db } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface PulseDetailProps {
    pulse: Pulse;
    activeTree?: Lifetree | null;
    onClose: () => void;
    backLabel?: string;
    canEdit?: boolean;
    onEdit?: () => void;
}

export const PulseDetail = ({ pulse, activeTree, onClose, backLabel = "Back", canEdit, onEdit }: PulseDetailProps) => {
    const [depth, setDepth] = useState<number>(3);
    const [isTranslating, setIsTranslating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const images = pulse.imageUrls?.length ? pulse.imageUrls : (pulse.imageUrl ? [pulse.imageUrl] : []);

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
        <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300 pb-20 bg-slate-50">
             {/* Header */}
             <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4 flex items-center justify-between">
                <button onClick={onClose} className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-medium">
                    <Icons.ArrowLeft />
                    <span>{backLabel}</span>
                </button>
                <div className="flex items-center gap-2">
                    {pulse.type === 'event' && canEdit && onEdit && (
                        <button onClick={onEdit} className="flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-sky-700">
                            <Icons.Pencil /> Edit
                        </button>
                    )}
                    {pulse.care === 'watering' && (
                        <span className="bg-sky-100 text-sky-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            💧 {pulse.wateringConfirmedBy === 'ai' ? 'Confirmed by AI' : pulse.wateringConfirmedBy === 'guardian' ? 'Confirmed by guardian' : 'Awaiting confirmation'}
                        </span>
                    )}
                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <Icons.Hash /> {pulse.type}
                    </span>
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* Left Column: Visuals & Raw Pulse */}
                 <div className="space-y-6">
                    {images.length > 0 && (
                        <div className="relative h-96 w-full rounded-2xl overflow-hidden shadow-2xl bg-white border border-slate-100 group">
                            <img src={images[activeImageIndex]} alt={pulse.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            {images.length > 1 && (
                                <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto rounded-2xl bg-black/30 p-2 backdrop-blur-md">
                                    {images.map((url, index) => (
                                        <button
                                            key={url}
                                            onClick={() => setActiveImageIndex(index)}
                                            className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 ${activeImageIndex === index ? 'border-white' : 'border-white/30'}`}
                                        >
                                            <img src={url} className="h-full w-full object-cover" alt="" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Metadata Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h1 dir="auto" className="text-2xl font-bold text-slate-800 mb-2">{pulse.title}</h1>
                        <div className="flex items-center space-x-2 text-sm text-slate-500 mb-4">
                             <span>By {pulse.authorName}</span>
                             <span>•</span>
                             <span>{new Date(pulse.createdAt?.toMillis()).toLocaleDateString()}</span>
                        </div>
                        {pulse.type === 'event' && (
                            <div className="mb-4 grid gap-2 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
                                {pulse.eventDate && <div><span className="font-bold">When:</span> {new Date(pulse.eventDate).toLocaleString()}</div>}
                                {pulse.eventLocation && <div><span className="font-bold">Where:</span> {pulse.eventLocation}</div>}
                            </div>
                        )}
                        {pulse.care === 'watering' && (
                            <div className="mb-4 grid gap-1.5 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
                                <div className="flex items-center gap-2 font-bold"><Icons.Droplet size={16} /> <span>Watering</span></div>
                                {/* The AI's reading — a witness, not the authority. */}
                                {typeof pulse.wateringConfirmation?.confidence === 'number' && (
                                    <div className="text-xs text-sky-800/90">
                                        <span className="font-semibold">AI reading:</span> {pulse.wateringConfirmation.confidence}% consistent with watering
                                        {pulse.wateringConfirmation?.note && <span className="italic"> — “{pulse.wateringConfirmation.note}”</span>}
                                    </div>
                                )}
                                {/* The human reading — who says "yes, this was tended". */}
                                <div className="text-xs text-sky-800/90">
                                    <span className="font-semibold">Tended:</span>{' '}
                                    {pulse.wateringConfirmedBy === 'guardian'
                                        ? 'confirmed by a guardian'
                                        : pulse.wateringConfirmedBy === 'ai'
                                            ? 'auto-accepted on the AI reading — a guardian can still confirm'
                                            : 'awaiting a guardian’s confirmation'}
                                </div>
                            </div>
                        )}
                        <p dir="auto" className="text-slate-600 leading-relaxed whitespace-pre-wrap font-serif text-lg">
                            {pulse.content || pulse.body}
                        </p>
                    </div>
                 </div>

                 {/* Right Column: AI Translation & Network Coherence */}
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
            </div>
        </div>
    );
}
