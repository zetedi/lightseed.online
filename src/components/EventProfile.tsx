import { useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { showAlert, showConfirm } from './ui/Dialog';
import { deleteCommunityEvent } from '../services/firebase';
import { SuperDot } from './ui/SuperDot';
import { Pulse, Lifetree } from '../types';
import { Icons } from './ui/Icons';
import { MahameruAvatar } from './ui/MahameruAvatar';
import { ProfileHero } from './ui/ProfileHero';
import { ProfileLayout } from './ui/ProfileLayout';
import { SectionTitle } from './ui/SectionTitle';
import { SectionMenu, SectionItem } from './ui/SectionMenu';
import { PulseInsightPanel } from './ui/PulseInsightPanel';
import { TreeParticipants } from './TreeParticipants';

// The event view, rendered through the shared profile scaffold (ProfileHero + ProfileLayout) so an
// event reads like the community / lifetree / lightseed profiles rather than a generic pulse. Events
// are pulses of type 'event'; this is the read view — editing still goes through EventModal (onEdit).
// The "Participants" section is where participating trees will land (a later step adds the data).
interface EventProfileProps {
    pulse: Pulse;
    activeTree?: Lifetree | null;
    onClose: () => void;
    canEdit?: boolean;
    onEdit?: () => void;
    currentUserId?: string;
    myTrees?: Lifetree[];
}

type EventSection = 'about' | 'participants' | 'reflect';

export const EventProfile = ({ pulse, activeTree, onClose, canEdit, onEdit, currentUserId, myTrees }: EventProfileProps) => {
    const { isAdmin, isSuperAdmin } = useSession();
    // Deletion mirrors the rules: the author may, and staff may. The amber dot marks the
    // latter — power by role, not authorship.
    const isAuthor = !!currentUserId && pulse.authorId === currentUserId;
    const canDelete = isAuthor || isAdmin || isSuperAdmin;
    const [isDeleting, setIsDeleting] = useState(false);
    const handleDelete = async () => {
        if (!(await showConfirm(`Delete the event "${pulse.title}"? This cannot be undone.`, { title: 'Delete event', confirmText: 'Delete', danger: true }))) return;
        setIsDeleting(true);
        try {
            await deleteCommunityEvent(pulse.id);
            onClose();
        } catch (e: any) {
            showAlert(e?.message || 'Could not delete the event.');
            setIsDeleting(false);
        }
    };
    const [section, setSection] = useState<EventSection>('about');
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const images = pulse.imageUrls?.length ? pulse.imageUrls : (pulse.imageUrl ? [pulse.imageUrl] : []);

    const sections: SectionItem[] = [
        { key: 'about', label: 'About', icon: <Icons.Eye /> },
        { key: 'participants', label: 'Participants', icon: <Icons.Users /> },
        { key: 'reflect', label: 'Reflect', icon: <Icons.Wizard /> },
    ];

    const whenText = pulse.eventDate ? new Date(pulse.eventDate).toLocaleString() : null;

    return (
        <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300 pb-20 bg-slate-50">
            <ProfileHero heroImageUrl={images[0]}>
                {/* Top bar — back + edit */}
                <div className="flex items-center justify-between mb-6">
                    <button onClick={onClose} className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium">
                        <Icons.ArrowLeft />
                        <span>Back</span>
                    </button>
                    <div className="flex items-center gap-2">
                        {canEdit && onEdit && (
                            <button onClick={onEdit} className="flex items-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-sky-700">
                                <Icons.Pencil /> Edit
                            </button>
                        )}
                        {canDelete && (
                            <button onClick={handleDelete} disabled={isDeleting} className="relative flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/20 px-4 py-2 text-xs font-bold text-red-200 shadow-sm transition-colors hover:bg-red-500 hover:text-white disabled:opacity-50">
                                <Icons.Trash /> Delete
                                {!isAuthor && <SuperDot />}
                            </button>
                        )}
                        <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-200">Event</span>
                    </div>
                </div>

                {/* Avatar + name + meta on one wrapping row */}
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                    <div className="flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-xl">
                        {images[0] ? (
                            <img src={images[0]} className="h-full w-full object-cover" alt={pulse.title} referrerPolicy="no-referrer" />
                        ) : (
                            <MahameruAvatar className="h-full w-full" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 justify-center sm:justify-start">
                            <h1 dir="auto" className="min-w-0 break-words text-2xl font-light tracking-wide">{pulse.title}</h1>
                            {whenText && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/40 bg-sky-400/10 px-2.5 py-0.5 text-xs font-medium text-sky-200">
                                    {whenText}
                                </span>
                            )}
                            {pulse.eventLocation && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs text-slate-200">
                                    <Icons.Map size={12} /> {pulse.eventLocation}
                                </span>
                            )}
                            {pulse.communityName && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 text-xs text-emerald-300">
                                    <Icons.Globe size={12} /> {pulse.communityName}
                                </span>
                            )}
                            {pulse.visibility && pulse.visibility !== 'public' && (
                                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{pulse.visibility}</span>
                            )}
                        </div>
                        {pulse.authorName && <p className="mt-1 text-xs text-slate-300 text-center sm:text-left">Hosted by {pulse.authorName}</p>}
                    </div>
                </div>
            </ProfileHero>

            <ProfileLayout
                overlapClassName="-mt-8"
                menu={<SectionMenu items={sections} active={section} onSelect={(k) => setSection(k as EventSection)} />}
            >
                {section === 'about' && (
                    <div>
                        <SectionTitle title="About this event" sub="When and where it gathers, and why." />
                        {images.length > 0 && (
                            <div className="relative mb-6 h-72 w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                                <img src={images[activeImageIndex]} alt={pulse.title} className="h-full w-full object-cover" />
                                {images.length > 1 && (
                                    <div className="absolute bottom-3 left-3 right-3 flex gap-2 overflow-x-auto rounded-2xl bg-black/30 p-2 backdrop-blur-md">
                                        {images.map((url, index) => (
                                            <button
                                                key={url}
                                                onClick={() => setActiveImageIndex(index)}
                                                className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${activeImageIndex === index ? 'border-white' : 'border-white/30'}`}
                                            >
                                                <img src={url} className="h-full w-full object-cover" alt="" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {(whenText || pulse.eventLocation) && (
                            <div className="mb-6 grid gap-2 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
                                {whenText && <div><span className="font-bold">When:</span> {whenText}</div>}
                                {pulse.eventLocation && <div><span className="font-bold">Where:</span> {pulse.eventLocation}</div>}
                            </div>
                        )}
                        <p dir="auto" className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-slate-600">
                            {pulse.content || pulse.body}
                        </p>
                    </div>
                )}

                {section === 'participants' && (
                    <div>
                        <SectionTitle title="Participants" sub="The trees gathering around this event." />
                        <TreeParticipants entityId={pulse.id} currentUserId={currentUserId} myTrees={myTrees} />
                    </div>
                )}

                {section === 'reflect' && (
                    <div>
                        <SectionTitle title="Reflect" sub="Translate the event's intent and see its standing in the network." />
                        <PulseInsightPanel pulse={pulse} activeTree={activeTree} />
                    </div>
                )}
            </ProfileLayout>
        </div>
    );
};
