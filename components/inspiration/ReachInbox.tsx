import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from '../ui/Icons';
import { Lifetree, Lightseed, Pulse } from '../../types';
import { ReachThread } from './ReachThread';
import { markReachPulsesSeen, listenToUserProfile } from '../../services/firebase';
import { getIntelligence } from '../../services/intelligence';

interface ReachThreadSummary {
    partnerId: string;
    partnerName: string;
    partnerPhoto?: string;
    lastMessage: string;
    lastAt: number;
    count: number;
}

type Selection =
    | { kind: 'none' }
    | { kind: 'oracle' }
    | { kind: 'tree'; tree: Lifetree };

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

const OracleAvatar = ({ size = 'md' }: { size?: 'sm' | 'md' }) => {
    const dim = size === 'sm' ? 'h-10 w-10' : 'h-12 w-12';
    return (
        <div className={`${dim} relative flex shrink-0 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-50 text-amber-500 shadow-sm`}>
            <Icons.Sun />
        </div>
    );
};

export const ReachInbox = ({
    pulses,
    myTrees,
    lightseed,
    requestedPartner,
    onConsumeRequested,
    title = 'Direct Messages',
    subtitle = 'Private reaches between your trees and the network.',
}: {
    pulses: Pulse[];
    myTrees: Lifetree[];
    lightseed: Lightseed | null;
    requestedPartner: Lifetree | null;
    onConsumeRequested?: () => void;
    title?: string;
    subtitle?: string;
}) => {
    const [selection, setSelection] = useState<Selection>({ kind: 'none' });
    const [aiName, setAiName] = useState('Osiris');

    // Show the enabled, active intelligence's name for the AI thread — reactively, so it
    // tracks the user's chosen intelligence as soon as the profile loads/changes.
    useEffect(() => {
        if (!lightseed?.uid) { setAiName('Osiris'); return; }
        let cancelled = false;
        const unsub = listenToUserProfile(lightseed.uid, (profile) => {
            const id = profile?.preferredIntelligenceId;
            if (!id) { setAiName('Osiris'); return; }
            getIntelligence(id).then(i => { if (!cancelled) setAiName(i && i.enabled !== false && i.name ? i.name : 'Osiris'); }).catch(() => {});
        });
        return () => { cancelled = true; unsub(); };
    }, [lightseed?.uid]);

    // Open a thread when one is requested from outside (map marker, tree card/detail).
    useEffect(() => {
        if (requestedPartner) {
            setSelection({ kind: 'tree', tree: requestedPartner });
            onConsumeRequested?.();
        }
    }, [requestedPartner?.id]);

    // Opening Direct Messages marks every received message as seen, clearing the
    // global unread glow. Sent messages (authored by me) are never marked/counted.
    const markedRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (!lightseed) return;
        const uid = lightseed.uid;
        const toMark = pulses
            .filter(p => p.recipientUid === uid && p.authorId !== uid && !(p.seenBy || []).includes(uid) && !markedRef.current.has(p.id))
            .map(p => p.id);
        if (toMark.length) {
            toMark.forEach(id => markedRef.current.add(id));
            markReachPulsesSeen(toMark, uid);
        }
    }, [pulses, lightseed?.uid]);

    const threads = useMemo<ReachThreadSummary[]>(() => {
        const myIds = new Set(myTrees.map(t => t.id));
        const map = new Map<string, ReachThreadSummary>();

        for (const p of pulses) {
            const reachId = p.reachTreeId || (p as any).chatTreeId;
            const reachName = p.reachTreeName || (p as any).chatTreeName;
            // I sent it if I authored it, or it originates from one of my trees.
            const outgoing = (!!lightseed && p.authorId === lightseed.uid) || myIds.has(p.lifetreeId || '');

            let partnerId: string | undefined;
            let partnerName: string | undefined;
            let partnerPhoto: string | undefined;

            if (outgoing) {
                partnerId = reachId;
                partnerName = reachName;
            } else {
                partnerId = p.lifetreeId;
                partnerName = p.authorName;
                partnerPhoto = p.authorPhoto;
            }
            if (!partnerId) continue;

            const at = p.createdAt?.toMillis?.() || 0;
            // Newest utterance in this pulse: the reply if present, otherwise the message.
            const text = p.reachResponse || p.content || p.body || '';
            const existing = map.get(partnerId);
            if (!existing) {
                map.set(partnerId, {
                    partnerId,
                    partnerName: partnerName || 'Lifetree',
                    partnerPhoto,
                    lastMessage: text,
                    lastAt: at,
                    count: 1,
                });
            } else {
                existing.count += 1;
                if (at >= existing.lastAt) {
                    existing.lastAt = at;
                    existing.lastMessage = text;
                }
                if (!existing.partnerPhoto && partnerPhoto) existing.partnerPhoto = partnerPhoto;
            }
        }

        return Array.from(map.values()).sort((a, b) => b.lastAt - a.lastAt);
    }, [pulses, myTrees, lightseed?.uid]);

    const hasSelection = selection.kind !== 'none';
    const isOracle = selection.kind === 'oracle';
    const selectedTreeId = selection.kind === 'tree' ? selection.tree.id : null;

    const rowBase = 'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors';

    return (
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-xl">
            <div className="flex h-[70vh]">
            {/* Thread list */}
            <div className={`${hasSelection ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-slate-100 md:w-80`}>
                {/* Title sits with the Threads label; the standalone header was removed. */}
                <div className="border-b border-slate-100 px-4 py-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Threads</span>
                    <h2 className="mt-1 truncate text-base font-semibold text-slate-900">{title}</h2>
                    <p className="text-xs text-slate-500">{subtitle}</p>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <button
                        onClick={() => setSelection({ kind: 'oracle' })}
                        className={`${rowBase} border-b border-slate-100 ${isOracle ? 'bg-amber-50' : 'bg-amber-50/30 hover:bg-amber-50'}`}
                    >
                        <OracleAvatar size="sm" />
                        <div className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-slate-800">{aiName}</span>
                            <span className="block truncate text-xs text-slate-500 italic">Ask for wisdom & reflection</span>
                        </div>
                    </button>

                    {threads.length === 0 ? (
                        <div className="px-5 py-12 text-center text-slate-400">
                            <p className="text-sm">No direct messages yet.</p>
                            <p className="mt-1 text-xs">Reach a Lifetree from the map or a tree's page.</p>
                        </div>
                    ) : (
                        threads.map(thread => (
                            <button
                                key={thread.partnerId}
                                onClick={() => setSelection({ kind: 'tree', tree: { id: thread.partnerId, name: thread.partnerName, imageUrl: thread.partnerPhoto } as Lifetree })}
                                className={`${rowBase} border-b border-slate-50 ${selectedTreeId === thread.partnerId ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                            >
                                <TreeAvatar name={thread.partnerName} photo={thread.partnerPhoto} size="sm" />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate font-semibold text-slate-800">{thread.partnerName}</span>
                                        {thread.count > 1 && (
                                            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{thread.count}</span>
                                        )}
                                    </div>
                                    <span className="block truncate text-xs text-slate-500">{thread.lastMessage || 'Reached through the mycelial network.'}</span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Thread pane */}
            <div className={`${hasSelection ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
                {hasSelection ? (
                    <div key={isOracle ? 'oracle' : selectedTreeId || 'none'} className="flex min-h-0 flex-1 flex-col">
                        <ReachThread
                            targetTree={selection.kind === 'tree' ? selection.tree : null}
                            onBack={() => setSelection({ kind: 'none' })}
                        />
                    </div>
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-start px-8 pt-10 text-center text-slate-400">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                            <Icons.Lightning />
                        </div>
                        <p className="font-medium text-slate-500">Select a thread</p>
                        <p className="mt-1 max-w-xs text-sm">Choose a Lifetree on the left to open your reach, or ask {aiName}.</p>
                    </div>
                )}
            </div>
            </div>
        </div>
    );
};
