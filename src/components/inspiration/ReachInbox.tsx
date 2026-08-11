import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from '../ui/Icons';
import { Lifetree, Lightseed, Pulse, ReachAudience } from '../../types';
import { ReachThread, type GroupThreadDescriptor } from './ReachThread';
import { markReachPulsesSeen, listenToUserProfile, updateUserProfile } from '../../services/firebase';
import { getIntelligence } from '../../services/intelligence';
import { reachThreads, type ReachThread as ThreadSummary } from '../../domain/views/threads';
import { showConfirm } from '../ui/Dialog';
import { useLanguage } from '../../contexts/LanguageContext';

type Selection =
    | { kind: 'none' }
    | { kind: 'oracle' }
    | { kind: 'tree'; tree: Lifetree; audience?: ReachAudience }
    | { kind: 'group'; thread: GroupThreadDescriptor };

const TreeAvatar = ({ name, photo, size = 'md' }: { name: string, photo?: string, size?: 'sm' | 'md' }) => {
    const dim = size === 'sm' ? 'h-10 w-10 text-sm' : 'h-12 w-12 text-base';
    if (photo) {
        return <img src={photo} alt={name} className={`${dim} shrink-0 rounded-full object-cover border-2 border-emerald-100 shadow-sm`} />;
    }
    return (
        <div className={`${dim} flex shrink-0 items-center justify-center rounded-full border-2 border-emerald-100 bg-emerald-50 font-bold uppercase text-emerald-600 shadow-sm`}>
            {name?.trim()?.charAt(0) || <Icons.Tree />}
        </div>
    );
};


