import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Icons } from '../ui/Icons';
import { showAlert } from '../ui/Dialog';
import { ImagePicker } from '../ui/ImagePicker';
import { useSession } from '../../contexts/SessionContext';
import { createOffering, uploadImage, getMyBeds } from '../../services/firebase';
import { offeringProblem, formatLightPrice, type OfferingKind } from '../../domain/offering';
import { RAY_UNITS } from '../../domain/light';
import type { Lifetree } from '../../types';

// OFFER FOR LIGHT — post a BED or a SERVICE priced in light (domain/offering). Creates an
// 'offering' pulse that lands on the Offerings tab. The exchange itself (a buyer's light moving
// to the offerer) is a coming rung; this is the posting side.
export const OfferModal = ({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) => {
    const { lightseed } = useSession();
    const [kind, setKind] = useState<OfferingKind>('service');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState(String(RAY_UNITS));
    const [imageUrl, setImageUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [beds, setBeds] = useState<Lifetree[]>([]);
    const [bedId, setBedId] = useState('');

    useEffect(() => {
        if (kind === 'bed' && lightseed) getMyBeds(lightseed.uid).then(setBeds).catch(() => {});
    }, [kind, lightseed]);

    // Choosing a real bed borrows its name/image so the offering wears the bed's face (done in the
    // handler, not an effect, so no synchronous setState-in-effect).
    const chooseBed = (id: string) => {
        setBedId(id);
        const bed = beds.find(b => b.id === id);
        if (bed) {
            if (!title.trim()) setTitle(bed.name);
            if (!imageUrl && (bed.latestGrowthUrl || bed.imageUrl)) setImageUrl(bed.latestGrowthUrl || bed.imageUrl || '');
        }
    };

    const priceLight = Number.parseInt(price, 10);
    const problem = offeringProblem({ kind, title, description, priceLight: Number.isFinite(priceLight) ? priceLight : NaN });

    const pickImage = async (file: File) => {
        if (!lightseed) return;
        setUploading(true);
        try { setImageUrl(await uploadImage(file, `users/${lightseed.uid}/offerings/${Date.now()}`)); }
        catch { showAlert('Could not upload the image.'); }
        setUploading(false);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lightseed || problem || saving) return;
        setSaving(true);
        try {
            const bed = beds.find(b => b.id === bedId);
            await createOffering({
                title: title.trim(),
                body: description.trim(),
                content: description.trim(),
                imageUrl,
                offeringKind: kind,
                offeringPriceLight: priceLight,
                ...(kind === 'bed' && bed ? { offeringBedId: bed.id, offeringBedName: bed.name } : {}),
                authorId: lightseed.uid,
                authorName: lightseed.displayName || 'A being',
                authorPhoto: lightseed.photoURL || undefined,
            });
            onCreated?.();
            onClose();
        } catch (err: any) { showAlert(err?.message || 'Could not create the offering.'); setSaving(false); }
    };

    return (
        <Modal title="Offer for light" onClose={onClose} wide>
            <form onSubmit={submit} className="flex flex-col gap-4">
                {/* What is offered */}
                <div className="grid grid-cols-2 gap-2">
                    {(['service', 'bed'] as OfferingKind[]).map(k => (
                        <button key={k} type="button" onClick={() => setKind(k)}
                            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-center transition-all ${kind === k ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}>
                            <span className="[&>svg]:h-5 [&>svg]:w-5">{k === 'service' ? <Icons.Drop /> : <Icons.Moon />}</span>
                            <span className="text-xs font-bold uppercase tracking-wide">{k === 'service' ? 'A service' : 'A bed'}</span>
                        </button>
                    ))}
                </div>

                {kind === 'bed' && beds.length > 0 && (
                    <select value={bedId} onChange={e => chooseBed(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                        <option value="">A bed of yours (or just describe one)</option>
                        {beds.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                )}

                <input dir="auto" value={title} onChange={e => setTitle(e.target.value)} required
                    placeholder={kind === 'bed' ? "The bed's name or place" : 'What do you offer?'}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500" />

                <textarea dir="auto" value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Describe it — what it is, when, any conditions…"
                    className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />

                {/* Price in light */}
                <label className="block">
                    <span className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
                        <span>Price in light</span>
                        <span className="text-amber-500">{formatLightPrice(Number.isFinite(priceLight) ? priceLight : 0)}</span>
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-amber-500 [&>svg]:h-4 [&>svg]:w-4"><Icons.Sun /></span>
                        <input type="number" min="1" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <span className="mt-1 block text-[10px] text-slate-400">{RAY_UNITS} light = one ray (a night's worth of witnessed care).</span>
                </label>

                <ImagePicker onImageSelect={pickImage} previewUrl={imageUrl} loading={uploading} className="h-40" />

                {problem && <p className="text-xs font-medium text-amber-600">{problem}</p>}
                <button type="submit" disabled={!!problem || saving || uploading}
                    className="w-full rounded-2xl bg-amber-500 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600 disabled:opacity-50">
                    {saving ? 'Offering…' : 'Post the offering'}
                </button>
                <p className="text-center text-[11px] text-slate-400">Others will be able to take it up with light; the exchange itself is coming soon.</p>
            </form>
        </Modal>
    );
};
