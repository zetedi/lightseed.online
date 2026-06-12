import React, { useState } from 'react';
import { showAlert } from "../ui/Dialog";
import Logo from '../Logo';
import { Icons } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { subscribeToNewsletter } from '../../services/firebase';
import { useLanguage } from '../../contexts/LanguageContext';

// Shared "lore" sections that make up the foundational story of the network.
// They are rendered on every community/node about page (CommunityProfile), so the
// origin story travels with the code to every domain that serves it.

export type YantraSymbolType =
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

export const yantraSymbols: Array<{
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

export const SectionHeader = ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-2xl font-light text-purple-900 mb-6 mt-12 tracking-wide flex items-center gap-3">
        {children}
    </h2>
);

export const Paragraph = ({ children, className = "" }: { children?: React.ReactNode, className?: string }) => (
    <p className={`text-slate-700 leading-relaxed font-serif mb-6 text-justify text-lg ${className}`}>
        {children}
    </p>
);

// Helper to render specific geometric overlays for the Yantra section
export const SymbolOverlay = ({ type }: { type: YantraSymbolType }) => {
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
        case 'sun': // Circled dot crowned with rays — the bindu radiating
            return (
                <svg {...commonProps}>
                    <circle cx="131" cy="131" r="42" />
                    <circle cx="131" cy="131" r="8" fill="#F59E0B" stroke="none" />
                    {Array.from({ length: 12 }).map((_, i) => (
                        <line key={i} x1="131" y1="78" x2="131" y2="56" transform={`rotate(${i * 30} 131 131)`} strokeLinecap="round" />
                    ))}
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
        case 'shambhala': // Mandala: concentric rings around a square palace with four gates
            return (
                <svg {...commonProps}>
                    <circle cx="131" cy="131" r="84" />
                    <circle cx="131" cy="131" r="66" strokeOpacity="0.45" />
                    <rect x="99" y="99" width="64" height="64" />
                    {[0, 90, 180, 270].map(a => (
                        <rect key={a} x="121" y="83" width="20" height="20" transform={`rotate(${a} 131 131)`} />
                    ))}
                    <circle cx="131" cy="131" r="18" />
                    <circle cx="131" cy="131" r="5" fill="#F59E0B" stroke="none" />
                </svg>
            );
        case 'honeycomb': { // Seven edge-sharing cells — nature's tessellation
            const R = 23;
            const d = R * Math.sqrt(3); // centre-to-centre for shared edges
            const centers: [number, number][] = [
                [131, 131],
                ...[0, 60, 120, 180, 240, 300].map(a => [
                    131 + d * Math.cos(a * Math.PI / 180),
                    131 + d * Math.sin(a * Math.PI / 180),
                ] as [number, number]),
            ];
            return (
                <svg {...commonProps}>
                    {centers.map(([cx, cy], i) => (
                        <polygon
                            key={i}
                            points={Array.from({ length: 6 }).map((_, k) => {
                                const ang = (Math.PI / 180) * (60 * k - 90); // pointy-top
                                return `${(cx + R * Math.cos(ang)).toFixed(1)},${(cy + R * Math.sin(ang)).toFixed(1)}`;
                            }).join(' ')}
                            strokeOpacity={i === 0 ? 1 : 0.6}
                        />
                    ))}
                </svg>
            );
        }
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
        case 'infinity': // A clean lemniscate — two loops born from one centre
            return (
                <svg {...commonProps}>
                    <path
                        d="M131 131 C 108 102 64 102 64 131 C 64 160 108 160 131 131 C 154 102 198 102 198 131 C 198 160 154 160 131 131 Z"
                        strokeWidth="4"
                        strokeLinejoin="round"
                    />
                    <circle cx="131" cy="131" r="4" fill="#F59E0B" stroke="none" />
                </svg>
            );
        case 'lotus': // Eight-petalled bloom unfolding from the centre
            return (
                <svg {...commonProps}>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <path
                            key={i}
                            d="M131 131 C 113 96 113 70 131 46 C 149 70 149 96 131 131 Z"
                            transform={`rotate(${i * 45} 131 131)`}
                            fill="rgba(245, 158, 11, 0.12)"
                        />
                    ))}
                    <circle cx="131" cy="131" r="11" fill="#F59E0B" stroke="none" />
                </svg>
            );
        case 'kabbalah': { // Tree of Life: ten sephirot joined by the connecting paths
            const s = {
                keter: [131, 40], chokmah: [177, 70], binah: [85, 70],
                chesed: [177, 116], gevurah: [85, 116], tiferet: [131, 138],
                netzach: [177, 184], hod: [85, 184], yesod: [131, 206], malkuth: [131, 240],
            } as const;
            const edges: Array<[keyof typeof s, keyof typeof s]> = [
                ['keter', 'chokmah'], ['keter', 'binah'], ['chokmah', 'binah'],
                ['chokmah', 'chesed'], ['binah', 'gevurah'], ['chesed', 'gevurah'],
                ['keter', 'tiferet'], ['chokmah', 'tiferet'], ['binah', 'tiferet'],
                ['chesed', 'tiferet'], ['gevurah', 'tiferet'], ['chesed', 'netzach'], ['gevurah', 'hod'],
                ['tiferet', 'netzach'], ['tiferet', 'hod'], ['netzach', 'hod'],
                ['tiferet', 'yesod'], ['netzach', 'yesod'], ['hod', 'yesod'],
                ['netzach', 'malkuth'], ['hod', 'malkuth'], ['yesod', 'malkuth'],
            ];
            return (
                <svg {...commonProps}>
                    {edges.map(([a, b], i) => (
                        <line key={i} x1={s[a][0]} y1={s[a][1]} x2={s[b][0]} y2={s[b][1]} strokeOpacity="0.5" strokeWidth="2" />
                    ))}
                    {Object.values(s).map(([cx, cy], i) => (
                        <circle key={i} cx={cx} cy={cy} r="9" fill="#fff" />
                    ))}
                </svg>
            );
        }
        case 'triskelion': // Three Archimedean spiral arms turning from one centre
            return (
                <svg {...commonProps}>
                    {[0, 120, 240].map(off => {
                        const pts = Array.from({ length: 26 }).map((_, i) => {
                            const t = i / 25;
                            const ang = (off + t * 250) * Math.PI / 180;
                            const r = 7 + t * 47;
                            return `${(131 + r * Math.cos(ang)).toFixed(1)},${(131 + r * Math.sin(ang)).toFixed(1)}`;
                        });
                        return <path key={off} d={`M${pts.join(' L')}`} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
                    })}
                    <circle cx="131" cy="131" r="8" fill="#F59E0B" stroke="none" />
                </svg>
            );
        default:
            return null;
    }
};

const SymbolCard = ({ title, description, type, link }: { title: string, description: string, type: YantraSymbolType, link: string, key?: string | number }) => (
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

// 03 — The path to become a member.
export const MembershipPathSection = () => {
    const { t } = useLanguage();
    const [showSubModal, setShowSubModal] = useState(false);
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await subscribeToNewsletter(email);
            showAlert(`${t('subscribed_success')} ${email}`);
            setShowSubModal(false);
        } catch (e) { showAlert(t('subscription_failed')); }
        setSubmitting(false);
    };

    return (
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

// 04 — The Yantra: the logo / brand and its symbol language.
export const YantraSection = () => (
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
);

// Tab metadata shared by both about pages, so the lore tabs read identically everywhere.
export const loreTabs = [
    { id: 'path', label: 'The Path', meta: 'Become a member' },
    { id: 'yantra', label: 'The Yantra', meta: 'Logo & brand' },
] as const;

export type LoreTabId = typeof loreTabs[number]['id'];

// Renders the body for a given lore tab; used by the unified community/node about page.
export const LoreSection = ({ id }: { id: LoreTabId }) => {
    switch (id) {
        case 'path': return <MembershipPathSection />;
        case 'yantra': return <YantraSection />;
        default: return null;
    }
};
