import React, { useRef } from 'react';

// A reusable profile-style section menu: a horizontal strip on mobile, a vertical list on lg+.
// Shared across the tree / community / user / event "profile" views. On mobile the strip gets
// left/right arrows so the overflow is discoverable (swiping alone hid the far sections).
export interface SectionItem { key: string; label: string; icon?: React.ReactNode }

export const SectionMenu = ({ items, active, onSelect, className = '', orientation = 'responsive' }: {
  items: SectionItem[];
  active: string;
  onSelect: (key: string) => void;
  className?: string;
  orientation?: 'responsive' | 'horizontal'; // responsive = vertical sidebar on lg; horizontal = always a row
}) => {
  const navRef = useRef<HTMLElement>(null);
  const nudge = (dx: number) => navRef.current?.scrollBy({ left: dx, behavior: 'smooth' });
  const arrowCls = 'absolute top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-100 bg-white/95 text-slate-500 shadow-md transition-colors hover:text-emerald-700 lg:hidden';

  return (
    <div className={`relative ${className}`}>
      <nav ref={navRef} className={`flex gap-1.5 overflow-x-auto px-7 pb-1 scroll-hide-bar lg:px-0 ${orientation === 'responsive' ? 'lg:flex-col lg:overflow-visible lg:pb-0' : ''}`}>
        {items.map(s => {
          const on = active === s.key;
          return (
            <button key={s.key} onClick={() => onSelect(s.key)}
              className={`group flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${orientation === 'responsive' ? 'lg:w-full' : ''} ${on ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
              {s.icon && (
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors [&>svg]:h-4 [&>svg]:w-4 ${on ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'}`}>{s.icon}</span>
              )}
              <span>{s.label}</span>
            </button>
          );
        })}
      </nav>
      {/* Mobile-only scroll arrows (the lg sidebar is vertical and never overflows sideways). */}
      <button type="button" onClick={() => nudge(-180)} aria-label="Scroll menu left" className={`${arrowCls} left-0`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <button type="button" onClick={() => nudge(180)} aria-label="Scroll menu right" className={`${arrowCls} right-0`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
  );
};
