import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// Surfaces without the UpdateToast (the widget iframe, /model) would hold a WAITING service
// worker forever under prompt-style updates — there is no one to press Refresh inside a
// partner page's iframe, so the stale bundle kept seed panels blank white long after the fix
// shipped (found live, 2026-08-15). Here the swap is silent: activate and reload. The main
// shell keeps its polite prompt; silence is only for the surfaces that cannot ask.
export const SilentUpdate = () => {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  useEffect(() => {
    if (!needRefresh) return;
    updateServiceWorker(true).catch(() => {});
    // Belt and braces, mirroring UpdateToast: some browsers never fire controllerchange.
    const timer = window.setTimeout(() => window.location.reload(), 1500);
    return () => window.clearTimeout(timer);
  }, [needRefresh, updateServiceWorker]);
  return null;
};
