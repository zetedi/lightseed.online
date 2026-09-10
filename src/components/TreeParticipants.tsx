import { useState, useEffect } from 'react';
import { Lifetree } from '../types';
import { Icons } from './ui/Icons';
import { showAlert } from './ui/Dialog';
import { firestoreStore } from '../adapters/firestore';
import { getParticipatingTrees } from '../services/firebase';
import { useLanguage } from '../contexts/LanguageContext';

import { Picture } from './ui/Picture';
// The trees gathered around an event or vision, plus (for signed-in owners) a picker to enlist their
// own trees. Participation is a 'participant' link from the TREE to the entity — created/removed here
// through the same Store port the rest of the LIN uses. Shared by EventProfile and VisionProfile.
export const TreeParticipants = ({ entityId, currentUserId, myTrees = [], maxParticipants }: {
    entityId: string;
    currentUserId?: string;
    myTrees?: Lifetree[];
    // The gathering's room (events may bound it): joining closes when the places are taken.
    maxParticipants?: number;
}) => {
    const { t } = useLanguage();
    const [trees, setTrees] = useState<Lifetree[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [nonce, setNonce] = useState(0);

    useEffect(() => {
        let alive = true;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- flips the loading flag synchronously before the async participants fetch below
        setLoading(true);
        getParticipatingTrees(entityId)
            .then(ts => { if (alive) { setTrees(ts); setLoading(false); } })
            .catch(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [entityId, nonce]);

    const participatingIds = new Set(trees.map(t => t.id));
    const addable = myTrees.filter(t => !participatingIds.has(t.id));
    const bounded = typeof maxParticipants === 'number' && maxParticipants > 0;
    const full = bounded && trees.length >= maxParticipants;

    const toggle = async (tree: Lifetree, joining: boolean) => {
        if (busyId) return;
        setBusyId(tree.id);
        try {
            if (joining) await firestoreStore.link(tree.id, 'participant', entityId);
            else await firestoreStore.unlink(tree.id, 'participant', entityId);
            setNonce(n => n + 1);
        } catch (e: any) {
            showAlert(e?.message || 'err_participation');
        }
        setBusyId(null);
    };

    const treeImg = (t: Lifetree) => t.latestGrowthUrl || t.imageUrl || '';

    return (
        <div className="space-y-6">
            {loading ? (
                <p className="text-sm text-slate-400">{t('loading_trees')}</p>
            ) : trees.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {trees.map(tree => (
                        <div key={tree.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                            {treeImg(tree) ? (
                                <Picture size={480} src={treeImg(tree)} className="h-10 w-10 shrink-0 rounded-full object-cover" alt="" referrerPolicy="no-referrer" />
                            ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-500"><Icons.Tree /></div>
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{tree.name}</p>
                                {tree.shortTitle && <p className="truncate text-xs text-slate-400">{tree.shortTitle}</p>}
                            </div>
                            {currentUserId && tree.ownerId === currentUserId && (
                                <button
                                    onClick={() => toggle(tree, false)}
                                    disabled={busyId === tree.id}
                                    className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-slate-700"
                                >
                                    {busyId === tree.id ? '…' : t('remove')}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400 dark:border-slate-700">
                    {t('no_trees_joined')}
                </div>
            )}

            {bounded && (
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {t('places_taken').replace('{n}', String(Math.min(trees.length, maxParticipants))).replace('{max}', String(maxParticipants))}
                </p>
            )}

            {currentUserId && addable.length > 0 && full && (
                <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-700">
                    {t('gathering_full')}
                </p>
            )}

            {currentUserId && addable.length > 0 && !full && (
                <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{t('add_your_tree')}</p>
                    <div className="flex flex-wrap gap-2">
                        {addable.map(tree => (
                            <button
                                key={tree.id}
                                onClick={() => toggle(tree, true)}
                                disabled={busyId === tree.id}
                                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                            >
                                <Icons.Tree /> {busyId === tree.id ? '…' : tree.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
