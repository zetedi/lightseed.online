import { createPortal } from 'react-dom';
import { Icons } from './Icons';

// A PDF viewer over the app — the reach screen's card holding a document instead of messages:
// FULL SCREEN on mobile (a whisper of margin + radius, so the card visibly floats OVER the app),
// BELOW the sticky header on desktop (top-20 — the page header stays visible and usable). The
// browser's own engine renders the PDF (no bundled reader); the Download pill keeps the document
// take-away-able everywhere — including the odd mobile engine that inlines only a first page.
export const PdfViewer = ({ src, title, onClose }: { src: string; title: string; onClose: () => void }) => createPortal(
    <div className="fixed inset-x-0 bottom-0 top-0 z-50 bg-slate-900/90 backdrop-blur-sm sm:top-20">
        <div className="mx-auto h-full w-full max-w-6xl px-2 py-2 sm:px-6 sm:py-6 lg:py-10">
            <div className="relative flex h-full flex-col rounded-2xl bg-white p-3 pt-12 shadow-2xl sm:p-6 sm:pt-14">
                <p className="absolute left-4 right-40 top-4 truncate text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 sm:left-6 sm:top-5">
                    {title}
                </p>
                <a
                    href={src}
                    download
                    className="absolute right-14 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                    <Icons.Download size={14} /> Download
                </a>
                <button
                    onClick={onClose}
                    title="Close"
                    aria-label="Close the document"
                    className="absolute right-3 top-3 z-10 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                    <Icons.Close />
                </button>
                <iframe src={src} title={title} className="min-h-0 w-full flex-1 rounded-xl border border-slate-100 bg-slate-50" />
            </div>
        </div>
    </div>,
    document.body,
);
