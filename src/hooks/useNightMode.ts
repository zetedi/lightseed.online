import { useEffect, useState } from 'react';

// IS THE SHELL IN NIGHT? (ring 2026-09-11) Tailwind's `dark:` follows `data-mode="dark"` on the
// root element (useSiteTheme writes it), which is enough for anything written in classes. A few
// surfaces are painted from JavaScript instead — a list box tinted with its destination's own
// pigment — and those need the same answer as a value. One observer on the one attribute; no
// prop threaded through five components to say what the document already knows.
export const useNightMode = (): boolean => {
  const read = () => typeof document !== 'undefined' && document.documentElement.dataset.mode === 'dark';
  const [night, setNight] = useState<boolean>(read);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setNight(el.dataset.mode === 'dark');
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(el, { attributes: true, attributeFilter: ['data-mode'] });
    return () => observer.disconnect();
  }, []);
  return night;
};
