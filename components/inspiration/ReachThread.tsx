import React, { useState, useEffect, useRef } from 'react';
import { showAlert } from "../ui/Dialog";
import { useLanguage } from '../../contexts/LanguageContext';
import { sendMessageToOracle, generateImage, translatePulse, type TranslationResponse } from '../../services/gemini';
import { getIntelligence } from '../../services/intelligence';
import { checkAndIncrementAiUsage, mintPulse, uploadBase64Image, listenToUserProfile, fetchReachThread, markReachesSeen, sendReach } from '../../services/firebase';
import { useLifeseed } from '../../hooks/useLifeseed';
import { Icons } from '../ui/Icons';
import { Lifetree } from '../../types';

const SunAvatar = () => (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-50 text-amber-500 shadow-inner">
        <div className="pointer-events-none absolute -inset-1 rounded-full bg-amber-300/20 blur-sm"></div>
        <span className="relative z-10"><Icons.Sun /></span>
    </div>
);

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> =>
    new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
        promise
            .then((value) => {
                window.clearTimeout(timer);
                resolve(value);
            })
            .catch((error) => {
                window.clearTimeout(timer);
                reject(error);
            });
    });

export const ReachThread = ({ targetTree = null, onBack }: { targetTree?: Lifetree | null, onBack?: () => void }) => {
    const { t } = useLanguage();
    const { lightseed, activeTree, myTrees, isAdmin, isSuperAdmin } = useLifeseed();
    const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isMinting, setIsMinting] = useState(false);
    const [usage, setUsage] = useState(0);
    const [preferredIntelligenceId, setPreferredIntelligenceId] = useState<string | undefined>(undefined);
    // The name of the enabled, active intelligence — shown throughout the DM in place of "Osiris".
    const [aiName, setAiName] = useState('Osiris');
    // Per-message AI interpretations — the "shadow text" beneath an incoming tree's words.
    const [interpretations, setInterpretations] = useState<Record<number, TranslationResponse | 'loading'>>({});
    const [mode, setMode] = useState<'oracle' | 'tree'>(targetTree ? 'tree' : 'oracle');
    const [selectedTree, setSelectedTree] = useState<Lifetree | null>(targetTree);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (targetTree) {
            setSelectedTree(targetTree);
            setMode('tree');
        } else {
            setMode('oracle');
        }
    }, [targetTree?.id]);

    // Load the persistent reach thread (full back-and-forth) when a tree is selected.
    useEffect(() => {
        let cancelled = false;
        const greeting = (name: string) => `Mycelial communication ready. Reaches here travel between your active tree and ${name}.`;

        if (mode === 'tree' && selectedTree) {
            const partner = selectedTree;
            const myIds = new Set<string>(myTrees.map((tree: Lifetree) => tree.id));
            setMessages([]);
            setInterpretations({});
            setIsTyping(true);
            fetchReachThread(partner.id)
                .then(pulses => {
                    if (cancelled) return;
                    const history: {role: 'user' | 'model', text: string}[] = [];
                    pulses.forEach(p => {
                        const text = p.content || p.body || '';
                        // I sent it if I authored it (reliable even before myTrees loads).
                        const outgoing = (!!lightseed && p.authorId === lightseed.uid) || myIds.has(p.lifetreeId || '');
                        if (outgoing) {
                            if (text) history.push({ role: 'user', text });
                            if (p.reachResponse) history.push({ role: 'model', text: p.reachResponse });
                        } else {
                            if (text) history.push({ role: 'model', text });
                            if (p.reachResponse) history.push({ role: 'user', text: p.reachResponse });
                        }
                    });
                    if (history.length === 0) history.push({ role: 'model', text: greeting(partner.name) });
                    setMessages(history);

                    // Mark incoming reaches addressed to me as seen (clears the red envelope).
                    if (lightseed) {
                        const unseen = pulses
                            .filter(p => p.recipientUid === lightseed.uid && !(p.seenBy || []).includes(lightseed.uid))
                            .map(p => p.id);
                        if (unseen.length) markReachesSeen(unseen, lightseed.uid);
                    }
                })
                .catch(err => {
                    if (cancelled) return;
                    console.error('Failed to load reach thread:', err);
                    setMessages([{ role: 'model', text: greeting(partner.name) }]);
                })
                .finally(() => { if (!cancelled) setIsTyping(false); });
        } else {
            setMessages([{ role: 'model', text: t('oracle_greeting') }]);
        }

        return () => { cancelled = true; };
    }, [mode, selectedTree?.id, lightseed?.uid]);

    useEffect(() => {
        if (mode === 'tree' && !selectedTree && activeTree) {
            setSelectedTree(activeTree);
        }
    }, [mode, selectedTree?.id, activeTree?.id]);

    useEffect(() => {
        if (lightseed) {
            const unsub = listenToUserProfile(lightseed.uid, (data) => {
                setUsage(data?.dailyAiText || 0);
                setPreferredIntelligenceId(data?.preferredIntelligenceId || undefined);
            });
            return () => unsub();
        }
    }, [lightseed]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Resolve the active intelligence's display name (falls back to Osiris).
    useEffect(() => {
        let cancelled = false;
        if (preferredIntelligenceId) {
            getIntelligence(preferredIntelligenceId)
                .then(i => { if (!cancelled) setAiName(i && i.enabled !== false && i.name ? i.name : 'Osiris'); })
                .catch(() => {});
        } else {
            setAiName('Osiris');
        }
        return () => { cancelled = true; };
    }, [preferredIntelligenceId]);

    // Reveal what an incoming tree's message means — interpreted through the reader's
    // chosen intelligence against both trees' visions, shown as greyed shadow text.
    const revealInterpretation = async (index: number, text: string) => {
        if (!selectedTree || !activeTree || interpretations[index]) return;
        setInterpretations(prev => ({ ...prev, [index]: 'loading' }));
        try {
            const context = [selectedTree.shortTitle, selectedTree.body, activeTree.body]
                .filter(Boolean).join(' — ');
            const result = await translatePulse({
                senderTreeName: selectedTree.name,
                receiverTreeName: activeTree.name,
                message: text,
                depth: 4, // contextualize within their vision / direction of growth
                context,
            }, preferredIntelligenceId);
            setInterpretations(prev => ({ ...prev, [index]: result }));
        } catch {
            setInterpretations(prev => {
                const next = { ...prev };
                delete next[index];
                return next;
            });
        }
    };

    // Incoming bubbles: the partner tree's face in a reach, the sun for the Oracle.
    const incomingAvatar = () => {
        if (mode === 'tree' && selectedTree) {
            return selectedTree.imageUrl
                ? <img src={selectedTree.imageUrl} alt={selectedTree.name} className="h-10 w-10 shrink-0 rounded-full border-2 border-emerald-100 object-cover" />
                : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-emerald-100 bg-emerald-50 font-bold uppercase text-emerald-600">{selectedTree.name?.trim()?.charAt(0) || <Icons.Tree />}</div>;
        }
        return <SunAvatar />;
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        if (mode === 'tree') {
            if (!lightseed || !activeTree || !selectedTree) {
                setMessages(prev => [...prev, {role: 'model', text: "Choose your active tree and a receiving tree before sending a mycelial reach."}]);
                return;
            }

            const mycelialText = input.trim();
            setInput('');
            setMessages(prev => [...prev, {role: 'user', text: mycelialText}]);
            setIsSending(true);

            try {
                // Person-to-person delivery. sendReach resolves the recipient tree's owner,
                // enforces the validation-gated contact rule, and stamps threadId + seenBy.
                await sendReach({
                    fromTree: activeTree,
                    toTree: selectedTree,
                    text: mycelialText,
                    sender: lightseed,
                    isAdmin,
                    isSuperAdmin,
                });
            } catch (error: any) {
                console.error("Reach failed:", error);
                setMessages(prev => [...prev, {
                    role: 'model',
                    text: error.message || "The reach could not be sent."
                }]);
            }
            setIsSending(false);
            return;
        }
        
        // Check daily limit before proceeding
        try {
            const allowed = await checkAndIncrementAiUsage('text');
            if (!allowed) {
                setMessages(prev => [...prev, {role: 'user', text: input}, {role: 'model', text: t('ai_login_required')}]);
                setInput('');
                return;
            }
        } catch (error: any) {
            setMessages(prev => [...prev, {role: 'user', text: input}, {role: 'model', text: error.message || t('daily_limit_text')}]);
            setInput('');
            return;
        }

        const userMsg = input;
        const history = [...messages];
        setInput('');
        setMessages(prev => [...prev, {role: 'user', text: userMsg}]);
        setIsTyping(true);

        try {
            const responsePromise = sendMessageToOracle(userMsg, history, preferredIntelligenceId);
            const responseText = await withTimeout(responsePromise, 30000, "The reply took too long. Please try again.");
            setMessages(prev => [...prev, {role: 'model', text: responseText || "..."}]);
        } catch(e: any) {
            console.error("Oracle Error:", e);
            let msg = "The wind is too strong (Error connecting to AI).";
            
            if (e.message?.includes("403")) {
                msg = `Forbidden (403): ${aiName} cannot hear you. Please ensure your API Key is valid.`;
            } else if (e.message?.includes("429") || e.code === 'resource-exhausted') {
                msg = "The spirits are overwhelmed (Rate Limit). Please wait a moment.";
            } else if (e.message) {
                msg = `Error: ${e.message}`;
            }
            
            setMessages(prev => [...prev, {role: 'model', text: msg}]);
        }
        setIsTyping(false);
    }

    const handleMint = async () => {
        if (!lightseed || !activeTree) {
            showAlert("You need a planted Lifetree to mint this conversation.");
            return;
        }
        if (mode === 'tree' && !selectedTree) {
            showAlert("Choose a tree before minting this conversation.");
            return;
        }
        if (messages.length <= 1) return; // Only greeting

        setIsMinting(true);
        try {
            const modelName = mode === 'tree' && selectedTree ? selectedTree.name : aiName;
            const conversationText = messages.map(m => `${m.role === 'user' ? 'Seeker' : modelName}: ${m.text}`).join('\n\n');
            const summaryPrompt = conversationText.substring(0, 1000); // Limit context for generation

            // Check AI limit for image
            await checkAndIncrementAiUsage('image');

            // Generate Image
            const prompt = `Create an abstract, artistic image representing the essence of this conversation: ${summaryPrompt}. Do not contain any text, words, letters, or typography in the image.`;
            const imageUrl = await withTimeout(
                generateImage(prompt),
                45000,
                "The pulse image took too long to generate. Please try minting again."
            );
            let finalImageUrl = "";

            if (imageUrl && imageUrl.startsWith('data:')) {
                 finalImageUrl = await uploadBase64Image(imageUrl, `users/${lightseed.uid}/pulses/ai/${Date.now()}`);
            }

            await mintPulse({
                lifetreeId: activeTree.id,
                type: mode === 'tree' ? 'reach' : 'STANDARD',
                title: mode === 'tree' && selectedTree ? `Mycelial Reach: ${selectedTree.name}` : `${aiName} Wisdom`,
                body: conversationText,
                imageUrl: finalImageUrl,
                reachTreeId: mode === 'tree' ? selectedTree?.id : undefined,
                reachTreeName: mode === 'tree' ? selectedTree?.name : undefined,
                authorId: lightseed.uid,
                authorName: lightseed.displayName || "Soul",
                authorPhoto: lightseed.photoURL,
            });
            showAlert("Conversation minted as a Pulse!");
        } catch (e: any) {
            console.error(e);
            showAlert("Minting failed: " + e.message);
        }
        setIsMinting(false);
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-white relative">
            <div className="border-b border-slate-100 bg-white/95 p-4 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button onClick={onBack} className="text-slate-400 transition-colors hover:text-slate-600 md:hidden">
                            <Icons.ChevronRight className="rotate-180" size={22} />
                        </button>
                    )}
                    {mode === 'tree' && selectedTree ? (
                        selectedTree.imageUrl ? (
                            <img src={selectedTree.imageUrl} alt={selectedTree.name} className="h-10 w-10 shrink-0 rounded-full border-2 border-emerald-100 object-cover" />
                        ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-emerald-100 bg-emerald-50 font-bold uppercase text-emerald-600">
                                {selectedTree.name?.trim()?.charAt(0) || <Icons.Tree />}
                            </div>
                        )
                    ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-50 text-amber-500">
                            <Icons.Sun />
                        </div>
                    )}
                    <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-800">{mode === 'tree' && selectedTree ? selectedTree.name : aiName}</div>
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>{mode === 'tree' ? 'Mycelial reach' : `${aiName} · ${usage}/21`}</span>
                        </div>
                    </div>
                </div>

                {messages.length > 1 && lightseed && mode === 'oracle' && (
                  <div className="mt-3 flex justify-end">
                    <button 
                        onClick={handleMint} 
                        disabled={isMinting}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] px-4 py-1.5 rounded-full font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                    >
                        {isMinting ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Minting...</span>
                            </>
                        ) : (
                            <>
                                <Icons.HeartPulse />
                                <span>Mint Wisdom</span>
                            </>
                        )}
                    </button>
                  </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/50 scroll-smooth">
                {messages.map((m, i) => {
                    const canInterpret = mode === 'tree' && m.role === 'model' && !!selectedTree && !!activeTree;
                    const interp = interpretations[i];
                    return (
                    <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {m.role === 'model' && incomingAvatar()}
                        <div className={`flex max-w-[85%] flex-col gap-1.5 sm:max-w-[75%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div dir="auto" className={`w-fit rounded-[2rem] px-6 py-4 text-[15px] leading-relaxed tracking-wide ${
                                m.role === 'user'
                                    ? 'bg-emerald-600 text-white rounded-br-none shadow-lg'
                                    : 'bg-white border border-emerald-50 text-slate-800 rounded-bl-none shadow-sm font-medium italic'
                            }`}>
                                {m.text.split('\n').map((line, j) => (
                                    <span key={j}>
                                        {line}
                                        {j < m.text.split('\n').length - 1 && <><br /><br /></>}
                                    </span>
                                ))}
                            </div>

                            {/* Shadow text — what the message means, read through your intelligence. */}
                            {canInterpret && (
                                interp === 'loading' ? (
                                    <div className="flex items-center gap-1.5 px-3 text-[12px] italic text-slate-400">
                                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-transparent"></div>
                                        reading between the lines…
                                    </div>
                                ) : interp ? (
                                    <div dir="auto" className="px-3 text-[12.5px] italic leading-relaxed text-slate-400">
                                        <span className="font-semibold text-slate-400/90">✦ </span>{interp.interpretation}
                                        {interp.growthSuggestion && (
                                            <span className="mt-1 block text-slate-400/80">↳ {interp.growthSuggestion}</span>
                                        )}
                                    </div>
                                ) : (
                                    <button onClick={() => revealInterpretation(i, m.text)} className="inline-flex items-center gap-1 self-start px-3 text-[11px] font-medium text-slate-400 transition-colors hover:text-emerald-600">
                                        <span aria-hidden>✦</span> reveal meaning
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                    );
                })}
                {isTyping && (
                    <div className="flex justify-start gap-4">
                        {incomingAvatar()}
                        <div className="bg-white border border-emerald-50 rounded-[2rem] rounded-bl-none px-6 py-4 shadow-sm">
                            <div className="flex space-x-1.5 items-center h-4">
                                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={bottomRef}></div>
            </div>
            {mode === 'tree' && (
                <p className="px-5 pt-2 text-center text-[11px] italic leading-snug text-slate-400">
                    Kept on the immutable chain — remembered here. For everyday talk, meet outside; bring here only what is meant to stay. Even a dot, or a held silence, can be chosen to be remembered.
                </p>
            )}
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex space-x-3 items-center sticky bottom-0 z-10">
                <input 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={mode === 'tree' && selectedTree ? `Send from ${activeTree?.name || 'your tree'} to ${selectedTree.name}...` : `Ask ${aiName}...`}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-6 py-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-white transition-all shadow-inner placeholder:text-slate-400 placeholder:italic"
                />
                <button type="submit" disabled={isTyping || isSending || !input.trim() || (mode === 'tree' && (!selectedTree || !activeTree))} className="bg-emerald-600 text-white p-4 rounded-full hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all shadow-lg">
                    {isSending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Icons.Send />}
                </button>
            </form>
        </div>
    )
}
