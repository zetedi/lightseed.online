
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { sendMessageToOracle, generateImage } from '../services/gemini';
import { checkAndIncrementAiUsage, mintPulse, uploadBase64Image, listenToUserProfile } from '../services/firebase';
import { useLifeseed } from '../hooks/useLifeseed';
import { Icons } from './ui/Icons';
import { Lifetree } from '../types';

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

export const OracleChat = ({ initialTree = null }: { initialTree?: Lifetree | null }) => {
    const { t } = useLanguage();
    const { lightseed, activeTree, myTrees } = useLifeseed();
    const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isMinting, setIsMinting] = useState(false);
    const [usage, setUsage] = useState(0);
    const [mode, setMode] = useState<'oracle' | 'tree'>(initialTree ? 'tree' : 'oracle');
    const [selectedTree, setSelectedTree] = useState<Lifetree | null>(initialTree);
    const bottomRef = useRef<HTMLDivElement>(null);
    const treeChoices = [initialTree, ...myTrees].filter((tree): tree is Lifetree => !!tree)
        .filter((tree, index, all) => all.findIndex(t => t.id === tree.id) === index);

    useEffect(() => {
        if (initialTree) {
            setSelectedTree(initialTree);
            setMode('tree');
        }
    }, [initialTree?.id]);

    useEffect(() => {
        if (mode === 'tree' && selectedTree) {
            setMessages([{role: 'model', text: `Mycelial communication ready. Messages here travel between your active tree and ${selectedTree.name}.`}]);
        } else {
            setMessages([{role: 'model', text: t('oracle_greeting')}]);
        }
    }, [mode, selectedTree?.id]);

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

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        if (mode === 'tree') {
            if (!lightseed || !activeTree || !selectedTree) {
                setMessages(prev => [...prev, {role: 'model', text: "Choose your active tree and a receiving tree before sending a mycelial message."}]);
                return;
            }

            const mycelialText = input.trim();
            setInput('');
            setMessages([{role: 'model', text: `Mycelial communication moving between ${activeTree.name} and ${selectedTree.name}.`}]);
            setIsTyping(true);

            try {
                await mintPulse({
                    lifetreeId: activeTree.id,
                    type: 'tree_chat',
                    title: `Mycelial message: ${activeTree.name} -> ${selectedTree.name}`,
                    body: mycelialText,
                    content: mycelialText,
                    chatTreeId: selectedTree.id,
                    chatTreeName: selectedTree.name,
                    authorId: lightseed.uid,
                    authorName: activeTree.name,
                    authorPhoto: activeTree.imageUrl || lightseed.photoURL || undefined,
                });
                setMessages([{
                    role: 'model',
                    text: `Mycelial communication sent between ${activeTree.name} and ${selectedTree.name}.`
                }]);
            } catch (error: any) {
                console.error("Mycelial message failed:", error);
                setMessages([{
                    role: 'model',
                    text: error.message || "The mycelial message could not be sent."
                }]);
            }
            setIsTyping(false);
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
                type: mode === 'tree' ? 'tree_chat' : 'STANDARD',
                title: mode === 'tree' && selectedTree ? `Tree Chat: ${selectedTree.name}` : 'Oracle Wisdom',
                body: conversationText,
                imageUrl: finalImageUrl,
                chatTreeId: mode === 'tree' ? selectedTree?.id : undefined,
                chatTreeName: mode === 'tree' ? selectedTree?.name : undefined,
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
        <div className="max-w-2xl mx-auto h-[70vh] flex flex-col bg-white rounded-3xl shadow-xl border border-emerald-100 overflow-hidden relative">
            <div className="border-b border-slate-100 bg-white/95 p-4 backdrop-blur-md">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-800">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span>{mode === 'tree' ? 'Mycelial Communication' : 'Osiris Wisdom'}{mode === 'oracle' ? `: ${usage}/21` : ''}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="rounded-full border border-slate-200 bg-slate-50 p-1">
                            <button
                                type="button"
                                onClick={() => setMode('oracle')}
                                className={`rounded-full px-3 py-1 text-[10px] font-bold transition-colors ${mode === 'oracle' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Oracle
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('tree')}
                                className={`rounded-full px-3 py-1 text-[10px] font-bold transition-colors ${mode === 'tree' ? 'bg-sky-600 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Tree
                            </button>
                        </div>

                        {mode === 'tree' && (
                            <select
                                value={selectedTree?.id || ''}
                                onChange={(e) => setSelectedTree(treeChoices.find(tree => tree.id === e.target.value) || null)}
                                className="h-8 max-w-[180px] rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="">Choose tree</option>
                                {treeChoices.map(tree => (
                                    <option key={tree.id} value={tree.id}>{tree.name}</option>
                                ))}
                            </select>
                        )}
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
                        {m.role === 'model' && <SunAvatar />}
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
                        <SunAvatar />
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
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex space-x-3 items-center">
                <input 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={mode === 'tree' && selectedTree ? `Send from ${activeTree?.name || 'your tree'} to ${selectedTree.name}...` : "Ask Osiris..."}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-6 py-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-white transition-all shadow-inner placeholder:text-slate-400 placeholder:italic"
                />
                <button type="submit" disabled={isTyping || !input.trim() || (mode === 'tree' && (!selectedTree || !activeTree))} className="bg-emerald-600 text-white p-4 rounded-full hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all shadow-lg">
                    <Icons.Send />
                </button>
            </form>
        </div>
    )
}
