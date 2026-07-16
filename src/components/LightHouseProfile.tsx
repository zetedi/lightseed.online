import { useEffect, useState } from 'react';
import { Icons } from './ui/Icons';
import { ProfileHero } from './ui/ProfileHero';
import { ProfileLayout } from './ui/ProfileLayout';
import { SectionMenu, SectionItem } from './ui/SectionMenu';
import { SectionTitle } from './ui/SectionTitle';
import { SuperDot } from './ui/SuperDot';
import { showAlert, showConfirm } from './ui/Dialog';
import { BeingQr } from './ui/BeingQr';
import { mintBeingQr } from '../services/firebase/beings';
import { getCommunityById, updateLightHouse, getLifetreeById, requestStay, getStaysForHost, getMyStays, setStayStatus, withdrawStay } from '../services/firebase';
import { stayRequestProblem, type Stay } from '../domain/stay';
import { useSession } from '../contexts/SessionContext';
import { firestoreStore } from '../adapters/firestore';
import { LocationPicker } from './ui/LocationPicker';
import { announce } from '../services/refreshBus';
import { notify } from './ui/Toast';
import { lightHouseVisibility, type LightHouse, type LightHouseVisibility } from '../domain/lightHouse';
import type { Community, Lifetree } from '../types';

// The Light House's own page — the shared profile anatomy (ProfileHero + ProfileLayout), so a
// sacred place opens like every other being: from its map marker, or from a community's
// LightHouses tab. Two sections: About (the story, the 3D door, the visibility chips) and
// Communities — the mirror of the community profile: which houses this Light House holds.

type LightHouseSection = 'about' | 'communities' | 'tree' | 'beds';

interface LightHouseProfileProps {
    lightHouse: LightHouse;
    onClose: () => void;
    backLabel?: string;
    canEdit?: boolean;
    // True when canEdit comes from staff privilege rather than being the keeper (amber dot).
    editIsStaffOnly?: boolean;
    onSetVisibility?: (id: string, visibility: LightHouseVisibility) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    onViewCommunity?: (community: Community) => void;
    onViewTree?: (tree: Lifetree) => void;
}

