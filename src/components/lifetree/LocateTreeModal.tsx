import React, { useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Modal, ModalActions, modalButton } from '../ui/Modal';
import { LocationPicker } from '../ui/LocationPicker';
import { readPhotoProvenance } from '../../utils/exif';

// LOCATE THE TREE (2026-11-16). Two different questions used to hide behind one pin: WHERE AM I
// (the device's own fix — right when the keeper stands at the tree) and WHERE WAS THE PICTURE
// TAKEN (the place the camera wrote into a photo — right when the keeper is at home with the
// photo). They are two hands here, and neither writes anything by itself: the found place is
// shown on a map, may be nudged by a tap, and enters the edit form only on "Use this place".
// The tree's stored picture keeps no EXIF (the crop re-encodes it), so the picture hand reads
// either the planting photo's place the tree already carries (domain/exif plantedPlaceOf) or
// a photo the keeper chooses from the device (utils/exif, the original bytes).
type Source = 'me' | 'picture' | 'planting';
interface Found { latitude: number; longitude: number; source: Source; takenAtMs?: number }

interface LocateTreeModalProps {
    plantedPlace: { latitude: number; longitude: number } | null;
    onUse: (place: { latitude: number; longitude: number }) => void;
    onClose: () => void;
}

export const LocateTreeModal: React.FC<LocateTreeModalProps> = ({ plantedPlace, onUse, onClose }) => {
    const { t } = useLanguage();
    const [found, setFound] = useState<Found | null>(null);
    const [busy, setBusy] = useState<'me' | 'picture' | null>(null);
    const [problem, setProblem] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const locateMe = () => {
        setProblem(null);
        if (!('geolocation' in navigator)) { setProblem(t('locate_me_failed')); return; }
        setBusy('me');
        navigator.geolocation.getCurrentPosition(
            (pos) => { setFound({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, source: 'me' }); setBusy(null); },
            () => { setProblem(t('locate_me_failed')); setBusy(null); },
            { enableHighAccuracy: true, timeout: 15000 },
        );
    };

    const locatePicture = async (file: File | undefined) => {
        if (!file) return;
        setProblem(null);
        setBusy('picture');
        try {
            const place = await readPhotoProvenance(file);
            if (place) setFound({ latitude: place.latitude, longitude: place.longitude, source: 'picture', takenAtMs: place.takenAtMs });
            else setProblem(t('locate_no_place_in_photo'));
        } catch {
            setProblem(t('locate_no_place_in_photo'));
        } finally {
            setBusy(null);
            if (fileRef.current) fileRef.current.value = ''; // the same photo may be chosen again
        }
    };

    const hand = 'flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800';
    const handIcon = 'mt-0.5 shrink-0 rounded-full bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';
    const spinner = <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />;
    const sourceLabel = found ? t(found.source === 'me' ? 'locate_found_me' : found.source === 'planting' ? 'locate_planting_photo' : 'locate_found_picture') : '';

    return (
        <Modal onClose={onClose} title={t('locate_tree')}>
            <div className="space-y-3 p-4">
                <button type="button" className={hand} onClick={locateMe} disabled={busy !== null}>
                    <span className={handIcon}>{busy === 'me' ? spinner : <Icons.Loc />}</span>
                    <span>
                        <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{t('locate_me')}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{t('locate_me_hint')}</span>
                    </span>
                </button>
                <button type="button" className={hand} onClick={() => fileRef.current?.click()} disabled={busy !== null}>
                    <span className={handIcon}>{busy === 'picture' ? spinner : <Icons.Camera />}</span>
                    <span>
                        <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{t('locate_picture')}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{t('locate_picture_hint')}</span>
                    </span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { void locatePicture(e.target.files?.[0]); }} />
                {plantedPlace && (
                    <button type="button" disabled={busy !== null}
                        className="w-full rounded-xl px-3 py-2 text-left text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                        onClick={() => { setProblem(null); setFound({ ...plantedPlace, source: 'planting' }); }}>
                        {t('locate_planting_photo')} · <span className="font-mono">{plantedPlace.latitude.toFixed(5)}, {plantedPlace.longitude.toFixed(5)}</span>
                    </button>
                )}
                {problem && <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{problem}</p>}
                {found && (
                    <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800" aria-live="polite">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {sourceLabel}
                            {found.takenAtMs !== undefined && <> · {t('locate_taken_at').replace('{when}', new Date(found.takenAtMs).toLocaleString())}</>}
                        </p>
                        <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">{found.latitude.toFixed(6)}, {found.longitude.toFixed(6)}</p>
                        <LocationPicker
                            value={{ latitude: found.latitude, longitude: found.longitude }}
                            onChange={(c) => setFound(f => (f ? { ...f, latitude: c.latitude, longitude: c.longitude } : f))}
                            className="h-40 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                        />
                        <p className="text-xs text-slate-400">{t('locate_adjust_hint')}</p>
                    </div>
                )}
                <ModalActions>
                    <button type="button" className={modalButton('secondary')} onClick={onClose}>{t('cancel')}</button>
                    <button type="button" className={modalButton('primary')} disabled={!found}
                        onClick={() => { if (found) { onUse({ latitude: found.latitude, longitude: found.longitude }); onClose(); } }}>
                        {t('locate_use')}
                    </button>
                </ModalActions>
            </div>
        </Modal>
    );
};
