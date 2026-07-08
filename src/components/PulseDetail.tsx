import { useState } from 'react';
import { Pulse, Lifetree } from '../types';
import { Icons } from './ui/Icons';
import { ProfileHero } from './ui/ProfileHero';
import { PulseInsightPanel } from './ui/PulseInsightPanel';

// The generic pulse view — a PROFILE, not a modal: the same ProfileHero + full-page scaffold as
// VisionProfile / EventProfile / AlignmentView, so every entity (tree, vision, event, alignment,
// pulse) opens into one profile anatomy (Indra's net). It still renders inside App's
// DetailWrapper overlay, so it keeps its own full-page slate background.

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
            {/* Hero — back button + type/status chips, then avatar + title + meta. */}
            <ProfileHero heroImageUrl={images[0]}>
                <div className="flex items-center justify-between mb-6">
                    <button onClick={onClose} className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium">
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
                            <span className="flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">
                                💧 {pulse.wateringConfirmedBy === 'ai' ? 'Confirmed by AI' : pulse.wateringConfirmedBy === 'guardian' ? 'Confirmed by guardian' : 'Awaiting confirmation'}
                            </span>
                        )}
                        {/* Type badge — the pulse's kind, worn as the status chip. */}
                        <span className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-200">
                            <Icons.Hash /> {pulse.type}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-5">
                    <div className="flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-emerald-50 text-emerald-500 shadow-xl">
                        {images[0]
                            ? <img src={images[0]} className="h-full w-full object-cover" alt={pulse.title} referrerPolicy="no-referrer" />
                            : <Icons.Lightning />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 dir="auto" className="min-w-0 break-words text-2xl font-light tracking-wide">{pulse.title}</h1>
                        <p className="mt-1 text-xs text-slate-300">
                            By {pulse.authorName}
                        </p>
                        {/* Spacetime — the WHEN (date + time) every pulse carries, and the WHERE when it has one. */}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 font-mono text-[10px] text-slate-300">
                                {new Date(pulse.createdAt?.toMillis()).toLocaleString()}
                            </span>
                            {pulse.eventLocation && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 font-mono text-[10px] text-slate-300">
                                    <Icons.Loc /> {pulse.eventLocation}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </ProfileHero>

            {/* Body — the pulse itself: images, event/watering context, and the text. */}
            <div className="mx-auto mt-6 max-w-3xl px-4 sm:px-6">
                <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-6 shadow-lg">
                    {images.length > 0 && (
                        <div className="relative mb-6 h-96 w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm group">
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

                {/* AI Translation & Network Coherence — kept whole, in its own card below the body. */}
                <div className="mt-6">
                    <PulseInsightPanel pulse={pulse} activeTree={activeTree} />
                </div>
            </div>
        </div>
    );
}
