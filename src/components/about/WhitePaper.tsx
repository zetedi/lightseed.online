import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { marked } from 'marked';
import { Icons } from '../ui/Icons';
import { PdfViewer } from '../ui/PdfViewer';
import { SectionMenu, SectionItem } from '../ui/SectionMenu';
import { useLanguage } from '../../contexts/LanguageContext';
import { sanitizeDocumentHtml } from '../../utils/sanitize';
import { fetchRootPaper } from '../../services/rootPapers';
import type { WhitePaperChapter } from '../../domain/whitePaper';

// The White Paper — the root/ documents as a BOOK: a full-screen reader below the page
// header, chapters down the left side on desktop, the usual horizontal menu on mobile.
// The chapters are the root/ files themselves, served by this very deploy at /root/<NAME>.md
// (ring 2026-09-13; domain/whitePaper is the law) and fetched when a chapter is opened — the
// constitution at an address anyone can read, and 290 kB that no longer ride inside a script.
// One day every being may carry a book like this — the same model at every scale.

// Chapter names and hints are translation KEYS; the markdown itself is the root as written.
const PAPERS = [
    { id: 'genesis', labelKey: 'wp_genesis', hintKey: 'wp_genesis_hint', file: 'GENESIS' },
    { id: 'lin', labelKey: 'wp_lin', hintKey: 'wp_lin_hint', file: 'LIN' },
    { id: 'architecture', labelKey: 'wp_architecture', hintKey: 'wp_architecture_hint', file: 'ARCHITECTURE' },
    { id: 'decisions', labelKey: 'wp_decisions', hintKey: 'wp_decisions_hint', file: 'DECISIONS' },
    { id: 'roadmap', labelKey: 'wp_roadmap', hintKey: 'wp_roadmap_hint', file: 'ROADMAP' },
    { id: 'questions', labelKey: 'wp_questions', hintKey: 'wp_questions_hint', file: 'QUESTIONS' },
    // The shadow chapter: the 2025 vision read against the organism it became —
    // "a vision keeps its tree as a shadow, so the two growths can be compared" (LIN).
    { id: 'seed', labelKey: 'wp_seed', hintKey: 'wp_seed_hint', file: 'SEED' },
] as const satisfies readonly { id: string; labelKey: string; hintKey: string; file: WhitePaperChapter }[];

// Markdown prose styling via arbitrary variants — no typography plugin needed.
const PROSE =
    'font-serif leading-relaxed text-slate-700 dark:text-slate-300 ' +
    '[&_h1]:mb-4 [&_h1]:font-sans [&_h1]:text-2xl [&_h1]:font-light [&_h1]:tracking-wide [&_h1]:text-slate-900 dark:[&_h1]:text-slate-50 ' +
    '[&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:font-sans [&_h2]:text-xs [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-[0.18em] [&_h2]:text-emerald-700 dark:[&_h2]:text-emerald-400 ' +
    '[&_p]:mb-4 [&_p]:text-[15px] ' +
    '[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1.5 [&_li]:text-[15px] ' +
    '[&_blockquote]:mb-4 [&_blockquote]:border-l-2 [&_blockquote]:border-amber-300 [&_blockquote]:bg-amber-50/50 dark:[&_blockquote]:border-amber-700 dark:[&_blockquote]:bg-amber-950/40 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:italic [&_blockquote]:text-slate-600 ' +
    '[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12.5px] [&_code]:text-emerald-800 dark:[&_code]:bg-slate-800 dark:[&_code]:text-emerald-300 ' +
    '[&_pre]:mb-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:text-emerald-100 ' +
    '[&_table]:mb-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm ' +
    '[&_th]:border-b [&_th]:border-slate-200 dark:[&_th]:border-slate-700 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-sans [&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-slate-500 dark:[&_th]:text-slate-400 ' +
    '[&_td]:border-b [&_td]:border-slate-100 dark:[&_td]:border-slate-800 [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top ' +
    '[&_hr]:my-6 [&_hr]:border-slate-100 dark:[&_hr]:border-slate-800 ' +
    '[&_a]:text-emerald-700 [&_a]:underline [&_a]:decoration-emerald-300 dark:[&_a]:text-emerald-400 dark:[&_a]:decoration-emerald-700 ' +
    '[&_strong]:font-bold [&_strong]:text-slate-900 dark:[&_strong]:text-white';

