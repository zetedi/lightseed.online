import { ReactNode, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

// THE ONE MODAL SHELL (ring 2026-09-03) — every dialog in the app wears this skin: the same
// backdrop, panel, header and close, and the same buttons (modalButton / ModalActions below),
// so a modal reads as a modal wherever it opens. The global Dialog (alert / confirm) and the
// crop editor render their own panels because they must STACK above an open Modal, but they
// dress from these very classes; nothing else hand-rolls an overlay.
export const MODAL_BACKDROP = 'fixed inset-0 flex items-center justify-center bg-slate-900/90 backdrop-blur-md';
export const MODAL_PANEL = 'w-full rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95';
export const MODAL_TITLE = 'font-semibold text-slate-800';
export const MODAL_CLOSE = 'p-1 rounded-full transition-colors text-slate-400 hover:bg-slate-100 hover:text-slate-600';

// The modal's buttons: one shape (rounded-xl, the same padding and weight), a hue per meaning.
// `primary` defaults to the app's emerald; a hue may name the action's own colour (sky for
// water and events, amber for a vision, red for danger). Secondary is the quiet cancel.
export type ModalButtonKind = 'primary' | 'secondary' | 'secondary-dark' | 'danger' | 'ghost';
export type ModalButtonHue = 'emerald' | 'sky' | 'amber' | 'indigo' | 'violet' | 'red' | 'slate';
const HUES: Record<ModalButtonHue, string> = {
    emerald: 'bg-emerald-600 text-white shadow-md hover:bg-emerald-700',
    sky: 'bg-sky-600 text-white shadow-md hover:bg-sky-700',
    amber: 'bg-amber-500 text-white shadow-md hover:bg-amber-600',
    indigo: 'bg-indigo-600 text-white shadow-md hover:bg-indigo-500',
    violet: 'bg-violet-600 text-white shadow-md hover:bg-violet-500',
    red: 'bg-red-600 text-white shadow-md hover:bg-red-700',
    slate: 'bg-slate-800 text-white shadow-md hover:bg-slate-700',
};
export const modalButton = (
    kind: ModalButtonKind = 'primary',
    opts: { hue?: ModalButtonHue; full?: boolean; extra?: string } = {},
): string => {
    const base = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';
    const look = kind === 'primary' ? HUES[opts.hue || 'emerald']
        : kind === 'danger' ? HUES.red
        : kind === 'secondary' ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        : kind === 'secondary-dark' ? 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
        : 'text-slate-500 hover:bg-slate-100';
    return [base, look, opts.full === false ? '' : 'w-full', opts.extra || ''].filter(Boolean).join(' ');
};

// A row of modal buttons — the quiet one beside the decisive one, each taking its share.
export const ModalActions = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <div className={`flex gap-3 ${className}`}>{children}</div>
);

interface ModalProps {
    children?: ReactNode;
    onClose: () => void;
    title: string;
    backgroundImage?: string;
    fullScreenOnMobile?: boolean;
    innerGlow?: boolean;
    wide?: boolean;
}

export const Modal = ({ children, onClose, title, backgroundImage, fullScreenOnMobile, innerGlow, wide }: ModalProps) => {
    const desktopWidth = wide ? 'sm:max-w-2xl' : 'sm:max-w-md';
    const titleId = useId();
    // Escape closes, like every dialog a reader has met. (The backdrop does NOT: a tap beside a
    // half-filled form must never throw the form away.)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    // Portaled to <body>: a Modal is often rendered inside a stacking context (the sticky z-30
    // nav, a transformed card) where its own z-index is capped below root overlays like the
    // body-portaled mobile menu (z-95) — so it would paint UNDER the menu no matter its z-index,
    // and a confirm inside it would need a second tap. At the body it is truly on top.
    // z-[98]: above the mobile menu (95), below dialogs (100) so a confirm/alert still layers up.
    return createPortal(
    <div className={`${MODAL_BACKDROP} z-[98] ${fullScreenOnMobile ? 'p-0 sm:p-4' : 'p-4'}`}>
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 ${backgroundImage ? 'text-white' : 'bg-white'} ${
                fullScreenOnMobile
                    ? `w-full h-full max-h-full rounded-none sm:h-auto sm:max-h-[90vh] sm:w-full ${desktopWidth} sm:rounded-2xl`
                    : `w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] rounded-2xl`
            }`}
            style={backgroundImage ? { backgroundImage: `url("${backgroundImage}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
            <div className={`shrink-0 px-4 py-3 border-b flex justify-between items-center ${backgroundImage ? 'bg-slate-900/90 border-white/10 backdrop-blur-md' : 'bg-slate-50 border-slate-100'}`}>
                <h3 id={titleId} className={backgroundImage ? 'font-semibold text-emerald-100 drop-shadow-md' : MODAL_TITLE}>{title}</h3>
                <button type="button" onClick={onClose} aria-label="Close" className={backgroundImage ? 'p-1 rounded-full transition-colors text-white/80 hover:bg-white/20 hover:text-white' : MODAL_CLOSE}>&times;</button>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 ${backgroundImage ? 'bg-slate-900/90 backdrop-blur-md' : ''} ${innerGlow ? 'shadow-[inset_0_0_70px_rgba(16,185,129,0.35)]' : ''}`}>
                {children}
            </div>
        </div>
    </div>,
    document.body,
    );
};
