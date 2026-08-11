import { useState } from 'react';
import { showAlert } from './Dialog';
import { Icons } from './Icons';
import { SuperDot } from './SuperDot';
import { useSession } from '../../contexts/SessionContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { showsPlaceOfRecord, normalizePlaceOfRecord } from '../../domain/communityDoor';

// The place-of-record stamp — every domain-stamped being (event, vision) is shown on the
// node its stamp names, and the founding-era stamps were sometimes wrong ('localhost', a
// visitor's hostname). Staff may see and mend the stamp here (amber dot: power by role, not
// authorship); on a strict-scoped host the row hides entirely — one place by definition, so
// the stamp is noise (domain/communityDoor.showsPlaceOfRecord). The mend itself is the
// caller's service write; this component holds only the law and the hands.
interface PlaceOfRecordProps {
    /** Keys the draft and the mended value — the parent view survives switching beings. */
    beingId: string;
    domain?: string;
    hostStrictScope?: boolean | null;
    onMend: (domain: string) => Promise<void>;
}

export const PlaceOfRecord = ({ beingId, domain, hostStrictScope, onMend }: PlaceOfRecordProps) => {
    const { t } = useLanguage();
    const { isAdmin, isSuperAdmin } = useSession();
    const [mendedHomes, setMendedHomes] = useState<Record<string, string>>({});
    const [edit, setEdit] = useState<{ id: string; draft: string } | null>(null);
    const [saving, setSaving] = useState(false);
    if (!showsPlaceOfRecord(isAdmin || isSuperAdmin, hostStrictScope)) return null;

    const shown = mendedHomes[beingId] ?? domain ?? '';
    const draft = edit?.id === beingId ? edit.draft : null;
    const handleSave = async () => {
        const home = normalizePlaceOfRecord(draft || '');
        if (!home) { showAlert('place_of_record_invalid'); return; }
        if (home === shown) { setEdit(null); return; }
        setSaving(true);
        try {
            await onMend(home);
            setMendedHomes(m => ({ ...m, [beingId]: home }));
            setEdit(null);
        } catch (e: any) {
            showAlert(e?.message || 'place_of_record_invalid');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{t('place_of_record')}:</span>
            {draft === null ? (
                <>
                    <span className="font-mono" dir="ltr">{shown || '—'}</span>
                    <button
                        onClick={() => setEdit({ id: beingId, draft: shown })}
                        title={t('edit')}
                        className="relative inline-flex items-center rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                    >
                        <Icons.Pencil />
                        <SuperDot />
                    </button>
                </>
            ) : (
                <>
                    <input
                        value={draft}
                        onChange={(e) => setEdit({ id: beingId, draft: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); if (e.key === 'Escape') setEdit(null); }}
                        dir="ltr"
                        autoFocus
                        className="w-56 rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-sm outline-none focus:border-emerald-400"
                    />
                    <button onClick={() => void handleSave()} disabled={saving} className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
                        {saving ? t('saving') : t('save')}
                    </button>
                    <button onClick={() => setEdit(null)} disabled={saving} className="rounded-full px-3 py-1 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-200">
                        {t('cancel')}
                    </button>
                </>
            )}
        </div>
    );
};
