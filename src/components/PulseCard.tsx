
import React, { useState, useEffect } from 'react';
import { type Pulse, type Lightseed } from '../types';
import { isPulseLoved, lovePulse } from '../services/firebase';
import { Icons } from './ui/Icons';
import type { ListDensity } from '../hooks/useListDensity';

interface PulseCardProps {
    pulse: Pulse;
    lightseed: Lightseed | null;
    onMatch: (p: Pulse) => void;
    onView?: (p: Pulse) => void;
    density?: ListDensity;
}

// The lift every card shares: a stronger pop on hover, and the same pop when tapped-and-held on
// mobile (`active:`). Imageless cards carry only their words — no placeholder artwork.
const POP = 'hover:shadow-xl hover:-translate-y-1 active:shadow-xl active:-translate-y-1 transition-all duration-300';

export const PulseCard = ({ pulse, lightseed, onMatch, onView, density = 'cards' }: PulseCardProps) => {
    const [loved, setLoved] = useState(false);
    const [count, setCount] = useState(pulse.loveCount || 0);
    const images = pulse.imageUrls?.length ? pulse.imageUrls : (pulse.imageUrl ? [pulse.imageUrl] : []);
    const badge = pulse.type === 'event' ? 'EVENT' : pulse.type === 'tree_growth' ? 'GROWTH' : '';
    const isEvent = pulse.type === 'event';
    const meta = isEvent && pulse.eventDate ? `${new Date(pulse.eventDate).toLocaleDateString()} · ${pulse.eventLocation || pulse.body}` : pulse.body;

    useEffect(() => {
        if (lightseed) isPulseLoved(pulse.id, lightseed.uid).then(setLoved);
    }, [pulse, lightseed]);

    const handleLove = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening detail view
        if (!lightseed) return;
        const newStatus = !loved;
        setLoved(newStatus);
        setCount(c => newStatus ? c + 1 : c - 1);
        await lovePulse(pulse.id, lightseed.uid);
    }

    const handleMatchClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening detail view
        onMatch(pulse);
    }

    const ringCls = pulse.care === 'watering' ? 'ring-2 ring-sky-500 ring-opacity-30' : pulse.type === 'tree_growth' ? 'ring-2 ring-emerald-500 ring-opacity-20' : isEvent ? 'ring-2 ring-sky-500 ring-opacity-20' : '';

    // The pulse's badges — shown over the image, or inline on text-only cards.
    const badges = (
        <>
            {pulse.care === 'watering'
                ? <span title={pulse.wateringConfirmation?.note || ''} className="bg-sky-100 text-sky-700 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">💧{typeof pulse.wateringConfirmation?.confidence === 'number' ? ` ${pulse.wateringConfirmation.confidence}%` : ''}{pulse.wateringConfirmedBy === 'guardian' ? ' ✓' : ''}</span>
                : badge && <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm ${isEvent ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-600'}`}>{badge}</span>}
            {images.length > 1 && <span className="bg-white/90 text-slate-600 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">{images.length} IMG</span>}
            {pulse.isMatch && <span className="bg-sky-100 text-sky-600 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">MATCH</span>}
        </>
    );

    // A small square avatar: the first image, or the initial on a soft tone (never fake artwork).
    const avatar = (size: string, text: string) => images.length > 0
        ? <img src={images[0]} alt="" className={`${size} shrink-0 rounded-lg object-cover bg-slate-100`} />
        : <div className={`${size} flex shrink-0 items-center justify-center rounded-lg font-serif ${text} ${isEvent ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600'}`}>{(pulse.title || '·').charAt(0).toUpperCase()}</div>;

    // ROWS — one line of the list: avatar, title + description, love at the right.
    if (density === 'rows') {
        return (
            <div onClick={() => onView && onView(pulse)} className={`flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${POP} hover:-translate-y-0.5 active:-translate-y-0.5 ${ringCls}`}>
                {avatar('h-14 w-14', 'text-xl')}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <h3 dir="auto" className="truncate text-sm font-semibold text-slate-800">{pulse.title}</h3>
                        {pulse.carriedByName && <p className="truncate text-[10px] italic text-purple-500">🤲 carried by {pulse.carriedByName}</p>}
                        {badges}
                    </div>
                    <p dir="auto" className="mt-0.5 line-clamp-2 text-xs font-light leading-relaxed text-slate-500">{meta}</p>
                </div>
                <button onClick={handleLove} disabled={!lightseed} className="flex shrink-0 items-center gap-1 text-slate-400 transition-colors hover:text-red-500">
                    <Icons.Heart filled={loved} /><span className="text-xs">{count}</span>
                </button>
            </div>
        );
    }

    // MINI — a half-size card: small image (or initial), title, love.
    if (density === 'mini') {
        return (
            <div onClick={() => onView && onView(pulse)} className={`cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${POP} ${ringCls}`}>
                {images.length > 0 ? (
                    <div className="relative h-20 overflow-hidden bg-slate-100">
                        <img src={images[0]} alt={pulse.title} className="h-full w-full object-cover" />
                    </div>
                ) : (
                    <div className={`flex h-20 items-center justify-center px-2 text-center ${isEvent ? 'bg-sky-50' : 'bg-emerald-50/60'}`}>
                        <p dir="auto" className="line-clamp-3 font-serif text-[11px] italic leading-snug text-slate-500">{pulse.body}</p>
                    </div>
                )}
                <div className="p-2">
                    <h3 dir="auto" className="truncate text-xs font-semibold text-slate-800">{pulse.title}</h3>
                        {pulse.carriedByName && <p className="truncate text-[10px] italic text-purple-500">🤲 carried by {pulse.carriedByName}</p>}
                    <div className="mt-1 flex items-center justify-between">
                        <button onClick={handleLove} disabled={!lightseed} className="flex items-center gap-1 text-slate-400 transition-colors hover:text-red-500">
                            <Icons.Heart filled={loved} /><span className="text-[10px]">{count}</span>
                        </button>
                        {badge && <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${isEvent ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-600'}`}>{badge}</span>}
                    </div>
                </div>
            </div>
        );
    }

    // CARDS — the full card (the original look). A fixed height so every card in the grid is the
    // same size, whatever it carries (image or words, long body or none); the top image/text block
    // stays h-36 and the love row pins to the bottom, so a text card's spare room reads as
    // breathing space rather than a ragged edge.
    return (
        <div
            onClick={() => onView && onView(pulse)}
            className={`flex h-60 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${POP} group cursor-pointer ${ringCls}`}
        >
            {images.length > 0 ? (
                // With an image: the photo carries the card, title overlaid.
                <div className="relative h-36 shrink-0 bg-slate-100 overflow-hidden group">
                    <div className="absolute top-2 right-2 z-20 flex gap-1">{badges}</div>
                    <img src={images[0]} alt={pulse.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent pointer-events-none"></div>
                    <div className="absolute bottom-2 left-3 right-3 text-white pointer-events-none">
                        <h3 dir="auto" className="text-sm font-bold tracking-wide truncate">{pulse.title}</h3>
                    </div>
                </div>
            ) : (
                // No image: let the words carry it — no placeholder artwork.
                <div className="flex h-36 shrink-0 flex-col justify-between p-3">
                    <div className="flex items-start justify-between gap-2">
                        <h3 dir="auto" className="line-clamp-2 text-base font-semibold tracking-wide text-slate-800">{pulse.title}</h3>
                        <div className="flex shrink-0 gap-1">{badges}</div>
                    </div>
                    <p dir="auto" className="line-clamp-3 font-serif text-sm italic leading-relaxed text-slate-500">{pulse.body}</p>
                </div>
            )}

            <div className="flex flex-1 flex-col p-3">
                {/* Text-only cards already show the body above — don't repeat it here. */}
                {(images.length > 0 || (isEvent && pulse.eventDate)) && (
                    <p dir="auto" className="text-slate-600 text-xs font-light leading-relaxed truncate">{meta}</p>
                )}
                <div className={`mt-auto flex items-center justify-between ${images.length > 0 || (isEvent && pulse.eventDate) ? 'pt-2 border-t border-slate-100' : ''}`}>
                    <button onClick={handleLove} disabled={!lightseed} className="flex items-center gap-1 text-slate-500 hover:text-red-500 transition-colors">
                        <Icons.Heart filled={loved} />
                        <span className="text-xs">{count}</span>
                    </button>

                    {lightseed && lightseed.uid !== pulse.authorId && !pulse.isMatch && (
                        <button onClick={handleMatchClick} className="text-[10px] bg-slate-50 text-slate-500 hover:bg-sky-50 hover:text-sky-600 px-2 py-1 rounded transition-colors flex items-center gap-1">
                            <Icons.Link /> <span>Match</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
