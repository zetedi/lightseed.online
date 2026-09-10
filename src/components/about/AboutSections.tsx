import React, { useState, useEffect } from 'react';
import { notify } from '../ui/Toast';
import { WhitePaperSection } from './WhitePaper';
import { showAlert } from "../ui/Dialog";
import Logo from '../Logo';
import { Icons } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { subscribeToNewsletter, getGenesisHash } from '../../services/firebase';
import { useLanguage } from '../../contexts/LanguageContext';
import type { TranslationKey } from '../../utils/translations';

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

// The symbol families read into the yantra. Title and description are translation
// KEYS (the copy lives in the table) — the card speaks them through the hook.
export const yantraSymbols: Array<{
    titleKey: TranslationKey;
    descKey: TranslationKey;
    type: YantraSymbolType;
    link: string;
}> = [
    {
        titleKey: 'yantra_yinyang_title',
        descKey: 'yantra_yinyang_desc',
        type: 'yinYang',
        link: 'https://en.wikipedia.org/wiki/Yin_and_yang'
    },
    {
        titleKey: 'yantra_heart_title',
        descKey: 'yantra_heart_desc',
        type: 'heart',
        link: 'https://en.wikipedia.org/wiki/Heart_symbol'
    },
    {
        titleKey: 'yantra_sun_title',
        descKey: 'yantra_sun_desc',
        type: 'sun',
        link: 'https://en.wikipedia.org/wiki/Circled_dot'
    },
    {
        titleKey: 'yantra_seed_title',
        descKey: 'yantra_seed_desc',
        type: 'seed',
        link: 'https://www.uniguide.com/seed-of-life-number-7-sacred-geometry/'
    },
    {
        titleKey: 'yantra_hexagram_title',
        descKey: 'yantra_hexagram_desc',
        type: 'hexagram',
        link: 'https://en.wikipedia.org/wiki/Hexagram'
    },
    {
        titleKey: 'yantra_shambhala_title',
        descKey: 'yantra_shambhala_desc',
        type: 'shambhala',
        link: 'https://en.wikipedia.org/wiki/Shambhala'
    },
    {
        titleKey: 'yantra_lotus_title',
        descKey: 'yantra_lotus_desc',
        type: 'lotus',
        link: 'https://en.wikipedia.org/wiki/Sacred_lotus_in_religious_art'
    },
    {
        titleKey: 'yantra_honeycomb_title',
        descKey: 'yantra_honeycomb_desc',
        type: 'honeycomb',
        link: 'https://en.wikipedia.org/wiki/Honeycomb'
    },
    {
        titleKey: 'yantra_grid_title',
        descKey: 'yantra_grid_desc',
        type: 'grid',
        link: 'https://en.wikipedia.org/wiki/Overlapping_circles_grid'
    },
    {
        titleKey: 'yantra_kabbalah_title',
        descKey: 'yantra_kabbalah_desc',
        type: 'kabbalah',
        link: 'https://en.wikipedia.org/wiki/Tree_of_life_(Kabbalah)'
    },
    {
        titleKey: 'yantra_infinity_title',
        descKey: 'yantra_infinity_desc',
        type: 'infinity',
        link: 'https://en.wikipedia.org/wiki/Infinity_symbol'
    },
    {
        titleKey: 'yantra_triskelion_title',
        descKey: 'yantra_triskelion_desc',
        type: 'triskelion',
        link: 'https://en.wikipedia.org/wiki/Triskelion'
    }
];

export const SectionHeader = ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-2xl font-light text-purple-900 mb-6 mt-12 tracking-wide flex items-center gap-3 dark:text-purple-200">
        {children}
    </h2>
);

