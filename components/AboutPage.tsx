
import React, { useState } from 'react';
import Logo from './Logo';
import { Icons } from './ui/Icons';
import { subscribeToNewsletter } from '../services/firebase';
import { Modal } from './ui/Modal';
import { useLanguage } from '../contexts/LanguageContext';

type YantraSymbolType =
    | 'yinYang'
    | 'heart'
    | 'sun'
    | 'seed'
    | 'hexagram'
    | 'shambhala'
    | 'lotus'
    | 'honeycomb'
    | 'grid'
    | 'kabbalah'
    | 'infinity'
    | 'triskelion';

const yantraSymbols: Array<{
    title: string;
    description: string;
    type: YantraSymbolType;
    link: string;
}> = [
    {
        title: 'Yin & Yang',
        description: 'Opposite and contrary forces become complementary, interconnected, and interdependent inside the same field.',
        type: 'yinYang',
        link: 'https://en.wikipedia.org/wiki/Yin_and_yang'
    },
    {
        title: 'Heart',
        description: 'The mirrored arcs of the yantra can be read as a heart form, linking the geometry directly with love.',
        type: 'heart',
        link: 'https://en.wikipedia.org/wiki/Heart_symbol'
    },
    {
        title: 'Sun & Consciousness',
        description: 'The circled dot appears as the bindu: the sun, the center of the center, and awakened consciousness.',
        type: 'sun',
        link: 'https://en.wikipedia.org/wiki/Circled_dot'
    },
    {
        title: 'Seed of Life',
        description: 'The seven-circle seed pattern implies that all life on Earth and in the Universe is interconnected.',
        type: 'seed',
        link: 'https://www.uniguide.com/seed-of-life-number-7-sacred-geometry/'
    },
    {
        title: 'Hexagram',
        description: 'Two interwoven triangles suggest Heaven and Earth meeting, with the yantra acting as the shared field between them.',
        type: 'hexagram',
        link: 'https://en.wikipedia.org/wiki/Hexagram'
    },
    {
        title: 'Shambhala',
        description: 'The yantra can also be read as a mandalic inner kingdom, a protected spiritual center ordered around one source.',
        type: 'shambhala',
        link: 'https://en.wikipedia.org/wiki/Shambhala'
    },
    {
        title: 'Sacred Lotus',
        description: 'Petal-like arcs emerge from the circle intersections, pointing to inner unfolding and the realization of potential.',
        type: 'lotus',
        link: 'https://en.wikipedia.org/wiki/Sacred_lotus_in_religious_art'
    },
    {
        title: 'Honeycomb',
        description: 'Hexagonal order appears naturally in the yantra grid, echoing nature, cooperation, and efficient structure.',
        type: 'honeycomb',
        link: 'https://en.wikipedia.org/wiki/Honeycomb'
    },
    {
        title: 'Overlapping Circles Grid',
        description: 'The larger construction is itself a circle lattice, connecting the mark to the grid of life, DNA-like patterning, and expansion beyond.',
        type: 'grid',
        link: 'https://en.wikipedia.org/wiki/Overlapping_circles_grid'
    },
    {
        title: 'Tree of Life (Kabbalah)',
        description: 'A vertical path with balanced side pillars can be traced through the inner nodes, suggesting emanation, ascent, and return.',
        type: 'kabbalah',
        link: 'https://en.wikipedia.org/wiki/Tree_of_life_(Kabbalah)'
    },
    {
        title: 'Infinity',
        description: 'The left and right loops emerge from the same central field, expressing continuity, recurrence, and the unified flow.',
        type: 'infinity',
        link: 'https://en.wikipedia.org/wiki/Infinity_symbol'
    },
    {
        title: 'Triskelion',
        description: 'Three spiraling arms can be aligned with the yantra around the center, expressing motion, cycles, and living emergence.',
        type: 'triskelion',
        link: 'https://en.wikipedia.org/wiki/Triskelion'
    }
];

const SectionHeader = ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-2xl font-light text-purple-900 mb-6 mt-12 tracking-wide flex items-center gap-3">
        {children}
    </h2>
);

const Paragraph = ({ children, className = "" }: { children?: React.ReactNode, className?: string }) => (
    <p className={`text-slate-700 leading-relaxed font-serif mb-6 text-justify text-lg ${className}`}>
        {children}
    </p>
);

