import { useEffect, useState } from 'react';
import { Modal, modalButton } from '../ui/Modal';
import { Icons } from '../ui/Icons';
import { showAlert } from '../ui/Dialog';
import { ImagePicker } from '../ui/ImagePicker';
import { useSession } from '../../contexts/SessionContext';
import { createOffering, updateOffering, uploadImage, getMyBeds } from '../../services/firebase';
import { offeringProblem, type OfferingKind } from '../../domain/offering';
import { formatLight, RAY_UNITS } from '../../domain/light';
import { tabTone } from '../../utils/tabTheme';
import type { Lifetree, Pulse } from '../../types';
import { speak, spokenLine } from '../../utils/translations';
import { useLanguage } from '../../contexts/LanguageContext';

// MAKE AN OFFERING — post a BED or SERVICE through trust, with light named only as the hoped-for
// appreciation AFTER someone receives it (domain/offering). It creates an offering pulse on the
// one ledger, born ACTIVE (the author may pause it later from its profile). The form wears the
// heart's green (the offerings destination tone); only the light itself stays golden.
// `offering` puts the form in EDIT mode: the same words, face, appreciation and door, retold.
// The kind (and any bed it stands for) is frozen there, in the form and in the rules alike.
export const OfferModal = ({ onClose, onCreated, offering, onSaved }: {
    onClose: () => void;
    onCreated?: () => void;
    offering?: Pulse | null;
    onSaved?: (updates: Partial<Pulse>) => void;
}) => {
    const { lightseed } = useSession();
    const { t } = useLanguage();
    const editing = !!offering;
    const [kind, setKind] = useState<OfferingKind>(offering?.offeringKind || 'service');
    const [title, setTitle] = useState(offering?.title || '');
    const [description, setDescription] = useState(offering?.content || offering?.body || '');
    const [appreciation, setAppreciation] = useState(String(offering?.offeringAppreciationLight ?? RAY_UNITS));
    const [url, setUrl] = useState(offering?.offeringUrl || '');
    const [imageUrl, setImageUrl] = useState(offering?.imageUrl || '');
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [beds, setBeds] = useState<Lifetree[]>([]);
    const [bedId, setBedId] = useState('');

    const HEART = tabTone('offerings');

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

    // Preserve fractions/invalid input for the domain validator; parseInt would silently turn
    // "10.5" into 10 and bypass the whole-light rule.
    const suggestedAppreciationLight = Number(appreciation);
    const problem = offeringProblem({
        kind,
        title,
        description,
        suggestedAppreciationLight: Number.isFinite(suggestedAppreciationLight) ? suggestedAppreciationLight : NaN,
        url,
    });

    const pickImage = async (file: File) => {
        if (!lightseed) return;
        setUploading(true);
        try { setImageUrl(await uploadImage(file, `users/${lightseed.uid}/offerings/${Date.now()}`)); }
        catch { showAlert('err_image_upload'); }
        setUploading(false);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lightseed || problem || saving) return;
        setSaving(true);
        const detailUrl = url.trim();
        if (editing && offering) {
            // Retell it: only the fields the rules allow, and offeringUrl cleared honestly when emptied.
            const updates = {
                title: title.trim(),
                body: description.trim(),
                content: description.trim(),
                imageUrl,
                offeringAppreciationLight: suggestedAppreciationLight,
                offeringUrl: detailUrl,
            };
            try {
                await updateOffering(offering.id, updates);
                onSaved?.(updates);
                onClose();
            } catch (err: any) { showAlert(err?.message || 'err_offering_save'); setSaving(false); }
            return;
        }
        try {
            const bed = beds.find(b => b.id === bedId);
            await createOffering({
                title: title.trim(),
                body: description.trim(),
                content: description.trim(),
                imageUrl,
                offeringKind: kind,
                offeringAppreciationLight: suggestedAppreciationLight,
                offeringActive: true,
                ...(detailUrl ? { offeringUrl: detailUrl } : {}),
                ...(kind === 'bed' && bed ? { offeringBedId: bed.id, offeringBedName: bed.name } : {}),
                authorId: lightseed.uid,
                authorName: lightseed.displayName || 'A being',
                authorPhoto: lightseed.photoURL || undefined,
            });
            onCreated?.();
            onClose();
        } catch (err: any) { showAlert(err?.message || 'err_offering_create'); setSaving(false); }
    };

    const field = 'w-full rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600';

    return (
        <Modal title={editing ? t('offer_retell') : t('offer_make')} onClose={onClose} wide>
            <form onSubmit={submit} className="flex flex-col gap-4">
                {/* What is offered */}
                <div className="grid grid-cols-2 gap-2">
                    {(['service', 'bed'] as OfferingKind[]).map(k => (
                        <button key={k} type="button" onClick={() => !editing && setKind(k)} disabled={editing}
                            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-center transition-all ${kind === k ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}>
                            <span className="[&>svg]:h-5 [&>svg]:w-5">{k === 'service' ? <Icons.Drop /> : <Icons.Moon />}</span>
                            <span className="text-xs font-bold uppercase tracking-wide">{k === 'service' ? t('offer_service') : t('offer_bed')}</span>
                        </button>
                    ))}
                </div>

                {!editing && kind === 'bed' && beds.length > 0 && (
                    <select value={bedId} onChange={e => chooseBed(e.target.value)} className={`${field} h-11 px-3`}>
                        <option value="">{t('offer_bed_pick')}</option>
                        {beds.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                )}

                <input dir="auto" value={title} onChange={e => setTitle(e.target.value)} required
                    placeholder={kind === 'bed' ? t('offer_title_bed_ph') : t('offer_title_service_ph')}
                    className={`${field} h-11 px-3 font-medium`} />

                <textarea dir="auto" value={description} onChange={e => setDescription(e.target.value)}
                    placeholder={t('offer_desc_ph')}
                    className={`${field} min-h-24 p-3`} />

                {/* An optional door to more detail: a booking page, a menu, the offerer's site. */}
                <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">{t('offer_detail_link')}</span>
                    <input dir="ltr" type="url" inputMode="url" value={url} onChange={e => setUrl(e.target.value)}
                        placeholder="https://…"
                        className={`${field} h-11 px-3`} />
                </label>

                {/* Suggested appreciation: trust admits first; light may follow afterward.
                    The light itself keeps its golden voice inside the green form. */}
                <label className="block">
                    <span className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
                        <span>{t('offer_suggested')}</span>
                        <span className="text-amber-500">{formatLight(Number.isFinite(suggestedAppreciationLight) ? suggestedAppreciationLight : 0)}</span>
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-amber-500 [&>svg]:h-4 [&>svg]:w-4"><Icons.Sun /></span>
                        <input type="number" min="1" inputMode="numeric" value={appreciation} onChange={e => setAppreciation(e.target.value)}
                            className={`${field} h-11 px-3`} />
                    </div>
                    <span className="mt-1 block text-[10px] text-slate-400">{speak(spokenLine('offer_light_note', { units: RAY_UNITS }))}</span>
                </label>

                <ImagePicker onImageSelect={pickImage} previewUrl={imageUrl} loading={uploading} className="h-40" />

                {problem && <p className="text-xs font-medium text-rose-600">{speak(problem)}</p>}
                <button type="submit" disabled={!!problem || saving || uploading}
                    className={modalButton('primary', { extra: 'hover:brightness-110' })}
                    style={{ backgroundColor: HEART, boxShadow: '0 10px 15px -3px rgba(41,132,66,0.25)' }}>
                    {saving ? t('saving') : editing ? t('offer_save') : t('offer_post')}
                </button>
                <p className="text-center text-[11px] text-slate-400">{t('offer_trust_note')}</p>
            </form>
        </Modal>
    );
};