export const Paragraph = ({ children, className = "" }: { children?: React.ReactNode, className?: string }) => (
    <p className={`text-slate-700 leading-relaxed font-serif mb-6 text-justify text-lg dark:text-slate-200 ${className}`}>
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

const SymbolCard = ({ titleKey, descKey, type, link }: { titleKey: TranslationKey, descKey: TranslationKey, type: YantraSymbolType, link: string, key?: string | number }) => {
    const { t } = useLanguage();
    return (
    <div className="flex flex-col md:flex-row gap-6 items-center bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow dark:bg-slate-900 dark:border-slate-800">
        <div className="relative w-40 h-40 shrink-0 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-purple-50 shadow-inner overflow-hidden dark:border-amber-900">
             <div className="absolute inset-4">
                <SymbolOverlay type={type} />
             </div>
        </div>
        <div>
            <h3 className="text-amber-600 font-bold uppercase tracking-wider mb-2 dark:text-amber-300">{t(titleKey)}</h3>
            <p className="text-slate-600 text-sm mb-3 dark:text-slate-300">{t(descKey)}</p>
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-amber-500 flex items-center gap-1 transition-colors">
                <Icons.Link />
                <span>{t('read_more')}</span>
            </a>
        </div>
    </div>
    );
};

// The founding vision of the network — block 000 of the immutable chain — lives in the
// translation table as `genesis_text`, so the origin story speaks every language.

// 01 — The Genesis Block: the first, immutable pulse the whole network grows from.
export const GenesisSection = () => {
    const { t } = useLanguage();
    // The true on-chain hash of block 000, loaded from the shared genesis tree. Falls
    // back to a placeholder while loading or if the chain isn't reachable.
    const [hash, setHash] = useState<string | null>(null);
    useEffect(() => { getGenesisHash().then(setHash).catch(() => {}); }, []);
    const shortHash = hash ? `0x${hash.slice(0, 6)}...${hash.slice(-4)}` : '0x93...a7f2';

    return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white p-8 md:p-12 rounded-xl shadow-xl border border-slate-100 relative overflow-hidden dark:bg-slate-900 dark:border-slate-800">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 via-purple-500 to-amber-500"></div>
            <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
                <Logo width={300} height={300} />
            </div>

            <h2 className="text-center text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mb-8">{t('genesis_block_000')}</h2>

            <div className="prose prose-lg prose-slate mx-auto dark:prose-invert">
                <p className="font-serif text-base md:text-lg leading-relaxed text-slate-800 text-justify first-letter:text-4xl first-letter:font-bold first-letter:text-purple-900 first-letter:mr-2 first-letter:float-left dark:text-slate-100">
                    {t('genesis_text')}
                </p>
            </div>

            <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-end dark:border-slate-800">
                <div>
                    <p className="text-xs text-slate-400 font-mono" title={hash ?? undefined}>{t('genesis_hash_label')} {shortHash}</p>
                    <p className="text-xs text-slate-400 font-mono">{t('genesis_status_immutable')}</p>
                </div>
                <Logo width={32} height={32} className="text-slate-300" />
            </div>
        </div>
    </div>
    );
};

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
            await subscribeToNewsletter(email, window.location.hostname);
            notify(`🌱 ${t('subscribed_success')} ${email}`);
            setShowSubModal(false);
        } catch (e) { showAlert(t('subscription_failed')); }
        setSubmitting(false);
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-purple-200 before:to-transparent">

                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-purple-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-purple-600 font-bold dark:bg-slate-900 dark:text-purple-300">1</div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-white rounded-xl shadow-md border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
                        <h3 className="font-bold text-purple-900 mb-2 uppercase tracking-wider text-sm dark:text-purple-200">{t('path_phase_resonance')}</h3>
                        <p className="text-slate-600 text-sm dark:text-slate-300">{t('path_adopt_note')}</p>
                    </div>
                </div>

                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-purple-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-purple-600 font-bold dark:bg-slate-900 dark:text-purple-300">2</div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-white rounded-xl shadow-md border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
                        <h3 className="font-bold text-purple-900 mb-2 uppercase tracking-wider text-sm dark:text-purple-200">{t('path_phase_selection')}</h3>
                        <p className="text-slate-600 text-sm dark:text-slate-300">{t('path_recommend_note')}</p>
                    </div>
                </div>

                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-purple-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-purple-600 font-bold dark:bg-slate-900 dark:text-purple-300">3</div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-white rounded-xl shadow-md border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
                        <h3 className="font-bold text-purple-900 mb-2 uppercase tracking-wider text-sm dark:text-purple-200">{t('path_phase_nurturing')}</h3>
                        <p className="text-slate-600 text-sm dark:text-slate-300">{t('path_pot_note')}</p>
                    </div>
                </div>

                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-emerald-500 bg-emerald-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-white font-bold">4</div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-emerald-50 rounded-xl shadow-md border border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900">
                        <h3 className="font-bold text-emerald-900 mb-2 uppercase tracking-wider text-sm dark:text-emerald-200">{t('path_phase_initiation')}</h3>
                        <p className="text-emerald-800 text-sm dark:text-emerald-200">{t('path_transplant_note')}</p>
                    </div>
                </div>
            </div>

            <div className="mt-16 text-center">
                <button
                    onClick={() => setShowSubModal(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-full font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2 mx-auto"
                >
                    <Icons.Send />
                    <span>{t('join_the_path')}</span>
                </button>
            </div>

            {showSubModal && (
                <Modal title={t('stay_connected')} onClose={() => setShowSubModal(false)}>
                    <form onSubmit={handleSubscribe} className="space-y-6 p-6">
                        <p className="text-slate-500 font-serif italic text-center">{t('transmission_note')}</p>
                        <input
                            type="email"
                            placeholder={t('your_email_ph')}
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full border-b-2 border-slate-200 p-4 text-center text-lg focus:border-purple-500 outline-none transition-colors dark:border-slate-700"
                            required
                        />
                        <button type="submit" disabled={submitting} className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold text-lg shadow-xl hover:bg-purple-700 transition-all">
                            {submitting ? '...' : t('subscribe')}
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
};

// The EU emblem (twelve gold stars on blue) — the basis of the EUIPO mark. Inline so it needs
// no asset; drop an official logo at public/euipo.svg and swap this if preferred.
// A clean EU emblem: twelve five-pointed gold stars in a ring on EU blue (proper star polygons).
const euStarPoints = (cx: number, cy: number, R: number): string => {
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 === 0 ? R : R * 0.382;
        pts.push(`${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`);
    }
    return pts.join(' ');
};
export const EuipoMark = ({ size = 52 }: { size?: number }) => {
    const { t } = useLanguage();
    return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={t('eu_ip_aria')} className="shrink-0">
        <rect width="100" height="100" rx="14" fill="#003399" />
        {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 30) * Math.PI / 180;
            return <polygon key={i} points={euStarPoints(50 + 32 * Math.sin(a), 50 - 32 * Math.cos(a), 7)} fill="#FFCC00" />;
        })}
    </svg>
    );
};

