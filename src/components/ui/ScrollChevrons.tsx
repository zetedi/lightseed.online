import React from 'react';
import { createPortal } from 'react-dom';
import { NavArrow, NavChevron, NAV_ARROW_PREV_X, NAV_ARROW_NEXT_X, NAV_ARROW_PREV_Y, NAV_ARROW_NEXT_Y } from './NavArrow';
import { useScrollEdges } from '../../hooks/useScrollEdges';

// A scroll affordance built from the shared NavArrow: a light round chevron shown only when there
// is more content that way; clicking scrolls a near-page.
//
//   • contained (default): pass the scrollable element's ref + axis; renders `absolute` at the
//     edges of the nearest `relative` ancestor (carousels). Give the scroller `scroll-hide-bar`.
//   • fixed (page-level): omit scrollRef to track the document, set `fixed` — a down chevron
//     pinned to the bottom of the viewport, portaled to <body>, gently bobbing.

type Axis = 'x' | 'y';

export const ScrollChevrons = ({ scrollRef, axis = 'y', fixed = false }: {
    scrollRef?: React.RefObject<HTMLElement | null>;
    axis?: Axis;
    fixed?: boolean;
}) => {
    // Same source the events fade reads (useScrollEdges), so arrow and fade appear together.
    const { canPrev, canNext } = useScrollEdges(scrollRef, axis);

    const nudge = (dir: 1 | -1) => {
        const s = scrollRef?.current ?? (document.scrollingElement as HTMLElement | null);
        const by = axis === 'x'
            ? { left: dir * (s?.clientWidth || window.innerWidth) * 0.8, behavior: 'smooth' as const }
            : { top: dir * (s?.clientHeight || window.innerHeight) * 0.85, behavior: 'smooth' as const };
        (scrollRef?.current ?? window).scrollBy(by);
    };

    // Page-level: the shared arrow pinned to the bottom of the viewport, shown while more content
    // lies below and gently bobbing. Portaled to <body> so no ancestor's overflow or transform can
    // trap/clip it. (Down only — scrolling back up is natural, and a top chevron would collide with
    // the sticky nav.)
    if (fixed) {
        // Subtle by design: a small half-circle tab flush to the bottom edge (a dome, not a full
        // round button), so on mobile it barely covers anything. One down chevron, gently bobbing.
        const overlay = (
            <div className={`pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center transition-opacity duration-300 ${canNext ? 'opacity-100' : 'opacity-0'}`}>
                <button type="button" aria-label="Scroll down" onClick={() => nudge(1)}
                        className="pointer-events-auto flex h-5 w-11 items-center justify-center rounded-t-full bg-white/60 text-slate-400 shadow-sm ring-1 ring-emerald-100/50 backdrop-blur-sm transition-colors hover:bg-white hover:text-emerald-600"
                        style={{ animation: 'sc-bob-down 1.8s ease-in-out infinite' }}>
                    <NavChevron dir="down" small />
                </button>
            </div>
        );
        return createPortal(overlay, document.body);
    }

    // Contained: the shared arrow at each edge of the nearest `relative` ancestor, overhanging the
    // border (the parent must not clip that axis). Horizontal drives the events navigator; vertical
    // is available for future contained scrollers.
    if (axis === 'x') {
        return (
            <>
                <NavArrow dir="left" label="Scroll back" onClick={() => nudge(-1)} pos={NAV_ARROW_PREV_X} hidden={!canPrev} />
                <NavArrow dir="right" label="Scroll forward" onClick={() => nudge(1)} pos={NAV_ARROW_NEXT_X} hidden={!canNext} />
            </>
        );
    }
    return (
        <>
            <NavArrow dir="up" label="Scroll up" onClick={() => nudge(-1)} pos={NAV_ARROW_PREV_Y} hidden={!canPrev} />
            <NavArrow dir="down" label="Scroll down" onClick={() => nudge(1)} pos={NAV_ARROW_NEXT_Y} hidden={!canNext} />
        </>
    );
};