// Helper to render specific geometric overlays for the Yantra section
const SymbolOverlay = ({ type }: { type: YantraSymbolType }) => {
    const commonProps = {
        viewBox: "0 0 262 262",
        className: "absolute inset-0 w-full h-full",
        fill: "none",
        stroke: "#F59E0B", // Amber-500
        strokeWidth: "3"
    };

    switch (type) {
        case 'yinYang':
            return (
                <svg {...commonProps}>
                    <path d="M131 43a88 88 0 1 1 0 176a44 44 0 1 0 0-88a44 44 0 1 1 0-88" />
                    <path d="M131 43a44 44 0 1 0 0 88a44 44 0 1 1 0 88" />
                    <circle cx="131" cy="87" r="8" fill="#F59E0B" stroke="none" />
                    <circle cx="131" cy="175" r="8" fill="#F59E0B" stroke="none" />
                    <circle cx="131" cy="131" r="88" strokeOpacity="0.55" />
                </svg>
            );
        case 'heart':
            return (
                <svg {...commonProps}>
                    <path d="M131 214C92 188 54 154 54 108C54 81 76 61 103 61C118 61 129 69 131 81C133 69 144 61 159 61C186 61 208 81 208 108C208 154 170 188 131 214Z" />
                </svg>
            );
        case 'sun': // Circled Dot
            return (
                <svg {...commonProps}>
                    <circle cx="131" cy="131" r="64" />
                    <circle cx="131" cy="131" r="6" fill="#F59E0B" stroke="none" />
                </svg>
            );
        case 'seed':
            return (
                <svg {...commonProps}>
                    <circle cx="131" cy="131" r="42" />
                    <circle cx="131" cy="89" r="42" />
                    <circle cx="167.4" cy="110" r="42" />
                    <circle cx="167.4" cy="152" r="42" />
                    <circle cx="131" cy="173" r="42" />
                    <circle cx="94.6" cy="152" r="42" />
                    <circle cx="94.6" cy="110" r="42" />
                </svg>
            );
        case 'hexagram': // Star
            return (
                <svg {...commonProps}>
                    <polygon points="131,35 214,179 48,179" />
                    <polygon points="131,227 48,83 214,83" />
                </svg>
            );
        case 'shambhala':
            return (
                <svg {...commonProps}>
                    <circle cx="131" cy="131" r="72" />
                    <circle cx="131" cy="131" r="32" strokeOpacity="0.7" />
                    <path d="M131 59V203M59 131H203M80 80L182 182M80 182L182 80" strokeLinecap="round" />
                </svg>
            );
        case 'honeycomb': // Hexagon
            return (
                <svg {...commonProps}>
                    <polygon points="131,35 214,83 214,179 131,227 48,179 48,83" />
                </svg>
            );
        case 'grid':
            return (
                <svg {...commonProps}>
                    <circle cx="131" cy="131" r="36" />
                    <circle cx="131" cy="95" r="36" />
                    <circle cx="162" cy="113" r="36" />
                    <circle cx="162" cy="149" r="36" />
                    <circle cx="131" cy="167" r="36" />
                    <circle cx="100" cy="149" r="36" />
                    <circle cx="100" cy="113" r="36" />
                </svg>
            );
        case 'infinity':
            return (
                <svg {...commonProps}>
                     <path d="M43 131c18-30 40-46 66-46c18 0 32 10 45 26c13-16 27-26 45-26c26 0 48 16 66 46c-18 30-40 46-66 46c-18 0-32-10-45-26c-13 16-27 26-45 26c-26 0-48-16-66-46Z" strokeWidth="4" />
                </svg>
            );
        case 'lotus': // Petals
            return (
                <svg {...commonProps}>
                     <path d="M131 131 Q 163 99 131 55 Q 99 99 131 131" fill="rgba(245, 158, 11, 0.15)" />
                     <path d="M131 131 Q 195 111 187 59 Q 143 71 131 131" fill="rgba(245, 158, 11, 0.15)" />
                     <path d="M131 131 Q 207 147 187 203 Q 143 191 131 131" fill="rgba(245, 158, 11, 0.15)" />
                     <path d="M131 131 Q 163 163 131 207 Q 99 163 131 131" fill="rgba(245, 158, 11, 0.15)" />
                     <path d="M131 131 Q 55 147 75 203 Q 119 191 131 131" fill="rgba(245, 158, 11, 0.15)" />
                     <path d="M131 131 Q 67 111 75 59 Q 119 71 131 131" fill="rgba(245, 158, 11, 0.15)" />
                </svg>
            );
        case 'kabbalah': // Tree structure approximation
            return (
                <svg {...commonProps}>
                    <line x1="131" y1="43" x2="131" y2="219" />
                    <line x1="87" y1="75" x2="175" y2="75" />
                    <line x1="87" y1="187" x2="175" y2="187" />
                    <line x1="87" y1="75" x2="131" y2="131" />
                    <line x1="175" y1="75" x2="131" y2="131" />
                    <line x1="87" y1="187" x2="131" y2="131" />
                    <line x1="175" y1="187" x2="131" y2="131" />
                    <circle cx="131" cy="35" r="4" fill="#F59E0B" />
                    <circle cx="87" cy="75" r="4" fill="#F59E0B" />
                    <circle cx="175" cy="75" r="4" fill="#F59E0B" />
                    <circle cx="131" cy="131" r="4" fill="#F59E0B" />
                    <circle cx="87" cy="187" r="4" fill="#F59E0B" />
                    <circle cx="175" cy="187" r="4" fill="#F59E0B" />
                    <circle cx="131" cy="227" r="4" fill="#F59E0B" />
                </svg>
            );
        case 'triskelion':
            return (
                <svg {...commonProps}>
                    <circle cx="131" cy="131" r="11" fill="#F59E0B" stroke="none" />
                    <path d="M131 131c0-31 17-55 50-71c9 24 6 45-10 62c-12 13-25 18-40 18" strokeLinecap="round" />
                    <path d="M131 131c-27 15-56 15-88 0c8-24 23-39 45-44c17-4 32-1 43 8" strokeLinecap="round" />
                    <path d="M131 131c-5 31 7 56 38 80c18-18 25-38 20-59c-4-16-13-28-28-36" strokeLinecap="round" />
                </svg>
            );
        default: 
            return null;
    }
}

