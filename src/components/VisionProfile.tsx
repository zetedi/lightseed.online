import React, { useState, useEffect } from 'react';
import { showAlert } from './ui/Dialog';
import { Vision } from '../types';
import { Icons } from './ui/Icons';
import { useLanguage } from '../contexts/LanguageContext';
import { canJoinVision } from '../domain/policy';
import { getLifetreeById } from '../services/firebase';
import { firestoreStore } from '../adapters/firestore';
import { participants, isParticipant } from '../domain/views/participation';
import { ProfileHero } from './ui/ProfileHero';
import { ProfileLayout } from './ui/ProfileLayout';
import { SectionTitle } from './ui/SectionTitle';
import { SectionMenu, SectionItem } from './ui/SectionMenu';
import { TreeParticipants } from './TreeParticipants';
import { Lifetree } from '../types';

// The vision view, rendered through the shared profile scaffold so a vision reads like the community
// / lifetree / event profiles. Joining a vision is a self-serve 'joined' link (people); trees join
// via 'participant' links, shown in the Participants section.
interface VisionProfileProps {
    vision: Vision;
    onClose: () => void;
    currentUserId?: string;
    onDelete?: (id: string) => void;
    myTrees?: Lifetree[];
    // Grow this vision — emit a vision_growth pulse onto its rooted tree.
    onGrow?: (vision: Vision) => void;
    // Open the vision's root tree.
    onViewTree?: (tree: Lifetree) => void;
}

type VisionSection = 'about' | 'participants';

