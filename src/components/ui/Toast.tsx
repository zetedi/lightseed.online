import { useEffect, useRef, useState } from 'react';

// A quiet confirmation toast — the same voice and place as the "new version" toast
// (UpdateToast), for background work that deserves a visible "done": saves, flips,
// consecrations. Fire-and-forget: call notify('🌱 Saved.') from anywhere; the single
// ToastHost (mounted once in App) shows it briefly and fades.

let listener: ((message: string) => void) | null = null;

export const notify = (message: string): void => { listener?.(message); };

export const ToastHost = () => {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef(0);

  useEffect(() => {
    listener = (m: string) => {
      setMessage(m);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setMessage(null), 2600);
    };
    return () => { listener = null; window.clearTimeout(timer.current); };
  }, []);

  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4">
      <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2.5 shadow-xl animate-in fade-in slide-in-from-bottom-4">
        <span className="text-sm text-slate-700">{message}</span>
      </div>
    </div>
  );
};
