import React from 'react';

/**
 * Shared UI primitives. Brand colors flow from the runtime theme via the
 * `*-theme` Tailwind tokens (see index.css `@theme`), so anything built from
 * these follows the active community/personal theme automatically.
 * Accessibility (focus-visible rings, aria on toggles, required labels on
 * icon-only buttons) is baked in.
 */

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-theme focus-visible:ring-offset-2';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary-theme text-white hover:opacity-90 shadow-sm',
  secondary: 'bg-secondary-theme text-white hover:opacity-90 shadow-sm',
  accent: 'bg-accent-theme text-white hover:opacity-90 shadow-sm',
  outline: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
};

const BUTTON_SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-sm gap-2',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  block?: boolean;
}

export const Button = ({ variant = 'primary', size = 'md', loading = false, icon, block, className = '', children, disabled, ...props }: ButtonProps) => (
  <button
    {...props}
    disabled={disabled || loading}
    className={`inline-flex items-center justify-center rounded-full font-bold uppercase tracking-wide transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${ring} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${block ? 'w-full' : ''} ${className}`}
  >
    {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" /> : icon}
    {children != null && <span className="truncate normal-case">{children}</span>}
  </button>
);

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required for accessibility — used as aria-label and tooltip. */
  label: string;
  size?: Size;
  tone?: 'neutral' | 'brand' | 'danger';
}

const ICONBTN_TONES = {
  neutral: 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white',
  brand: 'border-primary-theme/30 bg-primary-theme/10 text-primary-theme hover:bg-primary-theme hover:text-white',
  danger: 'border-red-400/50 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white',
};
const ICONBTN_SIZES: Record<Size, string> = { sm: 'p-1.5', md: 'p-2', lg: 'p-2.5' };

export const IconButton = ({ label, size = 'md', tone = 'neutral', className = '', children, ...props }: IconButtonProps) => (
  <button
    {...props}
    aria-label={label}
    title={label}
    className={`inline-flex items-center justify-center rounded-full border transition-colors ${ring} ${ICONBTN_TONES[tone]} ${ICONBTN_SIZES[size]} ${className}`}
  >
    {children}
  </button>
);

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'section';
}
export const Card = ({ as: Tag = 'div', className = '', children, ...props }: CardProps) => (
  <Tag {...props} className={`rounded-2xl border border-slate-100 bg-white shadow-sm ${className}`}>{children}</Tag>
);

type BadgeTone = 'brand' | 'neutral' | 'amber' | 'rose' | 'indigo' | 'emerald';
const BADGE_TONES: Record<BadgeTone, string> = {
  brand: 'bg-primary-theme/15 text-primary-theme border border-primary-theme/30',
  neutral: 'bg-slate-100 text-slate-600 border border-slate-200',
  amber: 'bg-amber-100 text-amber-700 border border-amber-200',
  rose: 'bg-rose-100 text-rose-700 border border-rose-200',
  indigo: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  emerald: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
};
export const Badge = ({ tone = 'neutral', className = '', children }: { tone?: BadgeTone; className?: string; children: React.ReactNode }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${BADGE_TONES[tone]} ${className}`}>{children}</span>
);

export const Toggle = ({ on, onChange, disabled, label }: { on: boolean; onChange: (next: boolean) => void; disabled?: boolean; label: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!on)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${ring} ${on ? 'bg-primary-theme' : 'bg-slate-300'}`}
  >
    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} aria-hidden="true" />
  </button>
);

export const Input = ({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 ${ring} ${className}`}
  />
);
