import React, { useEffect, useRef, useState } from 'react';
import { Icons } from './Icons';
import { SuperDot } from './SuperDot';

// THE ACTIONS MENU (ring 2026-09-27): one dropdown where a crowded hero row stood. A trigger
// pill in the band's voice opens a short list of the being's hands — each an icon, a word, and
// an optional amber dot when the hand acts by staff role. Closes on a choice, outside, or Esc.
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
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('touchstart', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  if (actions.length === 0) return null;
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        style={themeColor ? { backgroundColor: themeColor } : undefined}
        className="flex h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-3 text-xs font-bold text-white shadow-sm ring-1 ring-white/25 transition-all hover:brightness-110"
      >
        <Icons.Menu /> <span className="hidden sm:inline">{label}</span>
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}><Icons.ChevronDown size={14} /></span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 min-w-[190px] overflow-hidden rounded-2xl border border-slate-100 bg-white py-1 text-slate-800 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
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
        </div>
      )}
    </div>
  );
};