export const LightHouseProfile = ({ lightHouse, onClose, backLabel = 'Back', canEdit = false, editIsStaffOnly = false, onSetVisibility, onDelete, onViewCommunity, onViewTree }: LightHouseProfileProps) => {
    const visibility = lightHouseVisibility(lightHouse);
    const [section, setSection] = useState<LightHouseSection>('about');

    // The place, editable by keepers: tap the map (or refine the name), then save.
    const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
        Number.isFinite(lightHouse.latitude) && Number.isFinite(lightHouse.longitude)
            ? { latitude: lightHouse.latitude!, longitude: lightHouse.longitude! }
            : null,
    );
    const [placeName, setPlaceName] = useState(lightHouse.locationName || '');
    const [isSavingPlace, setIsSavingPlace] = useState(false);
    const placeDirty = (coords?.latitude !== lightHouse.latitude) || (coords?.longitude !== lightHouse.longitude) || placeName.trim() !== (lightHouse.locationName || '');
    const savePlace = async () => {
        if (isSavingPlace) return;
        setIsSavingPlace(true);
        try {
            await updateLightHouse(lightHouse.id, {
                latitude: coords?.latitude,
                longitude: coords?.longitude,
                locationName: placeName.trim() || undefined,
            });
            announce('lightHouses', lightHouse.id);
            notify('🌍 The Light House found its place.');
        } catch (e: any) {
            showAlert(e?.message || 'Could not save the place.');
        }
        setIsSavingPlace(false);
    };

    // The circle of communities this Light House shelters — LIN edges plus the primary,
    // resolved lazily to their documents. Belonging is links, never arrays.
    const [homes, setHomes] = useState<Community[] | null>(null);
    useEffect(() => {
        let alive = true;
        firestoreStore.linksFrom(lightHouse.id, 'shelters')
            .then(links => {
                const ids = [...new Set([...(lightHouse.communityId ? [lightHouse.communityId] : []), ...links.map(l => l.to)])];
                return Promise.all(ids.map(id => getCommunityById(id).catch(() => null)));
            })
            .then(list => { if (alive) setHomes((list || []).filter(Boolean) as Community[]); })
            .catch(() => { if (alive) setHomes([]); });
        return () => { alive = false; };
    }, [lightHouse.id, lightHouse.communityId]);

    // The tree this Light House is ROOTED IN (lightHouse __rooted__ tree) — that tree is a
    // mother tree. A Light House is never built before a tree is planted.
    const [rootTree, setRootTree] = useState<Lifetree | null>(null);
    const [rootLoaded, setRootLoaded] = useState(false);
    // The keeper roots the Light House in one of THEIR OWN lifetrees — a personal avatar,
    // never a guarded nature tree: the mother is a being who answers for it.
    const { myTrees: sessionTrees } = useSession();
    const rootCandidates = (sessionTrees || []).filter((t: Lifetree) => !t.isNature);
    const [isRooting, setIsRooting] = useState(false);
    useEffect(() => {
        let alive = true;
        firestoreStore.linksFrom(lightHouse.id, 'rooted')
            .then(async links => {
                const tid = links[0]?.to;
                const t = tid ? await getLifetreeById(tid).catch(() => null) : null;
                if (alive) { setRootTree(t); setRootLoaded(true); }
            })
            .catch(() => { if (alive) setRootLoaded(true); });
        return () => { alive = false; };
    }, [lightHouse.id]);
    const rootIn = async (tree: Lifetree) => {
        if (isRooting) return;
        setIsRooting(true);
        try {
            if (rootTree) await firestoreStore.unlink(lightHouse.id, 'rooted', rootTree.id);
            await firestoreStore.link(lightHouse.id, 'rooted', tree.id);
            setRootTree(tree);
            notify(`🌳 ${lightHouse.name} is rooted in ${tree.name} — a mother tree now.`);
        } catch (e: any) { showAlert(e?.message || 'Could not root the Light House.'); }
        setIsRooting(false);
    };

    // Beds — the physical welcome. The keeper sets the beds and answers requests; a
    // signed-in guest asks for nights. Payments join later with the care economy.
    const { lightseed } = useSession();
    const viewerUid = lightseed?.uid;
    const isKeeperViewer = !!viewerUid && lightHouse.ownerId === viewerUid;
    const [beds, setBeds] = useState<number>(lightHouse.beds || 0);
    const [bedNote, setBedNote] = useState(lightHouse.bedNote || '');
    // The saved offer — the display truth (the Light House PROP is a snapshot from the
    // opener and doesn't hear the save; this does).
    const [offer, setOffer] = useState<{ beds: number; note: string }>({ beds: lightHouse.beds || 0, note: lightHouse.bedNote || '' });
    const [isSavingBeds, setIsSavingBeds] = useState(false);
    const [stays, setStays] = useState<Stay[]>([]);
    // Captured once per mount — date validation needs a day, not a ticking clock.
    const [nowMs] = useState(() => Date.now());
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [stayNote, setStayNote] = useState('');
    const [isRequesting, setIsRequesting] = useState(false);
    useEffect(() => {
        if (!viewerUid) return;
        let alive = true;
        (isKeeperViewer ? getStaysForHost(viewerUid, lightHouse.id) : getMyStays(viewerUid, lightHouse.id))
            .then(list => { if (alive) setStays(list.sort((a, b) => a.fromDate.localeCompare(b.fromDate))); })
            .catch(() => {});
        return () => { alive = false; };
    }, [viewerUid, isKeeperViewer, lightHouse.id]);
    const saveBeds = async () => {
        if (isSavingBeds) return;
        setIsSavingBeds(true);
        try {
            const nextBeds = Math.max(0, Math.round(Number(beds) || 0));
            await updateLightHouse(lightHouse.id, {
                beds: nextBeds,
                bedNote: bedNote.trim() || undefined,
            });
            setOffer({ beds: nextBeds, note: bedNote.trim() });
            announce('lightHouses', lightHouse.id);
            notify('🛏️ Beds saved.');
        } catch (e: any) { showAlert(e?.message || 'Could not save the beds.'); }
        setIsSavingBeds(false);
    };
    const askForStay = async () => {
        if (!viewerUid || isRequesting) return;
        const problem = stayRequestProblem(fromDate, toDate, nowMs);
        if (problem) { showAlert(problem); return; }
        setIsRequesting(true);
        try {
            await requestStay(lightHouse, { uid: viewerUid, name: lightseed?.displayName || '' }, { fromDate, toDate, note: stayNote.trim() });
            setStays(prev => [...prev, { id: 'local', lightHouseId: lightHouse.id, uid: viewerUid, hostUid: lightHouse.ownerId || '', fromDate, toDate, nights: 0, status: 'requested' } as Stay]);
            setFromDate(''); setToDate(''); setStayNote('');
            notify('🌙 Your stay request is on its way to the keeper.');
        } catch (e: any) { showAlert(e?.message || 'Could not send the request.'); }
        setIsRequesting(false);
    };
    const answerStay = async (stay: Stay, status: 'accepted' | 'declined') => {
        try {
            await setStayStatus(stay.id, status);
            setStays(prev => prev.map(x => x.id === stay.id ? { ...x, status } : x));
            notify(status === 'accepted' ? `🌙 ${stay.guestName || 'The guest'} has a bed.` : 'The request was declined, gently.');
        } catch (e: any) { showAlert(e?.message || 'Could not answer the request.'); }
    };

    const sections: SectionItem[] = [
        { key: 'about', label: 'About', icon: <Icons.Sun /> },
        { key: 'tree', label: 'The Tree', icon: <Icons.Tree /> },
        { key: 'beds', label: `Beds${offer.beds > 0 ? ` (${offer.beds})` : ''}`, icon: <Icons.Moon /> },
        { key: 'communities', label: `Communities${homes && homes.length > 0 ? ` (${homes.length})` : ''}`, icon: <Icons.Globe /> },
    ];

    const handleDelete = async () => {
        if (!onDelete) return;
        if (!(await showConfirm(`Release the Light House "${lightHouse.name}"? This cannot be undone.`, { title: 'Release Light House', confirmText: 'Release', danger: true }))) return;
        try { await onDelete(lightHouse.id); } catch (e: any) { showAlert(e?.message || 'Could not release the Light House.'); }
    };

    return (
        <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300 pb-20 bg-slate-50">
            <ProfileHero heroImageUrl={lightHouse.imageUrl || '/lighthouse.webp'}>
                <div className="flex items-center justify-between mb-6">
                    <button onClick={onClose} className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium">
                        <Icons.ArrowLeft />
                        <span>{backLabel}</span>
                    </button>
                    <div className="flex items-center gap-2">
                        {canEdit && onDelete && (
                            <button onClick={handleDelete} title="Release this Light House" aria-label="Release this Light House"
                                className="relative flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-200 transition-colors hover:bg-red-500 hover:text-white">
                                <Icons.Trash /> Release
                                {editIsStaffOnly && <SuperDot />}
                            </button>
                        )}
                        <span className="flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-200">
                            <Icons.Sun /> Light House
                        </span>
                        <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-200">
                            {visibility}
                        </span>
                        <BeingQr lid={lightHouse.lid} name={lightHouse.name} savedHref={lightHouse.qr?.href}
                            canMint={canEdit}
                            onMint={(href) => mintBeingQr('lightHouses', lightHouse.id, href)}
                            className="h-8 w-8 border border-white/15 bg-white/10 text-slate-200 hover:bg-white/25 hover:text-white" />
                    </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-5">
                    <div className="flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-amber-200 bg-[#04070f] shadow-xl">
                        <img src={lightHouse.imageUrl || '/lighthouse.webp'} className="h-full w-full object-cover" alt={lightHouse.name} referrerPolicy="no-referrer" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 dir="auto" className="min-w-0 break-words text-2xl font-light tracking-wide">{lightHouse.name}</h1>
                        {lightHouse.shortTitle && <p className="mt-1 text-sm font-bold uppercase tracking-widest text-amber-300">{lightHouse.shortTitle}</p>}
                        {lightHouse.locationName && (
                            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-slate-300">
                                <Icons.Loc /> {lightHouse.locationName}
                            </p>
                        )}
                    </div>
                </div>
            </ProfileHero>

            <ProfileLayout
                menu={<SectionMenu items={sections} active={section} onSelect={(k) => setSection(k as LightHouseSection)} />}
            >
                {section === 'about' && (
                    <div className="space-y-6">
                        <SectionTitle title="About this Light House" sub="The place, its story, and its doors." />
                        {lightHouse.body ? (
                            <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-lg">
                                <p dir="auto" className="whitespace-pre-line text-justify font-serif text-lg leading-relaxed text-slate-700">{lightHouse.body}</p>
                            </div>
                        ) : (
                            <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">Its story is still unwritten.</p>
                        )}

                        {/* The 3D door — step into the Light House's Gaussian-splat scene. */}
                        {lightHouse.splatUrl && (
                            <a href={lightHouse.splatUrl} target="_blank" rel="noopener noreferrer"
                               className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow transition-colors hover:bg-amber-600">
                                Enter the Light House in 3D ✦
                            </a>
                        )}

                        {/* The place — keepers move the Light House with the map's help. */}
                        {canEdit && (
                            <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5 shadow-sm">
                                <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-amber-600">The place</h3>
                                <p className="mb-2 text-[11px] text-slate-500">Tap the map to move the Light House — it glows where you place it in the forest.</p>
                                <LocationPicker value={coords} onChange={setCoords} className="h-56 w-full overflow-hidden rounded-xl border border-amber-100 shadow-inner" />
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <input value={placeName} onChange={e => setPlaceName(e.target.value)} placeholder="Place name (e.g. The Olive Grove, Crete)"
                                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                    <button onClick={savePlace} disabled={!placeDirty || isSavingPlace}
                                        className="rounded-full bg-amber-500 px-5 py-2 text-xs font-bold text-white shadow transition-colors hover:bg-amber-600 disabled:opacity-40">
                                        {isSavingPlace ? 'Saving…' : 'Save place'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Who may see it — keepers can open it wider or draw it back, right here. */}
                        {canEdit && onSetVisibility && (
                            <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5 shadow-sm">
                                <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-amber-600">Who may see it</h3>
                                <div className="flex flex-wrap gap-2">
                                    {(['community', 'node', 'public'] as const).map(v => (
                                        <button key={v} type="button"
                                            onClick={() => { if (v !== visibility) onSetVisibility(lightHouse.id, v); }}
                                            className={`rounded-full border px-4 py-1.5 text-xs font-bold capitalize transition-all ${visibility === v ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-slate-200 bg-white text-slate-500 hover:border-amber-200'}`}>
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {section === 'tree' && (
                    <div>
                        <SectionTitle title="The Tree" sub="A Light House roots in a tree — never before one. The tree that holds it is a mother tree." />
                        {!rootLoaded ? (
                            <p className="py-8 text-center text-sm text-slate-400">Listening…</p>
                        ) : rootTree ? (
                            <div
                                onClick={onViewTree ? () => onViewTree(rootTree) : undefined}
                                role={onViewTree ? 'button' : undefined}
                                className={`flex items-center gap-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 shadow-sm ${onViewTree ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}
                            >
                                <img src={rootTree.latestGrowthUrl || rootTree.imageUrl || '/mahameru.svg'} alt="" className="h-16 w-16 shrink-0 rounded-full border-4 border-amber-300 object-cover bg-[#04070f] shadow" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-lg font-light tracking-wide text-slate-800">{rootTree.name}</p>
                                    <p className="text-[10px] font-black uppercase tracking-wide text-amber-600">☀ Mother tree — this Light House is rooted here</p>
                                </div>
                                <Icons.ArrowRight size={18} className="shrink-0 text-amber-300" />
                            </div>
                        ) : (
                            <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                                This Light House is not rooted in a tree yet.
                            </p>
                        )}

                        {/* The keeper roots (or re-roots) the Light House in one of the domain's trees. */}
                        {canEdit && rootCandidates.length > 0 && (
                            <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-amber-600">{rootTree ? 'Re-root in another tree' : 'Root this Light House in a tree'}</p>
                                <div className="space-y-2">
                                    {rootCandidates.filter(t => t.id !== rootTree?.id).map(t => (
                                        <div key={t.id} className="flex items-center gap-3 rounded-xl border border-amber-100 bg-white p-2.5">
                                            <img src={t.latestGrowthUrl || t.imageUrl || '/mahameru.svg'} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover bg-[#04070f]" />
                                            <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{t.name}</p>
                                            <button onClick={() => rootIn(t)} disabled={isRooting}
                                                className="shrink-0 rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-50">
                                                {isRooting ? 'Rooting…' : 'Root here'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {section === 'beds' && (
                    <div className="space-y-6">
                        <SectionTitle title="Beds" sub="The bed this Light House can offer." />

                        {offer.beds > 0 ? (
                            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <p className="text-sm text-slate-700">
                                    <span className="font-bold">{offer.beds}</span> bed{offer.beds === 1 ? '' : 's'}
                                </p>
                                {offer.note && <p className="mt-2 whitespace-pre-line font-serif text-sm leading-relaxed text-slate-600">{offer.note}</p>}
                                {/* The reservation path, visible: three steps from wish to pillow. */}
                                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                                    <span className="rounded-full bg-sky-50 px-2.5 py-1"><span className="font-bold text-sky-700">1</span> Ask for your nights below</span>
                                    <span className="text-slate-300">→</span>
                                    <span className="rounded-full bg-sky-50 px-2.5 py-1"><span className="font-bold text-sky-700">2</span> The keeper answers</span>
                                    <span className="text-slate-300">→</span>
                                    <span className="rounded-full bg-sky-50 px-2.5 py-1"><span className="font-bold text-sky-700">3</span> Seal the details with a Reach — payment through the existing channels</span>
                                </div>
                            </div>
                        ) : (
                            <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">No beds offered here yet.</p>
                        )}

                        {/* A guest asks for nights. */}
                        {viewerUid && !isKeeperViewer && offer.beds > 0 && (
                            <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
                                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-sky-600">Request a stay</p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                                        className="rounded-xl border border-slate-200 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" aria-label="Arrival" />
                                    <span className="text-xs text-slate-400">→</span>
                                    <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                                        className="rounded-xl border border-slate-200 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" aria-label="Departure" />
                                    {/* No availability hint for guests: stay privacy means we
                                        can't see others' bookings — the keeper answers truthfully. */}
                                </div>
                                <textarea value={stayNote} onChange={e => setStayNote(e.target.value)} placeholder="Who you are, why these nights…"
                                    className="mt-2 min-h-[70px] w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
                                <button onClick={askForStay} disabled={isRequesting}
                                    className="mt-2 rounded-full bg-sky-600 px-5 py-2 text-xs font-bold uppercase tracking-widest text-white shadow transition-colors hover:bg-sky-700 disabled:opacity-50">
                                    {isRequesting ? 'Sending…' : 'Ask for these nights'}
                                </button>
                            </div>
                        )}

                        {/* The viewer's own requests / the keeper's inbox. */}
                        {viewerUid && stays.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{isKeeperViewer ? 'Requests' : 'Your requests'}</p>
                                {stays.map(stay => (
                                    <div key={stay.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-bold text-slate-800">{isKeeperViewer ? (stay.guestName || 'A traveller') : lightHouse.name}</p>
                                            <p className="text-[11px] text-slate-500">{stay.fromDate} → {stay.toDate}{stay.note ? ` · “${stay.note}”` : ''}</p>
                                        </div>
                                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${stay.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : stay.status === 'declined' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>{stay.status}</span>
                                        {!isKeeperViewer && stay.status === 'accepted' && rootTree && onViewTree && (
                                            <button onClick={() => onViewTree(rootTree)}
                                                className="shrink-0 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-bold text-white transition-colors hover:bg-amber-600">
                                                Seal it — Reach {rootTree.name}
                                            </button>
                                        )}
                                        {isKeeperViewer && stay.status === 'requested' && (
                                            <span className="flex gap-1.5">
                                                <button onClick={() => answerStay(stay, 'accepted')} className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-500">Accept</button>
                                                <button onClick={() => answerStay(stay, 'declined')} className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50">Decline</button>
                                            </span>
                                        )}
                                        {!isKeeperViewer && stay.status === 'requested' && stay.id !== 'local' && (
                                            <button onClick={() => withdrawStay(stay.id).then(() => setStays(prev => prev.filter(x => x.id !== stay.id))).catch(() => {})}
                                                className="text-[11px] font-medium text-slate-400 hover:text-slate-600">Withdraw</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* The keeper shapes the offer. */}
                        {canEdit && (
                            <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-amber-600">The offer</p>
                                <label className="flex items-center gap-2 text-sm text-slate-600">Beds
                                    <input type="number" min={0} max={144} value={beds} onChange={e => setBeds(Number(e.target.value))}
                                        className="w-20 rounded-xl border border-slate-200 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                </label>
                                <textarea value={bedNote} onChange={e => setBedNote(e.target.value)} placeholder="What staying here is like…"
                                    className="mt-2 min-h-[70px] w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                <button onClick={saveBeds} disabled={isSavingBeds}
                                    className="mt-2 rounded-full bg-amber-500 px-5 py-2 text-xs font-bold text-white shadow transition-colors hover:bg-amber-600 disabled:opacity-50">
                                    {isSavingBeds ? 'Saving…' : 'Save the offer'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {section === 'communities' && (
                    <div>
                        <SectionTitle title="Communities" sub="The houses this Light House holds — the mirror of each community's Light Houses tab." />
                        {homes === null ? (
                            <p className="py-8 text-center text-sm text-slate-400">Listening…</p>
                        ) : homes.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                                No community has stepped into this Light House yet.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {homes.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={onViewCommunity ? () => onViewCommunity(c) : undefined}
                                        role={onViewCommunity ? 'button' : undefined}
                                        aria-label={onViewCommunity ? `Open ${c.name}` : undefined}
                                        className={`group relative h-36 overflow-hidden rounded-2xl shadow-md ring-1 ring-slate-100 ${onViewCommunity ? 'cursor-pointer transition-shadow hover:shadow-lg' : ''}`}
                                    >
                                        {c.heroImageUrl ? (
                                            <img src={c.heroImageUrl} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" alt={c.name} />
                                        ) : (
                                            <div className="absolute inset-0" style={{ backgroundColor: c.theme?.primary || '#0f766e' }} />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/5" />
                                        <div className="absolute bottom-3 left-4 right-4 flex items-center gap-3 text-white">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/30 bg-white/20 backdrop-blur">
                                                {c.logoUrl ? <img src={c.logoUrl} className="h-full w-full object-cover" alt="" /> : <Icons.Globe />}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-base font-light tracking-wide">{c.name}</span>
                                                <span className="block truncate text-[11px] text-slate-300">{c.domain}</span>
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </ProfileLayout>
        </div>
    );
};
