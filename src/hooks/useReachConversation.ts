import React, { useState, useEffect, useRef } from 'react';
import { sendMessageToOracle } from '@backend/gemini';
import { checkAndIncrementAiUsage, fetchReachThread, fetchThreadById, markReachesSeen, sendReach, sendThreadMessage, retractReachMessage } from '@backend';
import { showAlert, showConfirm } from '../services/dialogBus';
import { useLanguage } from '../contexts/LanguageContext';
import { reachAudienceLabels } from '../utils/reachPermissions';
import { withTimeout } from '../utils/withTimeout';
import { isWateringOverdue } from '../domain/watering';
import { threadLines, unseenReachIds, type ThreadLine, type ThreadMeta, type GroupThreadDescriptor } from '../domain/views/threads';
import { useLifeseed } from './useLifeseed';
import { useRefreshSignal } from './useRefreshSignal';
import { useActiveIntelligence } from './useActiveIntelligence';
import { useReachInterpretations } from './useReachInterpretations';
import { useReachMint } from './useReachMint';
import type { Lifetree, Pulse, ReachAudience } from '../types';

type ChatMessage = ThreadLine;


// ONE CONVERSATION, HELD — a reach to a tree (1:1 or to a slice of its circle), a group thread
// opened from the inbox, or the Oracle: its lines, the composing hand, and the four things a
// speaker can do (send, retract, mint, ask what a message means). Lifted whole out of
// ReachThread (ring 2026-11-19): the face draws the room, this hook holds what is said in it.
export const useReachConversation = ({ targetTree = null, groupThread = null, initialAudience }: {
    targetTree?: Lifetree | null;
    groupThread?: GroupThreadDescriptor | null;
    initialAudience?: ReachAudience;
}) => {
    const { t } = useLanguage();
    const { lightseed, activeTree, myTrees, isAdmin, isSuperAdmin, nameAs } = useLifeseed();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    // THE THREAD FOLLOWS THE BUS (ring 2026-09-20): a watering confirmed from a care ping
    // announces 'reaches' and the tree's new head; the thread re-reads so the ping dissolves
    // and the tree's answer arrives without closing and reopening.
    const reachSignal = useRefreshSignal(['reaches', 'trees']);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isSending, setIsSending] = useState(false);
    // The minting explainer, folded behind a small (i) toggle under the messages.
    const [showMintInfo, setShowMintInfo] = useState(false);
    const [mode, setMode] = useState<'oracle' | 'tree'>(targetTree || groupThread ? 'tree' : 'oracle');
    const [selectedTree, setSelectedTree] = useState<Lifetree | null>(targetTree);
    // Who the next message goes to when composing to a tree: undefined = owner (1:1), else a
    // group audience. A group thread opened from the inbox fixes the audience and can't change it.
    const [audience, setAudience] = useState<ReachAudience | undefined>(groupThread?.audience ?? initialAudience);
    // Metadata for the thread currently loaded — lets a group reply reuse the same threadId
    // + participantUids so everyone stays in one conversation.
    const [threadMeta, setThreadMeta] = useState<ThreadMeta | null>(null);
    // The human behind the partner tree in a 1:1 thread — shown under the tree name. Derived
    // from the partner's own messages (their reaches carry authorPersonName).
    const [partnerPersonName, setPartnerPersonName] = useState<string | undefined>(undefined);
    const bottomRef = useRef<HTMLDivElement>(null);
    const { usage, preferredIntelligenceId, aiName } = useActiveIntelligence(lightseed);
    const { interpretations, revealInterpretation, clearInterpretations } = useReachInterpretations(selectedTree, activeTree, preferredIntelligenceId);

    const isGroup = !!groupThread || (mode === 'tree' && audience !== undefined);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on primitive ids; the targetTree/groupThread objects change identity on parent renders and would reset the selected tree/audience mid-conversation
    }, [targetTree?.id, groupThread?.threadId, initialAudience]);

    // The law of both is domain/views/threads (threadLines, unseenReachIds).
    const buildHistory = (pulses: Pulse[], group: boolean): ChatMessage[] =>
        threadLines(pulses, { uid: lightseed?.uid, treeIds: myTrees.map((tree: Lifetree) => tree.id), group });

    const markThreadSeen = (pulses: Pulse[]) => {
        if (!lightseed) return;
        const unseen = unseenReachIds(pulses, lightseed.uid);
        if (unseen.length) markReachesSeen(unseen, lightseed.uid);
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
            const greeting = t('reach_group_greeting').replace('{name}', groupThread.partnerName);
            setMessages([]);
            clearInterpretations();
            setIsTyping(true);
            fetchThreadById(groupThread.threadId, lightseed?.uid)
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
                ? t('reach_group_circle_greeting').replace('{name}', partner.name).replace('{circle}', reachAudienceLabels[audience].toLowerCase())
                : t('reach_direct_greeting').replace('{name}', partner.name);
            setMessages([]);
            clearInterpretations();
            setIsTyping(true);

            const load = audience && lightseed
                // Group: a deterministic per-initiator thread; sendReach lands every message here.
                ? fetchThreadById(['grp', partner.id, audience, lightseed.uid].join('__'), lightseed.uid)
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
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on primitive ids only; the listed objects (lightseed, myTrees, selectedTree, groupThread) and render-scoped fns (buildHistory, markThreadSeen, t) change identity per render and would refetch the thread in a loop
    }, [mode, selectedTree?.id, groupThread?.threadId, audience, lightseed?.uid, reachSignal]);

    useEffect(() => {
        if (mode === 'tree' && !selectedTree && !groupThread && activeTree) {
            setSelectedTree(activeTree);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on primitive ids; depending on the tree/thread objects would re-run on identity churn and could override the user's selected tree
    }, [mode, selectedTree?.id, activeTree?.id, groupThread?.threadId]);


    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);


    const partnerTreeId = selectedTree?.id || groupThread?.partnerId || null;
    // A quenched tree's care pings dissolve here too — the full tree record (with its watering
    // rhythm) comes from the session, since a thread row carries only a face and a name.
    const partnerFullTree = myTrees.find(mt => mt.id === partnerTreeId) || null;
    const partnerQuenched = !!partnerFullTree && !isWateringOverdue(partnerFullTree);
    const audibleMessages = partnerQuenched ? messages.filter(m => m.careAlert !== 'watering') : messages;
    const headerName = groupThread ? groupThread.partnerName
        : (mode === 'tree' && selectedTree
            ? (audience ? `${selectedTree.name} · ${reachAudienceLabels[audience]}` : selectedTree.name)
            : aiName);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        if (mode === 'tree') {
            // A sender without a tree still speaks — as themself (the person is the node).
            if (!lightseed || (!selectedTree && !groupThread)) {
                setMessages(prev => [...prev, {role: 'model', text: t('reach_choose_tree')}]);
                return;
            }

            const mycelialText = input.trim();
            setInput('');
            setMessages(prev => [...prev, { role: 'user', text: mycelialText, authorId: lightseed.uid, authorName: activeTree?.name || lightseed.displayName || t('you'), authorPhoto: activeTree?.imageUrl || lightseed.photoURL || undefined }]);
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
                    text: error.message || t('err_reach_send')
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
            const responseText = await withTimeout(responsePromise, 30000, t('err_reply_timeout'));
            setMessages(prev => [...prev, {role: 'model', text: responseText || "..."}]);
        } catch(e: any) {
            console.error("Oracle Error:", e);
            let msg = t('err_wind_too_strong');

            if (e.message?.includes("403")) {
                msg = t('err_ai_forbidden').replace('{name}', aiName);
            } else if (e.message?.includes("429") || e.code === 'resource-exhausted') {
                msg = t('err_ai_rate_limit');
            } else if (e.message) {
                msg = t('err_prefix').replace('{msg}', e.message);
            }

            setMessages(prev => [...prev, {role: 'model', text: msg}]);
        }
        setIsTyping(false);
    }

    // Retract an accidental message of mine: the chain keeps the sealed block, the room stops
    // repeating the words (rules overlay (h); the mark rides outside the hashed fields).
    const handleRetract = async (pulseId: string) => {
        if (!(await showConfirm('msg_retract_confirm', { title: 'msg_retract_title', confirmText: 'msg_retract_short', danger: true }))) return;
        try {
            await retractReachMessage(pulseId);
            setMessages(prev => prev.map(m => m.id === pulseId ? { ...m, retracted: true } : m));
        } catch (e) { showAlert(e instanceof Error ? e.message : String(e)); }
    };

    const { isMinting, handleMint } = useReachMint({
        session: { lightseed, activeTree, nameAs, isAdmin, isSuperAdmin },
        messages, setMessages, mode, selectedTree, groupThread, threadMeta, audience, aiName,
    });


    return {
        lightseed, activeTree, nameAs,
        messages, audibleMessages, input, setInput, isTyping, isSending, isMinting,
        showMintInfo, setShowMintInfo, usage, aiName, interpretations,
        mode, selectedTree, audience, setAudience, threadMeta, partnerPersonName, partnerTreeId,
        bottomRef, isGroup, headerName,
        revealInterpretation, handleSend, handleRetract, handleMint,
    };
};
