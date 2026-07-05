import React, { useState } from 'react';
import { Pulse, Lifetree } from '../types';
import { Icons } from './ui/Icons';
import { PulseInsightPanel } from './ui/PulseInsightPanel';

interface PulseDetailProps {
    pulse: Pulse;
    activeTree?: Lifetree | null;
    onClose: () => void;
    backLabel?: string;
    canEdit?: boolean;
    onEdit?: () => void;
}

export const PulseDetail = ({ pulse, activeTree, onClose, backLabel = "Back", canEdit, onEdit }: PulseDetailProps) => {
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const images = pulse.imageUrls?.length ? pulse.imageUrls : (pulse.imageUrl ? [pulse.imageUrl] : []);

    return (
        <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300 pb-20 bg-slate-50">
             {/* Header */}
             <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4 flex items-center justify-between">
                <button onClick={onClose} className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-medium">
                    <Icons.ArrowLeft />
                    <span>{backLabel}</span>
                </button>
                <div className="flex items-center gap-2">
                    {pulse.type === 'event' && canEdit && onEdit && (
                        <button onClick={onEdit} className="flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-sky-700">
                            <Icons.Pencil /> Edit
                        </button>
                    )}
                    {pulse.care === 'watering' && (
                        <span className="bg-sky-100 text-sky-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            💧 {pulse.wateringConfirmedBy === 'ai' ? 'Confirmed by AI' : pulse.wateringConfirmedBy === 'guardian' ? 'Confirmed by guardian' : 'Awaiting confirmation'}
                        </span>
                    )}
                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <Icons.Hash /> {pulse.type}
                    </span>
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* Left Column: Visuals & Raw Pulse */}
                 <div className="space-y-6">
                    {images.length > 0 && (
                        <div className="relative h-96 w-full rounded-2xl overflow-hidden shadow-2xl bg-white border border-slate-100 group">
                            <img src={images[activeImageIndex]} alt={pulse.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            {images.length > 1 && (
                                <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto rounded-2xl bg-black/30 p-2 backdrop-blur-md">
                                    {images.map((url, index) => (
                                        <button
                                            key={url}
                                            onClick={() => setActiveImageIndex(index)}
                                            className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 ${activeImageIndex === index ? 'border-white' : 'border-white/30'}`}
                                        >
                                            <img src={url} className="h-full w-full object-cover" alt="" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Metadata Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h1 dir="auto" className="text-2xl font-bold text-slate-800 mb-2">{pulse.title}</h1>
                        <div className="flex items-center space-x-2 text-sm text-slate-500 mb-4">
                             <span>By {pulse.authorName}</span>
                             <span>•</span>
                             <span>{new Date(pulse.createdAt?.toMillis()).toLocaleDateString()}</span>
                        </div>
                        {pulse.type === 'event' && (
                            <div className="mb-4 grid gap-2 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
                                {pulse.eventDate && <div><span className="font-bold">When:</span> {new Date(pulse.eventDate).toLocaleString()}</div>}
                                {pulse.eventLocation && <div><span className="font-bold">Where:</span> {pulse.eventLocation}</div>}
                            </div>
                        )}
                        {pulse.care === 'watering' && (
                            <div className="mb-4 grid gap-1.5 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
                                <div className="flex items-center gap-2 font-bold"><Icons.Droplet size={16} /> <span>Watering</span></div>
                                {/* The AI's reading — a witness, not the authority. */}
                                {typeof pulse.wateringConfirmation?.confidence === 'number' && (
                                    <div className="text-xs text-sky-800/90">
                                        <span className="font-semibold">AI reading:</span> {pulse.wateringConfirmation.confidence}% consistent with watering
                                        {pulse.wateringConfirmation?.note && <span className="italic"> — “{pulse.wateringConfirmation.note}”</span>}
                                    </div>
                                )}
                                {/* The human reading — who says "yes, this was tended". */}
                                <div className="text-xs text-sky-800/90">
                                    <span className="font-semibold">Tended:</span>{' '}
                                    {pulse.wateringConfirmedBy === 'guardian'
                                        ? 'confirmed by a guardian'
                                        : pulse.wateringConfirmedBy === 'ai'
                                            ? 'auto-accepted on the AI reading — a guardian can still confirm'
                                            : 'awaiting a guardian’s confirmation'}
                                </div>
                            </div>
                        )}
                        <p dir="auto" className="text-slate-600 leading-relaxed whitespace-pre-wrap font-serif text-lg">
                            {pulse.content || pulse.body}
                        </p>
                    </div>
                 </div>

                 {/* Right Column: AI Translation & Network Coherence */}
                 <PulseInsightPanel pulse={pulse} activeTree={activeTree} />
            </div>
        </div>
    );
}
