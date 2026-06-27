
import React, { useState, useEffect } from 'react';
import { fetchGrowthPulses, getLifetreeById } from '../services/firebase';
import { Modal } from './ui/Modal';

// One frame of the evolution: the planting/genesis image first, then each growth pulse.
interface Frame {
    imageUrl?: string;
    title: string;
    subtitle?: string;
    createdAt?: any;
    isGenesis?: boolean;
}

export const GrowthPlayerModal = ({ treeId, onClose }: { treeId: string, onClose: () => void }) => {
    const [frames, setFrames] = useState<Frame[]>([]);
    const [index, setIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let alive = true;
        const timeout = setTimeout(() => { if (alive) setLoading(false); }, 10000);

        Promise.all([getLifetreeById(treeId), fetchGrowthPulses(treeId)])
            .then(([tree, pulses]) => {
                if (!alive) return;
                // fetchGrowthPulses returns newest-first; the evolution plays OLDEST -> NEWEST.
                const growth = pulses.filter(p => p.imageUrl).reverse();
                const out: Frame[] = [];
                // The planting/genesis frame: the tree's first image + its vision.
                if (tree?.imageUrl) {
                    out.push({ imageUrl: tree.imageUrl, title: `${tree.name} · Planted`, subtitle: tree.body, createdAt: tree.createdAt, isGenesis: true });
                }
                growth.forEach(p => out.push({
                    imageUrl: p.imageUrl,
                    title: p.title,
                    subtitle: (p as any).care === 'watering' ? '💧 Watering' : undefined,
                    createdAt: p.createdAt,
                }));
                setFrames(out);
                setIndex(0);
                setLoading(false);
            })
            .catch(err => {
                if (!alive) return;
                console.error(err);
                setError("Failed to load growth images.");
                setLoading(false);
            });

        return () => { alive = false; clearTimeout(timeout); };
    }, [treeId]);

    useEffect(() => {
        if (frames.length > 1) {
            const timer = setInterval(() => setIndex(i => (i + 1) % frames.length), 1400);
            return () => clearInterval(timer);
        }
    }, [frames]);

    const f = frames[index];
    const frameDate = (x: any) => x ? new Date(x?.toMillis?.() ?? x).toLocaleDateString() : '';

    return (
        <Modal title="Growth Evolution" onClose={onClose}>
            {loading ? <div className="p-10 text-center">Loading Growth...</div> : (
                error ? <div className="p-10 text-center text-red-500">{error}</div> :
                !f ? <div className="p-10 text-center">No growth pictures recorded yet.</div> :
                <div className="flex flex-col items-center">
                    <div className="relative w-full">
                        <img src={f.imageUrl} className="w-full h-64 object-cover rounded-lg shadow-lg mb-4" />
                        {f.isGenesis && (
                            <span className="absolute left-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 shadow">🌱 PLANTING</span>
                        )}
                    </div>
                    <p className="text-center font-bold">{f.title}</p>
                    {f.subtitle && (
                        <p className="mt-0.5 max-w-md text-center text-xs italic text-slate-500 line-clamp-2">
                            {f.isGenesis ? `"${f.subtitle}"` : f.subtitle}
                        </p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">{frameDate(f.createdAt)}</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-1">
                        {frames.map((fr, i) => <div key={i} className={`h-1 w-4 rounded ${i === index ? (fr.isGenesis ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-200'}`} />)}
                    </div>
                </div>
            )}
        </Modal>
    );
};
