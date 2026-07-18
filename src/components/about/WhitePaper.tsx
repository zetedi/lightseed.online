import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { marked } from 'marked';
import { Icons } from '../ui/Icons';
import { PdfViewer } from '../ui/PdfViewer';
import { SectionMenu, SectionItem } from '../ui/SectionMenu';

// The White Paper — the root/ documents as a BOOK: a full-screen reader below the page
// header, chapters down the left side on desktop, the usual horizontal menu on mobile.
// Bundled at build time (?raw imports), so the node always ships the exact root it grew
// from. One day every being may carry a book like this — the same model at every scale.
import genesisMd from '../../../root/GENESIS.md?raw';
import linMd from '../../../root/LIN.md?raw';
import architectureMd from '../../../root/ARCHITECTURE.md?raw';
import decisionsMd from '../../../root/DECISIONS.md?raw';
import roadmapMd from '../../../root/ROADMAP.md?raw';
import questionsMd from '../../../root/QUESTIONS.md?raw';
import seedMd from '../../../root/SEED.md?raw';

const PAPERS = [
    { id: 'genesis', label: 'Genesis', hint: 'the promise', md: genesisMd },
    { id: 'lin', label: 'LIN', hint: 'what world we are creating', md: linMd },
    { id: 'architecture', label: 'Architecture', hint: 'how it currently lives', md: architectureMd },
    { id: 'decisions', label: 'Decisions', hint: 'how it became this way', md: decisionsMd },
    { id: 'roadmap', label: 'Roadmap', hint: 'where growth is invited next', md: roadmapMd },
    { id: 'questions', label: 'Questions', hint: 'what we refuse to pretend we know', md: questionsMd },
    // The shadow chapter: the 2025 vision read against the organism it became —
    // "a vision keeps its tree as a shadow, so the two growths can be compared" (LIN).
    { id: 'seed', label: 'Seed', hint: 'what was dreamed, and what grew', md: seedMd },
] as const;

// Markdown prose styling via arbitrary variants — no typography plugin needed.
const PROSE =
    'font-serif leading-relaxed text-slate-700 ' +
    '[&_h1]:mb-4 [&_h1]:font-sans [&_h1]:text-2xl [&_h1]:font-light [&_h1]:tracking-wide [&_h1]:text-slate-900 ' +
    '[&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:font-sans [&_h2]:text-xs [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-[0.18em] [&_h2]:text-emerald-700 ' +
    '[&_p]:mb-4 [&_p]:text-[15px] ' +
    '[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1.5 [&_li]:text-[15px] ' +
    '[&_blockquote]:mb-4 [&_blockquote]:border-l-2 [&_blockquote]:border-amber-300 [&_blockquote]:bg-amber-50/50 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:italic [&_blockquote]:text-slate-600 ' +
    '[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12.5px] [&_code]:text-emerald-800 ' +
    '[&_pre]:mb-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:text-emerald-100 ' +
    '[&_table]:mb-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm ' +
    '[&_th]:border-b [&_th]:border-slate-200 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-sans [&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-slate-500 ' +
    '[&_td]:border-b [&_td]:border-slate-100 [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top ' +
    '[&_hr]:my-6 [&_hr]:border-slate-100 ' +
    '[&_a]:text-emerald-700 [&_a]:underline [&_a]:decoration-emerald-300 ' +
    '[&_strong]:font-bold [&_strong]:text-slate-900';

export const WhitePaperSection = () => {
    const [open, setOpen] = useState(true); // arriving at the tab opens the book
    const [paper, setPaper] = useState<(typeof PAPERS)[number]['id']>('genesis');
    // A PDF the reader opened from a chapter link — shown in the in-app viewer (reach-card style)
    // instead of navigating the whole app away to the browser's bare document view.
    const [pdf, setPdf] = useState<{ src: string; title: string } | null>(null);
    const active = PAPERS.find(p => p.id === paper) || PAPERS[0];
    const html = useMemo(() => marked.parse(active.md, { async: false }) as string, [active.md]);

    const chapters: SectionItem[] = PAPERS.map(p => ({ key: p.id, label: p.label }));

    // PDF links inside a chapter open the viewer (a plain anchor would leave the app; the viewer
    // keeps the book open underneath and offers Download). Every other link behaves as itself.
    const onProseClick = (e: React.MouseEvent) => {
        const a = (e.target as HTMLElement).closest('a');
        const href = a?.getAttribute('href');
        if (a && href && href.toLowerCase().endsWith('.pdf')) {
            e.preventDefault();
            setPdf({ src: href, title: a.textContent || 'Document' });
        }
    };

    return (
        <>
            {/* In-page card — the book's cover; the reader opens over it. */}
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">The White Paper</p>
                <p className="mx-auto mt-2 max-w-md font-serif text-sm italic text-slate-500">
                    The root the seed grows from: six documents every intelligence roots in before
                    acting, and the seed vision they grew from, laid beside them.
                </p>
                <button onClick={() => setOpen(true)}
                    className="mt-4 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-bold uppercase tracking-widest text-white shadow transition-colors hover:bg-emerald-700">
                    Open the book
                </button>
            </div>

            {/* The reader — full screen below the page header: chapters left (desktop),
                horizontal menu on mobile, one document open at a time. A book. */}
            {open && createPortal(
                <div className="fixed inset-x-0 bottom-0 top-20 z-50 overflow-hidden bg-slate-50">
                    <div className="mx-auto flex h-full max-w-6xl flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4 lg:flex-row lg:gap-6">
                        <div className="shrink-0 lg:w-60">
                            <div className="mb-2 flex items-center justify-between lg:mb-4">
                                <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">The White Paper</p>
                                <button onClick={() => setOpen(false)} title="Close the book" aria-label="Close the book"
                                    className="rounded-full bg-white p-2 text-slate-400 shadow-sm ring-1 ring-slate-200 transition-colors hover:text-slate-700">
                                    <Icons.Close />
                                </button>
                            </div>
                            <SectionMenu items={chapters} active={paper} onSelect={(k) => setPaper(k as typeof paper)} />
                            <p className="mt-3 hidden text-[11px] italic leading-relaxed text-slate-400 lg:block">
                                {active.hint}. Look into the root; no need for else.
                            </p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-10">
                            {/* Trusted content: our own repo's root/ markdown, bundled at build time.
                                The click handler only delegates for anchors already in the content —
                                keyboard activation reaches those anchors natively. */}
                            <div className={PROSE} onClick={onProseClick} dangerouslySetInnerHTML={{ __html: html }} />
                        </div>
                    </div>
                </div>,
                document.body,
            )}

            {pdf && <PdfViewer src={pdf.src} title={pdf.title} onClose={() => setPdf(null)} />}
        </>
    );
};
