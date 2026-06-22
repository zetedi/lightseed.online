import React, { useEffect, useRef, useState } from 'react';

// A living scroll affordance: replaces the raw scrollbar with a small double chevron that
// bounces toward the direction more content lies, sitting in front of an emerald vignette.
// Drop it anywhere inside a vertically-scrollable container — it finds the scroller itself,
// shows only when there's more to see that way, and scrolls a near-page on click.

function getScrollParent(el: HTMLElement | null): HTMLElement {
    let node = el?.parentElement || null;
    while (node) {
        const oy = getComputedStyle(node).overflowY;
        if (oy === 'auto' || oy === 'scroll') return node;
        node = node.parentElement;
    }
    return (document.scrollingElement as HTMLElement) || document.documentElement;
}

export const ScrollChevrons = () => {
    const anchorRef = useRef<HTMLDivElement>(null);
    const [scroller, setScroller] = useState<HTMLElement | null>(null);
    const [canUp, setCanUp] = useState(false);
    const [canDown, setCanDown] = useState(false);

    useEffect(() => { setScroller(getScrollParent(anchorRef.current)); }, []);

    useEffect(() => {
        if (!scroller) return;
        const target: HTMLElement | Window =
            scroller === document.documentElement || scroller === document.body ? window : scroller;
        const update = () => {
            const top = scroller.scrollTop;
            const max = scroller.scrollHeight - scroller.clientHeight;
            setCanUp(top > 24);
            setCanDown(top < max - 24);
        };
        update();
        target.addEventListener('scroll', update, { passive: true });
        // Observe the box AND its content child: the scroller's box is viewport-fixed, so only the
        // content growing (e.g. images loading) changes scrollHeight — observe that to reveal arrows.
        const ro = new ResizeObserver(update);
        ro.observe(scroller);
        if (scroller.firstElementChild) ro.observe(scroller.firstElementChild);
        window.addEventListener('resize', update);
        return () => {
            target.removeEventListener('scroll', update);
            ro.disconnect();
            window.removeEventListener('resize', update);
        };
    }, [scroller]);

    const nudge = (dir: 1 | -1) => {
        scroller?.scrollBy({ top: dir * scroller.clientHeight * 0.85, behavior: 'smooth' });
    };

    return (
        <>
            <div ref={anchorRef} aria-hidden="true" className="pointer-events-none absolute h-0 w-0" />
            <style>{`
              @keyframes sc-bob-down { 0%,100%{transform:translateY(0)} 50%{transform:translateY(4px)} }
              @keyframes sc-bob-up { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
            `}</style>

            {/* Up — more content above */}
            <div className={`pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center transition-opacity duration-300 ${canUp ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex h-16 w-40 items-start justify-center pt-1.5"
                     style={{ background: 'radial-gradient(60% 90% at 50% 0%, rgba(16,185,129,0.30), transparent 72%)' }}>
                    <button type="button" onClick={() => nudge(-1)} aria-label="Scroll up"
                            className="pointer-events-auto rounded-full p-1 text-emerald-100 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] transition-transform hover:scale-110 active:scale-95"
                            style={{ animation: 'sc-bob-up 1.6s ease-in-out infinite' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m17 11-5-5-5 5" /><path d="m17 18-5-5-5 5" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Down — more content below */}
            <div className={`pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center transition-opacity duration-300 ${canDown ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex h-16 w-40 items-end justify-center pb-1.5"
                     style={{ background: 'radial-gradient(60% 90% at 50% 100%, rgba(16,185,129,0.30), transparent 72%)' }}>
                    <button type="button" onClick={() => nudge(1)} aria-label="Scroll down"
                            className="pointer-events-auto rounded-full p-1 text-emerald-100 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] transition-transform hover:scale-110 active:scale-95"
                            style={{ animation: 'sc-bob-down 1.6s ease-in-out infinite' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m7 6 5 5 5-5" /><path d="m7 13 5 5 5-5" />
                        </svg>
                    </button>
                </div>
            </div>
        </>
    );
};
