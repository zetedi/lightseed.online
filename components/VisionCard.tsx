
import React from 'react';
import { type Vision } from '../types';
import { Icons } from './ui/Icons';
import { DefaultCardImage } from './ui/DefaultCardImage';

export const VisionCard = ({ vision }: { vision: Vision }) => {
    // "Root Vision" is a generic auto-generated name — show the actual vision text instead.
    const isRoot = (vision.title || '').trim().toLowerCase() === 'root vision';
    const heading = (isRoot ? (vision.body || vision.description) : vision.title) || 'Vision';
    const subtext = isRoot ? (vision.description || '') : (vision.body || '');
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300 group">
            <div className="relative h-36 bg-amber-50 overflow-hidden">
                {vision.imageUrl ? (
                    <img src={vision.imageUrl} alt={heading} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                    <DefaultCardImage />
                )}

                {/* Author avatar — the soul this vision grows from. */}
                {vision.authorId && (
                    <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(vision.authorId.slice(0, 2))}&background=f59e0b&color=fff`}
                        alt="" title={vision.authorId}
                        className="absolute top-2 left-2 z-10 h-8 w-8 rounded-full border-2 border-white/80 shadow-md"
                    />
                )}

                {/* Title Overlay */}
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
            <div className="p-3">
                <p dir="auto" className="text-slate-600 text-xs font-light italic leading-relaxed truncate">
                    {subtext ? `"${subtext}"` : ' '}
                </p>
                {/* Matches layout height roughly by having same p-3 */}
            </div>
        </div>
    );
}