export const VisionProfile = ({ vision, onClose, currentUserId, onDelete, myTrees, onGrow, onViewTree }: VisionProfileProps) => {
    const { t } = useLanguage();
    const isAuthor = currentUserId === vision.authorId;
    const isRoot = vision.title.toLowerCase() === 'root vision';

    const [section, setSection] = useState<VisionSection>('about');
    const [isJoined, setIsJoined] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [participantCount, setParticipantCount] = useState(0);
    // The tree this vision is rooted in (vision.lifetreeId). Prefer the local copy; otherwise fetch
    // (the root tree may belong to someone else and not be in myTrees).
    const [rootTree, setRootTree] = useState<Lifetree | null>(null);
    useEffect(() => {
        if (!vision.lifetreeId) { setRootTree(null); return; }
        const local = myTrees?.find(tr => tr.id === vision.lifetreeId);
        if (local) { setRootTree(local); return; }
        let alive = true;
        getLifetreeById(vision.lifetreeId).then(tr => { if (alive) setRootTree(tr); }).catch(() => {});
        return () => { alive = false; };
    }, [vision.lifetreeId, myTrees]);

    // Growing a vision seals a vision_growth block onto its root tree — available to the vision's
    // author or the root tree's owner, and only once the vision is actually rooted in a tree.
    const canGrow = !!currentUserId && !!vision.lifetreeId && (isAuthor || rootTree?.ownerId === currentUserId);

    // Participation as a prism over the LIN: the vision's incoming 'joined' links.
    useEffect(() => {
        let alive = true;
        firestoreStore.linksTo(vision.id, 'joined').then(links => {
            if (!alive) return;
            setIsJoined(isParticipant(links, currentUserId));
            setParticipantCount(participants(links).length);
        }).catch(() => {});
        return () => { alive = false; };
    }, [vision.id, currentUserId]);

    const handleJoinToggle = async () => {
        if (!canJoinVision(currentUserId) || isUpdating) return;
        setIsUpdating(true);
        try {
            if (isJoined) {
                await firestoreStore.unlink(currentUserId, 'joined', vision.id);
                setIsJoined(false);
                setParticipantCount(prev => Math.max(0, prev - 1));
            } else {
                await firestoreStore.link(currentUserId, 'joined', vision.id);
                setIsJoined(true);
                setParticipantCount(prev => prev + 1);
            }
        } catch (e: any) {
            showAlert('Action failed: ' + e.message);
        }
        setIsUpdating(false);
    };

    const sections: SectionItem[] = [
        { key: 'about', label: 'About', icon: <Icons.Eye /> },
        { key: 'participants', label: 'Participants', icon: <Icons.Users /> },
    ];

    return (
        <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300 pb-20 bg-slate-50">
            <ProfileHero heroImageUrl={vision.imageUrl}>
                {/* Top bar — back + join / delete / root badge */}
                <div className="flex items-center justify-between mb-6">
                    <button onClick={onClose} className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium">
                        <Icons.ArrowLeft />
                        <span>{t('back')}</span>
                    </button>
                    <div className="flex items-center gap-2">
                        {canGrow && onGrow && (
                            <button
                                onClick={() => onGrow(vision)}
                                className="flex items-center gap-1 rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-600 active:scale-95"
                            >
                                <Icons.HandLeaf />
                                <span>{t('grow_vision')}</span>
                            </button>
                        )}
                        {currentUserId && !isAuthor && (
                            <button
                                onClick={handleJoinToggle}
                                disabled={isUpdating}
                                className={`flex items-center gap-1 rounded-full px-4 py-2 text-xs font-bold shadow-sm transition-all active:scale-95 ${isJoined ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
                            >
                                <Icons.SparkleFill />
                                <span>{isJoined ? 'Joined' : 'Join Vision'}</span>
                            </button>
                        )}
                        {isAuthor && !isRoot && onDelete && (
                            <button
                                onClick={() => onDelete(vision.id)}
                                className="flex items-center gap-1 rounded-full bg-red-500/15 px-4 py-2 text-xs font-bold text-red-300 border border-red-400/30 transition-colors hover:bg-red-500 hover:text-white"
                            >
                                <Icons.Trash />
                                <span>Delete</span>
                            </button>
                        )}
                        {isAuthor && isRoot && (
                            <span className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-3 py-1.5 text-[10px] font-bold text-emerald-200">
                                <Icons.ShieldCheck /> ROOT ANCHOR
                            </span>
                        )}
                    </div>
                </div>

                {/* Avatar + title + meta */}
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                    <div className="flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-amber-50 shadow-xl">
                        {vision.imageUrl ? (
                            <img src={vision.imageUrl} className="h-full w-full object-cover" alt={vision.title} referrerPolicy="no-referrer" />
                        ) : (
                            <span className="text-amber-400"><Icons.Eye /></span>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 justify-center sm:justify-start">
                            <h1 dir="auto" className="min-w-0 break-words text-2xl font-light tracking-wide">{vision.title}</h1>
                            {participantCount > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs text-slate-200">
                                    <Icons.Users size={12} /> {participantCount} joined
                                </span>
                            )}
                            {vision.visibility && vision.visibility !== 'public' && (
                                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{vision.visibility}</span>
                            )}
                            {rootTree && (
                                <button
                                    onClick={() => onViewTree?.(rootTree)}
                                    title={`Rooted in ${rootTree.name}`}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-400/15 px-2.5 py-0.5 text-xs font-medium text-emerald-100 transition-colors hover:bg-emerald-400/30"
                                >
                                    {rootTree.imageUrl
                                        ? <img src={rootTree.imageUrl} alt="" referrerPolicy="no-referrer" className="h-4 w-4 rounded-full object-cover" />
                                        : <Icons.Tree />}
                                    <span className="max-w-[10rem] truncate">{t('rooted_in')} {rootTree.name}</span>
                                </button>
                            )}
                        </div>
                        <p className="mt-1 text-xs text-slate-300 text-center sm:text-left">Seeded by {vision.authorId.substring(0, 6)}…</p>
                    </div>
                </div>
            </ProfileHero>

            <ProfileLayout
                overlapClassName="-mt-8"
                menu={<SectionMenu items={sections} active={section} onSelect={(k) => setSection(k as VisionSection)} />}
            >
                {section === 'about' && (
                    <div>
                        <SectionTitle title={t('vision')} sub="What this vision is calling towards." />
                        {/* The tree this vision is anchored in — shown prominently on a root anchor. */}
                        {rootTree && (
                            <button
                                onClick={() => onViewTree?.(rootTree)}
                                className="mb-6 flex w-full items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-left transition-colors hover:bg-emerald-50"
                            >
                                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-white bg-emerald-100 shadow">
                                    {rootTree.latestGrowthUrl || rootTree.imageUrl
                                        ? <img src={rootTree.latestGrowthUrl || rootTree.imageUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                                        : <span className="flex h-full w-full items-center justify-center text-emerald-500"><Icons.Tree /></span>}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">{t('rooted_in')}</p>
                                    <p className="truncate text-lg font-light tracking-wide text-slate-800">{rootTree.name}</p>
                                    {rootTree.shortTitle && <p className="truncate text-xs text-slate-500">{rootTree.shortTitle}</p>}
                                </div>
                                <span className="shrink-0 text-emerald-600"><Icons.ArrowRight /></span>
                            </button>
                        )}
                        {vision.imageUrl && (
                            <div className="mb-6 h-64 w-full overflow-hidden rounded-2xl border border-slate-100 bg-amber-50 shadow-sm">
                                <img src={vision.imageUrl} alt={vision.title} className="h-full w-full object-cover" />
                            </div>
                        )}
                        <p dir="auto" className="whitespace-pre-wrap font-serif text-xl leading-relaxed text-slate-700">
                            {vision.body}
                        </p>
                        {vision.link && (
                            <div className="mt-8 border-t border-slate-100 pt-6">
                                <a href={vision.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-medium text-amber-600 transition-colors hover:text-amber-800">
                                    <Icons.Globe />
                                    <span className="break-all">{vision.link}</span>
                                </a>
                            </div>
                        )}
                    </div>
                )}

                {section === 'participants' && (
                    <div className="space-y-6">
                        <SectionTitle title="Participants" sub="The people and trees gathering around this vision." />
                        {participantCount > 0 && (
                            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
                                <span className="font-bold">{participantCount}</span> {participantCount === 1 ? 'person has' : 'people have'} joined this vision.
                            </div>
                        )}
                        <TreeParticipants entityId={vision.id} currentUserId={currentUserId} myTrees={myTrees} />
                    </div>
                )}
            </ProfileLayout>
        </div>
    );
};