export const ReachInbox = ({
    pulses,
    myTrees,
    lightseed,
    requestedPartner,
    requestedAudience,
    onConsumeRequested,
    onOpenTreeById,
    onOpenCareById,
}: {
    pulses: Pulse[];
    myTrees: Lifetree[];
    lightseed: Lightseed | null;
    requestedPartner: Lifetree | null;
    requestedAudience?: ReachAudience;
    onConsumeRequested?: () => void;
    onOpenTreeById?: (treeId: string) => void;
    onOpenCareById?: (treeId: string) => void;
}) => {
    const { t } = useLanguage();
    const [selection, setSelection] = useState<Selection>({ kind: 'none' });
    const [aiName, setAiName] = useState('Osiris');
    // Per-user "deleted" threads: key → hidden-at (ms). A thread is hidden from MY inbox while its
    // newest message predates the hide — a new message (lastAt > hidden-at) brings it back.
    const [hiddenThreads, setHiddenThreads] = useState<Record<string, number>>({});

    // Show the enabled, active intelligence's name for the AI thread — reactively, so it
    // tracks the user's chosen intelligence as soon as the profile loads/changes.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to the default name when the user signs out / before auth resolves
        if (!lightseed?.uid) { setAiName('Osiris'); return; }
        let cancelled = false;
        const unsub = listenToUserProfile(lightseed.uid, (profile) => {
            setHiddenThreads(profile?.hiddenThreads || {});
            const id = profile?.preferredIntelligenceId;
            if (!id) { setAiName('Osiris'); return; }
            getIntelligence(id).then(i => { if (!cancelled) setAiName(i && i.enabled !== false && i.name ? i.name : 'Osiris'); }).catch(() => {});
        });
        return () => { cancelled = true; unsub(); };
    }, [lightseed?.uid]);

    // Open a thread when one is requested from outside (map marker, tree card/detail).
    useEffect(() => {
        if (requestedPartner) {
            // requestedAudience (e.g. 'guardians' from a danger alert) preselects a group reach.
            // eslint-disable-next-line react-hooks/set-state-in-effect -- prop→state sync: an externally requested partner opens that thread once, then is consumed
            setSelection({ kind: 'tree', tree: requestedPartner, audience: requestedAudience });
            onConsumeRequested?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the primitive partner id; the partner object and onConsumeRequested change identity per render and would re-open the thread after the user navigates away
    }, [requestedPartner?.id, requestedAudience]);

    // Opening Direct Messages marks every received message as seen, clearing the
    // global unread glow. Sent messages (authored by me) are never marked/counted.
    const markedRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (!lightseed) return;
        const uid = lightseed.uid;
        const toMark = pulses
            .filter(p => (p.recipientUid === uid || (p.participantUids || []).includes(uid)) && p.authorId !== uid && !(p.seenBy || []).includes(uid) && !markedRef.current.has(p.id))
            .map(p => p.id);
        if (toMark.length) {
            toMark.forEach(id => markedRef.current.add(id));
            markReachPulsesSeen(toMark, uid);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the primitive uid; the lightseed object changes identity on every profile update and would re-run the mark-seen write needlessly
    }, [pulses, lightseed?.uid]);

    const threads = useMemo(
        () => reachThreads(pulses, { uid: lightseed?.uid, treeIds: myTrees.map(t => t.id) }),
        [pulses, myTrees, lightseed?.uid],
    );

    const hasSelection = selection.kind !== 'none';
    const isOracle = selection.kind === 'oracle';
    const selectedKey = selection.kind === 'tree' ? selection.tree.id
        : selection.kind === 'group' ? selection.thread.threadId
        : null;

    // Hide "deleted" threads whose newest message predates the deletion.
    const visibleThreads = useMemo(
        () => threads.filter(t => !(hiddenThreads[t.key] && t.lastAt <= hiddenThreads[t.key])),
        [threads, hiddenThreads],
    );

    // A thirsty tree jumps the queue: when the inbox opens with no selection and a thread
    // carries a watering alert, open the first one — the care ping is one tap closer. Runs
    // once per mount so it never fights the user's own navigation.
    const autoOpenedRef = useRef(false);
    useEffect(() => {
        // An externally requested thread (map marker, tree page) always outranks the auto-open.
        if (autoOpenedRef.current || selection.kind !== 'none' || requestedPartner) return;
        const thirsty = visibleThreads.find(t => t.careAlert === 'watering');
        if (!thirsty) return;
        autoOpenedRef.current = true;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot auto-selection once the loaded threads reveal a watering alert; guarded by autoOpenedRef so it can never loop or override the user
        setSelection(thirsty.isGroup && thirsty.threadId
            ? { kind: 'group', thread: { threadId: thirsty.threadId, partnerId: thirsty.partnerId, partnerName: thirsty.partnerName, partnerPhoto: thirsty.partnerPhoto, audience: thirsty.audience, participantCount: thirsty.participantCount } }
            : { kind: 'tree', tree: { id: thirsty.partnerId, name: thirsty.partnerName, imageUrl: thirsty.partnerPhoto } as Lifetree });
    }, [visibleThreads, selection.kind, requestedPartner]);

    const deleteThread = async (thread: ThreadSummary, e: React.MouseEvent) => {
        e.stopPropagation();
        const ok = await showConfirm(
            thread.isGroup ? 'thread_delete_group_confirm' : 'thread_delete_direct_confirm',
            { title: 'delete_conversation', confirmText: 'delete', danger: true },
        );
        if (!ok) return;
        const next = { ...hiddenThreads, [thread.key]: Date.now() };
        setHiddenThreads(next);
        if (lightseed?.uid) {
            updateUserProfile(lightseed.uid, { hiddenThreads: next }).catch(() => {});
            // A deleted conversation must not keep glowing: mark ITS unseen messages seen, so the
            // unread envelope clears even for a thread deleted without ever being opened.
            const uid = lightseed.uid;
            const unseen = pulses
                .filter(p => (thread.isGroup ? p.threadId === thread.threadId : (!p.threadId || !p.participantUids) && (p.reachTreeId === thread.partnerId || p.lifetreeId === thread.partnerId))
                    && (p.recipientUid === uid || (p.participantUids || []).includes(uid))
                    && p.authorId !== uid && !(p.seenBy || []).includes(uid))
                .map(p => p.id);
            if (unseen.length) markReachPulsesSeen(unseen, uid);
        }
        if (selectedKey === thread.key) setSelection({ kind: 'none' });
    };

    const rowBase = 'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors';

    // The four kinds of reach, told apart at a glance (ring 2026-08-10): the Oracle (sun), the
    // group reach (two beings), the direct reach (one being), the care/watering reach (the drop).
    // A pill filters the list; tapping it again lets everything back in. The Oracle pill opens
    // the Oracle itself — it is one thread, not a category.
    type ReachKind = 'group' | 'direct' | 'care';
    const [kindFilter, setKindFilter] = useState<ReachKind | null>(null);
    const kindOf = (th: ThreadSummary): ReachKind => th.careAlert === 'watering' ? 'care' : th.isGroup ? 'group' : 'direct';
    const filteredThreads = kindFilter ? visibleThreads.filter(th => kindOf(th) === kindFilter) : visibleThreads;
    const pill = (active: boolean) =>
        `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${active ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-700'}`;

    return (
        <div className="mx-auto max-w-5xl">
            {/* The four kinds of reach, high above everything (ring 2026-08-10): the Oracle is a
                door, the other three are lenses. Hidden on a phone while a thread is open — there,
                every vertical pixel belongs to the conversation. */}
            <div className={`${hasSelection ? 'hidden md:flex' : 'flex'} flex-wrap items-center justify-center gap-2 px-12 pb-3 pt-1`}>
                <button type="button" onClick={() => setSelection({ kind: 'oracle' })} title={t('ask_wisdom')} className={pill(isOracle)}>
                    <span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Sun /></span>{aiName}
                </button>
                <button type="button" onClick={() => setKindFilter(f => f === 'group' ? null : 'group')} title={t('pill_group')} className={pill(kindFilter === 'group')}>
                    <span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Users /></span>{t('pill_group')}
                </button>
                <button type="button" onClick={() => setKindFilter(f => f === 'direct' ? null : 'direct')} title={t('pill_direct')} className={pill(kindFilter === 'direct')}>
                    <span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Profile /></span>{t('pill_direct')}
                </button>
                <button type="button" onClick={() => setKindFilter(f => f === 'care' ? null : 'care')} title={t('pill_care')} className={pill(kindFilter === 'care')}>
                    <span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Droplet /></span>{t('pill_care')}
                </button>
            </div>
            {/* Mobile: fill the floating card under its top chrome; desktop keeps 70vh. */}
            <div className="flex h-[calc(100dvh-8rem)] gap-4 md:h-[70vh]">
            {/* Thread list — no card, so it sits lightly on the page and takes less room. */}
            <div className={`${hasSelection ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col overflow-hidden md:w-72`}>
                <div className="flex-1 overflow-y-auto">
                    {filteredThreads.length === 0 ? (
                        <div className="px-5 py-12 text-center text-slate-400">
                            <p className="text-sm">{t('no_dms')}</p>
                            <p className="mt-1 text-xs">{t('no_dms_hint')}</p>
                        </div>
                    ) : (
                        filteredThreads.map(thread => (
                            <div
                                key={thread.key}
                                role="button"
                                onClick={() => thread.isGroup && thread.threadId
                                    ? setSelection({ kind: 'group', thread: { threadId: thread.threadId, partnerId: thread.partnerId, partnerName: thread.partnerName, partnerPhoto: thread.partnerPhoto, audience: thread.audience, participantCount: thread.participantCount } })
                                    : setSelection({ kind: 'tree', tree: { id: thread.partnerId, name: thread.partnerName, imageUrl: thread.partnerPhoto } as Lifetree })}
                                className={`${rowBase} group cursor-pointer border-b border-slate-50 ${thread.careAlert === 'watering' ? 'border-l-4 border-l-sky-500 bg-sky-50/40' : ''} ${selectedKey === thread.key ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                            >
                                <button
                                    type="button"
                                    onClick={(e) => { if (onOpenTreeById && thread.partnerId) { e.stopPropagation(); onOpenTreeById(thread.partnerId); } }}
                                    title={thread.partnerName}
                                    className="shrink-0 rounded-full transition-transform hover:scale-105"
                                >
                                    {thread.isGroup
                                        ? <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-emerald-100 bg-emerald-50 text-emerald-600"><Icons.Users /></div>
                                        : <TreeAvatar name={thread.partnerName} photo={thread.partnerPhoto} size="sm" />}
                                </button>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate font-semibold text-slate-800">
                                            {thread.partnerName}
                                            {thread.partnerPersonName && thread.partnerPersonName !== thread.partnerName && (
                                                <span className="ml-1 font-normal text-slate-400">({thread.partnerPersonName})</span>
                                            )}
                                        </span>
                                        {thread.unread > 0 && (
                                            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{thread.unread}</span>
                                        )}
                                    </div>
                                    <span className="block truncate text-xs text-slate-500">
                                        {thread.careAlert === 'watering' && <span className="font-bold text-sky-600">💧 needs water · </span>}
                                        {thread.isGroup && <span className="text-emerald-600/70">● group · </span>}
                                        {thread.lastMessage || t('reached_mycelial')}
                                    </span>
                                </div>
                                {/* A care request answers right here: the drop opens the care
                                    modal for the thirsty tree — no hunting inside the thread. */}
                                {thread.careAlert === 'watering' && onOpenCareById && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onOpenCareById(thread.partnerId); }}
                                        title={t('care_now')}
                                        className="shrink-0 rounded-full bg-sky-600 p-2 text-white shadow-md transition-all hover:bg-sky-700 active:scale-95"
                                    >
                                        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Droplet /></span>
                                    </button>
                                )}
                                {/* Delete (hide) — always visible on mobile, on hover on desktop. */}
                                <button
                                    type="button"
                                    onClick={(e) => deleteThread(thread, e)}
                                    title={t('delete_conversation')}
                                    className="shrink-0 rounded-full p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                >
                                    <Icons.Trash />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Thread pane — the card that holds the messages. */}
            <div className={`${hasSelection ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-xl`}>
                {hasSelection ? (
                    <div key={isOracle ? 'oracle' : selectedKey || 'none'} className="flex min-h-0 flex-1 flex-col">
                        <ReachThread
                            targetTree={selection.kind === 'tree' ? selection.tree : null}
                            groupThread={selection.kind === 'group' ? selection.thread : null}
                            initialAudience={selection.kind === 'tree' ? selection.audience : undefined}
                            onBack={() => setSelection({ kind: 'none' })}
                            onOpenTreeById={onOpenTreeById}
                            onOpenCareById={onOpenCareById}
                        />
                    </div>
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-start px-8 pt-10 text-center text-slate-400">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                            <Icons.Reach />
                        </div>
                        <p className="font-medium text-slate-500">{t('select_thread')}</p>
                        <p className="mt-1 max-w-xs text-sm">Choose a Lifetree on the left to open your reach, or ask {aiName}.</p>
                    </div>
                )}
            </div>
            </div>
        </div>
    );
};
