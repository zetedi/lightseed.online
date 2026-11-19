import React from 'react';

// WHAT A LIST SAYS WHEN IT IS EMPTY — the dashed box, with or without an icon disc above the
// line. One shape wherever a section has nothing to show yet, so "nothing here" never looks
// like a broken panel.
export type EmptyTone = 'slate' | 'emerald' | 'amber' | 'sky';
const DISC: Record<EmptyTone, string> = {
    slate: 'bg-slate-100 dark:bg-slate-800',
    emerald: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40',
    amber: 'bg-amber-50 text-amber-500 dark:bg-amber-950/40',
    sky: 'bg-sky-50 text-sky-500 dark:bg-sky-950/40',
};
const PAD = { lg: 'p-10', md: 'p-8', sm: 'p-6' } as const;

export const EmptyState = ({ icon, tone = 'slate', hint, size = 'lg', className = '', extra, children }: {
    /** An icon for the disc above the line. */
    icon?: React.ReactNode;
    tone?: EmptyTone;
    /** A smaller second line: what the reader could do about it. */
    hint?: React.ReactNode;
    size?: keyof typeof PAD;
    className?: string;
    /** Anything that follows the words inside the box (a keeper's actions, a form). */
    extra?: React.ReactNode;
    /** The line itself. */
    children: React.ReactNode;
}) => (
    <div className={`rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 dark:border-slate-700 ${PAD[size]} ${className}`}>
        {icon && <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${DISC[tone]}`}>{icon}</div>}
        <p className="text-sm">{children}</p>
        {hint && <p className="mt-1 text-xs">{hint}</p>}
        {extra}
    </div>
);

// The same word for a grid: one centred line across every column (also the grid's "loading").
export const EmptyLine = ({ children }: { children: React.ReactNode }) => (
    <p className="col-span-full py-10 text-center text-slate-500">{children}</p>
);
