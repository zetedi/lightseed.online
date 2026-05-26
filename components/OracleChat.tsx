
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { sendMessageToOracle, generateImage } from '../services/gemini';
import { checkAndIncrementAiUsage, mintPulse, uploadBase64Image, listenToUserProfile } from '../services/firebase';
import { useLifeseed } from '../hooks/useLifeseed';
import { Icons } from './ui/Icons';

export const OracleChat = () => {
    const { t } = useLanguage();
    const { lightseed, activeTree } = useLifeseed();
    const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isMinting, setIsMinting] = useState(false);
    const [usage, setUsage] = useState(0);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMessages([{role: 'model', text: t('oracle_greeting')}]);
    }, []);

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
            const responseText = await sendMessageToOracle(userMsg, history);
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
        if (messages.length <= 1) return; // Only greeting

        setIsMinting(true);
        try {
            // Format conversation
            const conversationText = messages.map(m => `${m.role === 'user' ? 'Seeker' : 'Oracle'}: ${m.text}`).join('\n\n');
            const summaryPrompt = conversationText.substring(0, 1000); // Limit context for generation

            // Check AI limit for image
            await checkAndIncrementAiUsage('image');

            // Generate Image
            const prompt = `Create an abstract, artistic image representing the essence of this conversation: ${summaryPrompt}. Do not contain any text, words, letters, or typography in the image.`;
            const imageUrl = await generateImage(prompt);
            let finalImageUrl = "";

            if (imageUrl && imageUrl.startsWith('data:')) {
                 finalImageUrl = await uploadBase64Image(imageUrl, `users/${lightseed.uid}/pulses/ai/${Date.now()}`);
            }

            await mintPulse({
                lifetreeId: activeTree.id,
                type: 'STANDARD',
                title: 'Oracle Wisdom',
                body: conversationText,
                imageUrl: finalImageUrl,
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
        <div className="max-w-2xl mx-auto h-[70vh] flex flex-col bg-white rounded-xl shadow-lg border border-indigo-100 overflow-hidden relative">
            {/* Header/Actions */}
            <div className="absolute top-4 left-4 z-10 bg-indigo-50 text-indigo-800 px-3 py-1 rounded-full text-[10px] font-bold border border-indigo-100 shadow-sm backdrop-blur-sm">
                Oracle Wisdom: {usage}/21
            </div>

            {messages.length > 1 && lightseed && (
                <div className="absolute top-4 right-4 z-10">
                    <button 
                        onClick={handleMint} 
                        disabled={isMinting}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-md transition-all active:scale-95 flex items-center gap-1 disabled:opacity-50"
                    >
                        {isMinting ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Minting...</span>
                            </>
                        ) : (
                            <>
                                <Icons.HeartPulse />
                                <span>Mint as Pulse</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 pt-20 scroll-smooth">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div dir="auto" className={`max-w-[85%] sm:max-w-[75%] rounded-3xl px-5 py-4 text-[15px] leading-relaxed tracking-wide ${
                            m.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-br-sm shadow-md' 
                                : 'bg-white border border-indigo-50 text-slate-800 rounded-bl-sm shadow-sm'
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
                    <div className="flex justify-start">
                        <div className="bg-white border border-indigo-50 rounded-3xl rounded-bl-sm px-5 py-4 shadow-sm">
                            <div className="flex space-x-1.5 items-center h-4">
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
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
                    placeholder={t('ask_oracle')}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-5 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white transition-all shadow-inner"
                />
                <button type="submit" disabled={isTyping || !input.trim()} className="bg-indigo-600 text-white p-3 rounded-full hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition-all shadow-md">
                    <Icons.Send />
                </button>
            </form>
        </div>
    )
}
