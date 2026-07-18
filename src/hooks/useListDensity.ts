import { useState } from 'react';

// The three densities every list can be read at: full cards (the current look), half-size mini
// cards, and rows (small avatar + title + description). Remembered per page in localStorage so
// each list keeps the density its reader chose.
export type ListDensity = 'cards' | 'mini' | 'rows';

export const useListDensity = (page: string): [ListDensity, (d: ListDensity) => void] => {
  const key = `lifeseed.density.${page}`;
  const [density, setDensityState] = useState<ListDensity>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved === 'mini' || saved === 'rows' ? saved : 'cards';
    } catch { return 'cards'; }
  });
  const setDensity = (d: ListDensity) => {
    setDensityState(d);
    try { localStorage.setItem(key, d); } catch { /* private mode */ }
  };
  return [density, setDensity];
};

// The grid wrapper for each density — shared by every list page.
export const densityGridClass = (d: ListDensity): string =>
  d === 'rows' ? 'flex flex-col gap-2.5'
  : d === 'mini' ? 'grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'
  : 'grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
