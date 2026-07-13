import { Icons } from './ui/Icons';
import { ProfileHero } from './ui/ProfileHero';
import { MahameruAvatar } from './ui/MahameruAvatar';
import { sanctuaryVisibility, type Sanctuary, type SanctuaryVisibility } from '../domain/sanctuary';

// The sanctuary's own page — the shared profile anatomy (ProfileHero + full-page scaffold),
// so a sacred place opens like every other being: from its map marker, or from the
// community's Sanctuary tab. Read-view; keepers also get the visibility chips here.

interface SanctuaryProfileProps {
    sanctuary: Sanctuary;
    onClose: () => void;
    backLabel?: string;
    canEdit?: boolean;
    onSetVisibility?: (id: string, visibility: SanctuaryVisibility) => Promise<void>;
}

export const SanctuaryProfile = ({ sanctuary, onClose, backLabel = 'Back', canEdit = false, onSetVisibility }: SanctuaryProfileProps) => {
    const visibility = sanctuaryVisibility(sanctuary);

    return (
        <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300 pb-20 bg-slate-50">
            <ProfileHero heroImageUrl={sanctuary.imageUrl}>
                <div className="flex items-center justify-between mb-6">
                    <button onClick={onClose} className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium">
                        <Icons.ArrowLeft />
                        <span>{backLabel}</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-200">
                            <Icons.Sun /> Sanctuary
                        </span>
                        <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-200">
                            {visibility}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-5">
                    <div className="flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-amber-200 bg-[#04070f] shadow-xl">
                        {sanctuary.imageUrl
                            ? <img src={sanctuary.imageUrl} className="h-full w-full object-cover" alt={sanctuary.name} referrerPolicy="no-referrer" />
                            : <MahameruAvatar className="h-full w-full !ring-0" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 dir="auto" className="min-w-0 break-words text-2xl font-light tracking-wide">{sanctuary.name}</h1>
                        {sanctuary.shortTitle && <p className="mt-1 text-sm font-bold uppercase tracking-widest text-amber-300">{sanctuary.shortTitle}</p>}
                        {sanctuary.locationName && (
                            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-slate-300">
                                <Icons.Loc /> {sanctuary.locationName}
                            </p>
                        )}
                    </div>
                </div>
            </ProfileHero>

            <div className="mx-auto mt-6 max-w-3xl px-4 sm:px-6 space-y-6">
                {sanctuary.body && (
                    <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-lg">
                        <p dir="auto" className="whitespace-pre-line text-justify font-serif text-lg leading-relaxed text-slate-700">{sanctuary.body}</p>
                    </div>
                )}

                {/* The 3D door — step into the sanctuary's Gaussian-splat scene. */}
                {sanctuary.splatUrl && (
                    <a href={sanctuary.splatUrl} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow transition-colors hover:bg-amber-600">
                        Enter the sanctuary in 3D ✦
                    </a>
                )}

                {/* Who may see it — keepers can open it wider or draw it back, right here. */}
                {canEdit && onSetVisibility && (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5 shadow-sm">
                        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-amber-600">Who may see it</h3>
                        <div className="flex flex-wrap gap-2">
                            {(['community', 'node', 'public'] as const).map(v => (
                                <button key={v} type="button"
                                    onClick={() => { if (v !== visibility) onSetVisibility(sanctuary.id, v); }}
                                    className={`rounded-full border px-4 py-1.5 text-xs font-bold capitalize transition-all ${visibility === v ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-slate-200 bg-white text-slate-500 hover:border-amber-200'}`}>
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
