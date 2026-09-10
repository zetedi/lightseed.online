import React, { useRef } from 'react';
import { NavArrow, NAV_ARROW_PREV_X, NAV_ARROW_NEXT_X } from './NavArrow';
import { useLanguage } from '../../contexts/LanguageContext';

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
  const { t } = useLanguage();
  const navRef = useRef<HTMLElement>(null);
  const nudge = (dx: number) => navRef.current?.scrollBy({ left: dx, behavior: 'smooth' });

  return (
    <div className={`relative ${className}`}>
      <nav ref={navRef} className={`flex gap-1.5 overflow-x-auto px-7 pb-1 scroll-hide-bar lg:px-0 ${orientation === 'responsive' ? 'lg:flex-col lg:overflow-visible lg:pb-0' : ''}`}>
        {items.map(s => {
          const on = active === s.key;
          return (
            <button key={s.key} onClick={() => onSelect(s.key)}
              className={`group flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${orientation === 'responsive' ? 'lg:w-full' : ''} ${on ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'}`}>
              {s.icon && (
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors [&>svg]:h-4 [&>svg]:w-4 ${on ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 group-hover:text-slate-600 dark:bg-slate-800 dark:text-slate-500 dark:group-hover:text-slate-300'}`}>{s.icon}</span>
              )}
              <span>{s.label}</span>
            </button>
          );
        })}
      </nav>
      {/* Mobile-only scroll arrows (the lg sidebar is vertical and never overflows sideways). */}
      <NavArrow dir="left" small label={t('scroll_menu_left')} onClick={() => nudge(-180)} pos={`${NAV_ARROW_PREV_X} lg:hidden`} />
      <NavArrow dir="right" small label={t('scroll_menu_right')} onClick={() => nudge(180)} pos={`${NAV_ARROW_NEXT_X} lg:hidden`} />
    </div>
  );
};
