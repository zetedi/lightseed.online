import { useSyncExternalStore } from 'react';

// THE PROFILE'S REQUESTED TAB (ring 2026-10-02): a door elsewhere in the shell — the envelope's
// invitation badge, an arrival through a tree invitation — may ask the profile to open on one of its
// tabs. One small store, the useCoin shape: the asker requests, the profile takes it once and clears.
let requested: { tab: string; n: number } | null = null;
let n = 0;
const listeners = new Set<() => void>();
export const requestProfileTab = (tab: string): void => {
  requested = { tab, n: ++n };
  listeners.forEach((l) => l());
};
export const clearProfileTab = (): void => { requested = null; };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useRequestedProfileTab = () => useSyncExternalStore(subscribe, () => requested, () => requested);
