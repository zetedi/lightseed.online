import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// "A new version is ready" — shown when a fresh deploy's service worker is installed and
// waiting. Refresh activates it and reloads; Later keeps the current shell until next visit.
// Replaces the silent autoUpdate swap that made deploys look like they hadn't landed.
export const UpdateToast = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const [refreshing, setRefreshing] = useState(false);

  if (!needRefresh) return null;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await updateServiceWorker(true);
    } catch (e) {
      console.warn('SW update failed, hard-reloading', e);
    }
    // Belt and braces: if the worker swap didn't trigger the plugin's own reload (some
    // browsers never fire controllerchange here), force one — the new worker is active
    // by now and will serve the fresh shell.
    window.setTimeout(() => window.location.reload(), 1200);
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-full border border-emerald-200 bg-white px-4 py-2.5 shadow-xl animate-in fade-in slide-in-from-bottom-4">
        <span className="text-sm text-slate-700">🌱 A new version is ready.</span>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
        >
          {refreshing && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          disabled={refreshing}
          className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-600"
        >
          Later
        </button>
      </div>
    </div>
  );
};
