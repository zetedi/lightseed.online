
import React, { useState, useEffect } from 'react';
import { type Pulse, type Lightseed } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { isPulseLoved, lovePulse } from '../services/firebase';
import { Icons } from './ui/Icons';
import { DefaultCardImage } from './ui/DefaultCardImage';

interface PulseCardProps {
    pulse: Pulse;
    lightseed: Lightseed | null;
    onMatch: (p: Pulse) => void;
    onView?: (p: Pulse) => void;
}

export const PulseCard = ({ pulse, lightseed, onMatch, onView }: PulseCardProps) => {
    const { t } = useLanguage();
    const [loved, setLoved] = useState(false);
    const [count, setCount] = useState(pulse.loveCount || 0);
    const images = pulse.imageUrls?.length ? pulse.imageUrls : (pulse.imageUrl ? [pulse.imageUrl] : []);
    const badge = pulse.type === 'event' ? 'EVENT' : pulse.type === 'GROWTH' ? 'GROWTH' : '';

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

    return (
        <div 
            onClick={() => onView && onView(pulse)}
            className={`bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 group cursor-pointer ${pulse.care === 'watering' ? 'ring-2 ring-sky-500 ring-opacity-30' : pulse.type === 'GROWTH' ? 'ring-2 ring-emerald-500 ring-opacity-20' : ''} ${pulse.type === 'event' ? 'ring-2 ring-sky-500 ring-opacity-20' : ''}`}
        >
             <div className="relative h-36 bg-slate-100 overflow-hidden group">
                 <div className="absolute top-2 right-2 z-20 flex gap-1">
                    {pulse.care === 'watering'
                        ? <span title={pulse.wateringConfirmation?.note || ''} className="bg-sky-100 text-sky-700 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">💧 {pulse.wateringConfirmedBy === 'ai' ? 'AI' : pulse.wateringConfirmedBy === 'guardian' ? 'CONFIRMED' : 'PENDING'}</span>
                        : badge && <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm ${pulse.type === 'event' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-600'}`}>{badge}</span>}
                    {images.length > 1 && <span className="bg-white/90 text-slate-600 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">{images.length} IMG</span>}
                    {pulse.isMatch && <span className="bg-sky-100 text-sky-600 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">MATCH</span>}
                 </div>

                {images.length > 0 ? (
                    <img src={images[0]} alt={pulse.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <DefaultCardImage />
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent pointer-events-none"></div>
                <div className="absolute bottom-2 left-3 right-3 text-white pointer-events-none">
                     <h3 dir="auto" className="text-sm font-bold tracking-wide truncate">{pulse.title}</h3>
                </div>
            </div>

            <div className="p-3">
                <p dir="auto" className="text-slate-600 text-xs font-light leading-relaxed truncate">
                    {pulse.type === 'event' && pulse.eventDate ? `${new Date(pulse.eventDate).toLocaleDateString()} · ${pulse.eventLocation || pulse.body}` : pulse.body}
                </p>
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center">
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
