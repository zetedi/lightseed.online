import React, { useState, useEffect, useRef } from 'react';
import { showAlert, showConfirm } from "../ui/Dialog";
import { useLanguage } from '../../contexts/LanguageContext';
import { sendMessageToOracle, generateImage, translatePulse, type TranslationResponse } from '../../services/gemini';
import { getIntelligence } from '../../services/intelligence';
import { checkAndIncrementAiUsage, mintPulse, uploadBase64Image, listenToUserProfile, fetchReachThread, fetchThreadById, markReachesSeen, sendReach, sendThreadMessage } from '../../services/firebase';
import { reachAudienceLabels } from '../../utils/reachPermissions';
import { useLifeseed } from '../../hooks/useLifeseed';
import { Icons } from '../ui/Icons';
import { Lifetree, Pulse, ReachAudience } from '../../types';

// A group thread chosen from the inbox — carries enough to open it and reply within it.
export interface GroupThreadDescriptor {
    threadId: string;
    partnerId: string;          // the subject tree the circle is about
    partnerName: string;        // display name, e.g. "Oak · Guardians"
    partnerPhoto?: string;
    audience?: ReachAudience;
    participantCount?: number;
}

// One rendered line of a conversation. `authorId`/`authorName` let group threads show who
// spoke; 1:1 and Oracle threads leave them unset and render as a plain two-party chat.
interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    authorId?: string;
    authorName?: string;
    authorPersonName?: string;
    authorPhoto?: string;
    system?: boolean; // a centered notice (e.g. "X minted this conversation to the chain"), not a bubble
}

// The audience options offered when starting a reach to a tree. `undefined` is the classic
// 1:1 message to the owner; the others fan out to a shared group thread with the circle.
const AUDIENCE_OPTIONS: { value: ReachAudience | undefined; label: string }[] = [
    { value: undefined, label: 'Owner' },
    { value: 'guardians', label: 'Guardians' },
    { value: 'everyone', label: 'Everyone' },
];

const SunAvatar = () => (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-50 text-amber-500 shadow-inner">
        <div className="pointer-events-none absolute -inset-1 rounded-full bg-amber-300/20 blur-sm"></div>
        <span className="relative z-10"><Icons.Sun /></span>
    </div>
);

const InitialAvatar = ({ name, photo }: { name?: string, photo?: string }) => (
    photo
        ? <img src={photo} alt={name || ''} className="h-10 w-10 shrink-0 rounded-full border-2 border-emerald-100 object-cover" />
        : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-emerald-100 bg-emerald-50 font-bold uppercase text-emerald-600">{name?.trim()?.charAt(0) || <Icons.Tree />}</div>
);

