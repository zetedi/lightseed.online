import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './Icons';
import { SuperDot } from './SuperDot';

// THE ACTIONS MENU (ring 2026-09-27): one dropdown where a crowded hero row stood. A trigger
// pill in the theme's action colour opens a short list of the being's hands — each an icon, a
// word, and an optional amber dot when the hand acts by staff role. The list is PORTALED to
// the body and placed by the trigger's rect, so a hero's overflow clip and the section card
// that overlaps it can never cut it short (the phone lesson). Closes on a choice, outside, Esc,
// a scroll or a resize.
export interface MenuAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;   // the one red line at the bottom (Delete)
  staffDot?: boolean;
  active?: boolean;   // a toggled hand (Carrying…)
}

export const ActionsMenu = ({ label, actions, themeColor }: {
  label: string;
  actions: MenuAction[];
  /** A community-themed header may tint the trigger. */
  themeColor?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPlace({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('touchstart', away);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);
  if (actions.length === 0) return null;
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        style={themeColor ? { backgroundColor: themeColor } : undefined}
        className="btn-theme flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold shadow-sm ring-1 ring-white/25 transition-all"
      >
        <span>{label}</span> <Icons.Menu />
      </button>
      {open && place && createPortal(
        <div ref={listRef} role="menu" style={{ top: place.top, right: place.right }}
          className="fixed z-[70] min-w-[200px] max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl border border-slate-100 bg-white py-1 text-slate-800 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          {actions.map(a => (
            <button
              key={a.key}
              role="menuitem"
              type="button"
              disabled={a.disabled}
              title={a.title}
              onClick={() => { setOpen(false); a.onClick(); }}
              className={`relative flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium transition-colors disabled:opacity-50 ${
                a.danger ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
                : a.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <span className="[&>svg]:h-4 [&>svg]:w-4">{a.icon}</span>
              <span className="flex-1">{a.label}</span>
              {a.staffDot && <SuperDot />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
};
