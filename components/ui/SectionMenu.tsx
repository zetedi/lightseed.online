import React from 'react';

// A reusable profile-style section menu: a horizontal strip on mobile, a vertical list on lg+.
// Shared across the tree / community / user / event "profile" views.
export interface SectionItem { key: string; label: string; icon?: React.ReactNode }

export const SectionMenu = ({ items, active, onSelect, className = '' }: {
  items: SectionItem[];
  active: string;
  onSelect: (key: string) => void;
  className?: string;
}) => (
  <nav className={`flex gap-1.5 overflow-x-auto pb-1 scroll-hide-bar lg:flex-col lg:overflow-visible lg:pb-0 ${className}`}>
    {items.map(s => {
      const on = active === s.key;
      return (
        <button key={s.key} onClick={() => onSelect(s.key)}
          className={`group flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all lg:w-full ${on ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
          {s.icon && (
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors [&>svg]:h-4 [&>svg]:w-4 ${on ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'}`}>{s.icon}</span>
          )}
          <span>{s.label}</span>
        </button>
      );
    })}
  </nav>
);
