
import { type Vision } from '../types';
import { Icons } from './ui/Icons';
import type { ListDensity } from '../hooks/useListDensity';

// Shared lift: pop on hover, and the same pop on tap-and-hold (`active:`) on mobile.
const POP = 'hover:shadow-xl hover:-translate-y-1 active:shadow-xl active:-translate-y-1 transition-all duration-300';

export const VisionCard = ({ vision, density = 'cards' }: { vision: Vision; density?: ListDensity }) => {
    // "Root Vision" is a generic auto-generated name — show the actual vision text instead.
    const isRoot = (vision.title || '').trim().toLowerCase() === 'root vision';
    const heading = (isRoot ? (vision.body || vision.description) : vision.title) || 'Vision';
    const subtext = isRoot ? (vision.description || '') : (vision.body || '');

    // Imageless visions wear Mahameru's sky — Orion over the sea of creation.
    const visionImage = vision.imageUrl || '/mahameru.svg';

    // A small square avatar: the vision's image, or the galaxy.
    const avatar = (size: string) => (
        <img src={visionImage} alt="" className={`${size} shrink-0 rounded-lg object-cover bg-[#04070f]`} />
    );

    // ROWS — avatar, heading + subtext on one line of the list.
    if (density === 'rows') {
        return (
            <div className={`flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${POP} hover:-translate-y-0.5 active:-translate-y-0.5`}>
                {avatar('h-14 w-14')}
                <div className="min-w-0 flex-1">
                    <h3 dir="auto" className="truncate text-sm font-semibold text-slate-800">{heading}</h3>
                    {subtext && <p dir="auto" className="mt-0.5 line-clamp-2 text-xs font-light italic leading-relaxed text-slate-500">"{subtext}"</p>}
                </div>
                {vision.link && <Icons.Globe className="shrink-0 text-amber-500" />}
            </div>
        );
    }

    // MINI — a half-size card.
    if (density === 'mini') {
        return (
            <div className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${POP}`}>
                <div className="h-20 overflow-hidden bg-[#04070f]">
                    <img src={visionImage} alt={heading} className="h-full w-full object-cover" />
                </div>
                <div className="p-2">
                    <h3 dir="auto" className="truncate text-xs font-semibold text-slate-800">{heading}</h3>
                </div>
            </div>
        );
    }

    // CARDS — the full card. Fixed height (matching PulseCard) so every vision in the grid is the
    // same size; the galaxy/image block stays h-36 and the quote fills the rest of the card.
    return (
        <div className={`flex h-60 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${POP} group`}>
            {/* The image (or the galaxy) carries the card, heading overlaid. */}
            <div className="relative h-36 shrink-0 bg-[#04070f] overflow-hidden">
                    <img src={visionImage} alt={heading} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />

                    {/* Author avatar — the soul this vision grows from. */}
                    {vision.authorId && (
                        <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(vision.authorId.slice(0, 2))}&background=f59e0b&color=fff`}
                            alt="" title={vision.authorId}
                            className="absolute top-2 left-2 z-10 h-8 w-8 rounded-full border-2 border-white/80 shadow-md"
                        />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none"></div>
                    <div className="absolute bottom-2 left-3 right-3 text-white pointer-events-none">
                        <h3 dir="auto" className="text-lg font-light tracking-wide line-clamp-2">{heading}</h3>
                    </div>

                    {vision.link && (
                        <a href={vision.link} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-amber-600 hover:text-amber-800 hover:scale-110 transition-all shadow-sm z-10">
                            <Icons.Globe />
                        </a>
                    )}
                </div>
            <div className="flex flex-1 flex-col p-3">
                <p dir="auto" className="text-slate-600 text-xs font-light italic leading-relaxed line-clamp-3">
                    {subtext ? `"${subtext}"` : ' '}
                </p>
            </div>
        </div>
    );
}