// The registered trademarks protecting the Lifeseed identity. Linked to EUIPO eSearch (public).
export const TRADEMARKS = [
    { no: '018427525', url: 'https://euipo.europa.eu/eSearch/#details/trademarks/018427525' },
    { no: '019374987', url: 'https://euipo.europa.eu/eSearch/#details/trademarks/019374987' },
];

// Reusable protection notice — used as its own About tab and inside the Yantra section.
export const ProtectionNote = ({ compact = false }: { compact?: boolean }) => {
    const { t } = useLanguage();
    // The `.seed` wordmark stays a left-to-right literal inside the sentence, so the
    // note is one key with a {mark} slot rather than two half-sentences.
    const [before, after] = t('protection_note').split('{mark}');
    return (
    <div className="flex items-start gap-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-5 dark:border-blue-900 dark:bg-blue-950/50">
        <EuipoMark size={compact ? 44 : 56} />
        <div className="min-w-0">
            <h3 className="font-bold text-blue-900 dark:text-blue-200">{compact ? t('protected') : t('protection')}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {before}<span dir="ltr" className="font-semibold">.seed</span>{after}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
                {TRADEMARKS.map(tm => (
                    <a key={tm.no} href={tm.url} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-mono font-bold text-blue-800 transition-colors hover:bg-blue-100 dark:bg-slate-900 dark:border-blue-900 dark:text-blue-200">
                        <Icons.ShieldCheck /> {tm.no}
                    </a>
                ))}
            </div>
        </div>
    </div>
    );
};

// A standalone About tab for the protection / trademark info.
export const ProtectionSection = () => {
    const { t } = useLanguage();
    return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-10 text-center max-w-2xl mx-auto">
            <SectionHeader>{t('protection')}</SectionHeader>
            <Paragraph>{t('protection_body')}</Paragraph>
        </div>
        <div className="max-w-2xl mx-auto"><ProtectionNote /></div>
    </div>
    );
};

// 04 — The Yantra: the logo / brand and its symbol language.
export const YantraSection = () => {
    const { t } = useLanguage();
    return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

        <div className="mb-10 text-center max-w-2xl mx-auto">
            <SectionHeader>{t('yantra_title')}</SectionHeader>
            <Paragraph>{t('yantra_what_is')}</Paragraph>
            <Paragraph className="text-base text-slate-600 dark:text-slate-300">{t('yantra_deeper')}</Paragraph>
            <p className="text-sm text-slate-500 italic">{t('yantra_line')}</p>
        </div>

        {/* Large Main Yantra */}
        <div className="relative flex justify-center py-12 mb-10">
             <div className="relative p-2 rounded-full border-2 border-amber-300 shadow-[0_0_80px_rgba(251,191,36,0.3)] bg-white dark:bg-slate-900">
                <Logo width={300} height={300} />
            </div>
        </div>

        {/* The yantra and the .seed mark are protected. */}
        <div className="max-w-2xl mx-auto mb-16"><ProtectionNote compact /></div>

        <div className="space-y-4">
            {yantraSymbols.map((symbol) => (
                <SymbolCard
                    key={symbol.titleKey}
                    titleKey={symbol.titleKey}
                    descKey={symbol.descKey}
                    type={symbol.type}
                    link={symbol.link}
                />
            ))}
        </div>

    </div>
);
};

// Tab metadata shared by both about pages, so the lore tabs read identically everywhere.
// 'path' retired from the tabs: the membership path now lives in the Light Path itself
// (its four phases ride as the tooltip on the card's label) — one trail, not two.
export const loreTabs = [
    { id: 'genesis', label: 'Genesis', meta: 'The first block' },
    { id: 'whitepaper', label: 'The White Paper', meta: 'The root, readable' },
    { id: 'yantra', label: 'The Yantra', meta: 'Logo & brand' },
    { id: 'protection', label: 'Protection', meta: 'Trademarks' },
] as const;

export type LoreTabId = typeof loreTabs[number]['id'];

// Renders the body for a given lore tab; used by the unified community/node about page.
export const LoreSection = ({ id }: { id: LoreTabId }) => {
    switch (id) {
        case 'genesis': return <GenesisSection />;
        case 'whitepaper': return <WhitePaperSection />;
        case 'yantra': return <YantraSection />;
        case 'protection': return <ProtectionSection />;
        default: return null;
    }
};
