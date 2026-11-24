import type { HTMLAttributes, ReactNode } from 'react';
import { NavArrow, NAV_ARROW_PREV_X, NAV_ARROW_NEXT_X } from '../ui/NavArrow';

// THE ONE CAROUSEL CARD (ring 2026-11-24): the rounded card, the two arrows hanging over its
// border and the row of dots under what it shows — drawn once, so the reflections and the
// featured videos are the same carousel holding different things. The frame keeps no state: its
// owner says how many there are, which one is shown and what moving means; arrows and dots
// appear only where there is more than one. The card centres what it holds, so two cards
// sharing a row can take the taller one's height without either looking emptied.
interface CarouselFrameProps extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'className'> {
  count: number;
  index: number;
  // Asked with the wished index, which may fall one outside the list — the owner wraps it.
  onGo: (n: number) => void;
  label: string;
  prevLabel: string;
  nextLabel: string;
  // The name of the dot for the nth item, counted from one.
  dotLabel: (n: number) => string;
  className?: string;
  children: ReactNode;
}

export const CarouselFrame = ({ count, index, onGo, label, prevLabel, nextLabel, dotLabel, className = '', children, ...rest }: CarouselFrameProps) => (
  <section
    aria-roledescription="carousel"
    aria-label={label}
    className={`relative flex w-full flex-col justify-center rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 shadow-sm dark:border-emerald-900/40 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/60 dark:shadow-none ${className}`}
    {...rest}
  >
    {children}

    {count > 1 && (
      <>
        <NavArrow dir="left" label={prevLabel} onClick={() => onGo(index - 1)} pos={NAV_ARROW_PREV_X} />
        <NavArrow dir="right" label={nextLabel} onClick={() => onGo(index + 1)} pos={NAV_ARROW_NEXT_X} />

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:mt-5">
          {Array.from({ length: count }, (_, n) => (
            <button key={n} type="button" onClick={() => onGo(n)} aria-label={dotLabel(n + 1)} aria-current={n === index}
              className={`h-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${n === index ? 'w-6 bg-emerald-600 dark:bg-emerald-400' : 'w-2 bg-emerald-200 hover:bg-emerald-300 dark:bg-emerald-800 dark:hover:bg-emerald-700'}`} />
          ))}
        </div>
      </>
    )}
  </section>
);