export const WhitePaperSection = () => {
    const { t } = useLanguage();
    const [open, setOpen] = useState(true); // arriving at the tab opens the book
    const [paper, setPaper] = useState<(typeof PAPERS)[number]['id']>('genesis');
    // A PDF the reader opened from a chapter link — shown in the in-app viewer (reach-card style)
    // instead of navigating the whole app away to the browser's bare document view.
    const [pdf, setPdf] = useState<{ src: string; title: string } | null>(null);
    const active = PAPERS.find(p => p.id === paper) || PAPERS[0];

    // Chapters arrive as they are opened and stay for the session; a chapter that could not be
    // fetched says so and offers another try (which clears its mark, so the effect asks again).
    const [texts, setTexts] = useState<Partial<Record<WhitePaperChapter, string>>>({});
    const [failed, setFailed] = useState<Partial<Record<WhitePaperChapter, true>>>({});
    const md = texts[active.file];
    useEffect(() => {
        if (!open || md !== undefined || failed[active.file]) return;
        let live = true;
        const file = active.file;
        fetchRootPaper(file)
            .then(text => { if (live) setTexts(t => ({ ...t, [file]: text })); })
            .catch(() => { if (live) setFailed(f => ({ ...f, [file]: true })); });
        return () => { live = false; };
    }, [open, active.file, md, failed]);
    const html = useMemo(() => md === undefined ? '' : sanitizeDocumentHtml(marked.parse(md, { async: false }) as string), [md]);

    const chapters: SectionItem[] = PAPERS.map(p => ({ key: p.id, label: t(p.labelKey) }));

    // PDF links inside a chapter open the viewer (a plain anchor would leave the app; the viewer
    // keeps the book open underneath and offers Download). Every other link behaves as itself.
    const onProseClick = (e: React.MouseEvent) => {
        const a = (e.target as HTMLElement).closest('a');
        const href = a?.getAttribute('href');
        if (a && href && href.toLowerCase().endsWith('.pdf')) {
            e.preventDefault();
            setPdf({ src: href, title: a.textContent || t('document_word') });
        }
    };

    return (
        <>
            {/* In-page card — the book's cover; the reader opens over it. */}
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm dark:bg-slate-900 dark:border-slate-800">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">{t('white_paper')}</p>
                <p className="mx-auto mt-2 max-w-md font-serif text-sm italic text-slate-500">{t('white_paper_note')}</p>
                <button onClick={() => setOpen(true)}
                    className="mt-4 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-bold uppercase tracking-widest text-white shadow transition-colors hover:bg-emerald-700">
                    {t('open_the_book')}
                </button>
            </div>

            {/* The reader — full screen below the page header: chapters left (desktop),
                horizontal menu on mobile, one document open at a time. A book. */}
            {open && createPortal(
                <div className="fixed inset-x-0 bottom-0 top-20 z-50 overflow-hidden bg-slate-50 dark:bg-slate-900">
                    <div className="mx-auto flex h-full max-w-6xl flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4 lg:flex-row lg:gap-6">
                        <div className="shrink-0 lg:w-60">
                            <div className="mb-2 flex items-center justify-between lg:mb-4">
                                <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">{t('white_paper')}</p>
                                <button onClick={() => setOpen(false)} title={t('close_the_book')} aria-label={t('close_the_book')}
                                    className="rounded-full bg-white p-2 text-slate-400 shadow-sm ring-1 ring-slate-200 transition-colors hover:text-slate-700 dark:bg-slate-900">
                                    <Icons.Close />
                                </button>
                            </div>
                            <SectionMenu items={chapters} active={paper} onSelect={(k) => setPaper(k as typeof paper)} />
                            <p className="mt-3 hidden text-[11px] italic leading-relaxed text-slate-400 lg:block">
                                {t('white_paper_hint').replace('{hint}', t(active.hintKey))}
                            </p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-10 dark:bg-slate-900 dark:border-slate-800">
                            {/* Our own root/ files, served by this deploy and sanitized anyway. The click
                                handler only delegates for anchors already in the content — keyboard
                                activation reaches those anchors natively. */}
                            {md !== undefined
                                ? <div className={PROSE} onClick={onProseClick} dangerouslySetInnerHTML={{ __html: html }} />
                                : failed[active.file]
                                    ? <div className="py-10 text-center">
                                        <p className="font-serif text-sm italic text-slate-500">{t('white_paper_unavailable')}</p>
                                        <button onClick={() => setFailed(f => { const { [active.file]: _gone, ...rest } = f; return rest; })}
                                            className="mt-4 rounded-full bg-emerald-600 px-5 py-2 text-xs font-bold uppercase tracking-widest text-white shadow transition-colors hover:bg-emerald-700">
                                            {t('refresh')}
                                        </button>
                                      </div>
                                    : <p className="py-10 text-center font-serif text-sm italic text-slate-400">{t('loading')}</p>}
                        </div>
                    </div>
                </div>,
                document.body,
            )}

            {pdf && <PdfViewer src={pdf.src} title={pdf.title} onClose={() => setPdf(null)} />}
        </>
    );
};
