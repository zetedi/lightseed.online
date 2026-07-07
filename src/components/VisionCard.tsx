
import React from 'react';
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

    // A small square avatar: the image, or the initial on amber (visions' tone) — no fake artwork.
    const avatar = (size: string, text: string) => vision.imageUrl
        ? <img src={vision.imageUrl} alt="" className={`${size} shrink-0 rounded-lg object-cover bg-amber-50`} />
        : <div className={`${size} flex shrink-0 items-center justify-center rounded-lg bg-amber-50 font-serif text-amber-600 ${text}`}>{heading.charAt(0).toUpperCase()}</div>;

    // ROWS — avatar, heading + subtext on one line of the list.
    if (density === 'rows') {
        return (
            <div className={`flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${POP} hover:-translate-y-0.5 active:-translate-y-0.5`}>
                {avatar('h-14 w-14', 'text-xl')}
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
                {vision.imageUrl ? (
                    <div className="h-20 overflow-hidden bg-amber-50">
                        <img src={vision.imageUrl} alt={heading} className="h-full w-full object-cover" />
                    </div>
                ) : (
                    <div className="flex h-20 items-center justify-center bg-amber-50/70 px-2 text-center">
                        <p dir="auto" className="line-clamp-3 font-serif text-[11px] italic leading-snug text-slate-500">{subtext || heading}</p>
                    </div>
                )}
                <div className="p-2">
                    <h3 dir="auto" className="truncate text-xs font-semibold text-slate-800">{heading}</h3>
                </div>
            </div>
        );
    }

    // CARDS — the full card.
    return (
        <div className={`bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden ${POP} group`}>
            {vision.imageUrl ? (
                // With an image: the photo carries the card, heading overlaid.
                <div className="relative h-36 bg-amber-50 overflow-hidden">
                    <img src={vision.imageUrl} alt={heading} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />

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
            ) : (
                // No image: the vision speaks for itself — no placeholder artwork.
                <div className="flex h-36 flex-col justify-between p-3">
                    <div className="flex items-start justify-between gap-2">
                        <h3 dir="auto" className="line-clamp-2 text-base font-semibold tracking-wide text-slate-800">{heading}</h3>
                        {vision.link && (
                            <a href={vision.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="shrink-0 rounded-full bg-amber-50 p-1.5 text-amber-600 shadow-sm transition-all hover:scale-110 hover:text-amber-800">
                                <Icons.Globe />
                            </a>
                        )}
                    </div>
                    {subtext && <p dir="auto" className="line-clamp-3 font-serif text-sm italic leading-relaxed text-slate-500">"{subtext}"</p>}
                </div>
            )}
            <div className="p-3">
                <p dir="auto" className="text-slate-600 text-xs font-light italic leading-relaxed truncate">
                    {vision.imageUrl && subtext ? `"${subtext}"` : ' '}
                </p>
            </div>
        </div>
    );
}
