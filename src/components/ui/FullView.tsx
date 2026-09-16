import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './Icons';
import { Picture } from './Picture';
import { MODAL_CLOSE } from './Modal';
import { useLanguage } from '../../contexts/LanguageContext';

// THE FULL VIEW (ring 2026-09-16). Every picture in the seed is served small for its seat —
// a card, an avatar, a hero. A flyer for a ceremony, a watering proof, a tree's portrait
// sometimes wants to be seen WHOLE: this is the one seat that asks for the primary. A
// FullViewButton rides the corner of a picture (or wraps a small thumbnail so the whole
// thumb is the door); it opens the picture over everything, on the modal's own night, and
// Escape, the backdrop or the cross let go. It never navigates: a card that opens a being on
// click keeps doing so; the button stops the click at itself. No entrance animation and no
// backdrop blur here, and the picture decodes SYNCHRONOUSLY: with async decoding Chrome left a
// 1600px picture unpainted on first open until the next style change (walked 2026-09-16); the
// night simply appears, and the picture with it.

export const FullView: React.FC<{ src: string; alt?: string; onClose: () => void }> = ({ src, alt, onClose }) => {
  const { t } = useLanguage();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || t('full_view')}
      // A portal's clicks bubble through the REACT tree, not the DOM: without the stop, closing
      // the view would also tap the card the button sits on (walked 2026-09-16: a chain leaf
      // opened its pulse on close).
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/95 p-4"
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label={t('close')}
        title={t('close')}
        className={`${MODAL_CLOSE} absolute right-4 top-4 z-10 text-white/80 hover:bg-white/15 hover:text-white`}
      >
        <Icons.Close />
      </button>
      <figure className="m-0 flex max-h-full max-w-full flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
        <Picture
          src={src}
          size="primary"
          loading="eager"
          decoding="sync"
          alt={alt || ''}
          referrerPolicy="no-referrer"
          className="max-h-[88vh] max-w-[96vw] rounded-lg object-contain shadow-2xl"
        />
        {alt && <figcaption dir="auto" className="max-w-[90vw] text-center text-sm text-white/80">{alt}</figcaption>}
      </figure>
    </div>,
    document.body,
  );
};

// The door to the full view. Default: a small round button at a corner of its (relative)
// parent. `wrap`: the children themselves become the button — for a thumbnail too small to
// carry a corner. Either way the click stops here, so a clickable card underneath stays put.
// Rendered as a <span role="button">, never a <button>: cards are <button>s themselves, and a
// button may not nest inside one (the LoveButton's inline precedent).
export const FullViewButton: React.FC<{
  src?: string | null;
  alt?: string;
  className?: string;
  wrap?: boolean;
  children?: React.ReactNode;
}> = ({ src, alt, className, wrap = false, children }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  if (!src) return <>{children}</>;
  const openIt = (e: React.MouseEvent | React.KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); setOpen(true); };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') openIt(e); };
  const door = { role: 'button' as const, tabIndex: 0, onClick: openIt, onKeyDown: onKey, 'aria-label': t('full_view'), title: t('full_view') };
  return (
    <>
      {wrap ? (
        <span {...door} className={`group/full relative block cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${className || ''}`}>
          {children}
          <span aria-hidden className="pointer-events-none absolute bottom-0.5 right-0.5 rounded-full bg-black/45 p-0.5 text-white opacity-0 transition-opacity group-hover/full:opacity-100"><Icons.Expand size={12} /></span>
        </span>
      ) : (
        <span
          {...door}
          className={`absolute z-10 cursor-zoom-in rounded-full bg-black/45 p-1.5 text-white/90 shadow backdrop-blur transition-colors hover:bg-black/65 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${className || 'right-2 top-2'}`}
        >
          <Icons.Expand size={16} />
        </span>
      )}
      {open && <FullView src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
};
