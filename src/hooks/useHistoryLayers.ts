import { useEffect, useRef } from 'react';

export interface OverlayLayer {
  key: string;
  open: boolean;
  close: () => void;
}

// Browser back closes overlays LAYER BY LAYER instead of leaving the app. No router here, so we push
// one history entry while any overlay is open ("armed"); each Back closes the topmost layer and, if
// layers remain, re-pushes one entry so the next Back is captured too. Using only pushState + back()
// (never go(-n)) sidesteps the "one popstate per go()" browser quirk. Closing via the UI consumes our
// own entry silently; with nothing of ours open, Back behaves normally and leaves the page.
//
// `layers` are ordered base-first; the LAST open one is the topmost layer (closed first on Back).
// Extracted from App verbatim; returns the open keys (base-first) for callers that need them.
export function useHistoryLayers(layers: OverlayLayer[]): string[] {
  const openKeys = layers.filter(l => l.open).map(l => l.key);

  const openKeysRef = useRef<string[]>([]);
  openKeysRef.current = openKeys;
  // The closers, keyed — refreshed each render so popstate always invokes the latest closer.
  const closersRef = useRef<Record<string, () => void>>({});
  closersRef.current = Object.fromEntries(layers.map(l => [l.key, l.close]));

  // We keep at most ONE history entry while any overlay is open ("armed").
  const armedRef = useRef(false);
  const skipNextPopRef = useRef(false);
  const openKeysSig = openKeys.join('|');

  useEffect(() => {
    const count = openKeys.length;
    if (count > 0 && !armedRef.current) {
      window.history.pushState({ lsOverlay: true }, '');
      armedRef.current = true;
    } else if (count === 0 && armedRef.current) {
      // All overlays closed via the UI — silently consume our history entry.
      armedRef.current = false;
      skipNextPopRef.current = true;
      window.history.back();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKeysSig]);

  useEffect(() => {
    const onPop = () => {
      if (skipNextPopRef.current) { skipNextPopRef.current = false; return; } // our own back()
      const keys = openKeysRef.current;
      if (keys.length === 0) { armedRef.current = false; return; } // nothing of ours → let the browser go
      closersRef.current[keys[keys.length - 1]]?.(); // close ONLY the topmost layer
      if (keys.length - 1 > 0) {
        window.history.pushState({ lsOverlay: true }, ''); // layers remain → re-arm for the next Back
      } else {
        armedRef.current = false;
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return openKeys;
}
