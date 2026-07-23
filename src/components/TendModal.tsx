import { useState } from 'react';
import { Modal } from './ui/Modal';
import { Icons } from './ui/Icons';
import { markWateredOffChain } from './../services/firebase';
import type { Lifetree } from '../types';

// THE TEND SHEET — the tend droplet opens this small, focused modal instead of steering to a
// whole page: the target tree, a single "watered today" breath of care, a door to the full Care
// section for more (photo proof, schedule, witnessing), and — when one is starred — the vision.
// An inner BLUE glow (water, not the emerald of the app) sets it apart; full-screen on mobile so
// the small content uses the space and the thumb has room.
export const TendModal = ({ tree, sender, hasVision, onOpenCare, onOpenVision, onClose }: {
    tree: Lifetree;
    sender: { uid: string; displayName?: string | null; photoURL?: string | null };
    hasVision?: boolean;
    onOpenCare: () => void;
    onOpenVision?: () => void;
    onClose: () => void;
}) => {
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const img = tree.latestGrowthUrl || tree.imageUrl;

    const water = async () => {
        if (busy || done) return;
        setBusy(true);
        try { await markWateredOffChain(tree, sender); setDone(true); }
        catch { /* best-effort; the full Care view surfaces errors */ }
        setBusy(false);
    };

    return (
        // A compact CENTRED modal (not full-screen): the small content fills it, no empty space.
        <Modal title="Tend" onClose={onClose}>
            {/* The inner blue glow — a pool of water light around the content. */}
            <div className="-m-4 flex flex-col items-center gap-4 p-6 text-center shadow-[inset_0_0_70px_rgba(59,130,246,0.3)]">
                <div className="relative">
                    {img
                        ? <img src={img} alt={tree.name} className="h-20 w-20 rounded-full border-4 border-white object-cover shadow-lg" referrerPolicy="no-referrer" />
                        : <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-emerald-700 text-white shadow-lg"><Icons.Tree /></div>}
                    <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-sky-500 text-white shadow"><Icons.Drop /></span>
                </div>

                <div>
                    <p className="text-lg font-light tracking-wide text-slate-800">{tree.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">A breath of care keeps it living.</p>
                </div>

                {done ? (
                    <p className="w-full rounded-2xl bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700">Watered today 💧 Thank you.</p>
                ) : (
                    <button onClick={water} disabled={busy} className="w-full rounded-2xl bg-sky-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition-all hover:bg-sky-700 active:scale-95 disabled:opacity-60">
                        {busy ? 'Watering…' : 'I watered today 💧'}
                    </button>
                )}

                <div className="flex items-center gap-4">
                    <button onClick={onOpenCare} className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 transition-colors hover:text-sky-700">
                        Open full care <Icons.ArrowRight size={14} />
                    </button>
                    {hasVision && onOpenVision && (
                        <button onClick={onOpenVision} className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 transition-colors hover:text-amber-700">
                            <span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Eye /></span> Tend your vision
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
};
