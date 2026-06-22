import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// A living scroll affordance: replaces a raw scrollbar with a small double chevron that bobs
// toward where more content lies, in front of an emerald vignette. Shows only when there's more
// that way; clicking scrolls a near-page.
//
//   • contained (default): pass the scrollable element's ref + axis; renders `absolute` at the
//     edges of the nearest `relative` ancestor (carousels). Give the scroller `scroll-hide-bar`.
//   • fixed (page-level): omit scrollRef to track the document, set `fixed` — renders centered
//     chevrons pinned to the viewport top/bottom, portaled to <body>.

type Axis = 'x' | 'y';
type Dir = 'left' | 'right' | 'up' | 'down';

const PATHS: Record<Dir, [string, string]> = {
    left: ['m11 17-5-5 5-5', 'm18 17-5-5 5-5'],
    right: ['m6 17 5-5-5-5', 'm13 17 5-5-5-5'],
    up: ['m17 11-5-5-5 5', 'm17 18-5-5-5 5'],
    down: ['m7 6 5 5 5-5', 'm7 13 5 5 5-5'],
};

const DoubleChevron = ({ dir }: { dir: Dir }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
         strokeLinecap="round" strokeLinejoin="round" style={{ animation: `sc-bob-${dir} 1.6s ease-in-out infinite` }}>
        <path d={PATHS[dir][0]} /><path d={PATHS[dir][1]} />
    </svg>
);

export const ScrollChevrons = ({ scrollRef, axis = 'y', fixed = false }: {
    scrollRef?: React.RefObject<HTMLElement | null>;
    axis?: Axis;
    fixed?: boolean;
}) => {
    const [canPrev, setCanPrev] = useState(false);
    const [canNext, setCanNext] = useState(false);

    useEffect(() => {
        const usingDoc = !scrollRef;
        const get = (): HTMLElement | null => scrollRef?.current ?? (document.scrollingElement as HTMLElement | null);
        const target: (Window & typeof globalThis) | HTMLElement | null = usingDoc ? window : (scrollRef!.current ?? null);
        if (!target) return;
        const update = () => {
            const s = get();
            if (!s) return;
            if (axis === 'x') {
                setCanPrev(s.scrollLeft > 8);
                setCanNext(s.scrollLeft < s.scrollWidth - s.clientWidth - 8);
            } else {
                setCanPrev(s.scrollTop > 8);
                setCanNext(s.scrollTop < s.scrollHeight - s.clientHeight - 8);
            }
        };
        update();
        target.addEventListener('scroll', update, { passive: true });
        // Observe the scroller + its content (and the page body) so the arrows track content growth.
        const ro = new ResizeObserver(update);
        const el = get();
        if (el) { ro.observe(el); if (el.firstElementChild) ro.observe(el.firstElementChild); }
        if (usingDoc) ro.observe(document.body);
        window.addEventListener('resize', update);
        return () => { target.removeEventListener('scroll', update); ro.disconnect(); window.removeEventListener('resize', update); };
    }, [scrollRef, axis, fixed]);

    const nudge = (dir: 1 | -1) => {
        const s = scrollRef?.current ?? (document.scrollingElement as HTMLElement | null);
        const by = axis === 'x'
            ? { left: dir * (s?.clientWidth || window.innerWidth) * 0.8, behavior: 'smooth' as const }
            : { top: dir * (s?.clientHeight || window.innerHeight) * 0.85, behavior: 'smooth' as const };
        (scrollRef?.current ?? window).scrollBy(by);
    };

    // Page-level: a centered double chevron over an emerald vignette pinned to the bottom of the
    // viewport, shown while more content lies below. Portaled to <body> so no ancestor's overflow
    // or transform can trap/clip it. (Down only — scrolling back up is natural, and a top chevron
    // would collide with the sticky nav.)
    if (fixed) {
        const overlay = (
            <div className={`pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center transition-opacity duration-300 ${canNext ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex h-16 w-48 items-end justify-center pb-2" style={{ background: 'radial-gradient(60% 100% at 50% 100%, rgba(2,44,34,0.55), transparent 75%)' }}>
                    <button type="button" aria-label="Scroll down" onClick={() => nudge(1)}
                            className="pointer-events-auto rounded-full p-1 text-emerald-50 drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)] transition-transform hover:scale-110 active:scale-95">
                        <DoubleChevron dir="down" />
                    </button>
                </div>
            </div>
        );
        return createPortal(overlay, document.body);
    }

    // Contained: edge buttons absolutely positioned within a `relative` parent (carousels, etc.).
    const prevDir: Dir = axis === 'x' ? 'left' : 'up';
    const nextDir: Dir = axis === 'x' ? 'right' : 'down';
    const base = 'pointer-events-auto absolute z-20 flex text-emerald-50 drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)] transition-opacity duration-300';
    const prevPos = axis === 'x' ? 'left-0 inset-y-0 w-12 items-center justify-start pl-1' : 'top-0 inset-x-0 h-12 items-start justify-center pt-1';
    const nextPos = axis === 'x' ? 'right-0 inset-y-0 w-12 items-center justify-end pr-1' : 'bottom-0 inset-x-0 h-12 items-end justify-center pb-1';
    const prevGrad = axis === 'x'
        ? 'linear-gradient(to right, rgba(2,44,34,0.92), rgba(2,44,34,0))'
        : 'linear-gradient(to bottom, rgba(2,44,34,0.92), rgba(2,44,34,0))';
    const nextGrad = axis === 'x'
        ? 'linear-gradient(to left, rgba(2,44,34,0.92), rgba(2,44,34,0))'
        : 'linear-gradient(to top, rgba(2,44,34,0.92), rgba(2,44,34,0))';

    return (
        <>
            <button type="button" aria-label="Scroll back" onClick={() => nudge(-1)}
                    className={`${base} ${prevPos} ${canPrev ? 'opacity-100 hover:opacity-90' : 'pointer-events-none opacity-0'}`}
                    style={{ background: prevGrad }}>
                <DoubleChevron dir={prevDir} />
            </button>
            <button type="button" aria-label="Scroll forward" onClick={() => nudge(1)}
                    className={`${base} ${nextPos} ${canNext ? 'opacity-100 hover:opacity-90' : 'pointer-events-none opacity-0'}`}
                    style={{ background: nextGrad }}>
                <DoubleChevron dir={nextDir} />
            </button>
        </>
    );
};
