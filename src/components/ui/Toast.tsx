import { useEffect, useRef, useState } from 'react';

// A confirmation toast — the visible "done" for background work (saves, flips, consecrations).
// Sits just below the header so an important result is seen, glows green when all is well and
// red when something failed. Fire-and-forget: notify('🌱 Saved.') or notify('Could not save.',
// 'error') from anywhere; the single ToastHost (mounted once in App) shows it briefly and fades.

export type ToastKind = 'success' | 'error';

let listener: ((message: string, kind: ToastKind) => void) | null = null;

export const notify = (message: string, kind: ToastKind = 'success'): void => { listener?.(message, kind); };

export const ToastHost = () => {
  const [toast, setToast] = useState<{ message: string; kind: ToastKind } | null>(null);
  const timer = useRef(0);

  useEffect(() => {
    listener = (message, kind) => {
      setToast({ message, kind });
      window.clearTimeout(timer.current);
      // Errors linger a touch longer — they usually ask the reader to do something.
      timer.current = window.setTimeout(() => setToast(null), kind === 'error' ? 4200 : 2800);
    };
    return () => { listener = null; window.clearTimeout(timer.current); };
  }, []);

  if (!toast) return null;
  const isError = toast.kind === 'error';
  return (
    // z-[99]: above modals (98) and the mobile menu (95) so a result is always seen, below
    // dialogs (100). Just below the header, centred.
    <div className="pointer-events-none fixed inset-x-0 top-24 z-[99] flex justify-center px-4">
      <div className={`flex items-center gap-2 rounded-full border px-5 py-2.5 shadow-xl animate-in fade-in slide-in-from-top-4 ${
        isError
          ? 'border-red-300 bg-red-50 text-red-700 shadow-[0_0_26px_rgba(239,68,68,0.55)]'
          : 'border-emerald-300 bg-emerald-50 text-emerald-800 shadow-[0_0_26px_rgba(16,185,129,0.55)]'
      }`}>
        <span className="text-sm font-semibold">{toast.message}</span>
      </div>
    </div>
  );
};
