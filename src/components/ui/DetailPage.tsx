import { Icons } from './Icons';

// THE PAGE A BEING OPENS ON — every detail view (tree, vision, event, Light House, pulse,
// covenant, offering, bed, alignment) arrives the same way: full height, a soft zoom-in.
// `DETAIL_PAGE` is that arrival alone, for shells whose sections bring their own ground;
// `DETAIL_PAGE_GROUNDED` adds the slate ground and the foot room for shells that draw cards on it.
export const DETAIL_PAGE = 'min-h-screen animate-in fade-in zoom-in-95 duration-300';
export const DETAIL_PAGE_GROUNDED = `${DETAIL_PAGE} pb-20 bg-slate-50 dark:bg-slate-900`;

// The way back, at the top-left of every hero.
export const HeroBack = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button onClick={onClick} className="flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white">
        <Icons.ArrowLeft />
        <span>{label}</span>
    </button>
);
