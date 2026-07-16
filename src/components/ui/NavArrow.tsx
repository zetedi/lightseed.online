// The one navigation arrow used everywhere content scrolls — the reflection carousel, the events
// navigator, the section menu, the page-scroll affordance. A light round button whose white face
// reads over any background, with a single chevron pointing where more content lies. Kept in one
// place so every arrow looks and behaves identically (DRY).

export type NavDir = 'left' | 'right' | 'up' | 'down';

const PATH: Record<NavDir, string> = {
    left: 'm15 18-6-6 6-6',
    right: 'm9 18 6-6-6-6',
    up: 'm18 15-6-6-6 6',
    down: 'm6 9 6 6 6-6',
};

// The shared button skin (no position, no size) — for the few callers that place it themselves
// (the fixed page-scroll button). Most callers use <NavArrow>.
export const NAV_ARROW_CLS =
    'pointer-events-auto flex items-center justify-center rounded-full bg-white/90 text-slate-500 shadow ring-1 ring-emerald-100 transition-all duration-300 hover:bg-white hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500';

// Standard edge placement: the button sits centred on the axis and hangs ~2/5 of itself over the
// border on mobile, a touch more on sm+ — the same overhang for every arrow, so they read as one.
export const NAV_ARROW_PREV_X = '-left-3.5 sm:-left-4 top-1/2 -translate-y-1/2';
export const NAV_ARROW_NEXT_X = '-right-3.5 sm:-right-4 top-1/2 -translate-y-1/2';
export const NAV_ARROW_PREV_Y = '-top-3.5 sm:-top-4 left-1/2 -translate-x-1/2';
export const NAV_ARROW_NEXT_Y = '-bottom-3.5 sm:-bottom-4 left-1/2 -translate-x-1/2';

export const NavChevron = ({ dir, small = false }: { dir: NavDir; small?: boolean }) => {
    const px = small ? 14 : 18;
    return (
        <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATH[dir]} /></svg>
    );
};

// An absolutely-positioned nav arrow. `pos` supplies the edge placement + overhang (usually one of
// the NAV_ARROW_*_X/Y constants, optionally with extra classes like `lg:hidden`). `hidden` fades it
// out when there's nothing that way; `small` is the compact section-menu size.
export const NavArrow = ({ dir, onClick, label, pos, hidden = false, small = false }: {
    dir: NavDir;
    onClick: () => void;
    label: string;
    pos: string;
    hidden?: boolean;
    small?: boolean;
}) => (
    <button type="button" aria-label={label} onClick={onClick}
            className={`${NAV_ARROW_CLS} absolute z-20 ${small ? 'h-7 w-7' : 'h-9 w-9'} ${pos} ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
        <NavChevron dir={dir} small={small} />
    </button>
);
