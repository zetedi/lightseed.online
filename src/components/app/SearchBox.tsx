import React from 'react';
import { Icons } from '../ui/Icons';
import { useLanguage } from '../../contexts/LanguageContext';

// THE SEARCH BOX (ring 2026-09-16, lifted out of App.tsx unchanged): reused inside the
// Visions/Events/Pulses headers (under the title), and in the forest's band in its own
// white-on-tone dress. One datalist of suggestions serves both.
export const SearchBox: React.FC<{
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  forest?: boolean;
}> = ({ value, onChange, suggestions, forest = false }) => {
  const { t } = useLanguage();
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
        <Icons.Search />
      </div>
      <input
        dir="auto"
        type="text"
        list="search-suggestions"
        className={forest
          ? 'block w-full pl-10 pr-3 py-2 border border-white/20 rounded-xl leading-5 bg-white/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-white focus:border-white sm:text-sm shadow-sm dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder-slate-500'
          : 'block w-full pl-10 pr-3 py-2 border border-emerald-100 rounded-xl leading-5 bg-white/80 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder-slate-500'}
        placeholder={t('search_placeholder')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id="search-suggestions">
        {suggestions.map((s, i) => <option key={i} value={s} />)}
      </datalist>
    </div>
  );
};
