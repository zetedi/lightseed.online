import { useEffect, useState, type RefObject } from 'react';

// Whether a scroller has more content before / after the current position on a given axis — the
// single source of truth for scroll affordances. The nav arrows AND the edge fade both read it,
// so a fade appears exactly where (and only where) an arrow does. Pass no ref to track the page.
export const useScrollEdges = (scrollRef: RefObject<HTMLElement | null> | undefined, axis: 'x' | 'y' = 'y') => {
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
        // Observe the scroller + its content (and the page body) so the edges track content growth.
        const ro = new ResizeObserver(update);
        const el = get();
        if (el) { ro.observe(el); if (el.firstElementChild) ro.observe(el.firstElementChild); }
        if (usingDoc) ro.observe(document.body);
        window.addEventListener('resize', update);
        return () => { target.removeEventListener('scroll', update); ro.disconnect(); window.removeEventListener('resize', update); };
    }, [scrollRef, axis]);

    return { canPrev, canNext };
};