const GroupAvatar = () => (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-emerald-100 bg-emerald-50 text-emerald-600">
        <Icons.Users />
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

export const ReachThread = ({ targetTree = null, groupThread = null, initialAudience, onBack }: { targetTree?: Lifetree | null, groupThread?: GroupThreadDescriptor | null, initialAudience?: ReachAudience, onBack?: () => void }) => {
    const { t } = useLanguage();
    const { lightseed, activeTree, myTrees, isAdmin, isSuperAdmin } = useLifeseed();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isMinting, setIsMinting] = useState(false);
    const [usage, setUsage] = useState(0);
    const [preferredIntelligenceId, setPreferredIntelligenceId] = useState<string | undefined>(undefined);
    // The name of the enabled, active intelligence — shown throughout the DM in place of "Osiris".
    const [aiName, setAiName] = useState('Osiris');
    // Per-message AI interpretations — the "shadow text" beneath an incoming tree's words.
    const [interpretations, setInterpretations] = useState<Record<number, TranslationResponse | 'loading' | { error: string }>>({});
    const [mode, setMode] = useState<'oracle' | 'tree'>(targetTree || groupThread ? 'tree' : 'oracle');
    const [selectedTree, setSelectedTree] = useState<Lifetree | null>(targetTree);
    // Who the next message goes to when composing to a tree: undefined = owner (1:1), else a
    // group audience. A group thread opened from the inbox fixes the audience and can't change it.
    const [audience, setAudience] = useState<ReachAudience | undefined>(groupThread?.audience ?? initialAudience);
    // Metadata for the thread currently loaded — lets a group reply reuse the same threadId
    // + participantUids so everyone stays in one conversation.
    const [threadMeta, setThreadMeta] = useState<{ threadId: string; participantUids: string[]; reachTreeId?: string; reachTreeName?: string; threadName?: string; audience?: ReachAudience } | null>(null);
    // The human behind the partner tree in a 1:1 thread — shown under the tree name. Derived
    // from the partner's own messages (their reaches carry authorPersonName).
    const [partnerPersonName, setPartnerPersonName] = useState<string | undefined>(undefined);
    const bottomRef = useRef<HTMLDivElement>(null);

    const isGroup = !!groupThread || (mode === 'tree' && audience !== undefined);
    const aiMode = mode === 'oracle';

    useEffect(() => {
        if (groupThread) {
            setMode('tree');
            setSelectedTree(null);
            setAudience(groupThread.audience);
        } else if (targetTree) {
            setSelectedTree(targetTree);
            setMode('tree');
            setAudience(initialAudience); // e.g. 'guardians' when opened from a danger alert
        } else {
            setMode('oracle');
        }
    }, [targetTree?.id, groupThread?.threadId, initialAudience]);

    // Translate raw reach pulses into the rendered conversation. In a group thread every
    // message is attributed; in a 1:1 the partner's words are "model", mine are "user".
    const buildHistory = (pulses: Pulse[], group: boolean): ChatMessage[] => {
        const myUid = lightseed?.uid;
        const myIds = new Set<string>(myTrees.map((tree: Lifetree) => tree.id));
        const history: ChatMessage[] = [];
        pulses.forEach(p => {
            const text = p.content || p.body || '';
            // A mint notice is a system line both sides see, not a chat bubble.
            if (p.mintNotice) { if (text) history.push({ role: 'model', system: true, text }); return; }
            const mine = (!!myUid && p.authorId === myUid) || myIds.has(p.lifetreeId || '');
            const base = group ? { authorId: p.authorId, authorName: p.authorName, authorPersonName: p.authorPersonName, authorPhoto: p.authorPhoto } : {};
            if (mine) {
                if (text) history.push({ role: 'user', text, ...base });
                if (p.reachResponse) history.push({ role: 'model', text: p.reachResponse });
            } else {
                if (text) history.push({ role: 'model', text, ...base });
                if (p.reachResponse) history.push({ role: 'user', text: p.reachResponse });
            }
        });
        return history;
    };

    const markThreadSeen = (pulses: Pulse[]) => {
        if (!lightseed) return;
        const uid = lightseed.uid;
        const unseen = pulses
            .filter(p => p.authorId !== uid
                && (p.recipientUid === uid || (p.participantUids || []).includes(uid))
                && !(p.seenBy || []).includes(uid))
            .map(p => p.id);
        if (unseen.length) markReachesSeen(unseen, uid);
    };

    // Load the persistent thread (full back-and-forth) when a tree/group/audience is selected.
    useEffect(() => {
        let cancelled = false;
        setPartnerPersonName(undefined);

        if (mode !== 'tree') {
            setMessages([{ role: 'model', text: t('oracle_greeting') }]);
            setThreadMeta(null);
            return;
        }

        // This view runs its own useLifeseed, which resolves auth (then trees) a tick after mount.
        // Wait for the uid so the thread loads ONCE — not first empty (no uid), then again when the
        // uid lands, then again when trees settle (the old double/triple load on opening a thread).
        if (!lightseed?.uid) { setIsTyping(true); return; }

        // A group thread opened from the inbox.
        if (groupThread) {
            const greeting = `This is a group reach — everyone in ${groupThread.partnerName} sees these messages.`;
            setMessages([]);
            setInterpretations({});
            setIsTyping(true);
            fetchThreadById(groupThread.threadId)
                .then(pulses => {
                    if (cancelled) return;
                    const latest = pulses[pulses.length - 1];
                    setThreadMeta({
                        threadId: groupThread.threadId,
                        participantUids: latest?.participantUids || [],
                        reachTreeId: latest?.reachTreeId || groupThread.partnerId,
                        reachTreeName: latest?.reachTreeName,
                        threadName: latest?.threadName || groupThread.partnerName,
                        audience: latest?.audience || groupThread.audience,
                    });
                    const history = buildHistory(pulses, true);
                    setMessages(history.length ? history : [{ role: 'model', text: greeting }]);
                    markThreadSeen(pulses);
                })
                .catch(err => { if (!cancelled) { console.error('Failed to load group thread:', err); setMessages([{ role: 'model', text: greeting }]); } })
                .finally(() => { if (!cancelled) setIsTyping(false); });
            return () => { cancelled = true; };
        }

        // Starting / continuing a reach to a tree — 1:1 (owner) or a group audience.
        if (selectedTree) {
            const partner = selectedTree;
            const myTreeIds = myTrees.map((tree: Lifetree) => tree.id);
            const greeting = audience
                ? `Mycelial group reach: everyone in ${partner.name}'s ${reachAudienceLabels[audience].toLowerCase()} circle will see this.`
                : `Mycelial communication ready. Reaches here travel between your active tree and ${partner.name}.`;
            setMessages([]);
            setInterpretations({});
            setIsTyping(true);

            const load = audience && lightseed
                // Group: a deterministic per-initiator thread; sendReach lands every message here.
                ? fetchThreadById(['grp', partner.id, audience, lightseed.uid].join('__'))
                // 1:1: my conversation with the tree's owner.
                : fetchReachThread(partner.id, { uid: lightseed?.uid, treeIds: myTreeIds });

            load
                .then(pulses => {
                    if (cancelled) return;
                    if (audience) {
                        const latest = pulses[pulses.length - 1];
                        setThreadMeta({
                            threadId: ['grp', partner.id, audience, lightseed!.uid].join('__'),
                            participantUids: latest?.participantUids || [],
                            reachTreeId: partner.id,
                            reachTreeName: partner.name,
                            threadName: `${partner.name} · ${reachAudienceLabels[audience]}`,
                            audience,
                        });
                    } else {
                        setThreadMeta(null);
                        // The human behind this tree, from their own messages (if any yet).
                        const fromPartner = pulses.find(p => p.authorId !== lightseed?.uid && p.authorPersonName);
                        if (fromPartner?.authorPersonName) setPartnerPersonName(fromPartner.authorPersonName);
                    }
                    const history = buildHistory(pulses, !!audience);
                    setMessages(history.length ? history : [{ role: 'model', text: greeting }]);
                    markThreadSeen(pulses);
                })
                .catch(err => { if (!cancelled) { console.error('Failed to load reach thread:', err); setMessages([{ role: 'model', text: greeting }]); } })
                .finally(() => { if (!cancelled) setIsTyping(false); });
        }

        return () => { cancelled = true; };
        // Reload when the partner / group / audience changes, or once auth resolves.
    }, [mode, selectedTree?.id, groupThread?.threadId, audience, lightseed?.uid]);

    useEffect(() => {
        if (mode === 'tree' && !selectedTree && !groupThread && activeTree) {
            setSelectedTree(activeTree);
        }
    }, [mode, selectedTree?.id, activeTree?.id, groupThread?.threadId]);

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
        if (!selectedTree || !activeTree) return;
        const current = interpretations[index];
        if (current === 'loading' || (current && !('error' in current))) return; // already loading or done
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
        } catch (e: any) {
            setInterpretations(prev => ({ ...prev, [index]: { error: e?.message || 'The interpreter could not be reached.' } }));
        }
    };

    // Incoming bubbles: the partner tree's face in a 1:1, a group glyph in a circle, the sun
    // for the Oracle. In a group, each message can carry its own author's face.
    const incomingAvatar = (msg?: ChatMessage) => {
        if (mode === 'tree') {
            if (isGroup) return msg && (msg.authorPhoto || msg.authorName)
                ? <InitialAvatar name={msg.authorName} photo={msg.authorPhoto} />
                : <GroupAvatar />;
            if (selectedTree) return <InitialAvatar name={selectedTree.name} photo={selectedTree.latestGrowthUrl || selectedTree.imageUrl} />;
        }
        return <SunAvatar />;
    };

    const headerName = groupThread ? groupThread.partnerName
        : (mode === 'tree' && selectedTree
            ? (audience ? `${selectedTree.name} · ${reachAudienceLabels[audience]}` : selectedTree.name)
            : aiName);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        if (mode === 'tree') {
            if (!lightseed || !activeTree || (!selectedTree && !groupThread)) {
                setMessages(prev => [...prev, {role: 'model', text: "Choose your active tree and a receiving tree before sending a mycelial reach."}]);
                return;
            }

            const mycelialText = input.trim();
            setInput('');
            setMessages(prev => [...prev, { role: 'user', text: mycelialText, authorId: lightseed.uid, authorName: activeTree.name, authorPhoto: activeTree.imageUrl }]);
            setIsSending(true);

            try {
                if (groupThread && threadMeta) {
                    // Reply inside an existing group thread — reuse its threadId + participants.
                    await sendThreadMessage({
                        thread: { ...threadMeta, isGroup: true },
                        fromTree: activeTree,
                        sender: lightseed,
                        text: mycelialText,
                    });
                } else if (selectedTree) {
                    // Start/continue a reach to a tree. With an audience this fans out to the
                    // circle's shared thread; without one it's a classic 1:1 to the owner.
                    await sendReach({
                        fromTree: activeTree,
                        toTree: selectedTree,
                        text: mycelialText,
                        sender: lightseed,
                        audience,
                        isAdmin,
                        isSuperAdmin,
                    });
                }
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
        if (mode === 'tree' && !selectedTree && !groupThread) {
            showAlert("Open a conversation before minting it.");
            return;
        }
        if (messages.filter(m => !m.system).length <= 1) return; // nothing but the greeting

        const partnerLabel = groupThread?.partnerName || selectedTree?.name || 'this conversation';

        // Tree DM: seal the conversation onto the minter's tree as a PUBLIC record on the
        // immutable chain (a contract on the LIN), then post a notice into the thread so the
        // other party sees who minted it and where.
        if (mode === 'tree') {
            const ok = await showConfirm(
                `Mint this conversation to “${activeTree.name}”? It will be sealed on the immutable chain — a public record on your tree, like a contract — and everyone here will be told you minted it.`,
                { title: 'Mint to the chain', confirmText: 'Mint' },
            );
            if (!ok) return;
            setIsMinting(true);
            try {
                const meName = lightseed.displayName || activeTree.name;
                const conversationText = messages
                    .filter(m => !m.system)
                    .map(m => `${m.role === 'user' ? meName : (m.authorPersonName || m.authorName || partnerLabel)}: ${m.text}`)
                    .join('\n\n');
                // The record on the tree — a STANDARD pulse shows in the tree's growth chain (and the LIN).
                await mintPulse({
                    lifetreeId: activeTree.id,
                    type: 'STANDARD',
                    title: `Minted conversation · ${partnerLabel}`,
                    body: conversationText,
                    reachTreeId: selectedTree?.id || groupThread?.partnerId,
                    reachTreeName: selectedTree?.name || groupThread?.partnerName,
                    authorId: lightseed.uid,
                    authorName: meName,
                    authorPhoto: lightseed.photoURL || activeTree.imageUrl,
                });
                // The notice in the thread (a system line both sides see).
                const noticeText = `${meName} minted this conversation to “${activeTree.name}” on the immutable chain.`;
                if (groupThread && threadMeta) {
                    await sendThreadMessage({ thread: { ...threadMeta, isGroup: true }, fromTree: activeTree, sender: lightseed, text: noticeText, mintNotice: true });
                } else if (selectedTree) {
                    await sendReach({ fromTree: activeTree, toTree: selectedTree, text: noticeText, sender: lightseed, audience, mintNotice: true, isAdmin, isSuperAdmin });
                }
                setMessages(prev => [...prev, { role: 'model', system: true, text: noticeText }]);
                showAlert("Conversation minted to the chain.");
            } catch (e: any) {
                console.error(e);
                showAlert("Minting failed: " + (e?.message || ''));
            }
            setIsMinting(false);
            return;
        }

        // Oracle: "Mint Wisdom" — an abstract image + the conversation, on your active tree.
        setIsMinting(true);
        try {
            const conversationText = messages.map(m => `${m.role === 'user' ? 'Seeker' : aiName}: ${m.text}`).join('\n\n');
            const summaryPrompt = conversationText.substring(0, 1000);
            await checkAndIncrementAiUsage('image');
            const prompt = `Create an abstract, artistic image representing the essence of this conversation: ${summaryPrompt}. Do not contain any text, words, letters, or typography in the image.`;
            const imageUrl = await withTimeout(generateImage(prompt), 45000, "The pulse image took too long to generate. Please try minting again.");
            let finalImageUrl = "";
            if (imageUrl && imageUrl.startsWith('data:')) {
                finalImageUrl = await uploadBase64Image(imageUrl, `users/${lightseed.uid}/pulses/ai/${Date.now()}`);
            }
            await mintPulse({
                lifetreeId: activeTree.id,
                type: 'STANDARD',
                title: `${aiName} Wisdom`,
                body: conversationText,
                imageUrl: finalImageUrl,
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
                    {mode === 'tree' ? (
                        isGroup ? <GroupAvatar /> : <InitialAvatar name={selectedTree?.name} photo={selectedTree?.latestGrowthUrl || selectedTree?.imageUrl} />
                    ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-50 text-amber-500">
                            <Icons.Sun />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-slate-800">
                            {headerName}
                            {!isGroup && partnerPersonName && partnerPersonName !== headerName && (
                                <span className="ml-1.5 text-xs font-normal text-slate-400">({partnerPersonName})</span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>{mode === 'tree' ? (isGroup ? `Group reach${threadMeta?.participantUids?.length ? ` · ${threadMeta.participantUids.length} in circle` : groupThread?.participantCount ? ` · ${groupThread.participantCount} in circle` : ''}` : 'Mycelial reach') : `${aiName} · ${usage}/21`}</span>
                        </div>
                    </div>

                    {/* Mint — seal the messages so far onto the immutable chain (a contract). Upper-right,
                        in line with the avatar + name; the tooltip explains what it does. */}
                    {messages.filter(m => !m.system).length > 1 && lightseed && (mode === 'oracle' || selectedTree || groupThread) && (
                        <button
                            onClick={handleMint}
                            disabled={isMinting}
                            title={mode === 'tree'
                                ? 'Mint the messages so far as a contract on the immutable Lightseed chain.'
                                : 'Mint this wisdom to your tree on the immutable Lightseed chain.'}
                            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white shadow-md transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                        >
                            {isMinting
                                ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                : <Icons.Stamp size={14} />}
                            <span className="hidden sm:inline">{mode === 'tree' ? 'Mint' : 'Mint Wisdom'}</span>
                        </button>
                    )}
                </div>

                {/* Audience picker — only when starting a fresh reach to a tree (not a fixed group thread). */}
                {mode === 'tree' && selectedTree && !groupThread && (
                    <div className="mt-3 flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Send to</span>
                        <div className="flex flex-wrap gap-1.5">
                            {AUDIENCE_OPTIONS.map(opt => {
                                const active = audience === opt.value;
                                return (
                                    <button
                                        key={opt.label}
                                        type="button"
                                        onClick={() => setAudience(opt.value)}
                                        className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${active ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 scroll-smooth">
                {messages.map((m, i) => {
                    // Mint notices (and any system line) render centered — not as a chat bubble.
                    if (m.system) {
                        return (
                            <div key={i} className="flex justify-center px-4">
                                <span dir="auto" className="rounded-full bg-amber-50 px-3 py-1 text-center text-[11px] font-medium leading-snug text-amber-700/90 ring-1 ring-amber-100">
                                    ⛓️ {m.text}
                                </span>
                            </div>
                        );
                    }
                    const canInterpret = mode === 'tree' && !isGroup && m.role === 'model' && !!selectedTree && !!activeTree;
                    const interp = interpretations[i];
                    // In a group, label an incoming bubble with who spoke (consecutive same-author merged).
                    const showAuthor = isGroup && m.role === 'model' && !!m.authorName && (i === 0 || messages[i - 1]?.authorId !== m.authorId || messages[i - 1]?.role !== 'model');
                    return (
                    <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {m.role === 'model' && incomingAvatar(m)}
                        <div className={`flex max-w-[90%] flex-col gap-1 sm:max-w-[80%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                            {showAuthor && (
                                <span className="px-2 text-[11px] font-bold text-emerald-700/80">
                                    {m.authorName}
                                    {m.authorPersonName && m.authorPersonName !== m.authorName && (
                                        <span className="font-normal text-slate-400"> ({m.authorPersonName})</span>
                                    )}
                                </span>
                            )}
                            <div dir="auto" className={`w-fit rounded-2xl px-4 py-2 text-[13.5px] leading-snug ${
                                m.role === 'user'
                                    ? 'bg-emerald-600 text-white rounded-br-sm shadow'
                                    : 'bg-white border border-emerald-50 text-slate-800 rounded-bl-sm shadow-sm font-medium italic'
                            }`}>
                                {m.text.split('\n').map((line, j) => (
                                    <span key={j}>
                                        {line}
                                        {j < m.text.split('\n').length - 1 && <br />}
                                    </span>
                                ))}
                            </div>

                            {/* Shadow text — what the message means, read through your intelligence. */}
                            {canInterpret && (() => {
                                if (interp === 'loading') return (
                                    <div className="flex items-center gap-1.5 px-3 text-[12px] italic text-slate-400">
                                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-transparent"></div>
                                        reading between the lines…
                                    </div>
                                );
                                if (interp && 'error' in interp) return (
                                    <div className="px-3 text-[11.5px] text-red-400">
                                        <span aria-hidden>✦</span> couldn’t read this — {interp.error}{' '}
                                        <button onClick={() => revealInterpretation(i, m.text)} className="font-bold underline hover:text-red-500">try again</button>
                                    </div>
                                );
                                if (interp) {
                                    const r = interp as TranslationResponse;
                                    return (
                                        <div dir="auto" className="px-3 text-[12.5px] italic leading-relaxed text-slate-400">
                                            <span className="font-semibold text-slate-400/90">✦ </span>{r.interpretation}
                                            {r.growthSuggestion && (
                                                <span className="mt-1 block text-slate-400/80">↳ {r.growthSuggestion}</span>
                                            )}
                                        </div>
                                    );
                                }
                                return (
                                    <button onClick={() => revealInterpretation(i, m.text)} className="inline-flex items-center gap-1 self-start px-3 text-[11px] font-medium text-slate-400 transition-colors hover:text-emerald-600">
                                        <span aria-hidden>✦</span> reveal meaning
                                    </button>
                                );
                            })()}
                        </div>
                    </div>
                    );
                })}
                {isTyping && (
                    <div className="flex justify-start gap-2.5">
                        {incomingAvatar()}
                        <div className="bg-white border border-emerald-50 rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
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
                    {isGroup
                        ? 'A group reach — everyone in the chosen circle sees and can answer here. Anyone can mint this conversation to their tree, sealing it on the immutable chain.'
                        : 'These messages stay between you. Anyone here can mint the conversation to their tree — sealing it on the immutable chain as a shared record, like a contract. A mint shows here and on that tree.'}
                </p>
            )}
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex space-x-3 items-center sticky bottom-0 z-10">
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={mode === 'tree' ? `Send from ${activeTree?.name || 'your tree'} to ${headerName}...` : `Ask ${aiName}...`}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-6 py-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-white transition-all shadow-inner placeholder:text-slate-400 placeholder:italic"
                />
                <button type="submit" disabled={isTyping || isSending || !input.trim() || (mode === 'tree' && ((!selectedTree && !groupThread) || !activeTree))} className="bg-emerald-600 text-white p-4 rounded-full hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all shadow-lg">
                    {isSending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Icons.Send />}
                </button>
            </form>
        </div>
    )
}
