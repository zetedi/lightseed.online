import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { sendMessageToOracle, generateImage } from '../../services/gemini';
import { checkAndIncrementAiUsage, mintPulse, uploadBase64Image, listenToUserProfile, fetchReachThread, markReachesSeen, getLifetreeById } from '../../services/firebase';
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
    const { lightseed, activeTree, myTrees } = useLifeseed();
    const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isMinting, setIsMinting] = useState(false);
    const [usage, setUsage] = useState(0);
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
            });
            return () => unsub();
        }
    }, [lightseed]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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
                // Real person-to-person delivery: resolve the recipient tree's owner so the
                // reach lands in their inbox (and triggers their email if they opted in).
                let recipientUid: string | undefined = (selectedTree as any).ownerId;
                if (!recipientUid) {
                    const full = await getLifetreeById(selectedTree.id);
                    recipientUid = full?.ownerId;
                }

                await mintPulse({
                    lifetreeId: activeTree.id,
                    type: 'reach',
                    title: `Reach: ${activeTree.name} -> ${selectedTree.name}`,
                    body: mycelialText,
                    content: mycelialText,
                    reachTreeId: selectedTree.id,
                    reachTreeName: selectedTree.name,
                    recipientUid: recipientUid || null,
                    recipientName: selectedTree.name,
                    authorId: lightseed.uid,
                    authorName: activeTree.name,
                    authorPhoto: activeTree.imageUrl || lightseed.photoURL || undefined,
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
            const responsePromise = sendMessageToOracle(userMsg, history);
            const responseText = await withTimeout(responsePromise, 30000, "The reply took too long. Please try again.");
            setMessages(prev => [...prev, {role: 'model', text: responseText || "..."}]);
        } catch(e: any) {
            console.error("Oracle Error:", e);
            let msg = "The wind is too strong (Error connecting to AI).";
            
            if (e.message?.includes("403")) {
                msg = "Forbidden (403): The Oracle cannot hear you. Please ensure your API Key is valid.";
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
            alert("You need a planted Lifetree to mint this conversation.");
            return;
        }
        if (mode === 'tree' && !selectedTree) {
            alert("Choose a tree before minting this conversation.");
            return;
        }
        if (messages.length <= 1) return; // Only greeting

        setIsMinting(true);
        try {
            const modelName = mode === 'tree' && selectedTree ? selectedTree.name : 'Oracle';
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
                title: mode === 'tree' && selectedTree ? `Mycelial Reach: ${selectedTree.name}` : 'Oracle Wisdom',
                body: conversationText,
                imageUrl: finalImageUrl,
                reachTreeId: mode === 'tree' ? selectedTree?.id : undefined,
                reachTreeName: mode === 'tree' ? selectedTree?.name : undefined,
                authorId: lightseed.uid,
                authorName: lightseed.displayName || "Soul",
                authorPhoto: lightseed.photoURL,
            });
            alert("Conversation minted as a Pulse!");
        } catch (e: any) {
            console.error(e);
            alert("Minting failed: " + e.message);
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
                        <div className="truncate font-semibold text-slate-800">{mode === 'tree' && selectedTree ? selectedTree.name : 'Osiris · Oracle'}</div>
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>{mode === 'tree' ? 'Mycelial reach' : `Oracle · ${usage}/21`}</span>
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
                {messages.map((m, i) => (
                    <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {m.role === 'model' && incomingAvatar()}
                        <div dir="auto" className={`max-w-[85%] sm:max-w-[75%] rounded-[2rem] px-6 py-4 text-[15px] leading-relaxed tracking-wide ${
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
                    </div>
                ))}
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
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex space-x-3 items-center sticky bottom-0 z-10">
                <input 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={mode === 'tree' && selectedTree ? `Send from ${activeTree?.name || 'your tree'} to ${selectedTree.name}...` : "Ask Osiris..."}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-6 py-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-white transition-all shadow-inner placeholder:text-slate-400 placeholder:italic"
                />
                <button type="submit" disabled={isTyping || isSending || !input.trim() || (mode === 'tree' && (!selectedTree || !activeTree))} className="bg-emerald-600 text-white p-4 rounded-full hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all shadow-lg">
                    {isSending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Icons.Send />}
                </button>
            </form>
        </div>
    )
}