const SymbolCard = ({ title, description, type, link }: { title: string, description: string, type: YantraSymbolType, link: string }) => (
    <div className="flex flex-col md:flex-row gap-6 items-center bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
        <div className="relative w-40 h-40 shrink-0 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-purple-50 shadow-inner overflow-hidden">
             <div className="absolute inset-4">
                <SymbolOverlay type={type} />
             </div>
        </div>
        <div>
            <h3 className="text-amber-600 font-bold uppercase tracking-wider mb-2">{title}</h3>
            <p className="text-slate-600 text-sm mb-3">{description}</p>
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-amber-500 flex items-center gap-1 transition-colors">
                <Icons.Link />
                <span>Read more</span>
            </a>
        </div>
    </div>
);

export const AboutPage = ({ onClose }: { onClose: () => void }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'vision' | 'phoenix' | 'sun' | 'path' | 'yantra' | 'design'>('design');
    const [showSubModal, setShowSubModal] = useState(false);
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await subscribeToNewsletter(email);
            alert(`${t('subscribed_success')} ${email}`);
            setShowSubModal(false);
        } catch (e) { alert(t('subscription_failed')); }
        setSubmitting(false);
    };

    const GENESIS_TEXT = `The purpose of lightseed is to bring joy. The joy of realizing the bliss of conscious, compassionate, grateful existence by opening a portal to the center of life. By creating a bridge between creator and creation, science and spirituality, virtual and real, nothing and everything. It is designed to intimately connect our inner Self, our culture, our trees and the tree of life, the material and the digital, online world into a sustainable and sustaining circle of unified vibration, sound and light. It aims to merge us into a common flow for all beings to be liberated, wise, strong, courageous and connected. It is rooted in nonviolence, compassion, generosity, gratitude and love. It is blockchain (truthfulness), cloud (global, distributed, resilient), ai (for connecting dreams and technology), regen (nature centric) native. It is an inspiration, an impulse towards a quantum leap in consciousness, a prompt both for human and artificial intelligence for action towards transcending humanity into a new era, a New Earth, Universe and Field with the help of our most important evolutionary sisters and brothers, the trees.`;

    const tabs = [
        { id: 'vision', label: 'The Vision', meta: 'Genesis' },
        { id: 'phoenix', label: 'Phoenix', meta: 'First lifetree' },
        { id: 'sun', label: 'The Secret Sun', meta: 'Sacred platform' },
        { id: 'path', label: 'The Path', meta: '4 steps' },
        { id: 'yantra', label: 'The Yantra', meta: 'Symbol language' },
        { id: 'design', label: 'Design Brief', meta: 'Identity system' }
    ];

    return (
        <div className="min-h-screen pb-20 bg-[#FDFCFB]">
            {/* View Page Style Sticky Header */}
            <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4 flex items-center justify-between">
                <button onClick={onClose} className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-medium">
                    <Icons.ArrowLeft />
                    <span>{t('back')}</span>
                </button>
                <a
                    href="https://github.com/zetedi/lifeseed.online"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Lifeseed GitHub repository"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:text-slate-900 hover:border-slate-300"
                >
                    <Icons.GitHub />
                    <span className="hidden sm:inline">GitHub</span>
                </a>
            </div>

            {/* Header with Bigger Logo & Less Space */}
            <div className="bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.22),_transparent_28%),linear-gradient(135deg,#2e1065_0%,#4c1d95_48%,#0f172a_100%)] text-white pt-8 pb-12 px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/bg-noise.png')] opacity-10"></div>
                <div className="absolute -top-14 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full border border-amber-200/30 bg-amber-300/10 blur-2xl"></div>
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="flex justify-center mb-4">
                        {/* Increased Logo size, reduced padding around it. Clickable to go home. */}
                        <button onClick={onClose} className="relative bg-white/10 p-2 rounded-full backdrop-blur-sm hover:bg-white/20 transition-colors cursor-pointer active:scale-95">
                            <span className="absolute inset-[-10px] rounded-full border-2 border-amber-300/70"></span>
                            <Logo width={100} height={100} />
                        </button>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-400/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.28em] text-amber-100">
                        <span className="h-2 w-2 rounded-full bg-amber-300"></span>
                        <span>.seed</span>
                    </div>
                    <h1 className="mt-4 text-3xl md:text-4xl font-light tracking-[0.16em] uppercase text-purple-50">The Light of Value</h1>
                    <p className="text-sm text-purple-200 font-mono tracking-[0.24em] uppercase mt-3 opacity-90">Vision, symbols, sacred geometry, and design language</p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-[0.18em] text-purple-100/90">
                        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">Genesis</span>
                        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">Phoenix</span>
                        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">Yantra</span>
                        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">Design</span>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs - Top adjusted for sticky header */}
            <div className="sticky top-[68px] z-40 bg-[#FDFCFB]/95 backdrop-blur border-b border-slate-200 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 py-3">
                    <div className="flex gap-3 overflow-x-auto no-scrollbar md:justify-center">
                        {tabs.map(tab => (
                            <button 
                                key={tab.id} 
                                onClick={() => setActiveTab(tab.id as any)} 
                                className={`group flex-shrink-0 min-w-[132px] rounded-2xl border px-4 py-3 text-left transition-all ${
                                    activeTab === tab.id 
                                        ? 'text-purple-950 border-purple-300 bg-white shadow-md shadow-purple-100'
                                        : 'text-slate-500 border-slate-200/80 bg-white/70 hover:text-slate-700 hover:bg-white'
                                }`}
                            >
                                <span className={`block text-[10px] font-bold uppercase tracking-[0.24em] ${activeTab === tab.id ? 'text-amber-600' : 'text-slate-400 group-hover:text-amber-500'}`}>
                                    {tab.meta}
                                </span>
                                <span className="mt-1 block text-sm font-bold tracking-wide">
                                    {tab.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-6 md:p-12 min-h-[60vh]">
                
                {/* THE VISION */}
                {activeTab === 'vision' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white p-8 md:p-12 rounded-xl shadow-xl border border-slate-100 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 via-purple-500 to-amber-500"></div>
                            <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
                                <Logo width={300} height={300} />
                            </div>
                            
                            <h2 className="text-center text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mb-8">Genesis Block • 000</h2>
                            
                            <div className="prose prose-lg prose-slate mx-auto">
                                <p className="font-serif text-xl md:text-2xl leading-relaxed text-slate-800 text-justify first-letter:text-5xl first-letter:font-bold first-letter:text-purple-900 first-letter:mr-3 first-letter:float-left">
                                    {GENESIS_TEXT}
                                </p>
                            </div>

                            <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-end">
                                <div>
                                    <p className="text-xs text-slate-400 font-mono">HASH: 0x93...a7f2</p>
                                    <p className="text-xs text-slate-400 font-mono">STATUS: IMMUTABLE</p>
                                </div>
                                <Logo width={32} height={32} className="text-slate-300" />
                            </div>
                        </div>
                    </div>
                )}

                {/* PHOENIX */}
                {activeTab === 'phoenix' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                        <div className="relative h-64 md:h-96 w-full rounded-2xl overflow-hidden shadow-2xl group">
                            <img src="/phoenix.jpg" alt="Phoenix Tree" className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-[3s]" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                            <div className="absolute bottom-6 left-6 text-white">
                                <h2 className="text-3xl font-light tracking-wide">Phoenix</h2>
                                <p className="text-emerald-300 text-sm font-bold uppercase tracking-widest mt-1">The First Living Lifetree</p>
                            </div>
                        </div>

                        <div>
                            <SectionHeader>The Mythical Lifetree</SectionHeader>
                            <Paragraph>
                                Mahameru, the first lifetree died. Its name is Mahameru, the three dimensional representation of the Sri Yantra. The name carried the intention: to connect to the deepest layer of creation and create a new society from there, from the bindu, from the center of the center, from the spiritual heart of the Universe and each and every one of us.
                            </Paragraph>
                            <Paragraph>
                                His parent is from Place Jourdain in Brussels and it was planted from a branch. It survived the winter and new lovely leaves sprouted. However the insects loved it too much and I overcared. I've buried it in the same pot where I’ve planted a new branch of a willow tree from Waterloo.
                            </Paragraph>
                            <Paragraph>
                                This is where the name Phoenix is coming from: arising from the death of creation a new Cosmic heartbeat, a new Pulse. By the way Waterloo is the place of the war which ended feudalism and brought peace for a long time.
                            </Paragraph>
                            <div className="bg-purple-50 p-6 rounded-r-2xl border-l-4 border-purple-500 italic text-purple-900 font-serif text-lg leading-relaxed shadow-sm">
                                "This is why the first living lifetree is Phoenix, planted with the intention to create a society build from self sustaining intentional symbiotic organisms composed of light, trees, humans and intelligence."
                            </div>
                        </div>
                    </div>
                )}

                {/* THE SECRET SUN */}
                {activeTab === 'sun' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="relative h-64 md:h-96 w-full rounded-2xl overflow-hidden shadow-2xl mb-8 group">
                             <img src="/tss.jpg" alt="The Secret Sun" className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-[3s]" />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                             <div className="absolute bottom-6 left-6 text-white">
                                 <h2 className="text-3xl font-light tracking-wide">The Secret Sun</h2>
                                 <p className="text-emerald-300 text-sm font-bold uppercase tracking-widest mt-1">Sacred Platform</p>
                             </div>
                        </div>

                        <Paragraph>
                            For the tree named Phoenix, the platform was the best choice. Since it is very close to the mediation path around the chateau of Hridaya France we cut a new path through the brumble towards the direction which seemed a better place for a platform. And it happened that the area and the platform itself is interwoven with magic. The first auspicious sign for building was the finding of the Bodhisattva stone, a big stone on the path. The hill does not have many stones and the Kogi people believe that finding a stone while cutting a path is a very good sign. After a couple of days of listening and cutting the way we ended up on the exact place where the permaculture design marked a place for a platform years before.
                        </Paragraph>

                        <SectionHeader>Sacred Alignments</SectionHeader>
                        <Paragraph>
                            The second auspicious sign was the holly tree, which in folklore is a sacred tree protecting the area from evil spirits and should not be cut, thus marking one side of the platform. The other side there was a group of small oak trees. These two trees are in constant battle according to folklore, emphasizing the polarity aspect. The other ones were the two stumps of the douglas firs which were cut about three years before. They were exactly across the middle so we could use them as a base and as a symbolic rebirth of the trees in a different form. The third one is the wild rose island which became apparent after the second cutting of the path and before starting of the building of the platform. When we marked the corners of the platform we hit another stone, the Heart Stone.
                        </Paragraph>

                        <SectionHeader>Cosmic Timing and Symbolism</SectionHeader>
                        <Paragraph>
                            The building took place through the summer solstice, the international yoga day and the full moon the next day, St John’s day (with a fire ceremony), St Peter’s day, Madeira Day (madeira means wood in Portuguese) and Keti Koti, the celebration of freedom from slavery in Netherlands. The number 37 is present in every aspect of the platform, sometimes deeply hidden. The marking in the concrete in the North-East corner is the number 37. There are 3x7 planks on the top. The platform wes consecrated on the second day of the seventh month, however the last layer of oil on top was soaking in the night of 3/7 and was sealed on that day with Shambo, a powerful shamanic drum. The reason why 37 was central to the symbolism is to emphasize the principles conducive to bodhi:
                        </Paragraph>
                        
                        <div className="bg-purple-50 p-6 rounded-r-2xl border-l-4 border-purple-500 italic text-purple-900 font-serif text-lg leading-relaxed shadow-sm mb-6">
                            “Bodhipakṣa-caryā, the practice of the 37 bodhipakṣadharmas (the principles conducive to bodhi) which are: the four applications of mindfulness, the four right efforts, the four bases of spiritual power, the five spiritual faculties, the five strengths, the seven factors of awakening and the noble eightfold path.” - Bodhipakkhiyādhammā
                        </div>

                        <SectionHeader>Numbers of the Universe</SectionHeader>
                        <Paragraph>
                            The other symbolic number present was the number 108. The reinforcing beams are 108 cm long each, pointing at the cosmic number prevalent in yoga, and the reason being that on average the Sun is 108 Suns away, the Moon is 108 Moons away and the Sun is 108 Earths wide.
                        </Paragraph>
                        
                        <SectionHeader>Polarity and Unity</SectionHeader>
                        <Paragraph>
                            The Yin-Yang symbol and the polarities are represented by how the middle beam is on different sides of the middle supporting beams. The handmade marks in the opposing corners also represents polarity - the one opposed to one marked with the heart does not have a mark, it’s emptiness, nothing - it’s either love or nothing. The other two opposing corners are the 37 representing the bodhisattvas and selflessness and the R, the mark of the individual, anonymous people who build the pyramids, the R put down by a desire to leave a trace and to mark. The two tree stumps below the platform are also symbolizing polarities with their roots hugging each other underground. - Heartmantra
                        </Paragraph>
                        
                        <SectionHeader>Sacred Foundations</SectionHeader>
                        <Paragraph>
                            The bigger path towards the building one one hand took through Assisi, and from there are four stones embedded in the concrete on each corner of the platform. The water contains water from the temple where St. Francis’s final resting place is. The tap was just above his chamber. And from an even more overarching perspective the unmarked corner has a flower of life pendant embedded from the temple of Osiris in Abydos, Egypt, where the flower of life symbol appeared the first time according to some archeologists.
                        </Paragraph>
                    </div>
                )}

                {/* THE PATH */}
                {activeTab === 'path' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-purple-200 before:to-transparent">
                            
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-purple-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-purple-600 font-bold">1</div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-white rounded-xl shadow-md border border-slate-100">
                                    <h3 className="font-bold text-purple-900 mb-2 uppercase tracking-wider text-sm">Resonance</h3>
                                    <p className="text-slate-600 text-sm">Adopt guardianship of an existing tree. Commit to regular visits for meditation, reflection, and quiet observation.</p>
                                </div>
                            </div>

                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-purple-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-purple-600 font-bold">2</div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-white rounded-xl shadow-md border border-slate-100">
                                    <h3 className="font-bold text-purple-900 mb-2 uppercase tracking-wider text-sm">Selection</h3>
                                    <p className="text-slate-600 text-sm">Receive personalized recommendations for your future lifetree location, considering species, symbolism, and environment.</p>
                                </div>
                            </div>

                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-purple-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-purple-600 font-bold">3</div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-white rounded-xl shadow-md border border-slate-100">
                                    <h3 className="font-bold text-purple-900 mb-2 uppercase tracking-wider text-sm">Nurturing</h3>
                                    <p className="text-slate-600 text-sm">Plant your lifetree seed or sapling in a pot. For urban dwellers, a bonsai serves as a perfect, resilient avatar.</p>
                                </div>
                            </div>

                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-emerald-500 bg-emerald-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-white font-bold">4</div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-emerald-50 rounded-xl shadow-md border border-emerald-100">
                                    <h3 className="font-bold text-emerald-900 mb-2 uppercase tracking-wider text-sm">Initiation</h3>
                                    <p className="text-emerald-800 text-sm">Transplant the tree into soil at a communal Mother Tree hub. A ceremony of rooting, sharing stories, and collective meditation.</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-16 text-center">
                            <button 
                                onClick={() => setShowSubModal(true)}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-full font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2 mx-auto"
                            >
                                <Icons.Send />
                                <span>Join the Path</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* THE YANTRA */}
                {activeTab === 'yantra' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        
                        <div className="mb-10 text-center max-w-2xl mx-auto">
                            <SectionHeader>The Lifeseed Yantra</SectionHeader>
                            <Paragraph>
                                A Yantra is a geometric diagram, mainly from the Tantric traditions of the Indian religions. It is used for the worship of deities in temples or at home; as an aid in meditation; used for the benefits given by their supposed occult powers based on Hindu astrology and tantric texts. They are also used for adornment of temple floors, due mainly to their aesthetic and symmetric qualities.
                            </Paragraph>
                            <Paragraph className="text-base text-slate-600">
                                A little deeper exploration of the yantra: the symbol families below can be overlapped with the Lifeseed geometry in surprisingly strong alignment. The seven inner circles are half of the main circle, and the seven small inner seeds are one eighth of the main circle.
                            </Paragraph>
                            <p className="text-sm text-slate-500 italic">It is a true yantra I believe.</p>
                        </div>

                        {/* Large Main Yantra */}
                        <div className="relative flex justify-center py-12 mb-16">
                             <div className="relative p-2 rounded-full border-2 border-amber-300 shadow-[0_0_80px_rgba(251,191,36,0.3)] bg-white">
                                <Logo width={300} height={300} />
                            </div>
                        </div>

                        <div className="space-y-4">
                            {yantraSymbols.map((symbol) => (
                                <SymbolCard
                                    key={symbol.title}
                                    title={symbol.title}
                                    description={symbol.description}
                                    type={symbol.type}
                                    link={symbol.link}
                                />
                            ))}
                        </div>

                    </div>
                )}

                {/* DESIGN BRIEF (FOR DESIGNER) */}
                {activeTab === 'design' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-16 pb-20">
                        
                        {/* Header Section */}
                        <div className="text-center space-y-4">
                            <div className="inline-block p-4 rounded-full bg-slate-50 mb-4">
                                <Logo width={80} height={80} />
                            </div>
                            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">.seed</h1>
                            <p className="text-xl text-slate-500 font-light uppercase tracking-widest">Design System & Brand Identity</p>
                        </div>

                        {/* 01. Manifesto */}
                        <div className="grid md:grid-cols-12 gap-8 items-center">
                            <div className="md:col-span-4">
                                <h2 className="text-emerald-600 font-bold uppercase tracking-widest text-xs mb-2">01. Philosophy</h2>
                                <h3 className="text-3xl font-serif text-slate-800 leading-tight">Solar Punk meets Ancient Wisdom.</h3>
                            </div>
                            <div className="md:col-span-8 bg-slate-50 p-8 rounded-2xl border border-slate-100">
                                <p className="text-lg leading-relaxed text-slate-600 font-serif italic">
                                    "We are building a bridge between the digital and the organic. The interface should feel less like a database and more like a forest. Every interaction—planting, pulsing, growing—should carry weight and biological resonance."
                                </p>
                            </div>
                        </div>

                        {/* 02. Color System */}
                        <div>
                            <div className="flex items-end justify-between mb-6">
                                <h2 className="text-emerald-600 font-bold uppercase tracking-widest text-xs">02. Atomic Palette</h2>
                                <span className="text-xs text-slate-400 font-mono">Tailwind CSS Variables</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-3 group">
                                    <div className="h-32 w-full bg-emerald-600 rounded-xl shadow-lg shadow-emerald-200 group-hover:scale-105 transition-transform"></div>
                                    <div>
                                        <p className="font-bold text-slate-800">Life Emerald</p>
                                        <p className="text-xs text-slate-400 font-mono">bg-emerald-600</p>
                                        <p className="text-xs text-slate-400 font-mono">#059669</p>
                                    </div>
                                </div>
                                <div className="space-y-3 group">
                                    <div className="h-32 w-full bg-slate-900 rounded-xl shadow-lg shadow-slate-200 group-hover:scale-105 transition-transform"></div>
                                    <div>
                                        <p className="font-bold text-slate-800">Deep Space</p>
                                        <p className="text-xs text-slate-400 font-mono">bg-slate-900</p>
                                        <p className="text-xs text-slate-400 font-mono">#0f172a</p>
                                    </div>
                                </div>
                                <div className="space-y-3 group">
                                    <div className="h-32 w-full bg-amber-500 rounded-xl shadow-lg shadow-amber-200 group-hover:scale-105 transition-transform"></div>
                                    <div>
                                        <p className="font-bold text-slate-800">Solar Amber</p>
                                        <p className="text-xs text-slate-400 font-mono">bg-amber-500</p>
                                        <p className="text-xs text-slate-400 font-mono">#f59e0b</p>
                                    </div>
                                </div>
                                <div className="space-y-3 group">
                                    <div className="h-32 w-full bg-purple-900 rounded-xl shadow-lg shadow-purple-200 group-hover:scale-105 transition-transform"></div>
                                    <div>
                                        <p className="font-bold text-slate-800">Mystic Purple</p>
                                        <p className="text-xs text-slate-400 font-mono">bg-purple-900</p>
                                        <p className="text-xs text-slate-400 font-mono">#581c87</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 03. Typography */}
                        <div className="grid md:grid-cols-2 gap-12">
                            <div>
                                <h2 className="text-emerald-600 font-bold uppercase tracking-widest text-xs mb-6">03. Typography</h2>
                                <div className="space-y-8">
                                    <div>
                                        <p className="text-xs text-slate-400 mb-2 font-mono">Primary Font (UI & Headings)</p>
                                        <h3 className="text-4xl font-sans font-thin text-slate-900">Inter Sans</h3>
                                        <p className="text-slate-600 mt-2">Clean, modern, legible. Used for UI elements, navigation, and primary headers to convey digital clarity.</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 mb-2 font-mono">Secondary Font (Content & Soul)</p>
                                        <h3 className="text-4xl font-serif italic text-slate-900">Serif (System)</h3>
                                        <p className="text-slate-600 mt-2">Classic, organic, rooted. Used for user generated content, visions, and 'Pulse' bodies to convey human touch and wisdom.</p>
                                    </div>
                                </div>
                            </div>

                            {/* 04. Iconography & Shape */}
                            <div>
                                <h2 className="text-emerald-600 font-bold uppercase tracking-widest text-xs mb-6">04. Shape Language</h2>
                                <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                                    <div className="flex items-center gap-4">
                                        <button className="bg-emerald-600 text-white px-6 py-3 rounded-full font-bold shadow-lg">Pill Shape</button>
                                        <p className="text-sm text-slate-500">All interactive elements use fully rounded corners (`rounded-full`) to feel organic and soft.</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
                                            <Icons.Tree />
                                        </div>
                                        <p className="text-sm text-slate-500">Containers use `rounded-xl` or `rounded-2xl` for a card-like, approachable feel.</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex -space-x-2">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white"></div>
                                            <div className="w-8 h-8 rounded-full bg-sky-500 border-2 border-white"></div>
                                            <div className="w-8 h-8 rounded-full bg-amber-500 border-2 border-white"></div>
                                        </div>
                                        <p className="text-sm text-slate-500">Overlapping elements invoke connection and unity (The Flower of Life).</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

            </div>

            {showSubModal && (
                <Modal title="Stay Connected" onClose={() => setShowSubModal(false)}>
                    <form onSubmit={handleSubscribe} className="space-y-6 p-6">
                        <p className="text-slate-500 font-serif italic text-center">Receive our transmission every 7 weeks.</p>
                        <input 
                            type="email" 
                            placeholder="Your Email" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            className="w-full border-b-2 border-slate-200 p-4 text-center text-lg focus:border-purple-500 outline-none transition-colors" 
                            required 
                        />
                        <button type="submit" disabled={submitting} className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold text-lg shadow-xl hover:bg-purple-700 transition-all">
                            {submitting ? '...' : 'SUBSCRIBE'}
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
};
