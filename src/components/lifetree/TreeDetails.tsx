import React, { useState, useEffect } from 'react';
import { showAlert } from '../ui/Dialog';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { AutocompleteInput } from '../ui/AutocompleteInput';
import { type Lifetree } from '../../types';
import { isExplicitlyValidatedTree } from '../../utils/validation';

// The details-owned slice of a save. The shell merges in the hero-owned fields (name,
// shortTitle) and writes the whole edit in one update. `locationName`/`domain` use null to
// clear the field; `createdAt` is a JS Date (Firestore stores it as a Timestamp on write).
export interface TreeDetailsUpdates {
    body: string;
    latitude: number;
    longitude: number;
    locationName: string | null;
    domain: string | null;
    visibility: 'public' | 'node' | 'private';
    createdAt?: Date;
}

interface TreeDetailsProps {
    tree: Lifetree;
    // Editing is shared with the shell: the hero edits name/shortTitle while this section
    // edits everything else, and one Save writes both.
    isEditing: boolean;
    canEdit: boolean;
    canDelete: boolean;
    isSaving: boolean;
    onSave: (updates: TreeDetailsUpdates) => void;
    onCancelEdit: () => void;
    onRequestDelete: () => void;
}

// Details section — the tree's vision, facts (steward/location/GPS/planted/validator/website/
// visibility), the edit form for them, and the map.
export const TreeDetails: React.FC<TreeDetailsProps> = ({
    tree,
    isEditing,
    canEdit,
    canDelete,
    isSaving,
    onSave,
    onCancelEdit,
    onRequestDelete,
}) => {
    const { t } = useLanguage();
    const isNature = tree.isNature;
    const hasValidationBadge = isExplicitlyValidatedTree(tree);
    const hasCoordinates = Number.isFinite(tree.latitude) && Number.isFinite(tree.longitude);
    const fieldClassName = "h-10 w-full max-w-sm rounded border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
    // Legacy trees stored coordinates as lat/lng.
    const legacy = tree as Lifetree & { lat?: number; lng?: number };

    const [editBody, setEditBody] = useState(tree.body);
    const [editLat, setEditLat] = useState<number | string>(tree.latitude || legacy.lat || 0);
    const [editLng, setEditLng] = useState<number | string>(tree.longitude || legacy.lng || 0);
    const [editLocationName, setEditLocationName] = useState(tree.locationName || '');
    const initialCreatedAt = (source: Lifetree) => {
        if (!source.createdAt) return '';
        const d = source.createdAt.toDate ? source.createdAt.toDate() : new Date(source.createdAt as unknown as string | number);
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().slice(0, 16);
    };
    const [editCreatedAt, setEditCreatedAt] = useState(() => initialCreatedAt(tree));
    const [editDomain, setEditDomain] = useState(tree.domain || '');
    const [editVisibility, setEditVisibility] = useState<'public' | 'node' | 'private'>(tree.visibility || 'public');
    const [isLocating, setIsLocating] = useState(false);
    // The component instance can be reused across trees, so reset the editor when the tree
    // changes (useState initialisers only run on mount).
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the reused editor instance when the tree changes (useState initialisers only run on mount)
        setEditVisibility(tree.visibility || 'public');
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed to the tree's identity on purpose: re-seeding on every `tree.visibility` change would clobber an in-progress edit.
    }, [tree.id]);

    const handleLocateMe = () => {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition((pos) => {
            setEditLat(pos.coords.latitude);
            setEditLng(pos.coords.longitude);
            setIsLocating(false);
        }, (err) => {
            showAlert("Location failed: " + err.message);
            setIsLocating(false);
        });
    };

    const handleSaveClick = () => {
        onSave({
            body: editBody,
            latitude: Number(editLat),
            longitude: Number(editLng),
            locationName: editLocationName.trim() || null,
            domain: editDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '') || null,
            visibility: editVisibility,
            ...(editCreatedAt && { createdAt: new Date(editCreatedAt) }),
        });
    };

    const handleCancel = () => {
        setEditBody(tree.body);
        setEditLat(tree.latitude ?? 0);
        setEditLng(tree.longitude ?? 0);
        setEditLocationName(tree.locationName || '');
        setEditDomain(tree.domain || '');
        if (tree.createdAt) setEditCreatedAt(initialCreatedAt(tree));
        onCancelEdit();
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                    <Icons.Eye />
                    <span className="ml-2">{t('vision')}</span>
                </h3>
                {isEditing ? (
                    <textarea
                        dir="auto"
                        className="w-full h-40 border border-slate-300 rounded p-2 text-lg font-serif italic text-slate-700 leading-relaxed focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                    />
                ) : (
                    <p dir="auto" className="text-lg font-serif italic text-slate-700 leading-relaxed">
                        "{tree.body}"
                    </p>
                )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{t('tree_details')}</h3>

                <div className="flex items-start gap-4 py-2 border-b border-slate-50">
                    <span className="w-24 shrink-0 text-slate-500 text-sm">{t('steward')}</span>
                    <span dir="ltr" className="flex-1 text-left text-slate-800 font-mono text-sm">{isNature ? "Nature (System)" : tree.ownerId.substring(0, 10) + "..."}</span>
                </div>
                <div className="flex items-center gap-4 py-2 border-b border-slate-50">
                    <span className="w-24 shrink-0 text-slate-500 text-sm">{t('location')}</span>
                    {isEditing ? (
                        <input
                            type="text"
                            className={fieldClassName}
                            value={editLocationName}
                            onChange={e => setEditLocationName(e.target.value)}
                            placeholder="Location name"
                        />
                    ) : (
                        <span dir="auto" className="flex-1 text-left text-slate-800 font-mono text-sm">{tree.locationName}</span>
                    )}
                </div>
                <div className="py-2 border-b border-slate-50">
                    <div className="flex items-start gap-4">
                    <span className="w-24 shrink-0 pt-2 text-slate-500 text-sm">GPS</span>
                    {isEditing ? (
                        <div className="flex w-full max-w-sm space-x-2 items-center">
                            <div className="flex-1 flex space-x-2">
                                <input
                                    type="number" step="any"
                                    className={fieldClassName}
                                    value={editLat}
                                    onChange={e => setEditLat(e.target.value)}
                                    placeholder="Lat"
                                />
                                <input
                                    type="number" step="any"
                                    className={fieldClassName}
                                    value={editLng}
                                    onChange={e => setEditLng(e.target.value)}
                                    placeholder="Lng"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleLocateMe}
                                disabled={isLocating}
                                className="bg-emerald-100 text-emerald-600 p-2 rounded hover:bg-emerald-200 disabled:opacity-50"
                                title="Use My Location"
                            >
                                {isLocating ? <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div> : <Icons.Loc />}
                            </button>
                        </div>
                    ) : (
                        <span className="flex-1 pt-2 text-left text-slate-800 font-mono text-sm">{tree.latitude?.toFixed(4)}, {tree.longitude?.toFixed(4)}</span>
                    )}
                    </div>
                </div>
                <div className="flex items-center gap-4 py-2 border-b border-slate-50">
                    <span className="w-24 shrink-0 text-slate-500 text-sm">Planted</span>
                    {isEditing ? (
                        <input
                            type="datetime-local"
                            className={fieldClassName}
                            value={editCreatedAt}
                            onChange={e => setEditCreatedAt(e.target.value)}
                        />
                    ) : (
                        <span className="flex-1 text-left text-slate-800 font-mono text-sm">
                            {tree.createdAt?.toDate ? tree.createdAt.toDate().toLocaleString() : '—'}
                        </span>
                    )}
                </div>
                 <div className="flex items-start gap-4 py-2">
                    <span className="w-24 shrink-0 text-slate-500 text-sm">Validator</span>
                    <span className="flex-1 text-left text-slate-800 font-mono text-sm">
                        {isNature ? 'Nature' : hasValidationBadge && tree.validatorId ? `${tree.validatorId.substring(0, 8)}...` : t('unvalidated')}
                    </span>
                </div>
                 <div className="flex items-center gap-4 py-2">
                    <span className="w-24 shrink-0 text-slate-500 text-sm">Website</span>
                    {isEditing ? (
                        <AutocompleteInput
                            label="Community Hub"
                            value={editDomain}
                            onChange={setEditDomain}
                            placeholder="e.g. mycommunity.com"
                            className={fieldClassName}
                        />
                    ) : (
                        tree.domain
                            ? <a href={`https://${tree.domain}`} target="_blank" rel="noreferrer" className="flex-1 text-left text-emerald-600 text-sm hover:underline font-mono">{tree.domain}</a>
                            : <span className="flex-1 text-left text-slate-400 text-sm">—</span>
                    )}
                </div>
                <div className="flex items-center gap-4 py-2 border-t border-slate-50">
                    <span className="w-24 shrink-0 text-slate-500 text-sm">{t('visibility')}</span>
                    {isEditing && canEdit ? (
                        <select value={editVisibility} onChange={e => setEditVisibility(e.target.value as 'public' | 'node' | 'private')} className={fieldClassName}>
                            <option value="public">{t('vis_public')}</option>
                            <option value="node">{t('vis_node')}</option>
                            <option value="private">{t('vis_private')}</option>
                        </select>
                    ) : (
                        <span className="flex-1 text-left text-slate-800 text-sm capitalize">{tree.visibility || 'public'}</span>
                    )}
                </div>

                {isEditing && (
                    <div className="flex space-x-2 mt-4 pt-4 border-t border-slate-100">
                        <button onClick={handleSaveClick} disabled={isSaving} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-emerald-700">
                            {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                        <button onClick={handleCancel} disabled={isSaving} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-bold hover:bg-slate-300">
                            Cancel
                        </button>
                    </div>
                )}
                {isEditing && canDelete && (
                    <button type="button" onClick={onRequestDelete} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-100">
                        <Icons.Trash />
                        <span>Delete this Lifetree</span>
                    </button>
                )}
            </div>

            {hasCoordinates && (
                <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Map</h4>
                        {tree.locationName && <span dir="auto" className="text-xs text-emerald-700">{tree.locationName}</span>}
                    </div>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                        <iframe
                            title={`Map of ${tree.name}`}
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(tree.longitude) - 0.01}%2C${Number(tree.latitude) - 0.01}%2C${Number(tree.longitude) + 0.01}%2C${Number(tree.latitude) + 0.01}&layer=mapnik&marker=${Number(tree.latitude)}%2C${Number(tree.longitude)}`}
                            className="h-40 w-full"
                            loading="lazy"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
